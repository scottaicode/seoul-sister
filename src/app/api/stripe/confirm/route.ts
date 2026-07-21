import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/supabase'
import { getStripeClient, planFromStripePriceId } from '@/lib/stripe'

/** Mirrors the webhook's mapping — single tier, all subscribers are 'pro'. */
const SUBSCRIPTION_TIER = 'pro'

/**
 * Second fulfillment trigger — confirm payment directly with Stripe when the
 * buyer returns from Checkout.
 *
 * WHY THIS EXISTS (July 21 2026)
 *
 * Fulfillment was webhook-only. Stripe redirects the buyer back the INSTANT
 * payment succeeds, but `checkout.session.completed` arrives out-of-band a
 * moment later — so `ss_user_profiles.plan` still reads 'free' when they land,
 * and the app showed them a paywall seconds after they paid. If the webhook is
 * merely slow, a retry hides it; if the webhook is delayed by minutes or fails
 * outright, a genuinely paying customer is stuck being asked to pay again.
 *
 * Stripe's documented pattern (docs.stripe.com/checkout/fulfillment) is
 * DUAL-TRIGGER: the webhook AND a server-side session retrieval on return, both
 * calling the same idempotent fulfillment. Neither alone is sufficient — the
 * webhook covers the customer who closes the tab, this covers the customer
 * who's staring at the screen right now.
 *
 * SAFETY
 * - Requires an authenticated session; a user can only confirm their OWN
 *   checkout (session.metadata.user_id must match the caller).
 * - Verifies `payment_status !== 'unpaid'` with Stripe before granting
 *   anything, so typing this URL by hand grants nothing.
 * - Idempotent: upserts on user_id, and the webhook doing the same work
 *   concurrently is safe. Stripe's docs explicitly warn fulfillment may run
 *   more than once for one session.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session_id: sessionId } = await request.json()
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // A session belongs to exactly one user. Never let one account's checkout
    // upgrade another's, even if the id leaks.
    if (session.metadata?.user_id !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 })
    }

    // The authority on whether money moved is Stripe, not our redirect.
    if (session.payment_status === 'unpaid') {
      return NextResponse.json({ paid: false, reason: 'unpaid' })
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as { id?: string } | null)?.id
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : (session.customer as { id?: string } | null)?.id

    if (!subscriptionId || !customerId) {
      return NextResponse.json({ paid: false, reason: 'incomplete_session' })
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const plan = planFromStripePriceId(subscription.items.data[0]?.price?.id ?? '')

    // Service client: this write must not depend on the caller's RLS.
    const db = getServiceClient()

    // Profile plan FIRST. This is the one write that unlocks the product the
    // customer just paid for; the subscription record is bookkeeping. If the
    // bookkeeping fails we still must not leave a payer locked out.
    const { error: planError } = await db
      .from('ss_user_profiles')
      .update({ plan })
      .eq('user_id', user.id)

    if (planError) {
      console.error('[stripe/confirm] plan update failed:', planError.message)
      return NextResponse.json({ error: 'Could not apply subscription' }, { status: 500 })
    }

    // Best-effort bookkeeping — never blocks access. The webhook writes the
    // same row with the same onConflict, so a concurrent run is safe.
    const { error: subError } = await db.from('ss_subscriptions').upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        tier: SUBSCRIPTION_TIER,
        status: 'active',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (subError) {
      console.error('[stripe/confirm] ss_subscriptions upsert failed:', subError.message)
    }

    return NextResponse.json({ paid: true, plan })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[stripe/confirm] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
