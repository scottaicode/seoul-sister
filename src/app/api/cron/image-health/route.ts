import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { runImageHealthRepair } from '@/lib/pipeline/image-health'

/**
 * POST /api/cron/image-health  (also GET — Vercel cron sends GET)
 *
 * Runs daily at 4 AM UTC (via vercel.json). Detects and repairs blank product
 * images, and — critically — LOGS what it can't fix so the otherwise-silent
 * dead-URL bug becomes visible (v10.3.5 fire-and-forget lesson).
 *
 * The dead-URL bug class: a product's image_url 404/403s at the brand origin
 * (Shopify/brand-direct/YesStyle drift), so it renders as a blank box with NO
 * error anywhere. Only a monitor like this surfaces it. See PRODUCT-IMAGE-HEALTH.md.
 *
 * Each run examines a bounded batch (network-bound: it reachability-checks
 * non-Olive-Young urls). A keyset cursor (last_id_examined, persisted in the
 * previous run's ss_pipeline_runs metadata) walks the catalog across runs and
 * wraps to the start when it reaches the end — so the whole catalog is swept
 * over a few days and re-swept continuously, catching newly-dead urls.
 *
 * Repair re-points to the product's OWN Olive Young image from ss_product_staging
 * (strict matcher — wrong-product discipline). Products with no staging match
 * stay blank and are reported in the run's metadata for the future live-scrape
 * backfill.
 *
 * Secured with CRON_SECRET header.
 */

export const maxDuration = 60

const EXAMINE_PER_RUN = 150

async function handler(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const startedAt = Date.now()

    // Read the cursor from the most recent image_health run.
    const { data: lastRun } = await db
      .from('ss_pipeline_runs')
      .select('metadata')
      .eq('run_type', 'image_health')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const cursor =
      ((lastRun?.metadata as Record<string, unknown> | null)?.last_id_examined as string | null) ?? null

    const result = await runImageHealthRepair(db, {
      limit: EXAMINE_PER_RUN,
      apply: true,
      afterId: cursor,
    })

    // If we examined nothing new past the cursor, we've reached the end — wrap to
    // the start on the next run so the sweep is continuous (re-detects new drift).
    const reachedEnd = result.scanned === 0 && cursor !== null
    const nextCursor = reachedEnd ? null : result.lastIdExamined

    const totalUnfixable = result.unfixableDead + result.unfixableNull

    await db.from('ss_pipeline_runs').insert({
      source: 'system',
      run_type: 'image_health',
      status: 'completed',
      products_scraped: result.scanned,
      products_processed: result.fixed,
      products_failed: totalUnfixable,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'daily_4am_utc',
        last_id_examined: nextCursor,
        wrapped: reachedEnd,
        dead_detected: result.deadDetected,
        null_detected: result.nullDetected,
        fixed: result.fixed,
        unfixable_dead: result.unfixableDead,
        unfixable_null: result.unfixableNull,
        stale_staging: result.staleStaging,
        // VISIBLE record of what couldn't be auto-fixed → feeds the future
        // live-scrape backfill. This is the anti-silent-failure surface.
        unfixable_sample: result.unfixableSample,
        duration_ms: Date.now() - startedAt,
      },
    })

    // Surface unfixable count in logs too (Vercel function logs), not just the DB.
    if (totalUnfixable > 0) {
      console.warn(
        `[image-health] examined ${result.scanned}, fixed ${result.fixed}, ` +
        `UNFIXABLE ${totalUnfixable} (dead:${result.unfixableDead} null:${result.unfixableNull}) — need live scrape`,
      )
    }

    return NextResponse.json({
      success: true,
      examined: result.scanned,
      fixed: result.fixed,
      dead_detected: result.deadDetected,
      null_detected: result.nullDetected,
      unfixable: totalUnfixable,
      stale_staging: result.staleStaging,
      wrapped: reachedEnd,
      next_cursor: nextCursor,
    })
  } catch (error) {
    console.error('[image-health] run failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    )
  }
}

export const POST = handler
export { handler as GET }
