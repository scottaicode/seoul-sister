'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, Loader2, Check, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS, PAYWALL_FEATURES } from '@/lib/stripe'
import { PRICING } from '@/lib/pricing'
import { trackEvent, PaywallEvent } from '@/lib/analytics'
import type { ExtractedSkinProfile } from '@/types/database'
import { onFileRows } from '@/lib/paywall/on-file'
import { getOfferCode, clearOfferCode, rememberOfferCode, normalizeOfferCode, priceWithOffer, pricingCardLines, paywallFreeWeekLine, paywallStartLine, stripeHandoffLine, paywallStartLineDirect, directAgreeLabel, useStripePageLabel, codeNotAppliedHereLine, tickToStartLine, startWithoutCodeLabel, couldNotStartLine } from '@/lib/offers'
import { directFreeWeekTerms } from '@/lib/stripe-params'
import FreeWeekStarted from '@/components/subscribe/FreeWeekStarted'
import { browserTimeZone } from '@/lib/start-free-week'

export default function SubscribePage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  // Priority 2 — arriving straight from onboarding is the earned VALUE MOMENT:
  // Yuri has just learned the visitor's skin. (She has NOT built a routine: the
  // onboarding prompt keeps the complete build for members. This page said "I've
  // built ... your first routine" until Nov 10 2026, which was false.) Read via
  // window (client component) to avoid the useSearchParams Suspense requirement.
  const [fromOnboarding, setFromOnboarding] = useState(false)
  // What the setup chat captured, shown back as facts. null = nothing on file
  // (skipped setup, or the read failed and was logged).
  const [onFile, setOnFile] = useState<ExtractedSkinProfile | null>(null)
  // From /api/me/trial, which applies the SAME rule as the checkout route
  // (src/lib/trial.ts). null = unknown: the page then makes no trial claim.
  const [trialEligible, setTrialEligible] = useState<boolean | null>(null)
  // true = that trial starts with no card. Only meaningful when eligible.
  const [noCardTrial, setNoCardTrial] = useState(false)
  // true = this person already used their free week (it ended without a card).
  const [hadTrial, setHadTrial] = useState(false)
  // true = no free week here because several were started from this network recently.
  const [networkCap, setNetworkCap] = useState(false)
  // The free week starts on this page (no Stripe page): the terms and a box to
  // tick are shown here. Only what /api/me/trial says; the checkout decides again.
  const [directMode, setDirectMode] = useState(false)
  const [agreed, setAgreed] = useState(false)
  // Set once the free week has started here: the page then says so before moving on.
  const [started, setStarted] = useState<{ endsAt: string | null } | null>(null)
  // Offer Stripe's page after our own could not do it (a failure, or a code we cannot apply).
  const [stripeOption, setStripeOption] = useState(false)
  // A code this page cannot apply (not a creator code). While it is set the
  // free week is NOT started here: the person chooses Stripe's page, where it
  // can be entered, or says to go on without it. Never dropped silently.
  const [foreignCode, setForeignCode] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  // The setup chat is unfinished and can be gone back to (started or skipped).
  const [setupOpen, setSetupOpen] = useState(false)

  /** What this person can start, as /api/me/trial states it. Anything missing is treated as not on offer. */
  function applyTrialFacts(t: { eligible?: boolean | null; no_card?: boolean; direct?: boolean; had_trial?: boolean; network_cap?: boolean }) {
    setTrialEligible(t.eligible === true)
    setNoCardTrial(t.eligible === true && t.no_card === true)
    setDirectMode(t.eligible === true && t.no_card === true && t.direct === true)
    setHadTrial(t.had_trial === true)
    setNetworkCap(t.network_cap === true)
  }
  // A creator code remembered by this browser (e.g. BAILEY from her link), and
  // what Stripe says about it. The line is shown only when Stripe answered; if
  // it could not be asked, the page says nothing about the code.
  const [offerCode, setOfferCode] = useState<string | null>(null)
  const [offerLine, setOfferLine] = useState<string | null>(null)
  const [offerActive, setOfferActive] = useState(false)
  const [offerPercent, setOfferPercent] = useState<number | null>(null)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFromOnboarding(new URLSearchParams(window.location.search).get('from') === 'onboarding')
    }
  }, [])

  // If user already has a subscription, skip to onboarding/dashboard
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/register')
      return
    }

    async function checkSubscription() {
      try {
        const { data: profile } = await supabase
          .from('ss_user_profiles')
          .select('plan, onboarding_completed')
          .eq('user_id', user!.id)
          .maybeSingle()

        if (profile?.plan && profile.plan !== 'free') {
          // Already subscribed — go to onboarding or dashboard
          router.replace(profile.onboarding_completed ? '/dashboard' : '/onboarding')
          return
        }
      } catch {
        // Profile check failed — show subscribe page anyway
      }

      // What to show on the wall. Both reads are the user's own rows (RLS). A
      // failure leaves the generic, still-true copy and is logged.
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        const [progressRes, trialRes] = await Promise.all([
          supabase
            .from('ss_onboarding_progress')
            .select('skin_profile_data, onboarding_status')
            .eq('user_id', user!.id)
            .maybeSingle(),
          accessToken
            ? fetch('/api/me/trial', { headers: { Authorization: `Bearer ${accessToken}` } })
            : Promise.resolve(null),
        ])
        if (progressRes.error) {
          console.error('[subscribe] setup profile read failed:', progressRes.error.message)
        } else {
          // Only a FINISHED setup backs "I have what I need". AppShell also
          // sends people here mid-setup (20 such accounts on Nov 10 2026, one
          // with partial data); they get the generic copy and no card.
          // The setup chat can still be continued when it was started or
          // skipped, not when it is finished (that page sends a finished setup
          // straight back here) and not when its state could not be read.
          const status = progressRes.data?.onboarding_status
          setSetupOpen(status === 'in_progress' || status === 'skipped')
          setOnFile(
            progressRes.data?.onboarding_status === 'completed'
              ? ((progressRes.data.skin_profile_data as ExtractedSkinProfile | null) ?? null)
              : null
          )
        }
        let startsHere = false
        if (trialRes && trialRes.ok) {
          const facts = await trialRes.json()
          applyTrialFacts(facts)
          startsHere = facts?.eligible === true && facts?.no_card === true && facts?.direct === true
        } else {
          console.error('[subscribe] trial facts unavailable; making no trial claim')
        }

        const code = getOfferCode()
        if (code) {
          setOfferCode(code)
          const offerRes = await fetch(`/api/offer?code=${encodeURIComponent(code)}`)
          if (offerRes.ok) {
            const o = (await offerRes.json()) as { state?: string; line?: string; percent_off?: number }
            if (o.state === 'active' || o.state === 'ended') setOfferLine(o.line ?? null)
            setOfferActive(o.state === 'active')
            setOfferPercent(o.state === 'active' && typeof o.percent_off === 'number' ? o.percent_off : null)
            // A code Stripe does not accept is forgotten, so it is not sent
            // (and refused) at the button.
            if (o.state !== 'active') {
              clearOfferCode()
              setOfferCode(null)
              // On Stripe's page such a code can still be typed. Here there is
              // no such box, so say what happened and offer that page.
              if (startsHere && o.state === 'unknown') {
                setForeignCode(code)
                setOfferLine(codeNotAppliedHereLine(code))
                setStripeOption(true)
              }
            }
          } else {
            console.error('[subscribe] offer lookup unavailable; saying nothing about the code')
          }
        }
      } catch (err) {
        console.error('[subscribe] paywall context read failed:', err)
      }

      // Free-plan user is actually seeing the wall. Record it both ways:
      // GA4 (aggregate funnel) + set-once DB stamp (reachable bounce cohort).
      trackEvent(PaywallEvent.view)
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (token) {
          await fetch('/api/me/paywall-reached', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
        }
      } catch {
        // Measurement must never block the paywall.
      }

      setChecking(false)
    }

    checkSubscription()
  }, [user, authLoading, router])

  /** A code typed on this page (direct mode only). Stripe decides; nothing is said about how many are left. */
  async function applyTypedCode() {
    const code = normalizeOfferCode(codeInput)
    if (!code) {
      setOfferLine('That does not look like a code. Codes are 3 to 20 letters and numbers.')
      return
    }
    setCodeBusy(true)
    try {
      const res = await fetch(`/api/offer?code=${encodeURIComponent(code)}`)
      if (res.status === 429) {
        setOfferLine('Too many tries just now. Please wait a few minutes and try the code again.')
        return
      }
      if (!res.ok) {
        setOfferLine('The code could not be checked just now. Please try again in a minute.')
        return
      }
      const o = (await res.json()) as { state?: string; line?: string; percent_off?: number }
      if (o.state === 'active' && typeof o.percent_off === 'number') {
        setForeignCode(null)
        rememberOfferCode(code)
        setOfferCode(code)
        setOfferActive(true)
        setOfferPercent(o.percent_off)
        setOfferLine(o.line ?? null)
        setCodeInput('')
      } else if (o.state === 'ended') {
        setOfferLine(o.line ?? null)
      } else {
        // Not a creator code. It may still be a real promotion code, which
        // only Stripe's page can take.
        setForeignCode(code)
        setOfferLine(codeNotAppliedHereLine(code))
        setStripeOption(true)
        setCodeInput('')
      }
    } catch (err) {
      console.error('[subscribe] typed code lookup failed:', err)
      setOfferLine('The code could not be checked just now. Please try again in a minute.')
    } finally {
      setCodeBusy(false)
    }
  }

  async function handleCheckout(useStripePage = false) {
    if (!user) {
      router.push('/register')
      return
    }

    trackEvent(PaywallEvent.checkoutClick)
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // The remembered code is always sent, even if this page could not ask
        // about it: the server asks Stripe itself and stops if the code closed.
        // expect_free_week: this page has just said "no card, nothing charged
        // today". The checkout decides again and refuses if it cannot honour it.
        body: JSON.stringify({
          plan: 'monthly',
          ...(offerCode ? { offer_code: offerCode } : {}),
          ...(trialEligible === true && noCardTrial ? { expect_free_week: true } : {}),
          // Which way of starting this page showed. Stripe's page is always
          // accepted; ours only while the server still starts it that way.
          ...(trialEligible === true && noCardTrial
            ? directMode && !useStripePage
              ? { via: 'direct', agreed_terms: agreed, ...browserTimeZone() }
              : { via: 'stripe' }
            : {}),
        }),
      })

      const result = await response.json()
      if (response.status === 409 && result.offer_ended) {
        // The code closed. Show that where the code line is and forget the
        // code; pressing the button again continues at the normal price.
        clearOfferCode()
        setOfferCode(null)
        setOfferActive(false)
        setOfferPercent(null)
        setOfferLine(result.error)
        return
      }
      if (response.status === 409 && result.free_week_changed) {
        // The no-card free week is not available after all. Nothing was
        // started. Read again what DOES apply (a card-required week, or
        // membership charged today) so the page states it before a second
        // press, then say what happened. If that read fails, offer nothing as
        // free: the checkout decides again on the next press either way.
        try {
          const again = await fetch('/api/me/trial', { headers: { Authorization: `Bearer ${token}` } })
          if (again.ok) applyTrialFacts(await again.json())
          else applyTrialFacts({})
        } catch {
          applyTrialFacts({})
        }
        setCheckoutError(result.error)
        return
      }
      if (response.status === 409 && result.already_member) {
        // Started in another tab, or a moment ago: they are a member. Go on in.
        router.replace('/yuri')
        return
      }
      if (result.started_not_recorded) {
        // The free week is running at Stripe; our records are not written.
        // The same button finishes it. Stripe's page must NOT be offered: it
        // would make a second subscription.
        setStripeOption(false)
        setCheckoutError(result.error)
        return
      }
      if (result.code_not_applied || result.direct_failed) {
        // Nothing was started here. Stripe's page can still do it.
        setStripeOption(true)
        setCheckoutError(result.error)
        return
      }
      if (response.ok && result.started === true) {
        // Started on this page. Say so, with when it ends, before moving on.
        trackEvent(PaywallEvent.checkoutRedirect)
        setStarted({ endsAt: typeof result.ends_at === 'string' ? result.ends_at : null })
        return
      }
      if (result.offer_failed) {
        // The code could not be applied right now. It stays remembered for a
        // later visit, but the next press of the button goes without it.
        setOfferCode(null)
        setOfferActive(false)
        setOfferPercent(null)
        setOfferLine(result.error)
        return
      }
      if (!response.ok) throw new Error(result.error)

      trackEvent(PaywallEvent.checkoutRedirect)
      window.location.href = result.url
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutError(err instanceof Error && err.message ? err.message : couldNotStartLine())
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (started) return <FreeWeekStarted endsAt={started.endsAt} onContinue={() => router.replace('/onboarding?started=1')} />

  const tier = SUBSCRIPTION_TIERS.monthly
  const rows = onFileRows(onFile)
  const hasProfile = rows.length > 0
  // Every price sentence on this page: with a confirmed code, the discounted
  // first month and the price after it, so no line contradicts the code line.
  const priceLong = priceWithOffer(offerActive ? offerPercent : null)
  // Someone who can start the free week with no card sees THAT first, in the
  // same words as the public pricing card (Nov 11 2026: this page still led
  // with the price in large type and the free week in small grey print, at the
  // exact moment a person decides). Anyone else sees the price first, because
  // for them the price is what happens today.
  const freeWeekLeads = trialEligible === true && noCardTrial
  const card = pricingCardLines()

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-gradient mb-2">
          {hadTrial ? 'Your free week has ended' : hasProfile ? 'Ready to build your routine?' : fromOnboarding ? 'Want me to keep going?' : freeWeekLeads ? 'Start your free week' : 'Become a member'}
        </h1>
        <p className="text-white/50 text-sm">
          {hadTrial
            ? `Nothing was charged. Your skin profile and everything we worked out are saved. Continue for ${priceLong} and we pick up where we left off.`
            : hasProfile
            ? "I have what I need from our setup chat. Once you're a member, we start by building your routine from it, morning and night where you need both. Then, most weeks, I check in and adjust it from how your skin is doing."
            : 'You have a free account. Membership is separate: I learn your skin, we build your routine together, and I remember all of it.'}
        </p>
        {/* Someone who has not finished the setup chat (they skipped it, or
            arrived another way) can go back to it: it is free and still open.
            Without this the page had no way back to the chat they left. */}
        {!hadTrial && !hasProfile && setupOpen && (
          <p className="text-sm mt-3">
            <Link href="/onboarding" className="text-gold-light underline underline-offset-2 hover:text-gold">
              Rather talk first? Back to the setup chat
            </Link>
          </p>
        )}
      </div>

      {hasProfile && (
        <div className="dark-card p-5 text-left mb-6 border border-white/10 rounded-2xl">
          <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3">What you told me in setup</p>
          <dl className="space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="flex gap-3 text-sm">
                <dt className="text-white/40 shrink-0 w-36">{r.label}</dt>
                <dd className="text-white/80">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="relative dark-card-gold p-8 text-left shadow-glow-gold">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge-gold font-semibold px-4 py-1 text-xs whitespace-nowrap">
          Your K-Beauty Advisor, Available 24/7
        </span>

        <div className="flex items-center gap-2 mb-2 mt-2">
          <Star className="w-5 h-5 text-gold" />
          <p className="font-display font-bold text-xl text-white">Seoul Sister Pro</p>
        </div>

        {freeWeekLeads ? (
          <>
            <p className="text-4xl font-bold text-white leading-tight">{card.headline}</p>
            <p className="text-base font-semibold text-gold-light mb-2">{directMode ? paywallStartLineDirect() : paywallStartLine()}</p>
          </>
        ) : (
          <div className="flex items-baseline gap-1 mb-1">
            <p className="text-4xl font-bold text-white">${tier.price}</p>
            <span className="text-base font-normal text-white/60">/month</span>
          </div>
        )}
        <p className={freeWeekLeads ? 'text-sm text-white/80 mb-6' : 'text-sm text-white/60 mb-6'}>
          {trialEligible === true && noCardTrial
            ? paywallFreeWeekLine(priceLong)
            : trialEligible === true
              ? `First ${PRICING.trial_days} days free, then ${priceLong}. Cancel anytime.`
              : hadTrial
                ? `Your free week has ended. Continue for ${priceLong}. Cancel anytime.`
                : networkCap
                  ? `${priceLong}, charged today. The free week is not available here because several have already been started from this network recently. Cancel anytime.`
                  : `${priceLong}. Cancel anytime.`}
        </p>

        {offerLine && !(freeWeekLeads && directMode) && (
          <p className={`text-xs mb-6 -mt-3 ${offerActive ? 'text-gold-light' : 'text-white/50'}`} role="status">
            {offerLine}
          </p>
        )}

        <ul className="space-y-3 mb-6">
          {PAYWALL_FEATURES.map((f) => (
            <li key={f} className="flex gap-2.5 text-sm text-white/85">
              <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        {freeWeekLeads && directMode && (
          <div className="mb-5">
            {!offerActive && (
              <div className="flex gap-2 mb-4">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && codeInput.trim() && !codeBusy) void applyTypedCode() }}
                  placeholder="Have a code?"
                  aria-label="Have a code? Enter it here"
                  maxLength={20}
                  autoCapitalize="characters"
                  className="flex-1 rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-base text-white placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={applyTypedCode}
                  disabled={codeBusy || !codeInput.trim()}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}
            {offerLine && (
              <p className={`text-xs mb-4 ${offerActive ? 'text-gold-light' : 'text-white/70'}`} role="status">{offerLine}</p>
            )}
            <p className="text-xs text-white/70 leading-relaxed mb-3">{directFreeWeekTerms(PRICING.trial_days, offerActive ? offerPercent : null)}</p>
            <label className="flex items-start gap-2.5 text-xs text-white/85">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0" />
              <span>
                {directAgreeLabel()}{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Read the Terms</a>
              </span>
            </label>
          </div>
        )}

        <button
          onClick={() => handleCheckout()}
          disabled={loading || (freeWeekLeads && directMode && (!agreed || foreignCode !== null))}
          aria-describedby={freeWeekLeads && directMode && !agreed ? 'tick-to-start' : undefined}
          className="glass-button-primary w-full flex items-center justify-center gap-2 text-sm py-3 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {freeWeekLeads ? card.cta : trialEligible === true ? `Start ${PRICING.trial_days} days free` : 'Start membership'} <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        {checkoutError && <p className="text-center text-xs text-rose-300 mt-3" role="alert">{checkoutError}</p>}

        {freeWeekLeads && directMode && !agreed && (
          <p id="tick-to-start" className="text-center text-xs text-white/60 mt-2">{tickToStartLine()}</p>
        )}
        {freeWeekLeads && directMode && foreignCode !== null && (
          <button
            type="button"
            onClick={() => { setForeignCode(null); setOfferLine(null); setStripeOption(false) }}
            className="block mx-auto mt-3 text-xs text-white/70 underline underline-offset-2"
          >
            {startWithoutCodeLabel()}
          </button>
        )}
        {freeWeekLeads && directMode && stripeOption && (
          <button
            type="button"
            onClick={() => handleCheckout(true)}
            disabled={loading}
            className="block mx-auto mt-3 text-xs text-white/70 underline underline-offset-2 disabled:opacity-50"
          >
            {useStripePageLabel()}
          </button>
        )}
        {freeWeekLeads && directMode && stripeOption && (
          <p className="text-center text-xs text-white/50 mt-2">{stripeHandoffLine()}</p>
        )}

        {!(freeWeekLeads && directMode) && (
          <p className="text-center text-xs text-white/50 mt-3">
            {trialEligible === true && noCardTrial ? stripeHandoffLine() : 'Secure payment via Stripe.'}
          </p>
        )}

      </div>

      {/* Escape hatch — a free user parked on the paywall must never be trapped.
          /subscribe is under the (auth) group with no nav bar, so without this
          there is NO link to manage or delete the account (right-to-erasure). */}
      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-white/60">
        <button
          onClick={() => router.push('/settings')}
          className="hover:text-white/70 transition-colors underline underline-offset-2"
        >
          Manage account
        </button>
        <span className="text-white/20">·</span>
        <button
          onClick={async () => { await signOut(); router.push('/'); }}
          className="hover:text-white/70 transition-colors underline underline-offset-2"
        >
          Log out
        </button>
      </div>
    </div>
  )
}
