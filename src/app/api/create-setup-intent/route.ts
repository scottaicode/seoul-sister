import { NextRequest, NextResponse } from 'next/server'
import { createCustomer, createSetupIntent } from '@/lib/stripe-server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user profile from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, stripe_customer_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let customerId = profile.stripe_customer_id

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await createCustomer(
        profile.email,
        `${profile.first_name} ${profile.last_name}`.trim()
      )
      customerId = customer.id

      // Update profile with Stripe customer ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to update profile with customer ID:', updateError)
      }
    }

    // Create setup intent for saving payment method
    const setupIntent = await createSetupIntent(customerId)

    return NextResponse.json({
      setupIntent,
      customerId
    })

  } catch (error) {
    console.error('Error creating setup intent:', error)
    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 }
    )
  }
}