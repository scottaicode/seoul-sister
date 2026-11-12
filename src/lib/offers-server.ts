import { getStripeClient } from '@/lib/stripe'
import { normalizeOfferCode, offerFactForYuri } from '@/lib/offers'

/**
 * Ask Stripe what a creator code is worth right now (Nov 10 2026). Stripe is
 * the only source of truth: it holds the discount, enforces the redemption cap,
 * and marks the code inactive when the cap is reached.
 *
 *   active  : the code can be applied; `promotionCodeId` and `percentOff` set
 *   ended   : the code exists but Stripe no longer accepts it (cap reached,
 *             expired or switched off)
 *   unknown : no such code, or a code not marked as a creator offer
 *
 * A code is accepted only if its coupon is a percentage off that lasts exactly
 * one month (`repeating`, 1). Anything else is refused and logged, because
 * every sentence the app writes about the offer says "the first month".
 * Throws when Stripe cannot be reached: the caller decides what to do, and must
 * never treat "could not ask" as "no discount" silently.
 */
export type OfferState =
  | { state: 'active'; code: string; promotionCodeId: string; percentOff: number }
  | { state: 'ended'; code: string }
  | { state: 'unknown'; code: string | null }

export async function resolveOffer(raw: string | null | undefined): Promise<OfferState> {
  const code = normalizeOfferCode(raw)
  if (!code) return { state: 'unknown', code: null }
  const stripe = getStripeClient()
  const found = await stripe.promotionCodes.list({ code, limit: 1 })
  const promo = found.data[0]
  if (!promo) return { state: 'unknown', code }
  // Only codes the owner marked as creator offers (promotion code metadata
  // creator_offer=1) are confirmed to a visitor. Private one-off codes stay
  // invisible here: this endpoint is public and must not confirm them. They
  // still work when typed on the Stripe page.
  if (promo.metadata?.creator_offer !== '1') return { state: 'unknown', code }
  if (!promo.active) return { state: 'ended', code }
  // Stripe's own closing conditions, checked here too so a full or expired code
  // is reported as ended before a checkout is attempted with it.
  if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) return { state: 'ended', code }
  if (promo.expires_at != null && promo.expires_at * 1000 <= Date.now()) return { state: 'ended', code }
  const coupon = promo.coupon
  const percentOff = coupon?.percent_off ?? null
  const oneMonth = coupon?.duration === 'repeating' && coupon.duration_in_months === 1
  if (!coupon?.valid || !percentOff || !Number.isInteger(percentOff) || percentOff < 1 || percentOff > 99 || !oneMonth) {
    console.error(
      `[offers] code ${code} is active in Stripe but its coupon is not "a whole-number percentage off for exactly one month" (percent_off=${percentOff}, duration=${coupon?.duration}, months=${coupon?.duration_in_months}, valid=${coupon?.valid}); refusing it rather than misdescribing it`
    )
    return { state: 'ended', code }
  }
  return { state: 'active', code, promotionCodeId: promo.id, percentOff }
}

/**
 * The creator-code fact for Yuri's per-turn context, or null when there is no
 * creator code to speak of. When Stripe cannot be asked (error, or no answer
 * within FACT_WAIT_MS) she is told only that a code could not be checked:
 * nothing unconfirmed is asserted, and a chat turn never waits on Stripe.
 *
 * Asked on every chat turn, so an answer is kept for a few minutes per warm
 * instance (a failure for one minute). A code that closes inside that window
 * is still stopped at the checkout, which always asks Stripe itself.
 */
const FACT_TTL_MS = 5 * 60 * 1000
const FACT_FAIL_TTL_MS = 60 * 1000
const FACT_WAIT_MS = 1500
const factCache = new Map<string, { until: number; fact: string | null; active: boolean }>()

export async function offerFactLine(raw: string | null | undefined, now: number = Date.now()): Promise<string | null> {
  const code = normalizeOfferCode(raw)
  if (!code) return null
  const hit = factCache.get(code)
  if (hit && now < hit.until) return hit.fact
  try {
    const offer = await Promise.race([
      resolveOffer(code),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer from Stripe in ${FACT_WAIT_MS}ms`)), FACT_WAIT_MS)),
    ])
    const fact = offer.state === 'unknown' ? null : offerFactForYuri(offer)
    factCache.set(code, { until: now + FACT_TTL_MS, fact, active: offer.state === 'active' })
    return fact
  } catch (err) {
    console.error('[offers] could not confirm a code for Yuri:', err instanceof Error ? err.message : String(err))
    const fact = offerFactForYuri({ state: 'unchecked' })
    factCache.set(code, { until: now + FACT_FAIL_TTL_MS, fact, active: false })
    return fact
  }
}

/**
 * The code, only if Stripe has just confirmed it as an open creator offer
 * (the answer offerFactLine holds for this code, still fresh). Null for a code
 * Stripe does not know, one that has ended, and one that could not be checked:
 * a code is put into a lead's email links only on Stripe's word, never on the
 * strength of a string in a URL. Call it after offerFactLine for the same code.
 */
export function confirmedOfferCode(raw: string | null | undefined, now: number = Date.now()): string | null {
  const code = normalizeOfferCode(raw)
  if (!code) return null
  const hit = factCache.get(code)
  return hit && now < hit.until && hit.active ? code : null
}
