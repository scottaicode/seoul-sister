import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutSession, type TierKey } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'
import { checkTrialEligibility, noCardTrialEnabled, networkKey } from '@/lib/trial'

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

    // A live or past-due subscription must not get a second one (below). The
    // trial rule itself lives in src/lib/trial.ts.
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
        { error: 'You already have a membership. If you are on the free trial, use the "Add a card" button at the top of any page. To change a card on a paid membership, go to your Profile page and choose "Manage subscription".' },
        { status: 409 }
      )
    }
    // One free trial per person, and a few per network (src/lib/trial.ts; the
    // paywall reads the same function through /api/me/trial, so what the button
    // said and what happens here cannot disagree). If the lookup fails we stop
    // rather than quietly charging today someone who was promised a trial.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const ipHash = networkKey(ip)
    const eligibility = await checkTrialEligibility(getServiceClient(), user, { ipHash })
    if (!eligibility.eligible && eligibility.reason === 'lookup_failed') {
      return NextResponse.json({ error: 'Could not start checkout. Please try again in a minute.' }, { status: 503 })
    }
    const withTrial = eligibility.eligible
    const noCard = noCardTrialEnabled()

    // Stamp the first checkout start (set-once). Until Nov 10 2026 "pressed the
    // paywall button" existed only in GA4, which is bot-inflated. A failed
    // stamp is logged and never blocks checkout.
    const { error: stampErr } = await getServiceClient()
      .from('ss_user_profiles')
      .update({ checkout_clicked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('checkout_clicked_at', null)
    if (stampErr) console.error('[stripe/checkout] checkout_clicked_at stamp failed:', stampErr.message)

    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      plan: parsed.data.plan as TierKey,
      withTrial,
      noCard,
      ipHash,
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
