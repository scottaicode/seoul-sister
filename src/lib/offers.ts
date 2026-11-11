import { PRICING } from '@/lib/pricing'

/**
 * Creator offer codes (Nov 10 2026). First use: Bailey's TikTok.
 *
 * Bailey's decision: code BAILEY gives 50% off the first PAID month, for the
 * first 50 people, with no end date. The free trial stays 7 days for everyone;
 * a code never lengthens it.
 *
 * What makes each word true:
 *   - "50% off the first paid month": a Stripe coupon (percent_off, duration
 *     `repeating`, 1 month) applied when the subscription is created. A `once`
 *     coupon would be used up by the free trial's $0 invoice.
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
    ? `${firstChargeText(percentOff)} when the trial ends, then ${PRICING.monthly_display_long}`
    : `${PRICING.monthly_display_long}, starting when the trial ends`
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
  return `Creator code: this visitor has the code ${offer.code} saved in this browser. For someone who is not yet a member, it takes ${validPercent(offer.percentOff)}% off the first paid month: ${firstMonthPrice(offer.percentOff)} instead of ${full.replace('/month', '')}. Every month after that is ${full}, so where anything else here says ${full}, for this person that begins with the second paid month. If they start membership in this same browser the code is applied for them; on another device or browser they can type it on the payment page. The free trial is the same with or without it. How many times the code can still be used is not visible to you. It matters only if price or the code comes up.`
}
