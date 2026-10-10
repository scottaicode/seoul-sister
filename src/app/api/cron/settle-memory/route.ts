import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { logPipelineRun } from '@/lib/pipeline/log-run'
import { findUnsettled, settleConversation, settleStateMigrated, MAX_SETTLE_ATTEMPTS } from '@/lib/intelligence/memory-settle'

export const maxDuration = 300

/** Conversations settled per run; the backlog drains over a few hours. */
const BATCH_LIMIT = 10

/**
 * GET /api/cron/settle-memory — hourly. Re-runs summary, then decision memory,
 * then treatment-phase extraction on conversations that have gone quiet since
 * they were last settled (src/lib/intelligence/memory-settle.ts). External users
 * first; failures back off and give up after MAX_SETTLE_ATTEMPTS (counted here).
 * Writes a run row every invocation, including "0 unsettled", so a clean
 * result is distinguishable from a dead job.
 */
async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError
  const db = getServiceClient()
  const startedAt = Date.now()

  try {
    // Without the settle-state columns (and the activity-only updated_at
    // trigger shipped in the same migration) a live settle would redo the same
    // AI work every hour AND bump old conversations to "most recent". Refuse
    // with one visible run row instead.
    if (!(await settleStateMigrated(db))) {
      await logPipelineRun(db, {
        run_type: 'settle_memory',
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: { error: 'migration 20261010000001/20261010000002 missing; settle refused (no AI work done)', duration_ms: Date.now() - startedAt },
      })
      return NextResponse.json({ error: 'migration 20261010000001/20261010000002 missing' }, { status: 503 })
    }

    const pending = await findUnsettled(db)
    const batch = pending.slice(0, BATCH_LIMIT)
    const { data: profiles, error: pErr } = await db
      .from('ss_user_profiles')
      .select('user_id, timezone')
      .in('user_id', batch.length ? [...new Set(batch.map((c) => c.userId))] : ['00000000-0000-0000-0000-000000000000'])
    if (pErr) throw new Error(`profile load: ${pErr.message}`)
    const tz = new Map((profiles ?? []).map((p) => [p.user_id as string, (p.timezone as string | null) ?? null]))

    let settled = 0
    const errors: string[] = []
    for (const c of batch) {
      const r = await settleConversation(db, c, { timezone: tz.get(c.userId) ?? null })
      if (r.applied) settled++
      else errors.push(`${c.id.slice(0, 8)}: ${r.errors.join('; ')}`)
    }

    // Conversations that exhausted their attempts are skipped by findUnsettled;
    // count them here so "given up" is visible, never silent.
    const { count: gaveUp, error: gErr } = await db
      .from('ss_yuri_conversations')
      .select('id', { count: 'exact', head: true })
      .gte('memory_settle_attempts', MAX_SETTLE_ATTEMPTS)
    if (gErr) errors.push(`gave-up count: ${gErr.message}`)

    await logPipelineRun(db, {
      run_type: 'settle_memory',
      status: errors.length ? 'completed_with_errors' : 'completed',
      products_scraped: pending.length,
      products_processed: settled,
      products_failed: errors.length,
      completed_at: new Date().toISOString(),
      metadata: { unsettled: pending.length, attempted: batch.length, settled, gave_up: gaveUp ?? null, errors, duration_ms: Date.now() - startedAt },
    })
    return NextResponse.json({ success: true, unsettled: pending.length, attempted: batch.length, settled, errors })
  } catch (err) {
    console.error('[settle-memory] run failed:', err)
    await logPipelineRun(db, {
      run_type: 'settle_memory',
      status: 'failed',
      completed_at: new Date().toISOString(),
      metadata: { error: err instanceof Error ? err.message : String(err), duration_ms: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'settle run failed' }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
