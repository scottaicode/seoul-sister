import Stripe from 'stripe'

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
  free: {
    name: 'Free',
    price: 0,
    scans_per_month: 3,
    yuri_messages_per_day: 3,
    features: [
      'Browse product database',
      '3 label scans per month',
      'Basic ingredient lists',
      'Community access (read)',
      'Trending products feed',
    ],
  },
  pro_monthly: {
    name: 'Pro Monthly',
    price: 14.99,
    scans_per_month: -1,
    yuri_messages_per_day: -1,
    features: [
      'Unlimited AI label scanning',
      'Full Yuri advisor conversations',
      'All 6 specialist agents',
      'Personalized routine builder',
      'Counterfeit detection alerts',
      'Price drop alerts on wishlist',
      'Skin cycling schedules',
      'Priority support',
    ],
  },
  pro_annual: {
    name: 'Pro Annual',
    price: 99.99,
    scans_per_month: -1,
    yuri_messages_per_day: -1,
    features: [
      'Everything in Pro Monthly',
      'Save $79.89/year (44% off)',
    ],
  },
  student: {
    name: 'Student',
    price: 6.99,
    scans_per_month: -1,
    yuri_messages_per_day: -1,
    features: [
      'Everything in Pro Monthly',
      'Requires .edu email',
      'Cancel anytime',
    ],
  },
} as const

export type TierKey = keyof typeof SUBSCRIPTION_TIERS

function getPriceId(plan: TierKey): string {
  const priceIds: Record<TierKey, string | undefined> = {
    free: undefined,
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    student: process.env.STRIPE_PRICE_STUDENT,
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
}): Promise<string> {
  const stripe = getStripeClient()
  const priceId = getPriceId(params.plan)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: params.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      user_id: params.userId,
      plan: params.plan,
    },
    subscription_data: {
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

export function planFromStripePriceId(priceId: string): TierKey {
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'pro_monthly'
  if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return 'pro_annual'
  if (priceId === process.env.STRIPE_PRICE_STUDENT) return 'student'
  return 'free'
}
