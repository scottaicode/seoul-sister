import { PRICING, USAGE_CAPS } from '@/lib/pricing'

/**
 * One-time price-change announcement (Nov 2026), written as a short personal
 * note from Bailey (the face of Seoul Sister on TikTok, sent with her OK).
 * Facts reviewed against the code by Opus 5.5 + an adversarial Fable review;
 * see reports/DRAFT-FOUNDING-MEMBER-EMAIL-OCT30.md. Plain on purpose: no bold,
 * no bullet list, one link. Yuri is named as an AI (Anthropic usage policy).
 *
 * Marketing email: send only with EMAIL_POSTAL_ADDRESS set (wrapEmailHtml adds
 * it) and with the recipient's one-click unsubscribe link. Replies go to
 * EMAIL_REPLY_TO (team@).
 *
 * 'registered' = has a free account (log in). 'widget' = only gave an email in
 * the homepage chat (create an account). Only people with NO past subscription
 * may receive either version: the trial line is false for anyone else.
 */
export type PriceChangeCohort = 'registered' | 'widget'

// team@ is a real mailbox (replies land there); a bailey@ address does not exist and would bounce.
export const PRICE_CHANGE_FROM = 'Bailey at Seoul Sister <team@seoulsister.com>'

const SITE = 'https://www.seoulsister.com'

export function buildPriceChangeEmail(
  cohort: PriceChangeCohort,
  unsubscribeUrl: string
): { subject: string; bodyHtml: string; footerHtml: string } {
  const price = PRICING.monthly_display_long.replace('/month', ' a month') // "$9.99 a month"
  const days = PRICING.trial_days

  const hello =
    cohort === 'registered'
      ? `<p>Hi, it's Bailey from Seoul Sister. You made an account with us a while back, and I wanted to let you know about our new plan.</p>`
      : `<p>Hi, it's Bailey from Seoul Sister. You chatted with Yuri on our site a while back, and I wanted to let you know about our new plan.</p>`

  const trial =
    cohort === 'registered'
      ? `since you've never had a subscription, your first ${days} days are free.`
      : `new members get the first ${days} days free.`

  const body = `${hello}
<p>It's ${price}, and ${trial} You add a card to start, you can cancel anytime from your Profile page (Manage subscription), and if you cancel during those ${days} days you aren't charged.</p>
<p>That gets you ${USAGE_CAPS.yuri_messages_per_month} messages a month with Yuri, our AI skincare advisor, who remembers your skin, what you're using, and what you loved or what broke you out. You also get ${USAGE_CAPS.scans_per_month} label scans a month: point your phone at a Korean label and Yuri checks it against your allergies, your skin type and the products you already use. And she'll build a routine from your own products and check it for ingredient conflicts.</p>
${cohort === 'registered'
    ? `<p>If you want to try it, just log in: <a href="${SITE}/login?from=price_change">seoulsister.com/login</a></p>`
    : `<p>If you want to try it, create an account here: <a href="${SITE}/register?from=price_change">seoulsister.com/register</a>.</p>`}
<p>One question, if you have a second: what would make Seoul Sister worth it for you? Just hit reply, it comes straight to us.</p>
<p>Bailey</p>`

  const reason =
    cohort === 'registered'
      ? 'You are receiving this because you created a Seoul Sister account.'
      : 'You are receiving this because you chatted with Yuri at seoulsister.com and shared your email.'
  const footerHtml = `<p style="font-size:12px;color:#999;margin:0;">${reason} <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe with one click</a> and you will never hear from us again.</p>`

  return {
    subject: 'Try Seoul Sister free for a week',
    bodyHtml: body,
    footerHtml,
  }
}
