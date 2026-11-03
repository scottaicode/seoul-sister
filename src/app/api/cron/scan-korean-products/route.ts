import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

export const maxDuration = 300

/** Stop starting new categories after this long, leaving room to write the run row. */
const TIME_BUDGET_MS = 230_000

/**
 * POST /api/cron/scan-korean-products
 *
 * Runs weekly, Mondays 6 AM UTC (via vercel.json). Weekly since Nov 3 2026: it adds
 * ~2 products/day from Olive Young Global, which stopped shipping to the US in May.
 * Incremental scrape: first 2-3 pages per Olive Young category to catch new arrivals.
 * Writes to ss_product_staging with status='pending'.
 * Skips products already in staging (UNIQUE constraint on source+source_id).
 *
 * Note: This cron job only scrapes LISTINGS (skip_details=true) because
 * detail pages take too long for Vercel's 60s cron timeout. The detail
 * enrichment is handled by the translate-and-index cron (7 AM UTC) or
 * manually via the admin API.
 *
 * Secured with CRON_SECRET header.
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const startedAt = new Date().toISOString()
    const startMs = Date.now()

    // Create pipeline run record
    const { data: run, error: runError } = await db
      .from('ss_pipeline_runs')
      .insert({
        source: 'olive_young',
        run_type: 'incremental',
        status: 'running',
        metadata: {
          trigger: 'cron',
          schedule: 'weekly_mon_6am_utc',
          mode: 'incremental',
          max_pages: 3,
          skip_details: true,
        },
      })
      .select('id')
      .single()

    if (runError || !run) {
      console.error('[cron:scan-korean-products] Failed to create pipeline run:', runError?.message)
      return NextResponse.json(
        { error: 'Failed to create pipeline run' },
        { status: 500 }
      )
    }

    // Import and run the Olive Young scraper in incremental mode
    // Using dynamic import to avoid loading Playwright at module level
    const { OliveYoungScraper } = await import('@/lib/pipeline/sources/olive-young')
    const scraper = new OliveYoungScraper({ delayMs: 2000 })

    try {
      // Rotate the starting category daily so a time budget never starves the same ones.
      const dayNumber = Math.floor(startMs / 86_400_000)
      const stats = await scraper.runScrape(db, run.id, {
        mode: 'incremental',
        maxPagesPerCategory: 3,
        skipDetails: true,
        deadlineAt: startMs + TIME_BUDGET_MS,
        startOffset: dayNumber,
      })

      // A run that scraped nothing is a failure, not a quiet day: the listing
      // pages always hold products. Writing 'completed' here hid months of
      // breakage; 'failed' is what the Guardian's pipeline check reads.
      const blocked = scraper.blockedCategories
      const failureReason = stats.scraped > 0
        ? null
        : blocked.length > 0 ? 'blocked_by_olive_young' : 'zero_results'
      if (failureReason) {
        console.error(`[cron:scan-korean-products] Run failed: ${failureReason} (blocked categories: ${blocked.length})`)
      }

      await db
        .from('ss_pipeline_runs')
        .update({
          status: failureReason ? 'failed' : 'completed',
          products_scraped: stats.scraped,
          products_duplicates: stats.duplicates,
          products_failed: stats.failed,
          completed_at: new Date().toISOString(),
          metadata: {
            trigger: 'cron',
            schedule: 'weekly_mon_6am_utc',
            mode: 'incremental',
            max_pages: 3,
            skip_details: true,
            new_products: stats.new,
            failure_reason: failureReason,
            blocked_categories: blocked,
            categories_skipped_for_time: scraper.categoriesSkippedForTime,
            errors: stats.errors.slice(-10),
          },
        })
        .eq('id', run.id)

      return NextResponse.json({
        success: !failureReason,
        failure_reason: failureReason,
        run_id: run.id,
        products_scraped: stats.scraped,
        new_products: stats.new,
        duplicates: stats.duplicates,
        failed: stats.failed,
        scanned_at: startedAt,
      })
    } catch (scrapeError) {
      // Mark run as failed
      await db
        .from('ss_pipeline_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          metadata: {
            trigger: 'cron',
            fatal_error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
          },
        })
        .eq('id', run.id)

      console.error('[cron:scan-korean-products] Scrape failed:', scrapeError)
      return NextResponse.json({
        success: false,
        run_id: run.id,
        error: 'Scrape failed',
        scanned_at: startedAt,
      })
    }
  } catch (error) {
    console.error('[cron:scan-korean-products] Error:', error)
    return NextResponse.json(
      { error: 'Failed to scan Korean products' },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
