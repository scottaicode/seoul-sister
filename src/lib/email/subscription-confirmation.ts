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
  /** false = a no-card trial (Nov 10 2026): nothing will be charged unless a card is added. */
  cardOnFile?: boolean
}): { subject: string; html: string } {
  const noCardTrial = Boolean(params.trialEnd) && params.cardOnFile === false
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const fmtTime = (d: Date) =>
    d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
  const price = escapeHtml(PRICING.monthly_display_long)
  const firstCharge = noCardTrial && params.trialEnd
    ? `<p>Your ${PRICING.trial_days}-day free trial has started. <strong>No card is on file and you will not be charged.</strong> The trial ends ${escapeHtml(fmtTime(params.trialEnd))}.</p>
<p><strong>To keep your membership,</strong> add a card before then with the "Add a card" button at the top of any page once you are signed in at <a href="https://www.seoulsister.com/dashboard">seoulsister.com</a>. A card you add is charged ${price} when the trial ends and every month after that until you cancel. If you add no card, your membership stops when the trial ends. Your account and skin profile are kept.</p>`
    : params.trialEnd
    ? `<p>Your ${PRICING.trial_days}-day free trial has started. <strong>Unless you cancel before it ends, your card will be charged ${price} when the trial ends, ${PRICING.trial_days} days after you signed up (${escapeHtml(fmtTime(params.trialEnd))})</strong>, and again every month after that until you cancel.</p>`
    : `<p>Your subscription has started. Your card is charged ${price} today and every month after that until you cancel.</p>`

  const html = wrapEmailHtml(
    `<p>Welcome to ${escapeHtml(PRICING.plan_name)}.</p>
${firstCharge}
<p><strong>What to expect:</strong> Yuri builds your routine with you in your first conversation. After that, most weeks she checks in with a question or two about how your skin did, and adjusts the routine from what you tell her. Your answers are what make it better.</p>
<p><strong>What's included:</strong> ${escapeHtml(PRICING.yuri_allowance_display)}, label scans, and the full Seoul Sister intelligence suite. Your allowance resets on the first of each month.</p>
${noCardTrial
      ? `<p><strong>How to stop:</strong> you don't need to do anything. With no card on file the trial ends by itself. If you add a card and change your mind, go to your Profile page and choose "Manage subscription", or reply to this email and we'll cancel it for you.</p>`
      : `<p><strong>How to cancel:</strong> go to your Profile page at <a href="https://www.seoulsister.com/profile">seoulsister.com/profile</a> and choose "Manage subscription", or reply to this email and we'll cancel it for you. If you cancel during the free trial, you won't be charged.</p>`}
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
  trialEnd: Date | null,
  opts: { cardOnFile?: boolean } = {}
): Promise<{ sent: boolean; reason?: string }> {
  const { subject, html } = buildSubscriptionConfirmationEmail({ trialEnd, cardOnFile: opts.cardOnFile })
  const result = await sendEmail(to, subject, html)
  return result.sent ? { sent: true } : { sent: false, reason: 'reason' in result ? String(result.reason) : 'error' in result ? String(result.error) : 'unknown' }
}
