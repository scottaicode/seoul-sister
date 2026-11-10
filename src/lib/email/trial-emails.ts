import { sendEmail, wrapEmailHtml } from './send'
import { escapeHtml } from './html'
import { PRICING } from '@/lib/pricing'

/**
 * Sent when a free trial ends with nothing paid (Nov 10 2026). Until now the
 * only sign a trial had ended was being sent to the membership page. Plain,
 * factual, fixed wording: nothing was charged, what is kept, how to continue.
 * No urgency and no offer; it states what is true.
 */
export function buildTrialEndedEmail(): { subject: string; html: string } {
  const price = escapeHtml(PRICING.monthly_display_long)
  const html = wrapEmailHtml(
    `<p>Your ${PRICING.trial_days}-day free trial of Seoul Sister has ended.</p>
<p><strong>Nothing was charged</strong>, and nothing will be: no card was on file.</p>
<p>Your account, your skin profile and everything you worked out with Yuri are saved.</p>
<p>If you would like to keep going, membership is ${price}. You can start it any time at <a href="https://www.seoulsister.com/subscribe">seoulsister.com/subscribe</a>, and Yuri picks up from where you left off. If not, there is nothing you need to do.</p>`,
    `<p style="font-size:12px;color:#999;margin:0;">You're receiving this because you started a free trial at seoulsister.com. Yuri is Seoul Sister's AI K-beauty advisor.</p>`
  )
  return { subject: 'Your Seoul Sister free trial has ended (nothing was charged)', html }
}

export async function sendTrialEndedEmail(to: string): Promise<{ sent: boolean; reason?: string }> {
  const { subject, html } = buildTrialEndedEmail()
  const result = await sendEmail(to, subject, html)
  return result.sent
    ? { sent: true }
    : { sent: false, reason: 'reason' in result ? String(result.reason) : 'error' in result ? String(result.error) : 'unknown' }
}
