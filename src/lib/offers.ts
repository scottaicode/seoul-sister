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
    if (code) window.localStorage.setItem(OFFER_STORAGE_KEY, code)
  } catch {
    // localStorage can throw (private mode). A code is a convenience: the same
    // code can still be typed on the Stripe page.
  }
}

/** Remember a code the person typed on the membership page, once Stripe has confirmed it. Never throws. */
export function rememberOfferCode(raw: string): void {
  if (typeof window === 'undefined') return
  try {
    const code = normalizeOfferCode(raw)
    if (code) window.localStorage.setItem(OFFER_STORAGE_KEY, code)
  } catch {
    // The code is still sent with this page's button; it is only not kept for a later visit.
  }
}

/** The code remembered in this browser, if any. */
export function getOfferCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return normalizeOfferCode(window.localStorage.getItem(OFFER_STORAGE_KEY))
  } catch {
    return null
  }
}

/** Forget the remembered code (it does not exist, or Stripe no longer accepts it). Never throws. */
export function clearOfferCode(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(OFFER_STORAGE_KEY)
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
  return `Code ${code} saved: ${validPercent(percentOff)}% off your first paid month.`
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
    // The same card on the public page, where the button creates an account
    // and starts nothing. It used to say "Start my 7 free days" there too.
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

/** On the sign-up form, under the heading: what this step is, and what it is not. */
export function registerFootnote(percentOff: number | null | undefined): string {
  const price = priceWithOffer(percentOff)
  const week = PRICING.trial_requires_card
    ? `New members get the first ${PRICING.trial_days} days free, then ${price}.`
    : `New members get the first ${PRICING.trial_days} days free with no card, then ${price} only if you add a card.`
  return `This creates a free account. It does not start your free week. Next is a setup chat with Yuri, and membership is your choice after that. ${week}`
}

/**
 * Under the public pricing card's button, for someone not signed in. The card
 * above it says "Free for 7 days"; the button only creates an account.
 */
export function accountCtaNote(): string {
  return 'This creates your free account. The free week starts later, when you choose membership.'
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
export function setupChatLine(isMember: boolean | null): string {
  return isMember === false ? 'Free setup chat. Membership is separate, and starts only if you choose it.' : 'Setup chat'
}

/** The link under the setup chat that leaves it, by where it goes. */
export function skipSetupLabel(isMember: boolean | null): string {
  return isMember === true ? 'Skip this chat and go to Yuri' : 'Skip this chat and see membership'
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
    ? `The account is free. Membership is separate and optional: new members get the first ${PRICING.trial_days} days free, then ${price}.`
    : `The account is free. Membership is separate and optional: new members get the first ${PRICING.trial_days} days free with no card, then ${price} only if you add a card.`
}

/**
 * The account link under the free chat. With a confirmed code it states the
 * discounted first month, so it never shows the full price one line away from
 * "Code BAILEY saved: 50% off your first paid month".
 */
export function widgetAccountLine(percentOff: number | null | undefined): string {
  const lead = `Create a free account and continue with Yuri. New members get ${PRICING.trial_days} days free with no card.`
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
