'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2, Check, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'
import { PRICING } from '@/lib/pricing'
import { trackEvent, PaywallEvent } from '@/lib/analytics'
import type { ExtractedSkinProfile } from '@/types/database'
import { onFileRows } from '@/lib/paywall/on-file'

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
  // true = this person already used their free trial (it ended without a card).
  const [hadTrial, setHadTrial] = useState(false)
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
          setOnFile(
            progressRes.data?.onboarding_status === 'completed'
              ? ((progressRes.data.skin_profile_data as ExtractedSkinProfile | null) ?? null)
              : null
          )
        }
        if (trialRes && trialRes.ok) {
          const t = (await trialRes.json()) as { eligible?: boolean; no_card?: boolean; had_trial?: boolean }
          setTrialEligible(t.eligible === true)
          setNoCardTrial(t.eligible === true && t.no_card === true)
          setHadTrial(t.had_trial === true)
        } else {
          console.error('[subscribe] trial facts unavailable; making no trial claim')
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

  async function handleCheckout() {
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
        body: JSON.stringify({ plan: 'monthly' }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      trackEvent(PaywallEvent.checkoutRedirect)
      window.location.href = result.url
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutError(err instanceof Error && err.message ? err.message : 'Could not start checkout. Please try again.')
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

  const tier = SUBSCRIPTION_TIERS.monthly
  const rows = onFileRows(onFile)
  const hasProfile = rows.length > 0

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-gradient mb-2">
          {hadTrial ? 'Your free week has ended' : hasProfile ? 'Ready to build your routine?' : fromOnboarding ? 'Want me to keep going?' : 'One last step'}
        </h1>
        <p className="text-white/50 text-sm">
          {hadTrial
            ? `Nothing was charged. Your skin profile and everything we worked out are saved. Continue for ${PRICING.monthly_display_long} and we pick up where we left off.`
            : hasProfile
            ? "I have what I need from our setup chat. Become a member and your routine is the first thing we build. Then, most weeks, I check in and adjust it from how your skin is doing."
            : 'Become a member and we build your routine, and I keep everything I learn about your skin.'}
        </p>
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
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge-gold font-semibold px-4 py-1 text-xs">
          Full AI Intelligence Suite
        </span>

        <div className="flex items-center gap-2 mb-2 mt-2">
          <Star className="w-5 h-5 text-gold" />
          <p className="font-display font-bold text-xl text-white">Seoul Sister Pro</p>
        </div>

        <div className="flex items-baseline gap-1 mb-1">
          <p className="text-4xl font-bold text-white">${tier.price}</p>
          <span className="text-base font-normal text-white/40">/month</span>
        </div>
        <p className="text-xs text-white/40 mb-6">
          {trialEligible === true && noCardTrial
            ? `First ${PRICING.trial_days} days free. No card needed to start. Add a card any time in those ${PRICING.trial_days} days to keep going at ${PRICING.monthly_display_long}. If you don't, the trial ends and nothing is charged.`
            : trialEligible === true
              ? `First ${PRICING.trial_days} days free, then ${PRICING.monthly_display_long}. Cancel anytime.`
              : hadTrial
                ? `Your free trial has ended. Continue for ${PRICING.monthly_display_long}. Cancel anytime.`
                : `${PRICING.monthly_display_long}. Cancel anytime.`}
        </p>

        <ul className="space-y-3 mb-8">
          {tier.features.map((f) => (
            <li key={f} className="flex gap-2.5 text-sm text-white/70">
              <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="glass-button-primary w-full flex items-center justify-center gap-2 text-sm py-3 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {trialEligible === true ? `Start ${PRICING.trial_days} days free` : 'Start membership'} <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        {checkoutError && <p className="text-center text-xs text-rose-300 mt-3" role="alert">{checkoutError}</p>}

        <p className="text-center text-[10px] text-white/30 mt-3">
          {trialEligible === true && noCardTrial ? 'No card needed to start. Handled by Stripe.' : 'Secure payment via Stripe.'}
        </p>
      </div>

      {/* Escape hatch — a free user parked on the paywall must never be trapped.
          /subscribe is under the (auth) group with no nav bar, so without this
          there is NO link to manage or delete the account (right-to-erasure). */}
      <div className="flex items-center justify-center gap-4 mt-6 text-[11px] text-white/40">
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
