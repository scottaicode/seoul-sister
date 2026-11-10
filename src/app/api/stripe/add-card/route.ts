import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { createAddCardSession, liveTrialState } from '@/lib/stripe'

/**
 * POST /api/stripe/add-card
 *
 * A member on a no-card free trial saves a card so the membership continues
 * when the trial ends (Nov 10 2026). Returns a Stripe-hosted page; the webhook
 * attaches the saved card to the subscription. Only for a `trialing`
 * subscription: a paying member manages their card in the billing portal.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { data: sub, error } = await getServiceClient()
      .from('ss_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status, trial_end')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('[stripe/add-card] subscription lookup failed:', error.message)
      return NextResponse.json({ error: 'Could not open the card page. Please try again in a minute.' }, { status: 503 })
    }
    if (!sub?.stripe_customer_id || !sub.stripe_subscription_id || sub.status !== 'trialing') {
      return NextResponse.json(
        { error: 'There is no free trial on this account to add a card to. To manage a paid membership, use "Manage subscription" on your Profile page.' },
        { status: 409 }
      )
    }
    // Our row can lag Stripe by minutes at the end of a trial. A card saved
    // after the trial has ended cannot be attached, so check the date and ask
    // Stripe before sending anyone to a page that would tell them it was saved.
    const ended = sub.trial_end ? new Date(sub.trial_end).getTime() <= Date.now() : false
    const live = ended ? null : await liveTrialState(sub.stripe_subscription_id)
    if (ended || !live || live.status !== 'trialing') {
      return NextResponse.json(
        { error: 'Your free trial has ended, so there is nothing to add a card to. You can continue as a member from the membership page.', trial_ended: true },
        { status: 409 }
      )
    }
    const origin = request.headers.get('origin') || 'https://www.seoulsister.com'
    const url = await createAddCardSession({
      userId: user.id,
      stripeCustomerId: sub.stripe_customer_id,
      stripeSubscriptionId: sub.stripe_subscription_id,
      trialEnd: sub.trial_end ? new Date(sub.trial_end) : null,
      successUrl: `${origin}/dashboard?card=saved`,
      cancelUrl: `${origin}/dashboard`,
    })
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = /unauthor|not authenticated|token/i.test(message) ? 401 : 500
    if (status === 500) console.error('[stripe/add-card] failed:', message)
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Could not open the card page. Please try again.' }, { status })
  }
}
