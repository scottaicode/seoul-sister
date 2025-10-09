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

    // Type the profile data explicitly
    const typedProfile = profile as {
      email: string;
      first_name: string | null;
      last_name: string | null;
      stripe_customer_id: string | null;
    }

    let customerId: string = typedProfile.stripe_customer_id || ''

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await createCustomer(
        typedProfile.email,
        `${typedProfile.first_name || ''} ${typedProfile.last_name || ''}`.trim() || undefined
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