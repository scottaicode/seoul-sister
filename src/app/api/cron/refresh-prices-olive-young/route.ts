import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { runOliveYoungPriceRefresh } from '@/lib/pipeline/olive-young-price-refresh'
import { logPipelineRun } from '@/lib/pipeline/log-run'

/**
 * POST /api/cron/refresh-prices-olive-young  (also GET — Vercel cron sends GET)
 *
 * Refreshes Olive Young prices, which are ~96% of the catalog's price data and
 * had NO refresher until now (diagnosed Jul 6 2026 — the `scan-korean-products`
 * cron is a product scraper, not a price refresher, so 4,908 OY prices sat frozen
 * at Apr 7 for ~3 months). This closes that gap.
 *
 * A keyset cursor over `last_checked` (persisted in the previous run's
 * ss_pipeline_runs metadata) walks the OY catalog STALEST-FIRST across runs and
 * wraps to the start when it reaches the end — so the whole catalog refreshes on
 * a rolling cycle and then re-refreshes continuously. Same pattern as image-health.
 *
 * Playwright is ~5-10s/page, so the batch is small and a hard time budget stops
 * the run cleanly before the Vercel timeout. Secured with CRON_SECRET.
 */

export const maxDuration = 300 // Vercel Pro budget — Playwright is slow per page

const REFRESH_PER_RUN = 40
const BUDGET_MS = 270_000 // stop scraping with headroom before the 300s wall

async function handler(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const startedAt = Date.now()

    // Read the cursor (a `last_checked` ISO string) from the most recent run.
    const { data: lastRun } = await db
      .from('ss_pipeline_runs')
      .select('metadata')
      .eq('run_type', 'price_refresh_olive_young')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const cursor =
      ((lastRun?.metadata as Record<string, unknown> | null)?.last_checked_cursor as string | null) ?? null

    const result = await runOliveYoungPriceRefresh(db, {
      limit: REFRESH_PER_RUN,
      afterCheckedAt: cursor,
      budgetMs: BUDGET_MS,
    })

    // Wrap on the SWEEP phase specifically: if the long-tail sweep found nothing
    // past the cursor, reset to the start next run (a run can still have scanned
    // popular phase-1 rows, so we key on sweptCount, not scanned).
    const reachedEnd = result.sweptCount === 0 && cursor !== null
    const nextCursor = reachedEnd ? null : result.lastCheckedCursor

    await logPipelineRun(db, {
      run_type: 'price_refresh_olive_young',
      status: 'completed',
      source: 'olive_young',
      products_scraped: result.scanned,
      products_processed: result.updated,
      products_failed: result.fetchFailed + result.unscrapeable,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'daily_9pm_utc',
        last_checked_cursor: nextCursor,
        wrapped: reachedEnd,
        updated: result.updated,
        price_changes: result.priceChanges,
        fetch_failed: result.fetchFailed,
        unscrapeable: result.unscrapeable,
        duration_ms: Date.now() - startedAt,
      },
    })

    return NextResponse.json({
      success: true,
      examined: result.scanned,
      updated: result.updated,
      price_changes: result.priceChanges,
      fetch_failed: result.fetchFailed,
      unscrapeable: result.unscrapeable,
      wrapped: reachedEnd,
      next_cursor: nextCursor,
    })
  } catch (error) {
    console.error('[refresh-prices-olive-young] run failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    )
  }
}

export const POST = handler
export { handler as GET }
