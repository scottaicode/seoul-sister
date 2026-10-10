import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { logPipelineRun } from '@/lib/pipeline/log-run'
import { findUnsettled, settleConversation, settleStateMigrated, MAX_SETTLE_ATTEMPTS } from '@/lib/intelligence/memory-settle'

export const maxDuration = 300

/** Upper bound on conversations per run; the backlog drains over a few hours. */
const BATCH_LIMIT = 10

/**
 * Stop STARTING new conversations after this long. Each settle is ~3 model
 * calls (~20-35s), so this leaves room for the one in flight plus the final
 * writes inside maxDuration. On Oct 10 2026 the first scheduled run settled 9
 * conversations and was killed at 300s before it wrote its run row — "ran" and
 * "never ran" looked identical. A count limit cannot bound wall-clock time.
 */
const TIME_BUDGET_MS = 200_000

/**
 * Written FIRST and updated at the end, so a run killed at maxDuration leaves a
 * 'running' row with no completed_at instead of no row at all.
 */
async function startRunRow(db: ReturnType<typeof getServiceClient>, startedAtIso: string): Promise<string | null> {
  const { data, error } = await db
    .from('ss_pipeline_runs')
    .insert({ source: 'system', run_type: 'settle_memory', status: 'running', started_at: startedAtIso, metadata: { phase: 'started' } })
    .select('id')
    .single()
  if (error) {
    console.error(`[settle-memory] could not write the started row: ${error.message}`)
    return null
  }
  return data.id as string
}

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
  const runId = await startRunRow(db, new Date(startedAt).toISOString())

  // Finish the started row; fall back to a fresh row if it could not be written.
  async function finishRun(entry: Parameters<typeof logPipelineRun>[1]) {
    if (runId) {
      const { error } = await db.from('ss_pipeline_runs').update(entry).eq('id', runId)
      if (!error) return
      console.error(`[settle-memory] could not finish run row ${runId}: ${error.message}`)
    }
    await logPipelineRun(db, entry)
  }

  try {
    // Without the settle-state columns (and the activity-only updated_at
    // trigger shipped in the same migration) a live settle would redo the same
    // AI work every hour AND bump old conversations to "most recent". Refuse
    // with one visible run row instead.
    if (!(await settleStateMigrated(db))) {
      await finishRun({
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
    let attempted = 0
    let deferredForTime = 0
    const errors: string[] = []
    for (const c of batch) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        deferredForTime = batch.length - attempted
        break
      }
      attempted++
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

    await finishRun({
      run_type: 'settle_memory',
      status: errors.length ? 'completed_with_errors' : 'completed',
      products_scraped: pending.length,
      products_processed: settled,
      products_failed: errors.length,
      completed_at: new Date().toISOString(),
      metadata: { phase: 'finished', unsettled: pending.length, attempted, settled, deferred_for_time: deferredForTime, gave_up: gaveUp ?? null, errors, duration_ms: Date.now() - startedAt },
    })
    return NextResponse.json({ success: true, unsettled: pending.length, attempted, settled, deferred_for_time: deferredForTime, errors })
  } catch (err) {
    console.error('[settle-memory] run failed:', err)
    await finishRun({
      run_type: 'settle_memory',
      status: 'failed',
      completed_at: new Date().toISOString(),
      metadata: { error: err instanceof Error ? err.message : String(err), duration_ms: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'settle run failed' }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
