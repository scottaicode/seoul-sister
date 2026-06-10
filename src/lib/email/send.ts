/**
 * Email transport — minimal Resend-via-fetch sender.
 *
 * Adapted from LGAAS's proven `utils/email-notifications.js` pattern (raw fetch
 * to the Resend API, no SDK dependency). Deterministic infrastructure: this
 * file only TRANSPORTS email. The CONTENT of a lead email is AI-generated in
 * Yuri's voice elsewhere (see `lib/email/lead-email.ts`) per the AI-First rule
 * that outward-facing communication is the model's voice, not a template.
 *
 * Gated on RESEND_API_KEY: if unset, sendEmail() is a graceful no-op that logs
 * what it WOULD have sent and returns { sent: false, reason: 'no_provider' }.
 * This lets the capture path ship before the sending domain is verified —
 * nothing breaks, and the lead is still recorded for later outreach.
 *
 * MANUAL SETUP (Scott-only, not automatable):
 *   1. Set RESEND_API_KEY in Vercel (Production).
 *   2. Verify a sending domain at resend.com and set EMAIL_FROM
 *      (e.g. "Yuri at Seoul Sister <yuri@seoulsister.com>").
 *   3. Set EMAIL_REPLY_TO (e.g. an inbox Scott actually checks) so visitor
 *      replies land somewhere instead of bouncing off the send-only
 *      yuri@ address. The Reply-To safety net (v10.13.3): yuri@seoulsister.com
 *      can SEND but has no inbox; without a Reply-To, a motivated lead who
 *      hits "reply" vanishes. Graceful: when unset, replies go to the
 *      from-address (current behavior) and a one-line warn surfaces in logs.
 *   Until 1+2 are done, sends no-op gracefully.
 */

export interface SendEmailResult {
  sent: boolean
  reason?: string
  error?: string
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Send one HTML email. Never throws — returns a result object.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: { from?: string; replyTo?: string } = {}
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from =
    options.from ||
    process.env.EMAIL_FROM ||
    'Yuri at Seoul Sister <yuri@seoulsister.com>'
  // Reply-To safety net: route visitor replies to a monitored inbox.
  // yuri@seoulsister.com is send-only — without this, replies vanish.
  const replyTo = options.replyTo || process.env.EMAIL_REPLY_TO

  // No provider configured — graceful no-op (don't break the capture path).
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY unset — would have sent to ${to}: "${subject}". ` +
        `Set RESEND_API_KEY + EMAIL_FROM in Vercel to enable sending.`
    )
    return { sent: false, reason: 'no_provider' }
  }

  if (!replyTo) {
    console.warn(
      '[email] EMAIL_REPLY_TO unset — replies to this email will go to the ' +
        'send-only from-address and be lost. Set EMAIL_REPLY_TO in Vercel.'
    )
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown')
      console.error(`[email] Resend send failed (${response.status}): ${errText}`)
      return { sent: false, error: `resend_${response.status}` }
    }

    return { sent: true }
  } catch (err) {
    console.error('[email] sendEmail threw:', err)
    return { sent: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

/**
 * Wrap body HTML in a minimal, mobile-friendly envelope.
 * This is transport chrome (deterministic) — NOT Yuri's voice. The voice lives
 * inside `bodyHtml`, which is AI-generated. Keep this wrapper plain so it never
 * competes with or constrains the generated content.
 */
export function wrapEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#2b2b2b;max-width:560px;margin:0 auto;padding:24px;">
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:28px 0 14px;">
<p style="font-size:12px;color:#999;margin:0;">Seoul Sister — your K-beauty intelligence advisor. You're receiving this because you chatted with Yuri at seoulsister.com. Not interested? Just ignore this and we won't follow up.</p>
</body>
</html>`
}
