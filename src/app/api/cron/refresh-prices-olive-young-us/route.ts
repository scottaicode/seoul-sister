import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { runOliveYoungUsRefresh, decideRefreshStatus } from '@/lib/pipeline/olive-young-us-refresh'
import { logPipelineRun } from '@/lib/pipeline/log-run'

/**
 * GET/POST /api/cron/refresh-prices-olive-young-us — monthly (Oct 21 2026).
 *
 * Keeps the Olive Young US prices matched by scripts/match-olive-young-us.ts
 * roughly current. Policy is rough US prices, not exact tracking, so monthly is
 * enough; Yuri already flags any price older than 14 days with its age.
 * Vercel cron sends GET, so both are exported (a POST-only cron 405'd silently
 * for six days in July).
 */

export const maxDuration = 300
const BUDGET_MS = 270_000

async function handler(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError
    const db = getServiceClient()
    const startedAt = Date.now()

    const result = await runOliveYoungUsRefresh(db, { budgetMs: BUDGET_MS })
    const { status, reason } = decideRefreshStatus(result)
    const failed = status === 'failed'

    if (failed) {
      console.error('[refresh-prices-olive-young-us] FAILED', result)
    }

    await logPipelineRun(db, {
      run_type: 'price_refresh_olive_young_us',
      status,
      source: 'olive_young',
      products_scraped: result.scanned,
      products_processed: result.updated,
      products_failed: result.fetchFailed + result.unparseable,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'monthly_3rd_7am_utc',
        ...result,
        failure_reason: reason,
        duration_ms: Date.now() - startedAt,
      },
    })

    return NextResponse.json({ success: !failed, ...result })
  } catch (error) {
    console.error('[refresh-prices-olive-young-us] run failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

export const POST = handler
export { handler as GET }
