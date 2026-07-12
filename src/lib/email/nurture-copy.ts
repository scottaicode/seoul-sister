/**
 * The "Honest Three" nurture sequence — fixed, owner-approved copy.
 *
 * Design (July 1 2026, research-grounded — see LEAD-GEN-LEARNINGS-LOG.md):
 * 3 emails with behavioral exits, not a 7-12 email drip. The brand's moat is
 * honesty; the sequence says so out loud and keeps its "last email" promise.
 *
 * Why fixed copy and not per-lead Opus generation: registered leads carry no
 * per-lead context (no conversation, no profile) — generation would produce
 * unreviewed variance with zero personalization benefit. Where real context
 * exists (a widget visitor mid-conversation), the existing lead-email path
 * (src/lib/email/lead-email.ts) already generates with Opus. If leads ever
 * carry usable context at sequence time, upgrade the relevant step to
 * generation in the same change that adds the context.
 *
 * Voice rules: Yuri first person, plain punctuation, NO em-dashes (outward
 * copy rule), no fake urgency, no discounts, honest about the paywall.
 */

import { PRICING } from '@/lib/pricing'

export type NurtureCohort = 'registered' | 'widget'

export interface NurtureEmailContent {
  subject: string
  bodyHtml: string
}

const SITE = 'https://www.seoulsister.com'

function unsubFooter(unsubscribeUrl: string, cohort: NurtureCohort): string {
  const reason =
    cohort === 'registered'
      ? 'You are receiving this because you created a Seoul Sister account.'
      : 'You are receiving this because you chatted with Yuri at seoulsister.com and shared your email.'
  return `<p style="font-size:12px;color:#999;margin:0;">Seoul Sister, your K-beauty intelligence advisor. ${reason} <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe with one click</a> and you will never hear from us again.</p>`
}

/** Email 1 — Day 0. The honest reset. CTA: free widget chat. */
function email1(cohort: NurtureCohort, unsubscribeUrl: string): NurtureEmailContent {
  const opener =
    cohort === 'registered'
      ? `<p>You created an account with us a little while back, and then we did the thing where the very next screen asked you to subscribe before you could try anything. If you closed the tab right there, honestly, fair.</p>`
      : `<p>We talked for a bit on the site a while back and you left me your email so we could stay in touch. This is that, just later than either of us probably expected.</p>`
  return {
    subject:
      cohort === 'registered'
        ? `The part we should have led with`
        : `Picking up where we left off`,
    bodyHtml: `
<p>Hi, it's Yuri from Seoul Sister.</p>
${opener}
<p>So here's the part we should have led with: you can talk to me right now, no account needed. Ask me anything you'd ask a friend who knows Korean skincare inside out. What's actually worth it for your skin, whether that viral serum is right for you, how to tell if the snail mucin you bought is real. I'll give you a straight answer backed by a database of 5,900+ products, and I'll tell you when something is not worth your money too.</p>
<p><a href="${SITE}/?from=nurture_1" style="display:inline-block;background:#C9A55C;color:#111;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">Talk to Yuri, free</a></p>
<p>If it turns out I'm useful, the paid side is where I remember your skin, build your routine, and adjust it as your skin changes month to month. But try the conversation first. That's the honest order to do it in.</p>
<p>Yuri</p>`,
  }
}

/** Email 2 — Day 3. Pure value, zero ask: the counterfeit check. */
function email2(_cohort: NurtureCohort, _unsubscribeUrl: string): NurtureEmailContent {
  return {
    subject: `The 2-minute check before you buy any Korean skincare`,
    bodyHtml: `
<p>Hi, it's Yuri again. No pitch today, just the single most useful thing I know that most K-beauty shoppers don't.</p>
<p>Counterfeit Korean skincare is everywhere on open marketplaces, and the fakes have gotten good. Before you buy (or use) anything, run this:</p>
<ol>
<li><strong>Korean text + MFDS registration on the label.</strong> Korea's FDA equivalent. Korean-market products always carry it, and counterfeiters almost never bother.</li>
<li><strong>Barcode starts with 880.</strong> That's South Korea's country code. A "made in Korea" product with a different prefix deserves a hard look.</li>
<li><strong>Tight, factory-grade shrink wrap.</strong> Loose or bubbled wrap means tampered, refilled, or fake.</li>
<li><strong>The price gap IS the warning.</strong> Far below every authorized retailer is not a deal, it's the tell.</li>
<li><strong>Or skip all of this:</strong> buy from authorized retailers like Olive Young Global or Soko Glam and the question never comes up.</li>
</ol>
<p>The full checklist, including the brand-specific tells for the most-faked products, is here: <a href="${SITE}/blog/how-to-tell-if-korean-skincare-is-fake-a-5-point-check-for-a?from=nurture_2" style="color:#C9A55C;">How to spot fake Korean skincare</a>.</p>
<p>And if you're ever unsure about a specific bottle in your hands, describe it to me on the <a href="${SITE}/?from=nurture_2" style="color:#C9A55C;">homepage</a>. Free, no login, and I'll tell you straight.</p>
<p>Yuri</p>`,
  }
}

/** Email 3 — Day 8. The continuity fact + the ask + the last-email promise. */
function email3(_cohort: NurtureCohort, _unsubscribeUrl: string): NurtureEmailContent {
  return {
    subject: `What I can't do for you in one chat (last email, promise)`,
    bodyHtml: `
<p>Hi, it's Yuri. Last email from me, as promised, so let me be straight about what's free and what isn't.</p>
<p>The free conversation on the homepage is real. I'll diagnose, recommend, and warn you off wasted money, and none of that changes.</p>
<p>But skin doesn't change in one conversation. It changes over months. The part of my job that actually moves skin is the follow-through: remembering what you're using and how you reacted, catching the conflict when you add a new product, adjusting your routine when the seasons change or your skin does, and tracking your progress photos so we know what's working instead of guessing.</p>
<p>That follow-through is the subscriber side. It's ${PRICING.monthly_display_long}, cancel anytime, and it exists because an advisor who forgets you every conversation isn't really an advisor.</p>
<p><a href="${SITE}/subscribe?from=nurture_3" style="display:inline-block;background:#C9A55C;color:#111;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">Start with Yuri</a></p>
<p>And if Seoul Sister isn't for you, no hard feelings. This is the last email either way. It was good to meet you.</p>
<p>Yuri</p>`,
  }
}

const STEPS = [email1, email2, email3] as const

/** Days that must have elapsed since the PREVIOUS send before each step. */
export const STEP_DELAYS_DAYS = [0, 3, 5] as const // step1 immediate, step2 at day 3, step3 at day 8

export function buildNurtureEmail(
  step: 1 | 2 | 3,
  cohort: NurtureCohort,
  unsubscribeToken: string
): NurtureEmailContent & { footerHtml: string; unsubscribeUrl: string } {
  const unsubscribeUrl = `${SITE}/api/email/unsubscribe?token=${unsubscribeToken}`
  const content = STEPS[step - 1](cohort, unsubscribeUrl)
  return { ...content, footerHtml: unsubFooter(unsubscribeUrl, cohort), unsubscribeUrl }
}
