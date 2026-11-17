import { sendEmail, wrapEmailHtml } from './send'
import { escapeHtml } from './html'
import { PRICING } from '@/lib/pricing'
import { validTimeZone } from './timezone'
import { chargePhrase, firstChargeText, thereafterText, firstMonthPrice } from '@/lib/offers'

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
  /** Percent off the first paid month, when the member joined with a creator code. */
  percentOff?: number | null
  /**
   * The member's profile time zone. Dates are written in it, with the zone
   * named, so this email and the in-app notice name the same day when the
   * profile zone matches the device. Until Nov 11 2026 this email was always
   * UTC: a US evening sign-up was told "ends November 18" here and "Tuesday,
   * November 17" in the app. Unknown or invalid: UTC. The zone is always
   * printed, because a profile zone can come from the city someone typed.
   */
  timezone?: string | null
  /** The free week was started on our own membership page, so no Stripe page (and its word "trial") was seen. */
  startedOnOurPage?: boolean
  /** It started when the account was created (sign-up starts the free week). */
  startedAtSignup?: boolean
}): { subject: string; html: string } {
  const noCardTrial = Boolean(params.trialEnd) && params.cardOnFile === false
  const zone = validTimeZone(params.timezone) ?? 'UTC'
  const zoneName = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? zone
  const fmt = (d: Date) =>
    `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: zone })} ${zoneName(d)}`
  // The zone's short name is always printed ("PST", "UTC"), so the time is never ambiguous.
  const fmtTime = (d: Date) =>
    d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' })
  // For the subject line: the day and the time, no year. The week ends to the
  // minute, so a date alone ("ends November 22") misleads for a 12:00 AM end.
  const fmtShort = (d: Date) =>
    d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' })
  const pct = params.percentOff ?? null
  // Where they started it, in their terms: Stripe's page called it a trial; ours did not.
  const whereStarted = params.startedAtSignup
    ? 'It started when you created your account.'
    : params.startedOnOurPage
    ? 'You started it on the Seoul Sister membership page.'
    : `This is the ${PRICING.trial_days}-day trial you confirmed on Stripe's page; we call it your free week.`
  const discounted = firstMonthPrice(pct) !== null
  const firstCharge = noCardTrial && params.trialEnd
    ? `<p>Your free week has started. ${whereStarted} <strong>No card is on file and you will not be charged.</strong> It ends ${escapeHtml(fmtTime(params.trialEnd))}.</p>
<p><strong>To keep your membership,</strong> add a card before then with the "Add a card" button at the top of any page once you are signed in at <a href="https://www.seoulsister.com/dashboard">seoulsister.com</a>. A card you add is charged ${escapeHtml(chargePhrase(pct, 'when the free week ends'))}. If you add no card, your membership stops at that time and nothing is charged. Your account and skin profile are kept.</p>`
    : params.trialEnd
    ? `<p>Your free week has started. ${whereStarted} <strong>Unless you cancel before it ends, your card will be charged ${escapeHtml(firstChargeText(pct))} when it ends, ${PRICING.trial_days} days after it started (${escapeHtml(fmtTime(params.trialEnd))})</strong>, ${discounted ? escapeHtml(thereafterText(pct)) : 'and again every month after that until you cancel'}.</p>`
    : `<p>Your subscription has started. Your card is charged ${escapeHtml(chargePhrase(pct, 'today'))}.</p>`

  const html = wrapEmailHtml(
    `<p>Welcome to ${escapeHtml(PRICING.plan_name)}.</p>
${firstCharge}
<p><strong>What to expect:</strong> Yuri builds your routine with you in your first conversation. After that, most weeks she checks in with a question or two about how your skin did, and adjusts the routine from what you tell her. Your answers are what make it better.</p>
<p><strong>What's included:</strong> ${escapeHtml(PRICING.yuri_allowance_display)}, label scans, and the full Seoul Sister intelligence suite. Your allowance resets on the first of each month.</p>
${noCardTrial
      ? `<p><strong>How to stop:</strong> you don't need to do anything. With no card on file, your membership stops by itself when the free week ends, and nothing is charged. If you add a card and change your mind, go to your Profile page and choose "Manage subscription", or reply to this email and we'll cancel it for you.</p>`
      : `<p><strong>How to cancel:</strong> go to your Profile page at <a href="https://www.seoulsister.com/profile">seoulsister.com/profile</a> and choose "Manage subscription", or reply to this email and we'll cancel it for you.${params.trialEnd ? " If you cancel during the free week, you won't be charged." : ''}</p>`}
<p>Keep this email for your records.</p>`,
    `<p style="font-size:12px;color:#999;margin:0;">You're receiving this because you started a Seoul Sister membership at seoulsister.com.</p>`
  )

  return {
    subject: params.trialEnd
      ? `Your Seoul Sister free week has started (ends ${fmtShort(params.trialEnd)})`
      : 'Your Seoul Sister subscription is confirmed',
    html,
  }
}

export async function sendSubscriptionConfirmation(
  to: string,
  trialEnd: Date | null,
  opts: { cardOnFile?: boolean; percentOff?: number | null; timezone?: string | null; startedOnOurPage?: boolean; startedAtSignup?: boolean } = {}
): Promise<{ sent: boolean; reason?: string }> {
  const { subject, html } = buildSubscriptionConfirmationEmail({ trialEnd, cardOnFile: opts.cardOnFile, percentOff: opts.percentOff, timezone: opts.timezone, startedOnOurPage: opts.startedOnOurPage, startedAtSignup: opts.startedAtSignup })
  const result = await sendEmail(to, subject, html)
  return result.sent ? { sent: true } : { sent: false, reason: 'reason' in result ? String(result.reason) : 'error' in result ? String(result.error) : 'unknown' }
}
