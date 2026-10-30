import { sendEmail, wrapEmailHtml } from './send'
import { escapeHtml } from './html'
import { PRICING } from '@/lib/pricing'

/**
 * Subscription confirmation (Oct 30 2026). California's automatic renewal law
 * (and similar state laws) require a confirmation the customer can keep, sent
 * after they sign up, stating the auto-renewal terms, the price, the billing
 * frequency, and how to cancel. Stripe sends no receipt for a $0 trial invoice,
 * so without this a trial subscriber would get nothing in writing.
 *
 * Plain, factual, fixed wording on purpose: these are legal terms, not advice.
 */
export function buildSubscriptionConfirmationEmail(params: {
  trialEnd: Date | null
}): { subject: string; html: string } {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const fmtTime = (d: Date) =>
    d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
  const price = escapeHtml(PRICING.monthly_display_long)
  const firstCharge = params.trialEnd
    ? `<p>Your ${PRICING.trial_days}-day free trial has started. <strong>Unless you cancel before it ends, your card will be charged ${price} when the trial ends, ${PRICING.trial_days} days after you signed up (${escapeHtml(fmtTime(params.trialEnd))})</strong>, and again every month after that until you cancel.</p>`
    : `<p>Your subscription has started. Your card is charged ${price} today and every month after that until you cancel.</p>`

  const html = wrapEmailHtml(
    `<p>Welcome to ${escapeHtml(PRICING.plan_name)}.</p>
${firstCharge}
<p><strong>What's included:</strong> ${escapeHtml(PRICING.yuri_allowance_display)}, label scans, and the full Seoul Sister intelligence suite. Your allowance resets on the first of each month.</p>
<p><strong>How to cancel:</strong> go to your Profile page at <a href="https://www.seoulsister.com/profile">seoulsister.com/profile</a> and choose "Manage subscription", or reply to this email and we'll cancel it for you. If you cancel during the free trial, you won't be charged.</p>
<p>Keep this email for your records.</p>`,
    `<p style="font-size:12px;color:#999;margin:0;">You're receiving this because you subscribed to Seoul Sister at seoulsister.com.</p>`
  )

  return {
    subject: params.trialEnd
      ? `Your Seoul Sister free trial has started (ends ${fmt(params.trialEnd)})`
      : 'Your Seoul Sister subscription is confirmed',
    html,
  }
}

export async function sendSubscriptionConfirmation(
  to: string,
  trialEnd: Date | null
): Promise<{ sent: boolean; reason?: string }> {
  const { subject, html } = buildSubscriptionConfirmationEmail({ trialEnd })
  const result = await sendEmail(to, subject, html)
  return result.sent ? { sent: true } : { sent: false, reason: 'reason' in result ? String(result.reason) : 'error' in result ? String(result.error) : 'unknown' }
}
