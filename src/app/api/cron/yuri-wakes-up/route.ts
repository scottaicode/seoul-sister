import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { logPipelineRun } from '@/lib/pipeline/log-run'
import { runYuriWakesUp } from '@/lib/proactive/run'

export const maxDuration = 300

const LEAD_BATCH_LIMIT = 8
/** 16:00 UTC = 9am Pacific / 11am Central: grading + the once-a-day lead phase. */
const DAILY_PHASE_UTC_HOUR = 16

/**
 * GET/POST /api/cron/yuri-wakes-up — Yuri reaches out first (Oct 9 2026).
 *
 * Hourly at :30 (vercel.json). Each run: grade matured sends (the teacher), let Yuri
 * judge each eligible subscriber (check-in or silence), then each eligible lead
 * (one re-engagement email ever, or silence). See src/lib/proactive/*.
 *
 * LIVE only when YURI_WAKES_UP_MODE=live. Otherwise the scheduled run writes a
 * run row with mode 'off' and does nothing else, so "disabled" is visible in
 * ss_pipeline_runs and never looks like "ran, nothing to send".
 *
 * DRY RUN (any mode, writes nothing, sends nothing):
 *   POST { "dry_run": true, "user_ids": [...], "lead_ids": [...],
 *          "assume_owner_approval": true, "bypass_daytime": true }
 * returns the exact subject + HTML each recipient would receive.
 *
 * Secured with CRON_SECRET (verifyCronAuth).
 */
async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const db = getServiceClient()
  const startedAt = Date.now()

  if (request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as {
      dry_run?: boolean
      user_ids?: string[]
      lead_ids?: string[]
      assume_owner_approval?: boolean
      bypass_daytime?: boolean
    }
    if (body.dry_run === true) {
      const result = await runYuriWakesUp(db, {
        dryRun: true,
        leadLimit: 5,
        onlyUserIds: Array.isArray(body.user_ids) ? body.user_ids : undefined,
        onlyLeadIds: Array.isArray(body.lead_ids) ? body.lead_ids : undefined,
        assumeOwnerApproval: body.assume_owner_approval === true,
        bypassDaytime: body.bypass_daytime === true,
      })
      return NextResponse.json({ ...result, duration_ms: Date.now() - startedAt })
    }
  }

  const mode = process.env.YURI_WAKES_UP_MODE === 'live' ? 'live' : 'off'
  if (mode === 'off') {
    // One "off" row a day (at the daily phase hour), not 24: enough to show the
    // job is scheduled and disabled, without flooding ss_pipeline_runs.
    if (new Date().getUTCHours() !== DAILY_PHASE_UTC_HOUR) {
      return NextResponse.json({ success: true, mode, logged: false })
    }
    await logPipelineRun(db, {
      run_type: 'yuri_wakes_up',
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: { mode, note: 'YURI_WAKES_UP_MODE is not "live"; no judgments made, nothing sent' },
    })
    return NextResponse.json({ success: true, mode })
  }

  try {
    // Hourly, so every timezone's 9am-8pm local window is reachable for a
    // subscriber (once per local day: the daily unique index + judged_recently).
    // Grading and leads (no timezone) run once a day, at DAILY_PHASE_UTC_HOUR.
    const daily = new Date().getUTCHours() === DAILY_PHASE_UTC_HOUR
    const result = await runYuriWakesUp(db, {
      dryRun: false,
      leadLimit: LEAD_BATCH_LIMIT,
      phases: { grade: daily, subscribers: true, leads: daily },
    })
    const hadErrors = result.errors.length > 0 || result.grading.errors > 0
    const { renders: _renders, ...summary } = result
    await logPipelineRun(db, {
      run_type: 'yuri_wakes_up',
      status: hadErrors ? 'completed_with_errors' : 'completed',
      products_scraped: result.subscribers.scanned + result.leads.considered,
      products_processed: result.subscribers.speak + result.leads.sent,
      products_failed: result.errors.length,
      completed_at: new Date().toISOString(),
      metadata: { mode, ...summary, duration_ms: Date.now() - startedAt },
    })
    if (hadErrors) console.warn('[yuri-wakes-up] completed with errors', result.errors)
    return NextResponse.json({ success: true, mode, ...summary })
  } catch (err) {
    console.error('[yuri-wakes-up] run failed:', err)
    await logPipelineRun(db, {
      run_type: 'yuri_wakes_up',
      status: 'failed',
      completed_at: new Date().toISOString(),
      metadata: { mode, error: err instanceof Error ? err.message : String(err), duration_ms: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'run failed' }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
