import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { planFromStripePriceId, type TierKey } from '@/lib/stripe'
import { attributeConversion, leadSourceForEmail } from '@/lib/widget/visitor'
import { recordTrialStartOnce } from '@/lib/trial'
import { offerFromSubscription } from '@/lib/offers'
import { notifyNewSubscriber } from '@/lib/email/new-subscriber-alert'
import { sendSubscriptionConfirmation } from '@/lib/email/subscription-confirmation'
import { subscriptionPeriod } from '@/lib/stripe-payload'

/** Map plan key to the ss_subscriptions.tier column value */
export function planToTier(_plan: TierKey): string {
  return 'pro' // Single tier — all subscribers are pro
}

/** When Stripe created the subscription, as ISO, or null. */
export function stripeCreatedAt(subscription: { created?: number | null }): string | null {
  return typeof subscription.created === 'number' && subscription.created > 0
    ? new Date(subscription.created * 1000).toISOString()
    : null
}

/** The account's email from auth, or null. Never throws. */
export async function emailForUser(db: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId)
    return data?.user?.email ?? null
  } catch (err) {
    console.error('[stripe webhook] could not read the account email:', err)
    return null
  }
}

/** The member's time zone, for dates in emails. null (then UTC, labelled) if unknown or unreadable. */
export async function timezoneForUser(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.from('ss_user_profiles').select('timezone').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('[stripe webhook] could not read the member time zone; email dates will be UTC:', error.message)
    return null
  }
  return (data?.timezone as string | null) ?? null
}

/**
 * Everything a NEW subscription needs, in one place: the ss_subscriptions row,
 * the plan on the profile, the free-week ledger row, the confirmation email
 * the member keeps, and the owner alert.
 *
 * Called from three places (Nov 15 2026):
 *  - the webhook's checkout.session.completed (a subscription started on
 *    Stripe's page), exactly as before this was moved out of the route;
 *  - the checkout route, when the free week starts on our own page;
 *  - the webhook's customer.subscription.created for such a subscription, as
 *    the second chance if the route failed after Stripe made it.
 * Throws when a row that must exist could not be written, so a webhook retries.
 */
export async function fulfilNewSubscription(
  db: SupabaseClient,
  p: {
    userId: string
    customerId: string
    subscription: Stripe.Subscription
    buyerEmail: string | null
    /** The Checkout Session's metadata when there was one (the code typed there is read from the subscription itself). */
    metadata?: Record<string, string> | null
    /** True for a start that two callers can reach: only the one that made the ledger row sends mail. */
    mailOnlyIfNewLedgerRow: boolean
  }
): Promise<{ plan: TierKey; isTrial: boolean; mailed: boolean }> {
  const { userId, customerId, subscription, buyerEmail } = p
  const priceId = subscription.items.data[0]?.price?.id
  const plan = planFromStripePriceId(priceId ?? '')

  // Attribution (NORTH-STAR.md One Metric): tie this paid subscription
  // back to a Yuri widget conversation by matching the buyer's email
  // to a captured widget lead. Best-effort — never blocks the webhook.
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
    throw new Error(`subscription ${subscription.id} has no readable billing period`)
  }

  // The discount this subscription actually carries, from Stripe's own
  // record (a code typed into Stripe's box never reaches our metadata).
  // Stored so "who used Bailey's code, who paid" is readable from our
  // rows, and so later notices state the price the card will be charged.
  const { code: offerCode, percentOff: offerPercentOff } = offerFromSubscription(subscription, p.metadata ?? null)

  const { error: checkoutUpsertError } = await db.from('ss_subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
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

  const { error: planWriteError } = await db
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
    const ledgerEmail = buyerEmail ?? (await emailForUser(db, userId))
    if (!ledgerEmail) throw new Error(`no email for user ${userId}; cannot record the trial`)
    const recorded = await recordTrialStartOnce(db, {
      userId,
      email: ledgerEmail,
      subscriptionId: subscription.id,
      cardRequired: !noCardTrial,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      ipHash: p.metadata?.ip_hash ?? subscription.metadata?.ip_hash ?? null,
      offerCode,
      offerPercentOff,
    })
    if (recorded === 'failed') throw new Error(`could not record trial start for ${subscription.id}`)
    // The direct start and the webhook can both get here for one
    // subscription. Whichever made the ledger row sends the mail.
    if (p.mailOnlyIfNewLedgerRow && recorded === 'existing') return { plan, isTrial, mailed: false }
  }

  // Auto-renewal confirmation the customer keeps (price, first charge
  // date, how to cancel). Required by California's auto-renewal law;
  // Stripe sends no receipt for a $0 trial invoice. Best-effort.
  if (buyerEmail) {
    try {
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      // One more try on a failed send: for a start reached by two callers,
      // only this one will ever send it.
      let confirm = await sendSubscriptionConfirmation(buyerEmail, trialEnd, { cardOnFile: !noCardTrial, percentOff: offerPercentOff, timezone: await timezoneForUser(db, userId), startedOnOurPage: subscription.metadata?.direct === '1' })
      if (!confirm.sent) confirm = await sendSubscriptionConfirmation(buyerEmail, trialEnd, { cardOnFile: !noCardTrial, percentOff: offerPercentOff, timezone: await timezoneForUser(db, userId), startedOnOurPage: subscription.metadata?.direct === '1' })
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
  return { plan, isTrial, mailed: true }
}
