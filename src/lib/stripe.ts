import Stripe from 'stripe'
import { buildCheckoutParams, buildAddCardParams, buildDirectFreeWeekParams } from '@/lib/stripe-params'
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
      // Nov 13 2026: "cycle-aware" (on for 0 of 61 profiles) and "before it
      // hits the US" (a prediction, not a measurement) came off the sold plan.
      'Check-in notes from Yuri, with your local forecast once your location is on file',
      'Daily Olive Young & Reddit trend data',
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

/**
 * The lines shown on the membership page, where someone is deciding whether to
 * start. Four of the plan's own lines, not the full list: nine bullets pushed
 * the button off a phone screen at the moment of decision, and a list of
 * features is not what the person came for (Nov 15 2026). The list is BUILT
 * from SUBSCRIPTION_TIERS.monthly.features by position, so a line cannot be
 * added here that the plan does not already state: memory, the routine,
 * the check-in notes, then Yuri herself.
 */
export const PAYWALL_FEATURES: readonly string[] = [3, 2, 7, 0].map((i) => SUBSCRIPTION_TIERS.monthly.features[i])

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
 * Start a no-card free week with no Stripe-hosted page: a customer, then the
 * subscription. Returns the subscription (with its discount expanded, as the
 * fulfilment reads it).
 *
 * Two presses, or two tabs, must not make two:
 *  - the customer call carries a fixed key per account, and an existing
 *    customer for this account is reused before one is made;
 *  - an open subscription on that customer is returned instead of a second;
 *  - the subscription call carries a key per customer and code. The key holds
 *    no timestamp: Stripe refuses a repeated key whose parameters differ.
 * If any of this fails the caller says so and offers Stripe's own page, which
 * does not share these keys.
 */
/** Thrown when this account already has a live subscription that is NOT a running free week (paid, past due, or half made). */
export class HasLiveSubscriptionError extends Error {
  constructor(public readonly status: string) {
    super(`account already has a ${status} subscription`)
  }
}

/**
 * The Stripe customer made for this account by a direct start, and its running
 * free week if there is one. A list, not a search: a list reads what was just
 * written. Another account's customer on the same address is never used.
 */
export async function findDirectFreeWeek(userId: string, email: string): Promise<{ customerId: string | null; subscription: Stripe.Subscription | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('findDirectFreeWeek: not an account id')
  const stripe = getStripeClient()
  const existing = await stripe.customers.list({ email, limit: 100 })
  const customerId = existing.data.find((c) => c.metadata?.user_id === userId)?.id ?? null
  if (!customerId) return { customerId: null, subscription: null }
  return { customerId, subscription: await runningFreeWeekOn(customerId) }
}

/** The running free week on this customer, or null. Throws if the customer has a live subscription that is not one. */
async function runningFreeWeekOn(customerId: string): Promise<Stripe.Subscription | null> {
  const subs = await getStripeClient().subscriptions.list({ customer: customerId, status: 'all', limit: 20, expand: ['data.discount.promotion_code'] })
  const trialing = subs.data.find((s) => s.status === 'trialing')
  if (trialing) return trialing
  // Paid, past due or half made: not a free week, and never reported as one.
  const other = subs.data.find((s) => s.status === 'active' || s.status === 'past_due' || s.status === 'incomplete')
  if (other) throw new HasLiveSubscriptionError(other.status)
  return null
}

export async function startDirectFreeWeek(params: {
  userId: string
  email: string
  plan: TierKey
  ipHash?: string | null
  offer?: { code: string; promotionCodeId: string; percentOff: number } | null
  termsShown?: 'membership_page' | 'signup'
  timezone?: string | null
}): Promise<{ subscription: Stripe.Subscription; customerId: string }> {
  const stripe = getStripeClient()
  const found = await findDirectFreeWeek(params.userId, params.email)
  let customerId = found.customerId
  if (found.subscription && customerId) return { subscription: found.subscription, customerId }
  if (!customerId) {
    const customer = await stripe.customers.create(
      { email: params.email, metadata: { user_id: params.userId } },
      { idempotencyKey: `fw-cus-${params.userId}` }
    )
    customerId = customer.id
    // The same key from a second tab returns the SAME customer, which may
    // have its free week already. Look before making one.
    const already = await runningFreeWeekOn(customerId)
    if (already) return { subscription: already, customerId }
  }
  const subscription = await stripe.subscriptions.create(
    {
      ...buildDirectFreeWeekParams({ userId: params.userId, plan: params.plan, priceId: getPriceId(params.plan), customerId, ipHash: params.ipHash ?? null, offer: params.offer ?? null, termsShown: params.termsShown, timezone: params.timezone ?? null }),
      expand: ['discount.promotion_code'],
    },
    // The key names everything that can differ between two calls for one customer.
    { idempotencyKey: `fw-sub-${customerId}-${params.offer?.code ?? 'none'}-${params.termsShown ?? 'membership_page'}` }
  )
  // Stripe decides the status. Anything but a running free week is not one.
  if (subscription.status !== 'trialing') throw new HasLiveSubscriptionError(subscription.status)
  return { subscription, customerId }
}

/**
 * Put a creator code on a free week that is already running. Only on a
 * subscription that is still in its free week and carries no discount: the
 * code takes money off the first PAID month, so it must be on before that
 * invoice, and one subscription takes one code.
 */
export async function applyPromotionToFreeWeek(subscriptionId: string, promotionCodeId: string): Promise<'applied' | 'not_in_free_week' | 'has_discount'> {
  const stripe = getStripeClient()
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  if (sub.status !== 'trialing') return 'not_in_free_week'
  if (sub.discount) return 'has_discount'
  await stripe.subscriptions.update(subscriptionId, { promotion_code: promotionCodeId })
  return 'applied'
}

/**
 * What Stripe itself holds for a free week, asked BEFORE anything is said
 * about a code: whether it is still a free week, whether the member has
 * cancelled, and any discount already on it. Stripe is the record of what a
 * card will be charged; our own row can be behind it (a lost reply, a failed
 * write), and must not be what decides.
 */
export async function readFreeWeekDiscount(subscriptionId: string): Promise<{ status: string; cancelling: boolean; discount: { code: string | null; percentOff: number | null } | null }> {
  const sub = await getStripeClient().subscriptions.retrieve(subscriptionId, { expand: ['discount.promotion_code'] })
  const promo = sub.discount?.promotion_code
  return {
    status: sub.status,
    cancelling: sub.cancel_at_period_end === true || sub.cancel_at != null,
    discount: sub.discount
      ? { code: promo && typeof promo !== 'string' ? (promo.code ?? null) : null, percentOff: sub.discount.coupon?.percent_off ?? null }
      : null,
  }
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
  // A direct free-week start makes the customer BEFORE the subscription. If
  // the second call failed, the customer has no subscription to be found by,
  // and would keep the person's email after their account is deleted.
  let customerPage: string | undefined
  do {
    const result = await stripe.customers.search({ query: `metadata['user_id']:'${userId}'`, limit: 100, page: customerPage })
    for (const c of result.data) found.add(c.id)
    customerPage = result.has_more ? (result.next_page ?? undefined) : undefined
  } while (customerPage)
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
