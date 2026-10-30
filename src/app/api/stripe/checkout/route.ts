import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutSession, type TierKey } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'

// Only the current plan is sold. The legacy 'pro_monthly' plan exists for
// comped/grandfathered accounts and cannot be bought.
const CheckoutSchema = z.object({
  plan: z.enum(['monthly']).default('monthly'),
})

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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CheckoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid plan', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const origin = request.headers.get('origin') || 'https://www.seoulsister.com'

    // One free trial per person: only someone with no subscription history
    // (any status, any time) gets it. Checked by user id. If the lookup fails
    // we stop rather than quietly charging today someone promised a trial.
    const { data: priorSub, error: priorErr } = await getServiceClient()
      .from('ss_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (priorErr) {
      console.error('[stripe/checkout] subscription lookup failed:', priorErr.message)
      return NextResponse.json({ error: 'Could not start checkout. Please try again in a minute.' }, { status: 503 })
    }
    // A live or past-due subscription must not get a second one (a failed card
    // at trial end would otherwise lead to double billing). Send them to update
    // the card instead.
    if (priorSub && ['active', 'trialing', 'past_due', 'incomplete'].includes(priorSub.status)) {
      return NextResponse.json(
        { error: 'You already have a subscription. To update your card or plan, go to your Profile page and choose "Manage subscription".' },
        { status: 409 }
      )
    }
    const withTrial = !priorSub

    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      plan: parsed.data.plan as TierKey,
      withTrial,
      // {CHECKOUT_SESSION_ID} is substituted by Stripe on redirect. It lets the
      // app confirm payment DIRECTLY with Stripe when the buyer returns, instead
      // of waiting on the out-of-band webhook (Stripe's documented dual-trigger
      // fulfillment pattern). Without it the only path to "you are paid" is the
      // webhook, so a delayed or failed webhook leaves a paying customer
      // looking at a paywall. See /api/stripe/confirm.
      successUrl: `${origin}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/subscribe?canceled=true`,
    })

    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
