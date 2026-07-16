/**
 * Guardian push/email alerting — DEFERRED FEATURE 1, built July 15 2026.
 * =====================================================================
 * Closes the gap the always-on watcher left: a `critical` verdict (or a
 * bounced lead) was recorded to ss_pipeline_runs.metadata + Vercel logs 24/7
 * but never actively reached Scott. If something trips at 3am with his machine
 * off, he wouldn't know until back at the keyboard. This emails him.
 *
 * Design (per GUARDIAN-CHARTER.md DEFERRED FEATURE 1):
 *  - Provider is Resend, via the existing raw-fetch sendEmail() — NO new SDK,
 *    ~$0 (reuses RESEND_API_KEY + the verified sending domain).
 *  - Alert-worthy = overall `critical` OR a lead recap bounced/failed
 *    (Scott's choice July 15 2026: lead bounces are rare + high-value, so they
 *    earn an exception to the charter's warn=log-only rule; all other warns
 *    stay log-only to avoid alert fatigue).
 *  - DE-DUPE against the prior run's metadata: don't re-email the SAME
 *    unresolved condition every run (3×/day would be spam). Only alert when the
 *    set of alert-worthy signal keys CHANGES vs the last run that alerted.
 *  - Recipient in env (GUARDIAN_ALERT_EMAIL), never hardcoded. Graceful no-op
 *    if unset (logs what it would have sent) — same discipline as sendEmail().
 *
 * AI-First: pure plumbing (deterministic send on a deterministic condition).
 * No model, no judgment.
 */

import { sendEmail, wrapEmailHtml } from '@/lib/email/send'
import type { HealthReport, Signal } from './healthcheck'

/** Signal keys that alert even at `warn` severity (the lead-bounce exception). */
const WARN_ALERTING_KEYS = new Set(['lead_recap_delivery_7d'])

/**
 * Decide which signals are alert-worthy for THIS report:
 *  - any critical signal, OR
 *  - a WARN_ALERTING_KEYS signal that is actually warn/critical AND reports a
 *    real failure (its detail.failed_count > 0 — a healthy 'info' lead signal
 *    is not alert-worthy).
 */
export function alertWorthySignals(report: HealthReport): Signal[] {
  return report.signals.filter((s) => {
    if (s.severity === 'critical') return true
    // The lead-bounce exception: this key alerts at warn too, but only when it
    // reports a real failure (failed_count > 0 — a healthy 'info' lead signal,
    // or a warn with 0 failures, is not alert-worthy).
    if (s.severity === 'warn' && WARN_ALERTING_KEYS.has(s.key)) {
      const failed = (s.detail?.failed_count as number | undefined) ?? 0
      return failed > 0
    }
    return false
  })
}

/** Stable signature of the current alert set — used to de-dupe across runs. */
function alertSignature(signals: Signal[]): string {
  return signals
    .map((s) => s.key)
    .sort()
    .join('|')
}

export interface AlertDecision {
  shouldAlert: boolean
  reason: 'no_alert_worthy' | 'same_as_last_alert' | 'new_or_changed'
  signature: string
  signals: Signal[]
}

/**
 * Decide whether to send an alert, de-duping against the last run that alerted.
 * `priorSignature` is the alert signature stored on the most recent prior
 * guardian-watch run that itself alerted (null if none / never alerted).
 */
export function decideAlert(report: HealthReport, priorSignature: string | null): AlertDecision {
  const signals = alertWorthySignals(report)
  const signature = alertSignature(signals)

  if (signals.length === 0) {
    return { shouldAlert: false, reason: 'no_alert_worthy', signature, signals }
  }
  if (signature === priorSignature) {
    // Same unresolved condition as last time we alerted — stay quiet.
    return { shouldAlert: false, reason: 'same_as_last_alert', signature, signals }
  }
  return { shouldAlert: true, reason: 'new_or_changed', signature, signals }
}

/** Build the digest email (deterministic transport chrome — not Yuri's voice). */
function buildAlertEmail(report: HealthReport, signals: Signal[]): { subject: string; html: string } {
  const hasCritical = signals.some((s) => s.severity === 'critical')
  const leadIssue = signals.some((s) => WARN_ALERTING_KEYS.has(s.key))
  const subjectBits: string[] = []
  if (hasCritical) subjectBits.push(`${signals.filter((s) => s.severity === 'critical').length} critical`)
  if (leadIssue) subjectBits.push('lead delivery')
  const subject = `Seoul Sister Guardian: ${subjectBits.join(' + ')} needs a look`

  const rows = signals
    .map((s) => {
      const detail = s.detail ? `<div style="color:#666;font-size:13px;margin-top:2px;">${escapeHtml(JSON.stringify(s.detail))}</div>` : ''
      return `<li style="margin-bottom:12px;"><strong>[${s.severity.toUpperCase()}]</strong> ${escapeHtml(s.summary)}${detail}</li>`
    })
    .join('')

  const html = wrapEmailHtml(
    `<p style="margin:0 0 12px;">The Guardian watcher flagged something that needs your attention.</p>
<p style="margin:0 0 8px;color:#666;font-size:13px;">Overall: <strong>${report.overall.toUpperCase()}</strong> · checked ${report.signals.length} signals · ${new Date(report.generated_at).toUTCString()}</p>
<ul style="padding-left:18px;margin:12px 0;">${rows}</ul>
<p style="margin:16px 0 0;color:#666;font-size:13px;">This is a notification, not an action taken. Full verdict is in ss_pipeline_runs.metadata; run <code>/guardian-run</code> for the reasoning pass.</p>`,
    `<p style="font-size:12px;color:#999;margin:0;">Seoul Sister Guardian · automated health alert · critical + lead-delivery only</p>`
  )
  return { subject, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface SendAlertResult {
  sent: boolean
  reason?: string
  signature: string
}

/**
 * Send the Guardian alert email if warranted (deterministic). Never throws —
 * alerting must never break the watcher. Returns the signature so the caller
 * can persist it for next-run de-dupe.
 */
export async function maybeSendGuardianAlert(
  report: HealthReport,
  priorSignature: string | null
): Promise<SendAlertResult> {
  const decision = decideAlert(report, priorSignature)
  if (!decision.shouldAlert) {
    return { sent: false, reason: decision.reason, signature: decision.signature }
  }

  const to = process.env.GUARDIAN_ALERT_EMAIL
  if (!to) {
    console.warn(
      `[guardian-alert] GUARDIAN_ALERT_EMAIL unset — would have alerted: ${decision.signals
        .map((s) => `[${s.severity}] ${s.summary}`)
        .join('; ')}`
    )
    return { sent: false, reason: 'no_recipient', signature: decision.signature }
  }

  try {
    const { subject, html } = buildAlertEmail(report, decision.signals)
    const result = await sendEmail(to, subject, html)
    if (!result.sent) {
      console.error(`[guardian-alert] send failed: ${result.error || result.reason}`)
    }
    return { sent: result.sent, reason: result.error || result.reason, signature: decision.signature }
  } catch (err) {
    console.error('[guardian-alert] threw:', err)
    return { sent: false, reason: 'threw', signature: decision.signature }
  }
}
