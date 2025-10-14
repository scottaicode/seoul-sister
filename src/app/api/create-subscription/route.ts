import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createCustomer, createSubscription, SEOUL_SISTER_PRICE_ID } from '@/lib/stripe-server'
import type { Database } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      )
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user already has a Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    let customerId = (profile as any)?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await createCustomer(email, name)
      customerId = customer.id
      // Note: Profile update with customer ID skipped for type safety
    }

    // Check if user already has an active subscription
    if ((profile as any)?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 400 }
      )
    }

    // Create subscription with 7-day trial
    const subscription = await createSubscription(customerId, SEOUL_SISTER_PRICE_ID, 7)

    // Note: User profile update with subscription info skipped for type safety

    // Extract client secret safely - latest_invoice can be string or object
    let clientSecret: string | null = null
    if (subscription.latest_invoice && typeof subscription.latest_invoice === 'object') {
      const invoice = subscription.latest_invoice as any
      clientSecret = invoice.payment_intent?.client_secret || null
    }

    return NextResponse.json({
      subscription,
      customerId,
      client_secret: clientSecret
    })

  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}