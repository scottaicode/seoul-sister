import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createCustomer, createSetupIntent, getCustomerPaymentMethods } from '@/lib/stripe-server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Create setup intent for saving payment method
export async function POST(request: Request) {
  try {
    const { phoneNumber, email, name } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({
        error: 'Phone number is required'
      }, { status: 400 })
    }

    // Get or create customer profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phoneNumber)
      .single()

    if (!profile) {
      // Create new profile
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert({
          phone: phoneNumber,
          email: email,
          first_name: name,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({
          error: 'Failed to create profile'
        }, { status: 500 })
      }

      profile = newProfile
    }

    // Create or get Stripe customer
    let stripeCustomerId = profile.stripe_customer_id

    if (!stripeCustomerId) {
      const stripeCustomer = await createCustomer(
        email || `${phoneNumber}@seoulsister.temp`,
        name || `Customer ${phoneNumber.slice(-4)}`
      )

      stripeCustomerId = stripeCustomer.id

      // Update profile with Stripe customer ID
      await supabase
        .from('profiles')
        .update({
          stripe_customer_id: stripeCustomerId,
          email: email || profile.email,
          first_name: name || profile.first_name
        })
        .eq('id', profile.id)
    }

    // Create setup intent
    const setupIntent = await createSetupIntent(stripeCustomerId)

    return NextResponse.json({
      success: true,
      setup_intent: {
        id: setupIntent.id,
        client_secret: setupIntent.client_secret
      },
      customer: {
        id: profile.id,
        stripe_customer_id: stripeCustomerId
      }
    })

  } catch (error) {
    console.error('Payment setup error:', error)
    return NextResponse.json(
      { error: 'Payment setup failed', details: String(error) },
      { status: 500 }
    )
  }
}

// Get customer's saved payment methods
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phoneNumber = searchParams.get('phoneNumber')

    if (!phoneNumber) {
      return NextResponse.json({
        error: 'Phone number is required'
      }, { status: 400 })
    }

    // Get customer profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phoneNumber)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({
        payment_methods: [],
        has_default: false
      })
    }

    // Get payment methods from Stripe
    const paymentMethods = await getCustomerPaymentMethods(profile.stripe_customer_id)

    const formattedMethods = paymentMethods.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year
      } : null,
      created: pm.created
    }))

    return NextResponse.json({
      payment_methods: formattedMethods,
      has_default: formattedMethods.length > 0,
      customer_id: profile.stripe_customer_id
    })

  } catch (error) {
    console.error('Payment methods retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve payment methods' },
      { status: 500 }
    )
  }
}