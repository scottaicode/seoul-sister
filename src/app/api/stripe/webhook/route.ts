import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient, planFromStripePriceId } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const stripe = getStripeClient()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Idempotency: skip if we've already processed this event
  const { data: existing } = await supabase
    .from('ss_subscription_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Log the event
  await supabase.from('ss_subscription_events').insert({
    event_type: event.type,
    stripe_event_id: event.id,
    event_data: event.data.object as Record<string, unknown>,
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        if (!userId || session.mode !== 'subscription') break

        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id

        // Retrieve the subscription to get plan details
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as Stripe.Subscription)?.id

        if (subscriptionId && customerId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = subscription.items.data[0]?.price?.id
          const plan = priceId ? planFromStripePriceId(priceId) : 'free'

          await supabase.from('ss_subscriptions').upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan,
              status: 'active',
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            },
            { onConflict: 'user_id' }
          )

          await supabase
            .from('ss_user_profiles')
            .update({ plan })
            .eq('user_id', userId)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.user_id
        if (!userId) break

        const priceId = subscription.items.data[0]?.price?.id
        const plan = priceId ? planFromStripePriceId(priceId) : 'free'
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        // Upsert subscription record
        const { data: subRecord } = await supabase
          .from('ss_subscriptions')
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              plan,
              status: subscription.status === 'active' ? 'active'
                : subscription.status === 'past_due' ? 'past_due'
                : subscription.status === 'trialing' ? 'trialing'
                : 'canceled',
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
              canceled_at: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000).toISOString()
                : null,
            },
            { onConflict: 'user_id' }
          )
          .select('id')
          .single()

        // Update event with subscription_id
        if (subRecord) {
          await supabase
            .from('ss_subscription_events')
            .update({ subscription_id: subRecord.id })
            .eq('stripe_event_id', event.id)
        }

        // Sync plan to user profile
        await supabase
          .from('ss_user_profiles')
          .update({ plan: subscription.status === 'active' ? plan : 'free' })
          .eq('user_id', userId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.user_id
        if (!userId) break

        await supabase
          .from('ss_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        await supabase
          .from('ss_user_profiles')
          .update({ plan: 'free' })
          .eq('user_id', userId)

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id

        if (subscriptionId) {
          await supabase
            .from('ss_subscriptions')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', subscriptionId)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id

        if (subscriptionId) {
          await supabase
            .from('ss_subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Still return 200 to acknowledge receipt
  }

  return NextResponse.json({ received: true })
}
