/**
 * New-subscriber owner notification — built July 23 2026.
 * =======================================================
 * Closes a real gap surfaced by the FIRST paid subscriber (Kim Wells, Jul 21):
 * the Stripe webhook recorded the subscription but notified no one, so Scott
 * found out days later by accident. A paying customer is the single most
 * important event on the platform — he should hear about it immediately.
 *
 * Design (mirrors src/lib/guardian/alert.ts):
 *  - Provider is Resend via the existing raw-fetch sendEmail() — NO new SDK, ~$0
 *    (reuses RESEND_API_KEY + the verified sending domain).
 *  - Recipient in env (GUARDIAN_ALERT_EMAIL — the same owner inbox the Guardian
 *    already alerts; no new env to configure). Graceful no-op if unset (logs
 *    what it would have sent), same discipline as sendEmail().
 *  - Never throws. A notification failure must NEVER break the Stripe webhook —
 *    the caller awaits this only to log the result.
 *
 * AI-First: pure plumbing (deterministic send on a deterministic event —
 * a new active subscription). No model, no judgment.
 */

import { sendEmail, wrapEmailHtml } from '@/lib/email/send'

export interface NewSubscriberInfo {
  email: string | null
  plan: string
  tier: string
  /** 'widget' if attributed to a Yuri widget lead, else null (organic/direct/unknown). */
  leadSource: string | null
  amountDisplay?: string | null
}

export interface NotifyResult {
  sent: boolean
  reason?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email the owner that a new paid subscription just went active. Deterministic,
 * best-effort, never throws. Returns whether it sent so the caller can log it.
 */
export async function notifyNewSubscriber(info: NewSubscriberInfo): Promise<NotifyResult> {
  const to = process.env.GUARDIAN_ALERT_EMAIL
  const who = info.email ? escapeHtml(info.email) : 'unknown email'
  const source = info.leadSource
    ? `attributed to: ${escapeHtml(info.leadSource)}`
    : 'source: direct / organic (no widget lead matched)'

  if (!to) {
    console.warn(
      `[new-subscriber-alert] GUARDIAN_ALERT_EMAIL unset — would have notified: new ${info.tier} subscriber ${info.email ?? '(no email)'}, ${source}`
    )
    return { sent: false, reason: 'no_recipient' }
  }

  const subject = `🎉 New Seoul Sister subscriber: ${info.email ?? 'new customer'}`
  const amountLine = info.amountDisplay
    ? `<p style="margin:0 0 8px;">Plan: <strong>${escapeHtml(info.plan)}</strong> · ${escapeHtml(info.amountDisplay)}</p>`
    : `<p style="margin:0 0 8px;">Plan: <strong>${escapeHtml(info.plan)}</strong></p>`

  const html = wrapEmailHtml(
    `<p style="margin:0 0 12px;font-size:16px;">Someone just subscribed to Seoul Sister Pro. 💳</p>
<p style="margin:0 0 8px;">Customer: <strong>${who}</strong></p>
${amountLine}
<p style="margin:0 0 8px;color:#666;font-size:13px;">${source}</p>
<p style="margin:16px 0 0;color:#666;font-size:13px;">Subscription is now active. Full record is in ss_subscriptions.</p>`,
    `<p style="font-size:12px;color:#999;margin:0;">Seoul Sister · new-subscriber notification</p>`
  )

  try {
    const result = await sendEmail(to, subject, html)
    if (!result.sent) {
      console.error(`[new-subscriber-alert] send failed: ${result.error || result.reason}`)
    }
    return { sent: result.sent, reason: result.error || result.reason }
  } catch (err) {
    console.error('[new-subscriber-alert] threw:', err)
    return { sent: false, reason: 'threw' }
  }
}
