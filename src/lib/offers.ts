import { PRICING } from '@/lib/pricing'

/**
 * Creator offer codes (Nov 10 2026). First use: Bailey's TikTok.
 *
 * Bailey's decision: code BAILEY gives 50% off the first PAID month, for the
 * first 50 people, with no end date. The free week stays 7 days for everyone;
 * a code never lengthens it.
 *
 * What makes each word true:
 *   - "50% off the first paid month": a Stripe coupon (percent_off, duration
 *     `repeating`, 1 month) applied when the subscription is created. A `once`
 *     coupon would be used up by the free week's $0 invoice.
 *   - "first 50 people": the Stripe promotion code's `max_redemptions`. Stripe
 *     stops accepting the code itself; nothing here counts by hand.
 * Nothing in the app states how many spots are left, and nothing may claim the
 * offer is about to run out: that is only knowable from Stripe, and saying it
 * when it is not true is the fake scarcity this product does not do.
 *
 * This file is client-safe (no server imports). The Stripe lookup lives in
 * offers-server.ts.
 */
export const OFFER_STORAGE_KEY = 'ss_offer_code'
/** When the code was saved (ms). A saved code is kept for OFFER_KEEP_DAYS, then forgotten. */
export const OFFER_SAVED_AT_KEY = 'ss_offer_code_at'
/**
 * A code used to be kept for ever. Bailey opened the site weeks after testing
 * her own link and found "Code BAILEY saved" and a $4.99 price she had not
 * asked for (Nov 16 2026). Thirty days covers someone who watches a video and
 * comes back later; after that the browser forgets it and the link, or typing
 * the code, brings it back.
 */
export const OFFER_KEEP_DAYS = 30

/** A code as we accept it from a URL or a form: 3-20 letters and digits, upper-cased. Else null. */
export function normalizeOfferCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : null
}

/**
 * Remember a code that arrived in the URL (`?code=BAILEY`). The LATEST code
 * wins: someone who followed one creator's link and later another's gets the
 * one they clicked last. Never throws.
 */
export function captureOfferCode(): void {
  if (typeof window === 'undefined') return
  try {
    const code = normalizeOfferCode(new URLSearchParams(window.location.search).get('code'))
    if (code) {
      window.localStorage.setItem(OFFER_STORAGE_KEY, code)
      window.localStorage.setItem(OFFER_SAVED_AT_KEY, String(Date.now()))
    }
  } catch {
    // localStorage can throw (private mode). A code is a convenience: the same
    // code can still be typed on the Stripe page.
  }
}

/**
 * Remember a code the person typed, once Stripe has confirmed it. Never
 * throws. Answers whether it was really kept: the sign-up page states the
 * discount only if it was, because the saved code is what carries it into the
 * free week.
 */
export function rememberOfferCode(raw: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const code = normalizeOfferCode(raw)
    if (!code) return false
    window.localStorage.setItem(OFFER_STORAGE_KEY, code)
    window.localStorage.setItem(OFFER_SAVED_AT_KEY, String(Date.now()))
    return window.localStorage.getItem(OFFER_STORAGE_KEY) === code
  } catch {
    // Storage blocked (private mode). On the membership page the code is still
    // sent with that page's button; on the sign-up page the caller says so.
    return false
  }
}

/** The code remembered in this browser, if any. */
export function getOfferCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return readSavedOffer(window.localStorage, Date.now())
  } catch {
    return null
  }
}

/**
 * The saved code if it is still within OFFER_KEEP_DAYS, else null (and it is
 * forgotten). A code saved before the date was recorded starts its thirty days
 * at the first read. Pure but for the store it is handed; exported for tests.
 */
