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

export const maxDuration = 300 // Vercel Pro budget

// Batch size 40 -> 400 (Aug 15 2026). The old cap existed because Playwright
// cost ~5-10s/page; the price now comes from a single JSON fetch at ~0.3s, so
// the same wall-clock budget covers an order of magnitude more rows. At 400/run
// the ~4,900-row OY catalog cycles in ~12 days instead of ~4 months — which is
// what makes "our prices are roughly current" true rather than aspirational.
// The BUDGET_MS guard still stops the run cleanly if the endpoint slows down.
const REFRESH_PER_RUN = 400
const BUDGET_MS = 270_000 // stop with headroom before the 300s wall

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

    // A run that examined rows and refreshed NONE is a FAILED run, not a
    // completed one.
    //
    // Earned expensively (found Aug 15 2026, ~130 nights late). This route
    // hardcoded `status: 'completed'` and shipped it every night while the
    // Olive Young detail scraper returned a price for zero of 40 products —
    // `scanned: 40, updated: 0, fetchFailed: 40`, every single run since ~Jul 6.
    // Meanwhile 99.4% of OY prices sat frozen at Apr 7 and Yuri quoted six of
    // them to a real buyer as current.
    //
    // Two separate things failed to catch it, and both are worth naming:
    //
    //   1. The library's tripwire (olive-young-price-refresh.ts, "examined N
    //      rows but updated 0") fired correctly all 130 nights — to console.warn.
    //      Nobody reads Vercel logs. A log line is not observability.
    //   2. The Guardian's zero-result check (guardian/healthcheck.ts) only looks
    //      at `products_scraped === 0`. This run scrapes 40 happily and writes
    //      nothing, so it slipped every net while reporting success.
    //
    // Writing 'failed' is what makes it VISIBLE: the Guardian's 48h pipeline
    // check keys on `status === 'failed'`, which escalates to the alert email.
    // This is the CLAUDE.md silent-failure rule applied to our own cron — a
    // clean result and a dead component must not leave identical DB state.
    // `delisted` rows are excluded: a batch that legitimately consisted of
    // products Olive Young no longer carries updated nothing, and nothing is
    // broken. Counting those as failure would train the alert to be ignored.
    const refreshedNothing =
      result.scanned > 0 && result.updated === 0 && result.delisted < result.scanned
    if (refreshedNothing) {
      console.error(
        `[refresh-prices-olive-young] FAILED — examined ${result.scanned} rows, updated 0 ` +
          `(fetchFailed=${result.fetchFailed}, unscrapeable=${result.unscrapeable}). ` +
          `Olive Young detail pages are likely no longer yielding a price.`
      )
    }

    await logPipelineRun(db, {
      run_type: 'price_refresh_olive_young',
      status: refreshedNothing ? 'failed' : 'completed',
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
        delisted: result.delisted,
        duration_ms: Date.now() - startedAt,
        refreshed_nothing: refreshedNothing,
      },
    })

    return NextResponse.json({
      success: !refreshedNothing,
      examined: result.scanned,
      updated: result.updated,
      price_changes: result.priceChanges,
      fetch_failed: result.fetchFailed,
      unscrapeable: result.unscrapeable,
      delisted: result.delisted,
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
