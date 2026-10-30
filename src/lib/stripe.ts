import Stripe from 'stripe'
import { PRICING, USAGE_CAPS, LEGACY_USAGE_CAPS } from './pricing'

let stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable')
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  }
  return stripeInstance
}

export const SUBSCRIPTION_TIERS = {
  // The plan sold from Oct 30 2026.
  monthly: {
    name: PRICING.plan_name,
    price: PRICING.monthly_usd,
    scans_per_month: USAGE_CAPS.scans_per_month,
    yuri_messages_per_month: USAGE_CAPS.yuri_messages_per_month,
    features: [
      'Yuri, your K-beauty advisor, available 24/7',
      `${USAGE_CAPS.yuri_messages_per_month} messages with Yuri and ${USAGE_CAPS.scans_per_month} label scans a month`,
      'All 6 built-in AI specialists (ingredients, routines, authenticity & more)',
      'Reads your Korean labels & builds conflict-aware routines',
      'Remembers your skin across every session',
      'Glass Skin Score photo tracking',
      'Counterfeit detection & live price comparison',
      'Finds dupes & the right sunscreen for your skin',
      'Weather- & cycle-aware guidance',
      'Trending in Korea before it hits the US',
    ],
  },
  // Legacy/comped plan (the old $24.99 "unlimited" price). Not sold; kept so
  // existing comped and grandfathered accounts keep exactly what they were given.
  pro_monthly: {
    name: PRICING.plan_name,
    price: 24.99,
    scans_per_month: LEGACY_USAGE_CAPS.scans_per_month,
    yuri_messages_per_month: LEGACY_USAGE_CAPS.yuri_messages_per_month,
    features: [
      'Yuri, your K-beauty advisor, available 24/7',
      'Unlimited conversations & label scans',
      'All 6 built-in AI specialists (ingredients, routines, authenticity & more)',
      'Reads your Korean labels & builds conflict-aware routines',
      'Remembers your skin across every session',
      'Glass Skin Score photo tracking',
      'Counterfeit detection & live price comparison',
      'Finds dupes & the right sunscreen for your skin',
      'Weather- & cycle-aware guidance',
      'Trending in Korea before it hits the US',
    ],
  },
} as const

export type TierKey = keyof typeof SUBSCRIPTION_TIERS

function getPriceId(plan: TierKey): string {
  const priceIds: Record<TierKey, string | undefined> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  }
  const id = priceIds[plan]
  if (!id) throw new Error(`No Stripe price ID configured for plan: ${plan}`)
  return id
}

export async function createCheckoutSession(params: {
  userId: string
  email: string
  plan: TierKey
  successUrl: string
  cancelUrl: string
  /** First-time subscribers get the free trial; the caller decides eligibility. */
  withTrial?: boolean
}): Promise<string> {
  const stripe = getStripeClient()
  const priceId = getPriceId(params.plan)
  const trialDays = params.withTrial ? PRICING.trial_days : 0
  // Auto-renewal disclosure shown on the Checkout page next to the pay button
  // (California's automatic renewal law and similar state laws): what is
  // charged, when, how often, and how to stop it. Stripe also requires the
  // customer to tick agreement to the terms (consent_collection).
  const renewalTerms = trialDays > 0
    ? `Your ${trialDays}-day free trial starts today. Unless you cancel before it ends, your card will be charged ${PRICING.monthly_display_long} on day ${trialDays + 1} and every month after that until you cancel. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.`
    : `Your card will be charged ${PRICING.monthly_display_long} today and every month after that until you cancel. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: params.email,
    line_items: [{ price: priceId, quantity: 1 }],
    // Lets the owner hand a specific person a one-off code (e.g. a first
    // month free). Codes are created by hand in Stripe, single-use.
    allow_promotion_codes: true,
    consent_collection: { terms_of_service: 'required' },
    custom_text: { submit: { message: renewalTerms } },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      user_id: params.userId,
      plan: params.plan,
    },
    subscription_data: {
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      metadata: {
        user_id: params.userId,
        plan: params.plan,
      },
    },
  })

  if (!session.url) throw new Error('Failed to create checkout session')
  return session.url
}

export async function createBillingPortalSession(params: {
  stripeCustomerId: string
  returnUrl: string
}): Promise<string> {
  const stripe = getStripeClient()

  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  })

  return session.url
}

/** Price ids of the legacy $24.99 plan and the earlier $39.99 price (still live
 * in Stripe). Both map to the grandfathered 'pro_monthly' allowance. */
const LEGACY_PRICE_IDS = new Set(
  [process.env.STRIPE_PRICE_PRO_MONTHLY, ...(process.env.STRIPE_LEGACY_PRICE_IDS || '').split(',')]
    .map((s) => (s || '').trim())
    .filter(Boolean)
)

export function planFromStripePriceId(priceId: string): TierKey {
  if (priceId && priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly'
  if (priceId && LEGACY_PRICE_IDS.has(priceId)) return 'pro_monthly'
  // An unknown price must fail loudly (the webhook returns 500 and Stripe
  // retries) rather than silently granting or downgrading a plan.
  throw new Error(`Unknown Stripe price id: ${priceId || '(none)'}`)
}
