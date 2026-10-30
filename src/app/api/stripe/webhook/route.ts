import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient, planFromStripePriceId, type TierKey } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'
import { attributeConversion } from '@/lib/widget/visitor'
import { notifyNewSubscriber } from '@/lib/email/new-subscriber-alert'
import { subscriptionPeriod, invoiceSubscriptionId } from '@/lib/stripe-payload'
import type Stripe from 'stripe'

/** Map plan key to the ss_subscriptions.tier column value */
function planToTier(_plan: TierKey): string {
  return 'pro' // Single tier — all subscribers are pro
}

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
          const plan = planFromStripePriceId(priceId ?? '')

          // Attribution (NORTH-STAR.md One Metric): tie this paid subscription
          // back to a Yuri widget conversation by matching the buyer's email
          // to a captured widget lead. Best-effort — never blocks the webhook.
          // The buyer email comes from the Stripe session (collected at checkout).
          const buyerEmail =
            session.customer_details?.email || session.customer_email || null
          const leadSource = await attributeConversion(buyerEmail, userId)

          const period = subscriptionPeriod(subscription)
          if (!period) {
            throw new Error(`subscription ${subscriptionId} has no readable billing period`)
          }

          const { error: checkoutUpsertError } = await supabase.from('ss_subscriptions').upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              tier: planToTier(plan),
              // Was hardcoded 'active'; a free trial reports 'trialing'.
              status: subscription.status === 'trialing' ? 'trialing' : 'active',
              stripe_price_id: priceId ?? null,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              lead_source: leadSource, // 'widget' if matched, else null (organic/unknown)
              current_period_start: period.start,
              current_period_end: period.end,
            },
            { onConflict: 'user_id' }
          )
          if (checkoutUpsertError) {
            throw new Error(`ss_subscriptions upsert failed: ${checkoutUpsertError.message}`)
          }

          await supabase
            .from('ss_user_profiles')
            .update({ plan })
            .eq('user_id', userId)

          // Notify the owner — a paying customer is the most important event on
          // the platform. Best-effort; never blocks or fails the webhook.
          // Fired only here (once per checkout), not on subscription.created,
          // to avoid double-notifying the same new subscription.
          try {
            const notify = await notifyNewSubscriber({
              email: buyerEmail,
              plan,
              tier: planToTier(plan),
              leadSource,
            })
            if (!notify.sent) {
              console.warn(`[stripe webhook] new-subscriber notify not sent: ${notify.reason}`)
            }
          } catch (notifyErr) {
            console.error('[stripe webhook] new-subscriber notify threw:', notifyErr)
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.user_id
        if (!userId) break

        const priceId = subscription.items.data[0]?.price?.id
        const plan = planFromStripePriceId(priceId ?? '')
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const period = subscriptionPeriod(subscription)
        if (!period) {
          throw new Error(`subscription ${subscription.id} has no readable billing period`)
        }

        // Upsert subscription record
        const { data: subRecord, error: upsertError } = await supabase
          .from('ss_subscriptions')
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              tier: planToTier(plan),
              status: subscription.status === 'active' ? 'active'
                : subscription.status === 'past_due' ? 'past_due'
                : subscription.status === 'trialing' ? 'trialing'
                : 'canceled',
              current_period_start: period.start,
              current_period_end: period.end,
              stripe_price_id: priceId ?? null,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              canceled_at: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000).toISOString()
                : null,
            },
            { onConflict: 'user_id' }
          )
          .select('id')
          .single()

        if (upsertError) {
          throw new Error(`ss_subscriptions upsert failed: ${upsertError.message}`)
        }

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
          // A trialing subscriber has access exactly like an active one. Writing null
          // here locked trial users out of the whole app (AppShell gates on plan).
          .update({ plan: subscription.status === 'active' || subscription.status === 'trialing' ? plan : null })
          .eq('user_id', userId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.user_id
        if (!userId) break

        const { error: cancelError } = await supabase
          .from('ss_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
        if (cancelError) {
          throw new Error(`ss_subscriptions cancel failed: ${cancelError.message}`)
        }

        await supabase
          .from('ss_user_profiles')
          .update({ plan: null })
          .eq('user_id', userId)

        break
      }

      case 'invoice.payment_succeeded': {
        const subscriptionId = invoiceSubscriptionId(event.data.object)

        if (subscriptionId) {
          await supabase
            .from('ss_subscriptions')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', subscriptionId)
            // Recovery from a failed payment only. A free trial's $0 invoice
            // also fires this event and must not overwrite 'trialing';
            // customer.subscription.updated writes 'active' when a trial converts.
            .in('status', ['past_due', 'incomplete'])
        }
        break
      }

      case 'invoice.payment_failed': {
        const subscriptionId = invoiceSubscriptionId(event.data.object)

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
    // A 200 here told Stripe the event was handled when it was not, so it
    // never retried — that is how every subscription.updated was lost from
    // launch to Oct 2026. Un-log the event so the idempotency check lets the
    // retry through, and return 500 so Stripe actually retries.
    console.error(`[stripe webhook] ${event.type} ${event.id} failed:`, err)
    const { error: unlogError } = await supabase
      .from('ss_subscription_events')
      .delete()
      .eq('stripe_event_id', event.id)
    if (unlogError) {
      console.error(`[stripe webhook] could not un-log ${event.id}; Stripe retry will be skipped:`, unlogError)
    }
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
