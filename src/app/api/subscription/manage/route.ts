import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createCustomer,
  createSubscription,
  cancelSubscription,
  getCustomerSubscriptions,
  getCustomerPaymentMethods,
  SEOUL_SISTER_PRICE_ID
} from '@/lib/stripe-server'
import { stripe } from '@/lib/stripe-server'
import type { Database } from '@/types/database'

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

export async function POST(request: NextRequest) {
  try {
    const { action, userId, phoneNumber, email, name } = await request.json()

    if (!userId && !phoneNumber) {
      return NextResponse.json(
        { error: 'User ID or phone number is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'create_subscription':
        return await createUserSubscription(userId, phoneNumber, email, name)

      case 'cancel_subscription':
        return await cancelUserSubscription(userId, phoneNumber)

      case 'reactivate_subscription':
        return await reactivateUserSubscription(userId, phoneNumber)

      case 'get_billing_info':
        return await getBillingInfo(userId, phoneNumber)

      case 'update_payment_method':
        const { paymentMethodId } = await request.json()
        return await updatePaymentMethod(userId, phoneNumber, paymentMethodId)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error in subscription management:', error)
    return NextResponse.json(
      {
        error: 'Failed to process subscription request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

async function createUserSubscription(userId?: string, phoneNumber?: string, email?: string, name?: string) {
  try {
    let profile: any = null

    // Get or create user profile
    if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      profile = data
    } else if (phoneNumber) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('phone', phoneNumber)
        .single()
      profile = data

      if (!profile && email) {
        // Create new user_profiles entry
        const { data: newProfile, error } = await supabase
          .from('user_profiles')
          .insert({
            phone: phoneNumber,
            email: email,
            name: name
          })
          .select()
          .single()

        if (error) throw error
        profile = newProfile
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Check if user already has active subscription
    if (profile.stripe_subscription_id) {
      const existingSubscriptions = await getCustomerSubscriptions(profile.stripe_customer_id)
      const activeSubscription = existingSubscriptions.find(sub =>
        ['trialing', 'active'].includes(sub.status)
      )

      if (activeSubscription) {
        return NextResponse.json(
          { error: 'User already has an active subscription' },
          { status: 400 }
        )
      }
    }

    // Create Stripe customer if needed
    let customerId = profile.stripe_customer_id
    if (!customerId) {
      const customer = await createCustomer(
        email || profile.email || `${phoneNumber}@seoulsister.temp`,
        name || profile.name || `Seoul Sister Customer`
      )
      customerId = customer.id

      // Update profile with customer ID
      const updateData = { stripe_customer_id: customerId }
      if (userId) {
        await supabase.from('profiles').update(updateData).eq('id', userId)
      } else {
        await supabase.from('user_profiles').update(updateData).eq('id', profile.id)
      }
    }

    // Create subscription with 7-day trial
    const subscription = await createSubscription(customerId, SEOUL_SISTER_PRICE_ID, 7)

    // Update profile with subscription info
    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    }

    if (userId) {
      await supabase.from('profiles').update(subscriptionData).eq('id', userId)
    } else {
      await supabase.from('user_profiles').update(subscriptionData).eq('id', profile.id)
    }

    // Extract client secret for payment setup
    let clientSecret: string | null = null
    if (subscription.latest_invoice && typeof subscription.latest_invoice === 'object') {
      const invoice = subscription.latest_invoice as any
      clientSecret = invoice.payment_intent?.client_secret || null
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end,
        current_period_end: subscription.current_period_end
      },
      customer_id: customerId,
      client_secret: clientSecret,
      message: 'Subscription created successfully. 7-day free trial started!'
    })

  } catch (error) {
    console.error('Error creating subscription:', error)
    throw error
  }
}

async function cancelUserSubscription(userId?: string, phoneNumber?: string) {
  try {
    let profile: any = null

    if (userId) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      profile = data
    } else if (phoneNumber) {
      const { data } = await supabase.from('user_profiles').select('*').eq('phone', phoneNumber).single()
      profile = data
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    // Cancel subscription at period end (don't immediately terminate)
    const updatedSubscription = await cancelSubscription(profile.stripe_subscription_id)

    // Update local database
    const updateData = {
      subscription_status: updatedSubscription.status,
      cancel_at_period_end: updatedSubscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    }

    if (userId) {
      await supabase.from('profiles').update(updateData).eq('id', userId)
    } else {
      await supabase.from('user_profiles').update(updateData).eq('id', profile.id)
    }

    const periodEnd = new Date(updatedSubscription.current_period_end * 1000)

    return NextResponse.json({
      success: true,
      message: `Subscription canceled. Access continues until ${periodEnd.toLocaleDateString()}`,
      subscription: {
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        current_period_end: updatedSubscription.current_period_end
      }
    })

  } catch (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }
}

async function reactivateUserSubscription(userId?: string, phoneNumber?: string) {
  try {
    let profile: any = null

    if (userId) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      profile = data
    } else if (phoneNumber) {
      const { data } = await supabase.from('user_profiles').select('*').eq('phone', phoneNumber).single()
      profile = data
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }

    // Reactivate subscription by removing cancellation
    const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: false
    })

    // Update local database
    const updateData = {
      subscription_status: subscription.status,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    }

    if (userId) {
      await supabase.from('profiles').update(updateData).eq('id', userId)
    } else {
      await supabase.from('user_profiles').update(updateData).eq('id', profile.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully!',
      subscription: {
        status: subscription.status,
        cancel_at_period_end: false,
        current_period_end: subscription.current_period_end
      }
    })

  } catch (error) {
    console.error('Error reactivating subscription:', error)
    throw error
  }
}

async function getBillingInfo(userId?: string, phoneNumber?: string) {
  try {
    let profile: any = null

    if (userId) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      profile = data
    } else if (phoneNumber) {
      const { data } = await supabase.from('user_profiles').select('*').eq('phone', phoneNumber).single()
      profile = data
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({
        billing_info: null,
        payment_methods: [],
        invoices: []
      })
    }

    // Get payment methods
    const paymentMethods = await getCustomerPaymentMethods(profile.stripe_customer_id)

    // Get recent invoices
    const invoices = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: 10
    })

    // Get current subscription details
    let subscriptionDetails = null
    if (profile.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
      subscriptionDetails = {
        id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        trial_end: subscription.trial_end
      }
    }

    return NextResponse.json({
      billing_info: {
        customer_id: profile.stripe_customer_id,
        subscription: subscriptionDetails
      },
      payment_methods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year
        } : null
      })),
      invoices: invoices.data.map(invoice => ({
        id: invoice.id,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: invoice.created,
        hosted_invoice_url: invoice.hosted_invoice_url
      }))
    })

  } catch (error) {
    console.error('Error getting billing info:', error)
    throw error
  }
}

async function updatePaymentMethod(userId?: string, phoneNumber?: string, paymentMethodId?: string) {
  try {
    let profile: any = null

    if (userId) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      profile = data
    } else if (phoneNumber) {
      const { data } = await supabase.from('user_profiles').select('*').eq('phone', phoneNumber).single()
      profile = data
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID is required' },
        { status: 400 }
      )
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: profile.stripe_customer_id
    })

    // Set as default payment method
    await stripe.customers.update(profile.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully'
    })

  } catch (error) {
    console.error('Error updating payment method:', error)
    throw error
  }
}