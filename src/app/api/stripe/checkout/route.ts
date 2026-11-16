import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutSession, startDirectFreeWeek, findDirectFreeWeek, HasLiveSubscriptionError, type TierKey } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'
import { checkTrialEligibility, noCardTrialEnabled, directFreeWeekEnabled, networkKey } from '@/lib/trial'
import { fulfilNewSubscription } from '@/lib/subscription-fulfilment'
import { resolveOffer } from '@/lib/offers-server'
import { offerEndedLine, offerFailedLine, normalizeOfferCode, freeWeekChangedLine, startPageChangedLine, directStartFailedLine, directStartedNotRecordedLine, couldNotStartLine, codeNotAppliedHereLine } from '@/lib/offers'

// Only the current plan is sold. The legacy 'pro_monthly' plan exists for
// comped/grandfathered accounts and cannot be bought.
const CheckoutSchema = z.object({
  plan: z.enum(['monthly']).default('monthly'),
  // A creator code remembered by the browser (src/lib/offers.ts). Never
  // trusted: Stripe is asked whether it is real and still open.
  offer_code: z.string().max(40).optional(),
  // True when the page has just told the person the next step needs no card
  // and charges nothing today. The checkout refuses if it cannot honour that.
  expect_free_week: z.boolean().optional(),
  // Which way of starting the page showed: 'direct' = our own page, with the
  // terms and the box ticked there; 'stripe' = Stripe's page. Stripe's page is
  // always allowed; 'direct' only while the server still starts it that way.
  via: z.enum(['direct', 'stripe']).optional(),
  // The box under the terms on our page. Required for 'direct'.
  agreed_terms: z.boolean().optional(),
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
      return NextResponse.json({ error: couldNotStartLine() }, { status: 503 })
    }
    // A live or past-due subscription must not get a second one (a failed card
    // at trial end would otherwise lead to double billing). Send them to update
    // the card instead.
    if (priorSub && ['active', 'trialing', 'past_due', 'incomplete'].includes(priorSub.status)) {
      return NextResponse.json(
        { already_member: true, error: 'You already have a membership. If you are in your free week, use the "Add a card" button at the top of any page. To change a card on a paid membership, go to your Profile page and choose "Manage subscription".' },
        { status: 409 }
      )
    }
    // One free week per person, and a few per network (src/lib/trial.ts; the
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
      return NextResponse.json({ error: couldNotStartLine() }, { status: 503 })
    }
    const withTrial = eligibility.eligible
    const noCard = noCardTrialEnabled()

    // The page read the same rule a moment ago and may have told the person
    // "no card, nothing charged today". If the answer has changed since (the
    // per-network limit filled, the connection changed, the no-card week was
    // switched off), building a different session would show them a Stripe
    // page asking for a card under a promise that it would not. Stop instead.
    if (parsed.data.expect_free_week === true && !(withTrial && noCard)) {
      return NextResponse.json({ error: freeWeekChangedLine(), free_week_changed: true }, { status: 409 })
    }

    // Starting on our own page is only for the no-card free week, only while
    // the switch is on, and only with the terms box ticked. If the page showed
    // that and it no longer holds, nothing is started: the alternative is a
    // Stripe page nobody told them about.
    const direct = parsed.data.via === 'direct'
    if (direct && !(withTrial && noCard && directFreeWeekEnabled())) {
      return NextResponse.json({ error: withTrial && noCard ? startPageChangedLine() : freeWeekChangedLine(), free_week_changed: true }, { status: 409 })
    }
    if (direct && parsed.data.agreed_terms !== true) {
      return NextResponse.json({ error: 'Please tick the box to agree to the terms first.' }, { status: 400 })
    }

    // A creator code, if the browser sent one. Stripe decides whether it is
    // real and still open. If Stripe cannot be asked we STOP: going on without
    // the discount would charge full price to someone the page just told the
    // code was applied.
    let offer: { code: string; promotionCodeId: string; percentOff: number } | null = null
    if (parsed.data.offer_code) {
      try {
        const resolved = await resolveOffer(parsed.data.offer_code)
        if (resolved.state === 'active') {
          offer = { code: resolved.code, promotionCodeId: resolved.promotionCodeId, percentOff: resolved.percentOff }
        } else if (resolved.state === 'ended') {
          // The code closed between the page loading and the button. Say so and
          // stop; pressing the button again continues at the normal price.
          return NextResponse.json({ error: offerEndedLine(resolved.code), offer_ended: true }, { status: 409 })
        }
        // 'unknown': not a creator code. The page never claimed it, and the
        // Stripe page still has its own code box. Our own page has no such
        // box, so there we stop and point to Stripe's page rather than start
        // a free week without a code the person believes they are using.
        else if (direct) {
          return NextResponse.json({ error: codeNotAppliedHereLine(normalizeOfferCode(parsed.data.offer_code) ?? 'that code'), code_not_applied: true }, { status: 409 })
        }
      } catch (err) {
        console.error('[stripe/checkout] offer lookup failed:', err instanceof Error ? err.message : String(err))
        // offer_failed lets the page drop the code for the next press, so a
        // Stripe outage on code lookups never blocks someone from joining.
        return NextResponse.json({ error: offerFailedLine(normalizeOfferCode(parsed.data.offer_code) ?? 'you entered'), offer_failed: true }, { status: 503 })
      }
    }

    // Stamp the first checkout start (set-once). Until Nov 10 2026 "pressed the
    // paywall button" existed only in GA4, which is bot-inflated. A failed
    // stamp is logged and never blocks checkout.
    const { error: stampErr } = await getServiceClient()
      .from('ss_user_profiles')
      .update({ checkout_clicked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('checkout_clicked_at', null)
    if (stampErr) console.error('[stripe/checkout] checkout_clicked_at stamp failed:', stampErr.message)

    if (direct) {
      // No Stripe page. The subscription is made here and fulfilled here; the
      // webhook's customer.subscription.created is the second chance.
      let started: Awaited<ReturnType<typeof startDirectFreeWeek>>
      try {
        started = await startDirectFreeWeek({ userId: user.id, email: user.email!, plan: parsed.data.plan as TierKey, ipHash, offer })
      } catch (err) {
        console.error('[stripe/checkout] direct free week failed at Stripe:', err instanceof Error ? err.message : String(err))
        if (err instanceof HasLiveSubscriptionError) {
          return NextResponse.json({ already_member: true, error: 'You already have a membership.' }, { status: 409 })
        }
        // A call can fail on our side after Stripe has done the work (a
        // timeout). Ask Stripe what exists before saying anything: offering
        // Stripe's page while a free week is running would make a second.
        let after: Awaited<ReturnType<typeof findDirectFreeWeek>> | null = null
        try {
          after = await findDirectFreeWeek(user.id, user.email!)
        } catch (lookErr) {
          console.error('[stripe/checkout] could not ask Stripe what exists after the failure:', lookErr instanceof Error ? lookErr.message : String(lookErr))
        }
        // Unknown: say only that it could not be started now. No Stripe-page offer.
        if (!after) return NextResponse.json({ error: couldNotStartLine() }, { status: 502 })
        // Known to be absent: nothing started, and Stripe's page is a safe way on.
        if (!after.subscription || !after.customerId) return NextResponse.json({ error: directStartFailedLine(), direct_failed: true }, { status: 502 })
        started = { subscription: after.subscription, customerId: after.customerId }
      }
      const endsAt = started.subscription.trial_end ? new Date(started.subscription.trial_end * 1000).toISOString() : null
      try {
        await fulfilNewSubscription(getServiceClient(), {
          userId: user.id,
          customerId: started.customerId,
          subscription: started.subscription,
          buyerEmail: user.email ?? null,
          metadata: started.subscription.metadata,
          mailOnlyIfNewLedgerRow: true,
        })
      } catch (err) {
        // Stripe HAS the subscription, so the free week is running, but the
        // person is not yet a member in our records and the next page would
        // treat them as a stranger. Say exactly that. Pressing again finds
        // this same subscription (startDirectFreeWeek) and finishes; the
        // webhook is retrying the same work meanwhile.
        console.error(`[stripe/checkout] direct free week ${started.subscription.id} started but fulfilment failed; the webhook will retry:`, err instanceof Error ? err.message : String(err))
        return NextResponse.json({ error: directStartedNotRecordedLine(), started_not_recorded: true }, { status: 503 })
      }
      return NextResponse.json({ started: true, ends_at: endsAt })
    }

    let url: string
    try {
      url = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      plan: parsed.data.plan as TierKey,
      withTrial,
      noCard,
      ipHash,
      offer,
      // {CHECKOUT_SESSION_ID} is substituted by Stripe on redirect. It lets the
      // app confirm payment DIRECTLY with Stripe when the buyer returns, instead
      // of waiting on the out-of-band webhook (Stripe's documented dual-trigger
      // fulfillment pattern). Without it the only path to "you are paid" is the
      // webhook, so a delayed or failed webhook leaves a paying customer
      // looking at a paywall. See /api/stripe/confirm.
      successUrl: `${origin}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/subscribe?canceled=true`,
      })
    } catch (err) {
      if (!offer) throw err
      // Stripe refused the session with this code attached (for example the
      // last spot went a moment ago). Without this the page would resend the
      // same code forever and the person could not join at any price.
      console.error(`[stripe/checkout] session with code ${offer.code} failed:`, err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: offerFailedLine(offer.code), offer_failed: true }, { status: 409 })
    }

    return NextResponse.json({ url })
  } catch (err) {
    // The raw message (often Stripe's) is for the log, not the customer.
    console.error('[stripe/checkout] failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: couldNotStartLine() }, { status: 500 })
  }
}
