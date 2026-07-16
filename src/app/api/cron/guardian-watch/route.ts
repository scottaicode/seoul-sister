import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { runHealthCheck } from '@/lib/guardian/healthcheck'
import { maybeSendGuardianAlert } from '@/lib/guardian/alert'

export const maxDuration = 60

/**
 * GET/POST /api/cron/guardian-watch
 *
 * The ALWAYS-ON Guardian watcher (v10.13.0). Server-side, runs on Vercel cron
 * independent of any open Claude session — this is the piece that closes the
 * "3am incident while the laptop is off" gap.
 *
 * It is a CHEAP, DETERMINISTIC watcher — zero AI tokens. It runs the shared
 * read-only health probe (`runHealthCheck`) and:
 *   - persists the full verdict to ss_pipeline_runs.metadata (durable, queryable)
 *   - console.warn's a one-line alert when overall severity is warn/critical
 *     (visible in Vercel logs — the v10.3.5 visibility pattern every cron uses)
 *
 * It does NOT reason, fix, or write to the learning corpus. Per
 * GUARDIAN-CHARTER.md, autonomous *fixing* is a separate, Scott-approved layer
 * that only graduates after the report-only week. This watcher's job is to make
 * trouble VISIBLE 24/7, not to act on it. When a future escalation layer exists,
 * a warn/critical verdict here is its trigger.
 *
 * Secured with CRON_SECRET (verifyCronAuth).
 */
async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startedAt = Date.now()
  const db = getServiceClient()

  try {
    const report = await runHealthCheck(db)

    // Push/email alerting (DEFERRED FEATURE 1, built Jul 15 2026). De-dupe
    // against the last run that alerted: read its stored alert_signature so we
    // don't re-email the same unresolved condition every run. Alert-worthy =
    // critical OR a bounced/failed lead recap (all other warns stay log-only).
    let alertSignature = ''
    let alertSent = false
    try {
      const { data: priorRuns } = await db
        .from('ss_pipeline_runs')
        .select('metadata')
        .eq('source', 'guardian-watch')
        .order('started_at', { ascending: false })
        .limit(1)
      // De-dupe against the IMMEDIATELY preceding run's alert set (empty string
      // included). Alert only when the set CHANGES run-over-run: a condition
      // that clears (prev='' ) and re-appears correctly re-alerts, and a
      // persistent condition (same signature two runs running) stays quiet.
      const priorMeta = (priorRuns?.[0]?.metadata ?? null) as Record<string, unknown> | null
      const priorSignature =
        typeof priorMeta?.alert_signature === 'string' ? priorMeta.alert_signature : null
      const alertResult = await maybeSendGuardianAlert(report, priorSignature)
      alertSignature = alertResult.signature
      alertSent = alertResult.sent
      if (alertResult.sent) {
        console.warn(`[guardian-watch] ALERT EMAILED — signature: ${alertResult.signature}`)
      }
    } catch (alertErr) {
      // Alerting must never break the watcher.
      console.error('[guardian-watch] alert step failed:', alertErr)
    }

    // Surface warn/critical to Vercel logs (the visible-alert mechanism).
    if (report.overall === 'critical' || report.overall === 'warn') {
      const flagged = report.signals
        .filter((s) => s.severity === 'warn' || s.severity === 'critical')
        .map((s) => `[${s.severity}] ${s.summary}`)
      console.warn(
        `[guardian-watch] ${report.overall.toUpperCase()} — ${report.counts.critical} critical, ` +
          `${report.counts.warn} warn:\n  ${flagged.join('\n  ')}`
      )
    } else {
      console.log(`[guardian-watch] nominal (${report.overall}) — ${report.signals.length} signals checked`)
    }

    // Persist the verdict durably so the next Claude /guardian-run (or Scott)
    // can read the watcher's history without re-querying everything.
    const { error: logErr } = await db.from('ss_pipeline_runs').insert({
      source: 'guardian-watch',
      run_type: 'reprocess', // CHECK-allowed value reused (no migration); semantically a health pass
      status: 'completed',
      metadata: {
        guardian: true,
        overall: report.overall,
        counts: report.counts,
        signals: report.signals,
        duration_ms: Date.now() - startedAt,
        // Alert de-dupe: the signature of the alert-worthy signal set, and
        // whether an email actually went out this run. The next run reads the
        // most recent non-empty alert_signature to avoid re-alerting the same
        // unresolved condition. Empty string = nothing alert-worthy this run.
        alert_signature: alertSignature,
        alert_sent: alertSent,
      },
      started_at: new Date(startedAt).toISOString(),
      completed_at: new Date().toISOString(),
    })
    if (logErr) console.error('[guardian-watch] verdict log insert failed:', logErr.message)

    return NextResponse.json({
      ok: true,
      overall: report.overall,
      counts: report.counts,
      duration_ms: Date.now() - startedAt,
    })
  } catch (err) {
    console.error('[guardian-watch] failed:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
