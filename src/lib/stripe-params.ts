import { PRICING } from '@/lib/pricing'
import { chargePhrase, CODE_BOX_NOTE } from '@/lib/offers'

/**
 * The exact objects sent to Stripe Checkout, built by pure functions so the
 * guard tests can EXECUTE them and inspect the result.
 *
 * Why this file exists (Nov 10 2026): the first tests for the no-card trial
 * were regexes over source text. In review, a second `trial_settings` spread
 * that switched the end behaviour to 'create_invoice', and a sentence appended
 * to the consent text ("You will never be charged."), both passed. What Stripe
 * receives is the only thing that matters, so that is what is tested now.
 *
 * No imports beyond pricing.ts. Parameters verified against Stripe's docs on
 * Nov 10 2026 (`payment_method_collection: 'if_required'` collects no payment
 * method when nothing is due; `missing_payment_method: 'cancel'` ends the
 * subscription at the end of a trial with no payment method).
 */

/** Consent text for a trial that needs no card. */
export function noCardTrialTerms(trialDays: number, percentOff: number | null = null): string {
  return `Your ${trialDays}-day free trial starts today. No card is needed and nothing is charged. The trial ends after ${trialDays} days and your membership stops then, unless you have added a card with the "Add a card" button inside Seoul Sister. If you add one, it is charged ${chargePhrase(percentOff, 'when the trial ends')}.`
}

/** Consent text for a card-required trial (the emergency-stop path). */
export function cardTrialTerms(trialDays: number, percentOff: number | null = null): string {
  return `Your ${trialDays}-day free trial starts today. Unless you cancel before it ends, your card will be charged ${chargePhrase(percentOff, `on day ${trialDays + 1}`)}. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.`
}

/** Consent text when there is no trial: charged today. */
export function noTrialTerms(percentOff: number | null = null): string {
  return `Your card will be charged ${chargePhrase(percentOff, 'today')}. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.`
}

/** What the add-a-card page says next to the button during a no-card trial. */
export function addCardTerms(trialEnd: Date | null, percentOff: number | null = null): string {
  const when = trialEnd
    ? `when your free trial ends on ${trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })},`
    : 'when your free trial ends,'
  return `Saving this card keeps your Seoul Sister membership going. It will be charged ${chargePhrase(percentOff, when)}. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.`
}

export interface CheckoutParamsInput {
  userId: string
  email: string
  plan: string
  priceId: string
  successUrl: string
  cancelUrl: string
  /** First-time members get the free trial; the caller decides eligibility. */
  withTrial: boolean
  /** Start that trial with no card. Ignored without a trial. */
  noCard: boolean
  /** Hashed network address, kept on the subscription so the trial ledger can cap trials per network. */
  ipHash?: string | null
  /**
   * A creator code Stripe has confirmed is active (offers-server.ts). When set,
   * the discount is applied by Stripe itself and the consent text states it.
   */
  offer?: { code: string; promotionCodeId: string; percentOff: number } | null
}

/** The subscription Checkout Session. A paid checkout (no trial) ALWAYS takes a card. */
export function buildCheckoutParams(p: CheckoutParamsInput) {
  const trialDays = p.withTrial ? PRICING.trial_days : 0
  const noCard = trialDays > 0 && p.noCard === true
  const pct = p.offer?.percentOff ?? null
  const stated = noCard ? noCardTrialTerms(trialDays, pct) : trialDays > 0 ? cardTrialTerms(trialDays, pct) : noTrialTerms(pct)
  // Without a confirmed code the Stripe page shows its own code box, so the
  // stated price may not be the one charged. Say so in the same text.
  const terms = p.offer ? stated : `${stated} ${CODE_BOX_NOTE}`
  const metadata: Record<string, string> = { user_id: p.userId, plan: p.plan }
  if (p.offer) {
    metadata.offer_code = p.offer.code
    metadata.offer_percent_off = String(p.offer.percentOff)
  }
  if (p.ipHash) metadata.ip_hash = p.ipHash
  // Stated, not inferred: the webhook reads this to know the trial began with
  // no card (it used to guess from the subscription having no default card).
  if (noCard) metadata.no_card = '1'

  return {
    mode: 'subscription' as const,
    payment_method_types: ['card' as const],
    customer_email: p.email,
    line_items: [{ price: p.priceId, quantity: 1 }],
    ...(noCard ? { payment_method_collection: 'if_required' as const } : {}),
    // With a creator code, Stripe applies that exact promotion code (and enforces
    // its cap). Otherwise the code box stays on the page, so a code heard in a
    // video can still be typed, and the owner can hand someone a one-off code.
    // Stripe accepts only one of the two.
    ...(p.offer ? { discounts: [{ promotion_code: p.offer.promotionCodeId }] } : { allow_promotion_codes: true }),
    consent_collection: { terms_of_service: 'required' as const },
    custom_text: { submit: { message: terms } },
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    metadata,
    subscription_data: {
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      // With no card the trial must END, not invoice an empty wallet.
      ...(noCard ? { trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } } : {}),
      metadata,
    },
  }
}

/**
 * The setup-mode session where a member on a no-card trial saves a card
 * (Stripe's documented "update payment details" pattern). The client pins API
 * version 2023-10-16, where setup mode needs payment_method_types or a currency.
 */
export function buildAddCardParams(p: {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  trialEnd: Date | null
  successUrl: string
  cancelUrl: string
  /** Percent off the first paid month, when the trial started with a creator code. */
  percentOff?: number | null
}) {
  return {
    mode: 'setup' as const,
    customer: p.stripeCustomerId,
    payment_method_types: ['card' as const],
    custom_text: { submit: { message: addCardTerms(p.trialEnd, p.percentOff ?? null) } },
    setup_intent_data: { metadata: { user_id: p.userId, subscription_id: p.stripeSubscriptionId } },
    metadata: { user_id: p.userId, purpose: 'trial_add_card' },
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
  }
}
