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
  pro_monthly: {
    name: 'Seoul Sister Pro',
    price: 39.99,
    scans_per_month: 30,
    yuri_messages_per_month: 500,
    features: [
      'Full Yuri AI advisor (Claude Opus)',
      '500 Yuri conversations/month',
      'All 6 specialist agents',
      '30 label scans/month (Vision AI)',
      'Smart routine builder with conflict detection',
      'Glass Skin Score photo tracking',
      'K-Beauty dupe finder',
      'Sunscreen finder with PA/white cast filters',
      'Shelf scan collection analysis',
      'Ingredient include/exclude search',
      'Expiration & weather-adaptive alerts',
      'Counterfeit detection & price comparison',
      'Community reviews & trending',
      'Cross-session memory',
    ],
  },
} as const

export type TierKey = keyof typeof SUBSCRIPTION_TIERS

function getPriceId(plan: TierKey): string {
  const priceIds: Record<TierKey, string | undefined> = {
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
  return 'pro_monthly' // Single tier — all paid subscribers are pro_monthly
}
