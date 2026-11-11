import { getStripeClient } from '@/lib/stripe'
import { normalizeOfferCode } from '@/lib/offers'

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
