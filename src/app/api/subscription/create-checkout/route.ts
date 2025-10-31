import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { PRICING_CONFIG } from '@/config/pricing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Stripe price IDs for each tier (would be set in environment variables)
const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium',
  elite: process.env.STRIPE_ELITE_PRICE_ID || 'price_elite'
}

export async function POST(request: NextRequest) {
  try {
    const { userId, tier = 'premium', email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId: string

    // Check if customer already exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
          platform: 'seoul-sister'
        }
      })
      customerId = customer.id

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_IDS[tier as keyof typeof STRIPE_PRICE_IDS],
          quantity: 1
        }
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: PRICING_CONFIG.subscription[tier as keyof typeof PRICING_CONFIG.subscription].trialDays,
        metadata: {
          userId,
          tier
        }
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/cancelled`,
      metadata: {
        userId,
        tier
      }
    })

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id
    })
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

// Handle subscription management
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Get user's subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, subscription_status, current_period_end')
      .eq('id', userId)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({
        hasSubscription: false,
        status: 'none'
      })
    }

    // Get subscription from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        hasSubscription: false,
        status: 'inactive'
      })
    }

    const subscription = subscriptions.data[0]

    return NextResponse.json({
      hasSubscription: true,
      status: subscription.status,
      tier: subscription.metadata.tier || 'premium',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    })
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}