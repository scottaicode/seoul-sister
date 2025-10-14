import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe-server'
import { createClient } from '@/lib/supabase'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        {
          const subscription = event.data.object as Stripe.Subscription
          await handleSubscriptionCreated(supabase, subscription)
        }
        break

      case 'customer.subscription.updated':
        {
          const subscription = event.data.object as Stripe.Subscription
          await handleSubscriptionUpdated(supabase, subscription)
        }
        break

      case 'customer.subscription.deleted':
        {
          const subscription = event.data.object as Stripe.Subscription
          await handleSubscriptionDeleted(supabase, subscription)
        }
        break

      case 'invoice.payment_succeeded':
        {
          const invoice = event.data.object as Stripe.Invoice
          await handlePaymentSucceeded(supabase, invoice)
        }
        break

      case 'invoice.payment_failed':
        {
          const invoice = event.data.object as Stripe.Invoice
          await handlePaymentFailed(supabase, invoice)
        }
        break

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionCreated(supabase: any, subscription: Stripe.Subscription) {
  await supabase
    .from('user_profiles')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', subscription.customer)

  console.log(`Subscription created: ${subscription.id}`)
}

async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  await supabase
    .from('user_profiles')
    .update({
      subscription_status: subscription.status,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', subscription.customer)

  console.log(`Subscription updated: ${subscription.id}`)
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  await supabase
    .from('user_profiles')
    .update({
      stripe_subscription_id: null,
      subscription_status: 'canceled',
      trial_end: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', subscription.customer)

  console.log(`Subscription deleted: ${subscription.id}`)
}

async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    await supabase
      .from('user_profiles')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)

    console.log(`Payment succeeded for subscription: ${invoice.subscription}`)
  }
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    await supabase
      .from('user_profiles')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)

    console.log(`Payment failed for subscription: ${invoice.subscription}`)
  }
}