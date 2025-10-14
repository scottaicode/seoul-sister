import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createCustomer, createSubscription, SEOUL_SISTER_PRICE_ID } from '@/lib/stripe-server'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Check if user already has a Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    let customerId = profile.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await createCustomer(email, name)
      customerId = customer.id

      // Update user profile with Stripe customer ID
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating user profile with customer ID:', updateError)
        return NextResponse.json(
          { error: 'Failed to update user profile' },
          { status: 500 }
        )
      }
    }

    // Check if user already has an active subscription
    if (profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 400 }
      )
    }

    // Create subscription with 7-day trial
    const subscription = await createSubscription(customerId, SEOUL_SISTER_PRICE_ID, 7)

    // Update user profile with subscription ID
    const { error: subscriptionUpdateError } = await supabase
      .from('user_profiles')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (subscriptionUpdateError) {
      console.error('Error updating user profile with subscription:', subscriptionUpdateError)
      return NextResponse.json(
        { error: 'Failed to update subscription information' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscription,
      customerId,
      client_secret: subscription.latest_invoice?.payment_intent?.client_secret
    })

  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}