import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient, planFromStripePriceId, applySavedCardToSubscription, type TierKey } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'
import { attributeConversion, leadSourceForEmail } from '@/lib/widget/visitor'
import { recordTrialStart, markTrialLapsed, isStaleSubscriptionEvent } from '@/lib/trial'
import { onInvoicePaid } from '@/lib/trial-events'
import { offerFromSubscription } from '@/lib/offers'
import { sendTrialEndedEmail } from '@/lib/email/trial-emails'
import { notifyNewSubscriber } from '@/lib/email/new-subscriber-alert'
import { sendSubscriptionConfirmation } from '@/lib/email/subscription-confirmation'
import { subscriptionPeriod, invoiceSubscriptionId, invoiceAmountPaid } from '@/lib/stripe-payload'
import type Stripe from 'stripe'

/** Map plan key to the ss_subscriptions.tier column value */
function planToTier(_plan: TierKey): string {
  return 'pro' // Single tier — all subscribers are pro
}

/** When Stripe created the subscription, as ISO, or null. */
function stripeCreatedAt(subscription: { created?: number | null }): string | null {
  return typeof subscription.created === 'number' && subscription.created > 0
    ? new Date(subscription.created * 1000).toISOString()
    : null
}

/** The account's email from auth, or null. Never throws. */
async function emailForUser(db: ReturnType<typeof getServiceClient>, userId: string): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId)
    return data?.user?.email ?? null
  } catch (err) {
    console.error('[stripe webhook] could not read the account email:', err)
    return null
  }
}