export function readSavedOffer(store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, now: number): string | null {
  const code = normalizeOfferCode(store.getItem(OFFER_STORAGE_KEY))
  if (!code) return null
  const savedAt = Number(store.getItem(OFFER_SAVED_AT_KEY))
  if (!Number.isFinite(savedAt) || savedAt <= 0) {
    store.setItem(OFFER_SAVED_AT_KEY, String(now))
    return code
  }
  if (now - savedAt > OFFER_KEEP_DAYS * 24 * 60 * 60 * 1000) {
    store.removeItem(OFFER_STORAGE_KEY)
    store.removeItem(OFFER_SAVED_AT_KEY)
    return null
  }
  return code
}

/** Forget the remembered code (it does not exist, or Stripe no longer accepts it). Never throws. */
export function clearOfferCode(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(OFFER_STORAGE_KEY)
    window.localStorage.removeItem(OFFER_SAVED_AT_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/** A usable percentage: a whole number from 1 to 99. Anything else is null. */
export function validPercent(percentOff: number | null | undefined): number | null {
  return typeof percentOff === 'number' && Number.isInteger(percentOff) && percentOff >= 1 && percentOff <= 99 ? percentOff : null
}

/**
 * The discounted first paid month in dollars, e.g. "$4.99". Stripe rounds the
 * DISCOUNT to the cent and subtracts it: 50% of $9.99 is a $5.00 discount, so
 * $4.99 (confirmed against a live Stripe Checkout total of 499 on Nov 10 2026).
 * Only 50% has been confirmed; check Stripe before trusting another percentage
 * to the cent.
 */
export function firstMonthPrice(percentOff: number | null | undefined): string | null {
  const pct = validPercent(percentOff)
  if (!pct) return null
  const cents = Math.round(PRICING.monthly_usd * 100)
  return `$${((cents - Math.round((cents * pct) / 100)) / 100).toFixed(2)}`
}

/**
 * What a card is charged, used by EVERY sentence that says so (checkout
 * consent, add-a-card page, confirmation email, in-app trial notice,
 * trial-ending notice), so a member with a code is never told the full price
 * for their first month and never left guessing what the second month costs.
 *
 *   no code: "$9.99/month <when> and every month after that until you cancel"
 *   code:    "$4.99 for your first paid month (50% off) <when>, then $9.99/month until you cancel"
 *
 * `when` is the caller's own words ("today", "on that day,"). A trailing comma
 * is kept for the plain sentence and absorbed by the discounted one.
 */
export function chargePhrase(percentOff: number | null | undefined, when: string): string {
  if (!firstMonthPrice(percentOff)) return `${firstChargeText(percentOff)} ${when} ${thereafterText(percentOff)}`
  const bare = when.endsWith(',') ? when.slice(0, -1) : when
  return `${firstChargeText(percentOff)} ${bare}, ${thereafterText(percentOff)}`
}

/** The first amount charged: "$9.99/month", or "$4.99 for your first paid month (50% off)". */
export function firstChargeText(percentOff: number | null | undefined): string {
  const first = firstMonthPrice(percentOff)
  return first ? `${first} for your first paid month (${validPercent(percentOff)}% off)` : PRICING.monthly_display_long
}

/** What follows the first charge. */
export function thereafterText(percentOff: number | null | undefined): string {
  return firstMonthPrice(percentOff)
    ? `then ${PRICING.monthly_display_long} until you cancel`
    : 'and every month after that until you cancel'
}

/** The price as stated after "add a card:". */
export function addCardPhrase(percentOff: number | null | undefined): string {
  return firstMonthPrice(percentOff)
    ? `${firstChargeText(percentOff)} when the free week ends, then ${PRICING.monthly_display_long}`
    : `${PRICING.monthly_display_long}, starting when the free week ends`
}

/** Shown on the membership page when Stripe confirms the code. */
export function offerAppliedLine(code: string, percentOff: number): string {
  return `Code ${code} applied: your first paid month is ${firstMonthPrice(percentOff)} instead of ${PRICING.monthly_display_long.replace('/month', '')} (${validPercent(percentOff)}% off), then ${PRICING.monthly_display_long}.`
}

/** Shown under the free chat as soon as a code arrives and Stripe confirms it. */
export function offerSavedLine(code: string, percentOff: number): string {
  // "In this browser" says why it is here for someone who did not just enter
  // it (it arrived on a link, or was typed on the membership page).
  return `Code ${code} is saved in this browser: ${validPercent(percentOff)}% off your first paid month.`
}

/**
 * Typing a code (Nov 16 2026). Since creating an account starts the free week,
 * a new person never meets the membership page, which had the only code box;
 * someone who heard "use code BAILEY" and came to the site directly had
 * nowhere to enter it. There are now two places: the sign-up page, and the
 * notice at the top of the app during the free week (the discount is on the
 * first PAID month, so any time before a card is charged is in time).
 * A code is not case sensitive: normalizeOfferCode upper-cases it.
 */
export function haveACodeLabel(): string {
  return 'Have a code?'
}
export function codeShapeLine(): string {
  return 'That does not look like a code. Codes are 3 to 20 letters and numbers.'
}
export function codeCheckFailedLine(): string {
  return 'The code could not be checked just now. Please try again in a minute.'
}
export function codeTooManyTriesLine(): string {
  return 'Too many tries. Please try the code again in an hour.'
}
/** Stripe would not take it right now (for example the last place went a moment ago, or Stripe could not be reached). Nothing was changed. */
export function codeNotAppliedNowLine(code: string): string {
  return `Code ${code} could not be applied just now. Nothing was changed. Please try again in a few minutes.`
}
/** The browser refused to keep the code, so sign-up cannot carry it. The notice in the app takes it after sign-up. */
export function codeNotSavedLine(code: string): string {
  return `Your browser would not save ${code}, so it cannot be carried into sign-up. Create your account, then enter it with "Have a code?" at the top of the app.`
}
/** They cancelled: the membership stops when the free week ends, so a code would take one of its places for nothing. */
export function codeAfterCancelLine(): string {
  return 'Your membership is set to stop when the free week ends, so a code would not be used.'
}
/**
 * A code we do not recognise as a creator code. It may be a typo, or a code
 * Seoul Sister gave this person directly; this page cannot tell which and does
 * not say the code is wrong. The way through for the second kind is a person.
 */
export function codeNeedsHelpLine(code: string): string {
  return `We could not apply ${code} here. Check the spelling. If Seoul Sister gave you this code directly, email team@seoulsister.com and we will apply it for you.`
}
export function codeAlreadyOnLine(code: string | null): string {
  return code ? `Code ${code} is already on your membership.` : 'A code is already on your membership.'
}
export function codeNotInFreeWeekLine(): string {
  return 'A code can be added during your free week, and there is no free week running on this account.'
}

/** Shown when Stripe no longer accepts the code. It never says why or how many were used. */
export function offerEndedLine(code: string): string {
  return `Code ${code} is no longer available, so membership is ${PRICING.monthly_display_long}.`
}

/**
 * Exactly what GET /api/offer returns. A closed set of keys: nothing about how
 * many redemptions are left can leak out through here.
 */
export function offerResponse(
  offer: { state: 'active'; code: string; percentOff: number } | { state: 'ended'; code: string } | { state: 'unknown' }
): { state: 'active'; code: string; percent_off: number; line: string; saved_line: string } | { state: 'ended'; code: string; line: string } | { state: 'unknown' } {
  if (offer.state === 'active') {
    return {
      state: 'active',
      code: offer.code,
      percent_off: offer.percentOff,
      line: offerAppliedLine(offer.code, offer.percentOff),
      saved_line: offerSavedLine(offer.code, offer.percentOff),
    }
  }
  if (offer.state === 'ended') return { state: 'ended', code: offer.code, line: offerEndedLine(offer.code) }
  return { state: 'unknown' }
}

/**
 * The discount a subscription actually carries, read from Stripe's own record
 * of it. This is the truth for what later notices say and for "who used
 * Bailey's code": a code typed into Stripe's box never passes through our
 * checkout metadata. The metadata is only a fallback for when the object has
 * no `discount` field at all. `discount: null` is Stripe saying there is no
 * discount, and is believed.
 *
 * Only "a percentage off for exactly one month" is reported, because that is
 * the only discount the app's sentences can describe truthfully.
 */
export function offerFromSubscription(
  subscription: {
    discount?: {
      coupon?: { percent_off?: number | null; duration?: string | null; duration_in_months?: number | null } | null
      promotion_code?: string | { code?: string | null } | null
    } | null
  },
  metadata: Record<string, string | undefined> | null | undefined
): { code: string | null; percentOff: number | null } {
  const metaCode = normalizeOfferCode(metadata?.offer_code)
  const discount = subscription.discount
  if (discount === null) return { code: null, percentOff: null }
  if (discount) {
    const c = discount.coupon
    const pct = c && c.duration === 'repeating' && c.duration_in_months === 1 ? validPercent(c.percent_off) : null
    if (!pct) return { code: null, percentOff: null }
    const promo = discount.promotion_code
    const code = promo && typeof promo === 'object' ? normalizeOfferCode(promo.code) : null
    return { code: code ?? metaCode, percentOff: pct }
  }
  const metaPct = validPercent(Number(metadata?.offer_percent_off))
  return metaCode && metaPct ? { code: metaCode, percentOff: metaPct } : { code: null, percentOff: null }
}

/** Shown when a code could not be applied right now (Stripe refused it or could not be asked). */
export function offerFailedLine(code: string): string {
  return `Code ${code} could not be applied just now. Press the button again to continue without it at ${PRICING.monthly_display_long}, or try again in a few minutes to use the code.`
}

/** "$9.99/month", or with a code "$4.99 for your first paid month (50% off), then $9.99/month". */
export function priceWithOffer(percentOff: number | null | undefined): string {
  return firstMonthPrice(percentOff) ? `${firstChargeText(percentOff)}, then ${PRICING.monthly_display_long}` : PRICING.monthly_display_long
}

/**
 * The pricing card's lines (Nov 11 2026). The free week leads, because a
 * visitor had to read the small print to learn it existed. Each line is true
 * on its own: the week is free for new members, it needs no card, and the
 * price applies only to someone who adds one.
 */
export function pricingCardLines(): { headline: string; noCard: string; after: string; who: string; cta: string; accountCta: string; accountNote: string } {
  return {
    headline: `Free for ${PRICING.trial_days} days`,
    noCard: 'No card needed to start.',
    after: `Then ${PRICING.monthly_display_long}, only if you add a card. Cancel anytime.`,
    who: 'The free week is for new members.',
    // The button that STARTS the free week (membership page only).
    cta: 'Start my free week',
    // The same card on the public page, where the button creates the account.
    // Since Nov 16 2026 that starts the free week too (accountCtaNote says so).
    accountCta: 'Create my free account',
    accountNote: accountCtaNote(),
  }
}

// ---------------------------------------------------------------------------
// One vocabulary for the path to membership (Nov 15 2026).
//
// A tester created an account and believed that had started her free week;
// then a page offering "Free for 7 days" appeared, and then Stripe's page with
// a price on it. Two different things were both called "free", the account
// step was called "Join", and nothing said when the free week starts.
//
//   free account   the login. Never "join" or "member" for this step.
//   setup chat     the free first conversation with Yuri.
//   membership     the paid thing.
//   free week      the first 7 days of membership. "Trial" is Stripe's word;
//                  it is bridged once, on Stripe's own page.
//
// Wherever the free week is mentioned before it has started, the sentence says
// when it starts. Every sentence below is true for every account that can see
// it: the price comes from priceWithOffer (so a creator code shows), "new
// members" stays (an inbox that already had a free week does not get another),
// and the no-card clause follows PRICING.trial_requires_card.
// ---------------------------------------------------------------------------

/**
 * What creating an account does, in one place (Nov 16 2026): it starts the
 * free week. Until then the account was "free", the week began with a second
 * press on a membership page, and this sentence had to explain the difference
 * ("It does not start your free week... membership is your choice after
 * that"). Two testers and the owner all read sign-up as the start. Now it is.
 *
 * "One free week per person" is here because the week is one per inbox: a
 * returning person gets an account and is shown what membership costs.
 * If the free week ever needs a card again (PRICING.trial_requires_card), it
 * cannot start at sign-up, and this says so.
 */
export function signupStartsLine(percentOff: number | null | undefined): string {
  const price = priceWithOffer(percentOff)
  return PRICING.trial_requires_card
    ? `Creating your account is free. Your free week (${PRICING.trial_days} days, then ${price}) starts on the next page, when you add a card.`
    : `For a new member, creating your account starts your free week: ${PRICING.trial_days} days, no card. After that it is ${price}, only if you add a card. One free week per person.`
}

/** On the sign-up form, under the heading. */
export function registerFootnote(percentOff: number | null | undefined): string {
  return signupStartsLine(percentOff)
}

/**
 * Under the public pricing card's button, for someone not signed in. The card
 * above it says "Free for 7 days"; the button creates the account, which is
 * what starts them.
 */
export function accountCtaNote(): string {
  return PRICING.trial_requires_card ? 'This creates your account. The free week starts when you add a card.' : 'This creates your account and, for a new member, starts your free week.'
}

/**
 * On the membership card, under "Free for N days", when the no-card free week
 * is on offer. The button opens Stripe's page and the week starts once it is
 * confirmed there, so this does not say "when you press the button".
 */
export function paywallStartLine(): string {
  return 'Starts on the next page, once you confirm there. No card needed.'
}

/**
 * Under the button that starts the no-card free week: what the next page is.
 * It names no figure on purpose. Stripe's page shows the price (and, with a
 * creator code, its own arithmetic) and nobody here has seen every variant of
 * it, so this says only what is true whatever it shows. The email there is
 * filled in and fixed, so it is "shows", not "asks for".
 */
export function stripeHandoffLine(): string {
  return "The next page is Stripe's. It shows your email and asks you to check a box for our terms. It does not ask for a card. The price it shows applies after your free week, and only if you add a card. Nothing is charged today."
}

/**
 * The free week started on OUR page (trial.ts `directFreeWeekEnabled`). These
 * are every sentence that page adds. None names a "next page": there is none.
 */
export function paywallStartLineDirect(): string {
  return 'Starts when you press the button below. No card needed.'
}
export function directAgreeLabel(): string {
  return 'I have read this and agree to the Terms of Service.'
}
/** Shown in place of the membership card once the start has succeeded. `endText` is the day and time in the member's own zone, or null if unread. */
export function directStartedLines(endText: string | null): { heading: string; body: string; cta: string } {
  return {
    heading: 'Your free week has started.',
    body: `${endText ? `It ends ${endText}. ` : ''}No card is on file, so nothing will be charged, and membership stops when the free week ends unless you add a card with the "Add a card" button at the top of the app.`,
    cta: 'Continue',
  }
}
/** The start on our page failed. Nothing is claimed about Stripe's state beyond "nothing was charged" (no card exists to charge). */
export function directStartFailedLine(): string {
  return "Your free week could not be started here just now. Nothing was charged. Try again in a minute, or start it on Stripe's page instead."
}
/** A typed code that is not a creator code: we cannot apply it, Stripe's page can. No claim about whether it is valid. */
export function codeNotAppliedHereLine(code: string): string {
  return `We cannot apply ${code} on this page. If it is a Seoul Sister promotion code, start on Stripe's page instead, where it can be entered.`
}
/**
 * Stripe made the subscription (the free week IS running) but our own records
 * could not be written. Pressing the button again finds that subscription and
 * finishes the job; it never makes a second one. Stripe's page is not offered
 * here: that would.
 */
export function directStartedNotRecordedLine(): string {
  return 'Your free week has started, but we could not finish setting up your membership just now. Nothing was charged. Press the button again in a minute to finish.'
}
/** Under the button while the terms box is not ticked. */
export function tickToStartLine(): string {
  return 'Tick the box above to start.'
}
export function startWithoutCodeLabel(): string {
  return 'Start without a code'
}
/** Any failure to begin, on either way of starting, where nothing was started. */
export function couldNotStartLine(): string {
  return 'This could not be started just now. Nothing was charged. Please try again in a minute.'
}
export function useStripePageLabel(): string {
  return "Start on Stripe's page instead"
}
/** The page showed one way to start and the server now uses the other. */
export function startPageChangedLine(): string {
  return 'This page was out of date, so nothing was started and nothing was charged. It now shows the current way to start.'
}

/**
 * Said when the page offered the no-card free week and the checkout, deciding
 * again a moment later, could not give it (the per-network limit filled, the
 * connection changed, the no-card week was switched off). Nothing is started:
 * the alternative was a Stripe page asking for a card under a button that had
 * just said it would not. The page re-reads what applies before showing this.
 */
export function freeWeekChangedLine(): string {
  return 'The no-card free week could not be started just now, so nothing was started and nothing was charged. The page now shows what you can start instead.'
}

/**
 * The setup chat's line under "Meet Yuri". For someone who is not a member it
 * says the chat is free and that membership is a separate choice. It makes no
 * claim about a free week: some non-members have already had theirs, and some
 * will not be offered one. A member, or an unread plan, is told only what the
 * chat is.
 */
/**
 * Shown on the setup page when sign-up did NOT start the free week, because
 * the sign-up page had just said it would. It says why, that nothing was
 * charged, and what the way in is now. `detail` is the checkout's own
 * sentence about a code, when there is one.
 */
export function freeWeekNotStartedLine(reason: 'had_week' | 'network' | 'code' | 'not_asked' | 'other', detail: string | null = null): string {
  const next = 'This setup chat is free, and the membership page after it shows what you can start.'
  // The account is new but this browser did not come through the sign-up page
  // (another device, private mode, or signed up from the log-in page).
  if (reason === 'not_asked') return `Your free week has not started yet. This setup chat is free, and the membership page after it starts your free week: ${PRICING.trial_days} days, no card.`
  if (reason === 'had_week') return `Your free week has already been used, so it did not start again. ${next}`
  if (reason === 'network') return `Your free week did not start: several have already been started from this network recently. ${next}`
  if (reason === 'code') return `${detail ? `${detail} ` : ''}Your free week has not started yet. ${next}`
  return `Your free week could not be started just now. Nothing was charged. ${next}`
}

export function setupChatLine(isMember: boolean | null, freeWeekJustStarted = false): string {
  // Said only on the page load where this account's free week was started.
  if (isMember === true && freeWeekJustStarted) return 'Your free week has started. This first chat is where I learn your skin.'
  return isMember === false ? 'Free setup chat. Membership is separate, and starts only if you choose it.' : 'Setup chat'
}

/**
 * Under the membership page's "Free for N days / No card needed to start."
 * headline: what adding a card does and what happens without one. `priceLong`
 * is priceWithOffer(...), so a saved creator code shows here too.
 */
export function paywallFreeWeekLine(priceLong: string): string {
  return `Add a card any time in those ${PRICING.trial_days} days to keep going at ${priceLong}. If you don't, the free week ends and nothing is charged.`
}

/** The price line on the free chat's "you have used your free messages" card. */
export function widgetMembershipLine(percentOff: number | null | undefined): string {
  const price = firstMonthPrice(percentOff) ? priceWithOffer(percentOff) : PRICING.monthly_display
  // The free week comes before the price, so a creator code's first-month
  // figure is not read as what is paid first.
  return PRICING.trial_requires_card
    ? `Creating an account is free. Your free week (${PRICING.trial_days} days, then ${price}) starts when you add a card.`
    : `For a new member, creating an account starts your free week: ${PRICING.trial_days} days, no card. After that it is ${price}, only if you add a card. One free week per person.`
}

/**
 * The account link under the free chat. With a confirmed code it states the
 * discounted first month, so it never shows the full price one line away from
 * "Code BAILEY saved: 50% off your first paid month".
 */
export function widgetAccountLine(percentOff: number | null | undefined): string {
  const lead = `Create a free account and continue with Yuri. For a new member that starts your free week: ${PRICING.trial_days} days, no card.`
  return firstMonthPrice(percentOff)
    ? `${lead} After that, ${priceWithOffer(percentOff)}, only if you add a card.`
    : `${lead} ${PRICING.monthly_display} after that, only if you add a card.`
}

/**
 * Whether a saved creator code is spoken of to this person. A code takes money
 * off the first PAID month of someone who is not yet a member. A signed-in
 * member can still reach the landing page (links carrying ?from= or ?ask= are
 * not redirected), and telling them "50% off your first paid month" is false.
 * When membership cannot be read, nothing is said about the code.
 */
export function offerAudience(
  signedIn: boolean,
  plan: string | null | undefined,
  planKnown: boolean
): 'applies' | 'member' | 'unknown' {
  if (!signedIn) return 'applies'
  if (!planKnown) return 'unknown'
  return !plan || plan === 'free' ? 'applies' : 'member'
}

/** The saved creator code as it applies to the person looking at the page. */
export interface SavedOffer {
  /** Shown under the free chat: "Code X saved...", or that it is no longer available. */
  line: string | null
  /** Set only when Stripe confirmed the code and it applies to this person. */
  percentOff: number | null
  /** The code to send with a chat message so Yuri states this person's price; null for a member. */
  codeForChat: string | null
}

export const NO_SAVED_OFFER: SavedOffer = { line: null, percentOff: null, codeForChat: null }

/**
 * Works out what to say about a remembered code, in order: who is looking,
 * then what Stripe says. Each step reports through `onUpdate`. Kept free of
 * React and the network so it can be run in a test; useSavedOffer supplies
 * the real readers.
 *
 * - A member, or membership that could not be read: nothing, and no code sent.
 * - Stripe not reachable: nothing is claimed, but the code still goes with a
 *   chat message, where the server asks Stripe itself.
 * - A code Stripe does not accept is forgotten.
 */
export async function resolveSavedOffer(input: {
  code: string | null
  signedIn: boolean
  readPlan: () => Promise<{ plan: string | null; known: boolean }>
  askOffer: (code: string) => Promise<{ state?: string; line?: string; saved_line?: string; percent_off?: number } | null>
  forget: () => void
  onUpdate: (offer: SavedOffer) => void
}): Promise<void> {
  const { code } = input
  if (!code) return input.onUpdate(NO_SAVED_OFFER)
  const membership = input.signedIn ? await input.readPlan() : { plan: null, known: true }
  if (offerAudience(input.signedIn, membership.plan, membership.known) !== 'applies') return input.onUpdate(NO_SAVED_OFFER)
  input.onUpdate({ line: null, percentOff: null, codeForChat: code })
  const o = await input.askOffer(code)
  if (!o) return
  if (o.state === 'active') {
    return input.onUpdate({ line: o.saved_line ?? null, percentOff: validPercent(o.percent_off), codeForChat: code })
  }
  input.forget()
  input.onUpdate({ line: o.state === 'ended' ? o.line ?? null : null, percentOff: null, codeForChat: null })
}

/**
 * A signed-in person's plan, read from their profile row. `ss_user_profiles`
 * has a surrogate `id` and a separate `user_id`: the row is found by
 * `user_id`. Joined on `id` it returns no row and no error, which would read
 * as "not a member" for every member. A failed read is `known: false`.
 */
export async function readMemberPlan(
  db: { from: (table: string) => unknown },
  userId: string
): Promise<{ plan: string | null; known: boolean }> {
  type Query = { select: (c: string) => Query; eq: (c: string, v: string) => Query; maybeSingle: () => Promise<{ data: { plan?: string | null } | null; error: { message: string } | null }> }
  const { data, error } = await (db.from('ss_user_profiles') as Query).select('plan').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('[offer] could not read membership; saying nothing about the saved code:', error.message)
    return { plan: null, known: false }
  }
  return { plan: data?.plan ?? null, known: true }
}

type OfferAnswer = { state?: string; line?: string; saved_line?: string; percent_off?: number }
/** How long an answer about a code is reused. The server keeps its own for the same five minutes. */
export const OFFER_LOOKUP_TTL_MS = 5 * 60 * 1000
const offerLookups = new Map<string, { at: number; lookup: Promise<OfferAnswer | null> }>()

/**
 * Asks /api/offer about a code once for every component that wants the answer
 * (the saved line and the chat both do; the endpoint allows 30 requests an
 * hour per IP, and phone carriers share IPs). An answer is reused for five
 * minutes, not for the life of the page, so a code Stripe has since ended is
 * not called "saved" indefinitely. A failed lookup is not kept at all.
 */
export function askOfferOnce(
  code: string,
  fetcher: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
): Promise<OfferAnswer | null> {
  const kept = offerLookups.get(code)
  if (kept && Date.now() - kept.at < OFFER_LOOKUP_TTL_MS) return kept.lookup
  const lookup = (async () => {
    const res = await fetcher(`/api/offer?code=${encodeURIComponent(code)}`)
    if (!res.ok) {
      console.error(`[offer] /api/offer answered ${res.status}; saying nothing about the saved code`)
      return null
    }
    return (await res.json()) as OfferAnswer
  })()
  const entry = { at: Date.now(), lookup }
  offerLookups.set(code, entry)
  const drop = () => { if (offerLookups.get(code) === entry) offerLookups.delete(code) }
  lookup.then((answer) => { if (!answer) drop() }, drop)
  return lookup
}

/**
 * Added to the consent text when the Stripe page shows its own code box. The
 * sentence above it states the normal price; a code typed there changes what
 * is charged, and Stripe shows that amount on the same page.
 */
export const CODE_BOX_NOTE = 'If you enter a promotion code on this page, the discounted price shown on this page is what is charged instead.'

/**
 * What Yuri is told when the visitor in front of her has a creator code
 * (widget and setup chat, per-turn facts). Without it she would quote the full
 * price to someone the page has just told a code was saved, or say no code
 * exists. Facts only. It says where the code applies by itself and where it
 * must be typed (the code lives in one browser's storage), and it reconciles
 * the two prices she would otherwise hold for one person.
 */
export function offerFactForYuri(
  offer: { state: 'active'; code: string; percentOff: number } | { state: 'ended'; code: string } | { state: 'unchecked' }
): string {
  const full = PRICING.monthly_display_long
  if (offer.state === 'unchecked') {
    return `Creator code: this visitor's browser holds a creator code that could not be checked just now, so whether it applies is not visible to you.`
  }
  if (offer.state === 'ended') {
    return `Creator code: this visitor arrived with the code ${offer.code}, and it is no longer accepted, so membership for them is ${full}.`
  }
  return `Creator code: this visitor has the code ${offer.code} saved in this browser. For someone who is not yet a member, it takes ${validPercent(offer.percentOff)}% off the first paid month: ${firstMonthPrice(offer.percentOff)} instead of ${full.replace('/month', '')}. Every month after that is ${full}, so where anything else here says ${full}, for this person that begins with the second paid month. If they start membership in this same browser the code is applied for them; on another device or browser they can enter it when they start membership. The free week is the same with or without it. The discount covers the first paid month only. When the code itself stops being accepted is not shown to you. It matters only if price or the code comes up.`
}
