import { sendEmail, wrapEmailHtml } from './send'
import { escapeHtml } from './html'
import { PRICING } from '@/lib/pricing'
import { validTimeZone } from './timezone'
import { chargePhrase, addCardPhrase, normalizeOfferCode } from '@/lib/offers'

/**
 * Sent when a free trial ends with nothing paid (Nov 10 2026). Until now the
 * only sign a trial had ended was being sent to the membership page. Plain,
 * factual, fixed wording: nothing was charged, what is kept, how to continue.
 * No urgency and no offer; it states what is true.
 */
export function buildTrialEndedEmail(opts: { offerCode?: string | null } = {}): { subject: string; html: string } {
  const price = escapeHtml(PRICING.monthly_display_long)
  // Someone who started with a creator code is told the plain fact that it can
  // be used again, and where. Nothing about how long it lasts: that is not known.
  const code = normalizeOfferCode(opts.offerCode)
  const codeLine = code
    ? ` You started your trial with code ${escapeHtml(code)}. It can be used again there while it is still accepted: it is applied by itself in the browser you signed up in, and on another device you can type it on the payment page.`
    : ''
  const html = wrapEmailHtml(
    `<p>Your ${PRICING.trial_days}-day free trial of Seoul Sister has ended.</p>
<p><strong>Nothing was charged</strong>, and nothing will be: no card was on file.</p>
<p>Your account, your skin profile and everything you worked out with Yuri are saved.</p>
<p>If you would like to keep going, membership is ${price}. You can start it any time at <a href="https://www.seoulsister.com/subscribe">seoulsister.com/subscribe</a>, and Yuri picks up from where you left off.${codeLine} If not, there is nothing you need to do.</p>`,
    `<p style="font-size:12px;color:#999;margin:0;">You're receiving this because you started a free trial at seoulsister.com. Yuri is Seoul Sister's AI K-beauty advisor.</p>`
  )
  return { subject: 'Your Seoul Sister free trial has ended (nothing was charged)', html }
}

export async function sendTrialEndedEmail(to: string, opts: { offerCode?: string | null } = {}): Promise<{ sent: boolean; reason?: string }> {
  const { subject, html } = buildTrialEndedEmail(opts)
  const result = await sendEmail(to, subject, html)
  return result.sent
    ? { sent: true }
    : { sent: false, reason: 'reason' in result ? String(result.reason) : 'error' in result ? String(result.error) : 'unknown' }
}

/** What Stripe says about a running trial, or null when it could not be asked. */
export type TrialEndingState = { hasPaymentMethod: boolean; cancelAtPeriodEnd: boolean } | null

/**
 * The one sentence that says when a trial ends and what happens then, in the
 * member's own calendar. Stated per what Stripe says right now; when Stripe
 * could not be asked it gives the date and nothing else. Pure, exported.
 *
 * The date is formatted in the MEMBER's timezone. A first version used UTC, so
 * a US evening sign-up was told the trial ended, and the card would be
 * charged, the day after it actually would.
 */
export function trialEndingLine(endsAt: string, state: TrialEndingState, timezoneRaw: string | null, percentOff: number | null = null): string {
  // An unusable stored zone is treated as unknown (UTC, labelled), never a thrown error.
  const timezone = validTimeZone(timezoneRaw)
  const when = new Date(endsAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone || 'UTC',
  })
  const base = `Your free trial ends on ${when}${timezone ? '' : ' (UTC)'}.`
  if (!state) return base
  if (state.cancelAtPeriodEnd) return `${base} You cancelled, so nothing will be charged.`
  if (state.hasPaymentMethod) {
    return `${base} Your card will be charged ${chargePhrase(percentOff, 'on that day,')}.`
  }
  return `${base} No card is on file, so nothing will be charged and your membership will stop on that day. To keep going, sign in and use the "Add a card" button at the top of any page: ${addCardPhrase(percentOff)}.`
}

/**
 * A plain notice from Seoul Sister, sent about two days before a trial ends
 * (Nov 10 2026). It is deliberately NOT part of Yuri's check-in: a first version
 * put this line under her day-6 note, so a week where she stayed silent, or the
 * content guard blocked her draft, would have ended a member's access with no
 * notice at all, and it read as Yuri asking for money.
 */
export function buildTrialEndingEmail(line: string): { subject: string; html: string } {
  const html = wrapEmailHtml(
    `<p>A note from Seoul Sister about your free trial.</p>
<p><strong>${escapeHtml(line)}</strong></p>
<p>Your account, your skin profile and everything you worked out with Yuri are kept either way.</p>`,
    `<p style="font-size:12px;color:#999;margin:0;">You're receiving this because you started a free trial at seoulsister.com. This is an account notice, not a message from Yuri.</p>`
  )
  return { subject: 'Your Seoul Sister free trial ends soon', html }
}

export async function sendTrialEndingEmail(to: string, line: string): Promise<{ sent: boolean; reason?: string }> {
  const { subject, html } = buildTrialEndingEmail(line)
  const result = await sendEmail(to, subject, html)
  return result.sent
    ? { sent: true }
    : { sent: false, reason: 'reason' in result ? String(result.reason) : 'error' in result ? String(result.error) : 'unknown' }
}