/** The member's time zone, for dates in emails. null (then UTC, labelled) if unknown or unreadable. */
async function timezoneForUser(db: ReturnType<typeof getServiceClient>, userId: string): Promise<string | null> {
  const { data, error } = await db.from('ss_user_profiles').select('timezone').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('[stripe webhook] could not read the member time zone; email dates will be UTC:', error.message)
    return null
  }
  return (data?.timezone as string | null) ?? null
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

        // A member on a no-card trial saved a card (setup-mode Checkout, see
        // createAddCardSession). Make it the subscription's default, which is
        // what Stripe checks when the trial ends. A failure throws so Stripe
        // retries: the member was told the card was saved.
        if (userId && session.mode === 'setup' && session.metadata?.purpose === 'trial_add_card') {
          const setupIntentId =
            typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id
          if (!setupIntentId) throw new Error(`add-card session ${session.id} has no setup intent`)
          const saved = await applySavedCardToSubscription(setupIntentId)
          if (!saved.applied) {
            // The trial ended (or the session had no card) before the card
            // could be attached. Nothing to retry: say so loudly and stop.
            console.error(
              `[stripe webhook] saved card NOT applied for user ${userId} (${saved.reason}, subscription ${saved.subscriptionId ?? 'unknown'}). The member may believe a card is on file.`
            )
            break
          }
          const { error: cardStampError } = await supabase
            .from('ss_trial_starts')
            .update({ card_added_at: new Date().toISOString() })
            .eq('stripe_subscription_id', saved.subscriptionId)
            .is('card_added_at', null)
          if (cardStampError) {
            // The card IS attached in Stripe; only the bookkeeping row failed.
            console.error(`[stripe webhook] card_added_at stamp failed for ${saved.subscriptionId}:`, cardStampError.message)
          }
          // Saving the card is the moment auto-renewal starts, so the member
          // gets the renewal terms in writing (price, first charge date, how to
          // cancel). Best-effort.
          try {
            const cardEmail = session.customer_details?.email || (await emailForUser(supabase, userId))
            const { data: trialRow } = await supabase
              .from('ss_subscriptions')
              .select('trial_end, offer_percent_off')
              .eq('stripe_subscription_id', saved.subscriptionId)
              .maybeSingle()
            if (cardEmail) {
              const confirm = await sendSubscriptionConfirmation(
                cardEmail,
                trialRow?.trial_end ? new Date(trialRow.trial_end) : null,
                { cardOnFile: true, percentOff: trialRow?.offer_percent_off == null ? null : Number(trialRow.offer_percent_off), timezone: await timezoneForUser(supabase, userId) }
              )
              if (!confirm.sent) console.error(`[stripe webhook] card-saved confirmation NOT sent to user ${userId}: ${confirm.reason}`)
            } else {
              console.error(`[stripe webhook] no email for user ${userId}; card-saved confirmation not sent`)
            }
          } catch (confirmErr) {
            console.error('[stripe webhook] card-saved confirmation threw:', confirmErr)
          }
          break
        }

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
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['discount.promotion_code'] })
          const priceId = subscription.items.data[0]?.price?.id
          const plan = planFromStripePriceId(priceId ?? '')

          // Attribution (NORTH-STAR.md One Metric): tie this paid subscription
          // back to a Yuri widget conversation by matching the buyer's email
          // to a captured widget lead. Best-effort — never blocks the webhook.
          // The buyer email comes from the Stripe session (collected at checkout).
          const buyerEmail =
            session.customer_details?.email || session.customer_email || null
          // A free trial is NOT a paid conversion (Nov 10 2026). Stamping it
          // here made every trial start count as paid in the One Metric. The
          // stamp now happens when the trial becomes a paying subscription
          // (customer.subscription.updated, trialing -> active). A checkout
          // with no trial is paid today and is stamped here as before.
          const isTrial = subscription.status === 'trialing'
          const noCardTrial = isTrial && subscription.metadata?.no_card === '1'
          const leadSource = isTrial
            ? await leadSourceForEmail(buyerEmail)
            : await attributeConversion(buyerEmail, userId)

          const period = subscriptionPeriod(subscription)
          if (!period) {
            throw new Error(`subscription ${subscriptionId} has no readable billing period`)
          }

          // The discount this subscription actually carries, from Stripe's own
          // record (a code typed into Stripe's box never reaches our metadata).
          // Stored so "who used Bailey's code, who paid" is readable from our
          // rows, and so later notices state the price the card will be charged.
          const { code: offerCode, percentOff: offerPercentOff } = offerFromSubscription(subscription, session.metadata)

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
              stripe_created_at: stripeCreatedAt(subscription),
              offer_code: offerCode,
              offer_percent_off: offerPercentOff,
              lead_source: leadSource, // 'widget' if matched, else null (organic/unknown)
              current_period_start: period.start,
              current_period_end: period.end,
            },
            { onConflict: 'user_id' }
          )
          if (checkoutUpsertError) {
            throw new Error(`ss_subscriptions upsert failed: ${checkoutUpsertError.message}`)
          }

          const { error: planWriteError } = await supabase
            .from('ss_user_profiles')
            .update({ plan })
            .eq('user_id', userId)
          if (planWriteError) {
            throw new Error(`ss_user_profiles plan write failed: ${planWriteError.message}`)
          }

          // One row per trial ever started. It is the "trial started" count and
          // the one-trial-per-person ledger, so a failed write must retry.
          if (isTrial) {
            // The ledger is keyed on the inbox, so it needs a real address:
            // the one Stripe collected, else the account's own.
            const ledgerEmail = buyerEmail ?? (await emailForUser(supabase, userId))
            if (!ledgerEmail) throw new Error(`no email for user ${userId}; cannot record the trial`)
            const recorded = await recordTrialStart(supabase, {
              userId,
              email: ledgerEmail,
              subscriptionId,
              cardRequired: !noCardTrial,
              trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              ipHash: session.metadata?.ip_hash ?? null,
              offerCode,
              offerPercentOff,
            })
            if (!recorded) throw new Error(`could not record trial start for ${subscriptionId}`)
          }

          // Auto-renewal confirmation the customer keeps (price, first charge
          // date, how to cancel). Required by California's auto-renewal law;
          // Stripe sends no receipt for a $0 trial invoice. Best-effort.
          if (buyerEmail) {
            try {
              const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
              const confirm = await sendSubscriptionConfirmation(buyerEmail, trialEnd, { cardOnFile: !noCardTrial, percentOff: offerPercentOff, timezone: await timezoneForUser(supabase, userId) })
              if (!confirm.sent) {
                console.error(`[stripe webhook] subscription confirmation NOT sent to user ${userId}: ${confirm.reason}`)
              }
            } catch (confirmErr) {
              console.error('[stripe webhook] subscription confirmation threw:', confirmErr)
            }
          } else {
            console.error(`[stripe webhook] no buyer email on session; confirmation not sent for user ${userId}`)
          }

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
              kind: isTrial ? 'trial_started' : 'paid',
              trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
              cardOnFile: !noCardTrial,
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

        // Stripe does not guarantee event order. A late or retried event for
        // an OLD subscription (a lapsed trial) must not overwrite the row of
        // the newer one this person is now paying for, or clear their plan.
        const { data: storedSub, error: storedErr } = await supabase
          .from('ss_subscriptions')
          .select('stripe_subscription_id, status, stripe_created_at')
          .eq('user_id', userId)
          .maybeSingle()
        if (storedErr) throw new Error(`ss_subscriptions read failed: ${storedErr.message}`)
        if (isStaleSubscriptionEvent(storedSub, { subscriptionId: subscription.id, status: subscription.status, createdAt: stripeCreatedAt(subscription) })) {
          console.warn(`[stripe webhook] ignoring ${event.type} for old subscription ${subscription.id}; user ${userId} is now on ${storedSub?.stripe_subscription_id}`)
          break
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
              stripe_created_at: stripeCreatedAt(subscription),
              // Kept in step with Stripe: a discount removed there must stop
              // being stated in notices. Only when the event carries the
              // `discount` field: events arrive in the endpoint's API version,
              // and a version without that field says nothing either way.
              ...((subscription as { discount?: unknown }).discount !== undefined
                ? { offer_percent_off: offerFromSubscription(subscription, subscription.metadata).percentOff }
                : {}),
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

        const { data: canceledRows, error: cancelError } = await supabase
          .from('ss_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          // Only the subscription that was actually deleted. Without this a
          // late delete for an old subscription (a lapsed trial, say) would
          // cancel a newer paid one on the same account.
          .eq('stripe_subscription_id', subscription.id)
          .select('id')
        if (cancelError) {
          throw new Error(`ss_subscriptions cancel failed: ${cancelError.message}`)
        }
        // A trial that ends without a card arrives here: mark it lapsed (a
        // trial that already paid is left alone by closeTrial).
        await markTrialLapsed(supabase, subscription.id, new Date().toISOString())

        // Zero rows = this delete is for a subscription that is no longer the
        // account's current one. Leave the plan alone.
        if (!canceledRows || canceledRows.length === 0) break

        const { error: planClearError } = await supabase
          .from('ss_user_profiles')
          .update({ plan: null })
          .eq('user_id', userId)
        if (planClearError) {
          // A silent failure here leaves a lapsed trial with full access.
          throw new Error(`ss_user_profiles plan clear failed: ${planClearError.message}`)
        }

        // A free trial that ended with nothing paid: tell the member plainly
        // that nothing was charged, what is kept, and how to continue. Without
        // this the only sign was being sent to the membership page. Best-effort.
        try {
          // Only a trial that began with no card AND never had one added. A
          // card trial that was cancelled, or a card that was added and then
          // declined, also ends here, and "no card was on file" would be false.
          const { data: lapsed } = await supabase
            .from('ss_trial_starts')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .eq('card_required', false)
            .is('card_added_at', null)
            .is('paid_at', null)
            .not('lapsed_at', 'is', null)
            .limit(1)
          if ((lapsed ?? []).length > 0) {
            const lapsedEmail = await emailForUser(supabase, userId)
            if (lapsedEmail) {
              const sent = await sendTrialEndedEmail(lapsedEmail)
              if (!sent.sent) console.error(`[stripe webhook] trial-ended email NOT sent to user ${userId}: ${sent.reason}`)
            } else {
              console.error(`[stripe webhook] no email for user ${userId}; trial-ended email not sent`)
            }
          }
        } catch (lapseErr) {
          console.error('[stripe webhook] trial-ended email threw:', lapseErr)
        }

        break
      }

      // The live endpoint is subscribed to `invoice.paid`, NOT
      // `invoice.payment_succeeded` (checked against Stripe Nov 10 2026). Until
      // then this case only named the latter, so it had never run: recovery
      // from a failed payment never fired, and a trial that converted would
      // never have been counted. Both names are handled; the work below is
      // idempotent, so receiving both for one invoice is harmless.
      case 'invoice.paid':
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

          // The first invoice actually PAID after a free trial is the
          // conversion, and the only one (src/lib/trial-events.ts). A $0 trial
          // invoice, a renewal, or a retried event all return something else.
          const outcome = await onInvoicePaid(
            supabase,
            {
              attributeConversion,
              emailForUser: (uid) => emailForUser(supabase, uid),
              notifyPaid: async ({ email, leadSource }) => {
                const notify = await notifyNewSubscriber({
                  email,
                  plan: 'monthly',
                  tier: 'pro',
                  leadSource,
                  kind: 'paid',
                  trialEnd: null,
                  cardOnFile: true,
                })
                if (!notify.sent) console.warn(`[stripe webhook] paid notify not sent: ${notify.reason}`)
              },
            },
            { subscriptionId, amountPaid: invoiceAmountPaid(event.data.object) },
            new Date().toISOString()
          )
          if (outcome === 'converted') console.log(`[stripe webhook] trial converted to paid: ${subscriptionId}`)
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
