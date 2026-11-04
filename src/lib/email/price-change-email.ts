import { PRICING, USAGE_CAPS } from '@/lib/pricing'

/**
 * One-time price-change announcement (Oct 31 2026). Copy reviewed against the
 * code by Opus 5.5 + an adversarial Fable review; see
 * reports/DRAFT-FOUNDING-MEMBER-EMAIL-OCT30.md. Change wording there first.
 *
 * Marketing email: send only with EMAIL_POSTAL_ADDRESS set (wrapEmailHtml adds
 * it) and with the recipient's one-click unsubscribe link.
 *
 * 'registered' = has a free account (log in). 'widget' = only gave an email in
 * the homepage chat (create an account). Only people with NO past subscription
 * may receive either version: the trial line is false for anyone else.
 */
export type PriceChangeCohort = 'registered' | 'widget'

const SITE = 'https://www.seoulsister.com'

export function buildPriceChangeEmail(
  cohort: PriceChangeCohort,
  unsubscribeUrl: string
): { subject: string; bodyHtml: string; footerHtml: string } {
  const price = PRICING.monthly_display_long // "$9.99/month"
  const days = PRICING.trial_days
  const opener =
    cohort === 'registered'
      ? `<p>Hi there,</p>
<p>You made a Seoul Sister account a while back, so you should know the price changed.</p>
<p>Seoul Sister is now <strong>${price.replace('/month', ' a month')}</strong>, down from $24.99. Because you've never had a subscription, your first ${days} days are free. You add a card to start, you can cancel anytime from your Profile page (Manage subscription), and if you cancel during those ${days} days you aren't charged.</p>`
      : `<p>Hi there,</p>
<p>You chatted with Yuri on our homepage a while back, so you should know the price changed.</p>
<p>Seoul Sister is now <strong>${price.replace('/month', ' a month')}</strong>, down from $24.99, and new members get the first ${days} days free. You add a card to start, you can cancel anytime from your Profile page (Manage subscription), and if you cancel during those ${days} days you aren't charged.</p>`

  const features = `<p>What you get each month:</p>
<ul>
<li><strong>${USAGE_CAPS.yuri_messages_per_month} messages with Yuri, who remembers you.</strong> Your skin, what you're using, what you loved and what broke you out, so her advice gets more specific over time.</li>
<li><strong>${USAGE_CAPS.scans_per_month} label scans checked against you.</strong> Point your phone at a Korean label and Yuri reads it, then flags anything you're allergic to, ingredients that can clog pores for your skin type, and overlaps with products you already use.</li>
<li><strong>A full routine built from your own products</strong>, checked for ingredient conflicts.</li>
</ul>
<p>See everything included: <a href="${SITE}/#pricing">seoulsister.com/#pricing</a></p>`

  const start =
    cohort === 'registered'
      ? `<p>To start, log in at <a href="${SITE}/login?from=price_change">seoulsister.com/login</a> and you'll be taken to the plan.</p>`
      : `<p>To start, create an account at <a href="${SITE}/register?from=price_change">seoulsister.com/register</a>. If you use the same browser you chatted in, Yuri can carry that conversation over.</p>`

  const close = `<p>If it's not for you, no reply needed. If you have a question, just reply to this email.</p>
<p>Yuri and the Seoul Sister team</p>`

  const reason =
    cohort === 'registered'
      ? 'You are receiving this because you created a Seoul Sister account.'
      : 'You are receiving this because you chatted with Yuri at seoulsister.com and shared your email.'
  const footerHtml = `<p style="font-size:12px;color:#999;margin:0;">${reason} <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe with one click</a> and you will never hear from us again.</p>`

  return {
    subject: `Seoul Sister is now ${PRICING.monthly_display_long.replace('/month', ' a month')} (first week free for new members)`,
    bodyHtml: [opener, features, start, close].join('\n'),
    footerHtml,
  }
}
