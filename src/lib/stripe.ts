import Stripe from 'stripe'
import { buildCheckoutParams, buildAddCardParams } from '@/lib/stripe-params'
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
      'All 6 built-in AI specialists (ingredients, routines, authenticity & more)',
      'Reads your Korean labels & builds conflict-aware routines',
      'Remembers your skin across every session',
      'Glass Skin Score photo tracking',
      // "Counterfeit detection & live price comparison" overstated both (Nov 11
      // 2026): 11 counterfeit markers across 5 brands, and 215 of 5,222 stored
      // prices checked in the previous week. Say what she can actually do.
      'Counterfeit warning signs & price checks',
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
  /** First-time members get the free trial; the caller decides eligibility. */
  withTrial?: boolean
  /**
   * Start the trial with NO card (Nov 10 2026). Stripe then collects no payment
   * method and cancels the subscription when the trial ends unless one was
   * added (createAddCardSession). Ignored without a trial. The caller passes
   * noCardTrialEnabled() so the setting lives in one place.
   */
  noCard?: boolean
  ipHash?: string | null
  /** A creator code confirmed active by resolveOffer. */
  offer?: { code: string; promotionCodeId: string; percentOff: number } | null
}): Promise<string> {
  const stripe = getStripeClient()
  // The parameters are built by a pure function (stripe-params.ts) so tests
  // can execute it and see exactly what Stripe receives.
  const session = await stripe.checkout.sessions.create(
    buildCheckoutParams({
      userId: params.userId,
      email: params.email,
      plan: params.plan,
      priceId: getPriceId(params.plan),
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      withTrial: params.withTrial === true,
      noCard: params.noCard === true,
      ipHash: params.ipHash ?? null,
      offer: params.offer ?? null,
    })
  )

  if (!session.url) throw new Error('Failed to create checkout session')
  return session.url
}

/**
 * A Stripe-hosted page where a member on a no-card trial saves a card. The
 * webhook then makes the saved card the subscription's default, which is what
 * Stripe checks at the end of the trial. The billing portal is not used for
 * this: its docs do not say an added card becomes the default.
 */
export async function createAddCardSession(params: {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  trialEnd: Date | null
  successUrl: string
  cancelUrl: string
  percentOff?: number | null
}): Promise<string> {
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.create(buildAddCardParams(params))
  if (!session.url) throw new Error('Failed to create add-card session')
  return session.url
}

export type SavedCardResult =
  | { applied: true; subscriptionId: string }
  | { applied: false; subscriptionId: string | null; reason: 'no_payment_method' | 'subscription_not_open' }

/**
 * Make the card saved by a setup-mode session the subscription's default.
 *
 * A subscription that is no longer trialing or active cannot take a card (the
 * trial ended between the member opening the page and saving). That is
 * reported, NOT thrown: throwing made Stripe retry the webhook for days with
 * no chance of success. A Stripe error on an open subscription still throws,
 * so the webhook retries while the member believes the card is saved.
 */
export async function applySavedCardToSubscription(setupIntentId: string): Promise<SavedCardResult> {
  const stripe = getStripeClient()
  const intent = await stripe.setupIntents.retrieve(setupIntentId)
  const paymentMethod = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id
  const subscriptionId = intent.metadata?.subscription_id ?? null
  if (!paymentMethod || !subscriptionId) return { applied: false, subscriptionId, reason: 'no_payment_method' }
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  if (sub.status !== 'trialing' && sub.status !== 'active') {
    return { applied: false, subscriptionId, reason: 'subscription_not_open' }
  }
  await stripe.subscriptions.update(subscriptionId, { default_payment_method: paymentMethod })
  return { applied: true, subscriptionId }
}

export interface LiveTrialState {
  /** Stripe's own status right now. */
  status: string
  /** A way to be charged exists, by Stripe's end-of-trial rule. */
  hasPaymentMethod: boolean
  /** The member cancelled; nothing will be charged when the trial ends. */
  cancelAtPeriodEnd: boolean
}

/** Ask Stripe, not our copy of it, what a trial's state is. */
export async function liveTrialState(subscriptionId: string): Promise<LiveTrialState> {
  const stripe = getStripeClient()
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] })
  let hasPaymentMethod = Boolean(sub.default_payment_method || sub.default_source)
  const customer = sub.customer
  if (!hasPaymentMethod && customer && typeof customer !== 'string' && !('deleted' in customer && customer.deleted)) {
    hasPaymentMethod = Boolean(customer.invoice_settings?.default_payment_method || customer.default_source)
  }
  return { status: sub.status, hasPaymentMethod, cancelAtPeriodEnd: sub.cancel_at_period_end === true || sub.cancel_at != null }
}

/** Cancel a subscription in Stripe now (account deletion). Missing or already-canceled is fine. */
export async function cancelSubscriptionNow(subscriptionId: string): Promise<void> {
  const stripe = getStripeClient()
  try {
    await stripe.subscriptions.cancel(subscriptionId)
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === 'resource_missing') return
    throw err
  }
}

/**
 * The note put on a subscription cancelled because its owner deleted their
 * account. The webhook reads it and sends no "your trial ended, everything is
 * saved" email to someone who is leaving.
 */
export const ACCOUNT_DELETED_CANCEL_COMMENT = 'account_deleted'

/** Cancel now, marked as an account deletion. A subscription already gone is not an error. */
export async function cancelSubscriptionForDeletedAccount(subscriptionId: string): Promise<void> {
  const stripe = getStripeClient()
  try {
    await stripe.subscriptions.cancel(subscriptionId, {
      cancellation_details: { comment: ACCOUNT_DELETED_CANCEL_COMMENT },
    })
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === 'resource_missing') return
    throw err
  }
}

/**
 * Delete a customer in Stripe: their name, address and saved card, and any
 * subscription they still have there. Stripe keeps its own record of past
 * payments, as it must. A customer already gone is not an error.
 */
export async function deleteStripeCustomer(customerId: string): Promise<void> {
  const stripe = getStripeClient()
  try {
    await stripe.customers.del(customerId)
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === 'resource_missing') return
    throw err
  }
}

/**
 * Every Stripe customer that has held a subscription for this account. Each
 * checkout creates a new customer and our table keeps only the latest, so
 * Stripe is the one place that knows them all. Subscriptions carry our
 * `user_id` in their metadata, which is what this searches on: never the email
 * address, which could match a customer that is not ours to delete.
 */
export async function findStripeCustomersForUser(userId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('findStripeCustomersForUser: not an account id')
  const stripe = getStripeClient()
  const found = new Set<string>()
  let page: string | undefined
  do {
    const result = await stripe.subscriptions.search({ query: `metadata['user_id']:'${userId}'`, limit: 100, page })
    for (const sub of result.data) {
      const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      if (customer) found.add(customer)
    }
    page = result.has_more ? (result.next_page ?? undefined) : undefined
  } while (page)
  return [...found]
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
