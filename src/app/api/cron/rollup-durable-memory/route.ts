import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { rollupDurableCorrections } from '@/lib/yuri/durable-memory'

export const maxDuration = 60

/**
 * POST /api/cron/rollup-durable-memory  (also GET — Vercel cron sends GET)
 *
 * Weekly (Sundays 7 AM UTC via vercel.json). Consolidates every user's
 * decision_memory.corrections[] (which the Yuri context loader only reads from
 * the 3 most recent conversations) into the per-user durable store
 * ss_user_memory.durable_corrections — corrections are ground truth and must
 * persist past the recent-conversation window. Pure DB, no AI, negligible cost.
 *
 * LGAAS Blueprint 79 pattern. Cron (not inline-on-every-turn) for failure
 * isolation — a throw here can't take down a live Yuri conversation.
 *
 * Secured with CRON_SECRET header.
 */
async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startedAt = Date.now()
  try {
    const result = await rollupDurableCorrections()

    // Observability: record the run so a silent failure becomes visible
    // (v10.3.4 lesson — 3 months of memory was lost behind a fire-and-forget catch).
    const db = getServiceClient()
    await db.from('ss_pipeline_runs').insert({
      source: 'system',
      run_type: 'durable_memory_rollup',
      status: result.tableMissing ? 'failed' : 'completed',
      products_scraped: result.usersScanned,
      products_processed: result.usersUpdated,
      products_failed: result.errors,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'weekly_sun_7am_utc',
        corrections_promoted: result.correctionsPromoted,
        table_missing: result.tableMissing,
        duration_ms: Date.now() - startedAt,
      },
    }).then(({ error }) => {
      if (error) console.error('[rollup-durable-memory] run log insert failed:', error.message)
    })

    if (result.tableMissing) {
      console.warn('[rollup-durable-memory] ss_user_memory not applied yet — no-op')
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[rollup-durable-memory] failed:', err)
    return NextResponse.json({ error: 'rollup failed' }, { status: 500 })
  }
}

export const POST = handler
export { handler as GET }
