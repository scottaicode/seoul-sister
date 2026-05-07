import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

/**
 * POST /api/cron/retry-enrichment-queue
 *
 * Runs monthly on the 1st at 4:30 AM UTC (via vercel.json).
 *
 * Retries enrichment for products that the stub-enrichment script could not
 * confidently process (low Sonnet confidence, wrong-product-page mismatch,
 * weak Incidecoder coverage). Incidecoder coverage grows over time, so
 * today's 0.40-confidence skip might be tomorrow's 0.95-confidence success.
 *
 * Strategy:
 *   1. Fetch entries where status='pending' AND retry_after <= NOW() AND retry_count < 6
 *   2. For each: re-run Brave + Incidecoder + Sonnet pipeline
 *   3. If new confidence >= 0.7: insert links, mark queue 'resolved'
 *   4. If still <0.7: increment retry_count, push retry_after another 30 days
 *   5. After 6 failed retries (~6 months): mark 'permanent_skip'
 *
 * Current implementation: PLACEHOLDER. Logs what would be retried but does
 * not run enrichment yet — that requires extracting the Brave+Incidecoder+
 * Sonnet pipeline from scripts/enrich-stub-products.ts into a shared module.
 *
 * The placeholder is safe to deploy: it just reads the queue and logs counts.
 * The first batch isn't due until June 6 2026 (30-day retry_after on the
 * May 7 backfill), giving us a full month to do the refactor properly.
 *
 * TODO(post-launch): Refactor scripts/enrich-stub-products.ts to extract
 *   pipeline helpers into src/lib/pipeline/stub-enrichment.ts, then wire
 *   them in here.
 *
 * Secured with CRON_SECRET header.
 */

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const startedAt = Date.now()

    // Find entries due for retry
    const { data: dueEntries, error: queryError } = await db
      .from('ss_enrichment_review_queue')
      .select('id, product_id, retry_count, source_url, confidence')
      .eq('status', 'pending')
      .lte('retry_after', new Date().toISOString())
      .lt('retry_count', 6)
      .limit(50) // budget: 50 retries per monthly run, ~$0.80 cost

    if (queryError) {
      console.error('[cron:retry-enrichment-queue] Query error:', queryError)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    const due = dueEntries || []
    console.log(`[cron:retry-enrichment-queue] ${due.length} entries due for retry`)

    // PLACEHOLDER: Log what would be retried, don't actually do it yet.
    // Real retry logic requires extracting the enrichment pipeline into a
    // shared module — TODO above.
    const placeholderLog = due.map(e => ({
      product_id: e.product_id,
      retry_count: e.retry_count,
      previous_confidence: e.confidence,
    }))

    return NextResponse.json({
      success: true,
      placeholder: true,
      due_count: due.length,
      sample: placeholderLog.slice(0, 10),
      duration_ms: Date.now() - startedAt,
      processed_at: new Date().toISOString(),
      note: 'Placeholder cron. Live retry pipeline pending pipeline-helper refactor. See route file TODO.',
    })
  } catch (error) {
    console.error('[cron:retry-enrichment-queue] Error:', error)
    return NextResponse.json(
      { error: 'Failed to retry enrichment queue' },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
