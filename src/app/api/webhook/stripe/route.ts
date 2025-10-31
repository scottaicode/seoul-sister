import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCancellation(subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handleSuccessfulPayment(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleFailedPayment(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId

  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  const updates = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    console.error('Failed to update subscription in database:', error)
  }
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId

  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      cancel_at_period_end: true
    })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update cancellation in database:', error)
  }
}

async function handleSuccessfulPayment(invoice: Stripe.Invoice) {
  // Log successful payment
  console.log(`Payment successful for invoice ${invoice.id}`)

  // Could send a receipt email here
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  // Get user from customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    // Update subscription status
    await supabase
      .from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('id', profile.id)

    // Send payment failed notification
    console.log(`Payment failed for user ${profile.id}`)
    // Would send email notification in production
  }
}