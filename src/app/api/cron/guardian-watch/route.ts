import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { runHealthCheck } from '@/lib/guardian/healthcheck'

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
