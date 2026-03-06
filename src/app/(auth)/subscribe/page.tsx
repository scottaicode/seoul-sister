'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2, Check, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'

export default function SubscribePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

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
      setChecking(false)
    }

    checkSubscription()
  }, [user, authLoading, router])

  async function handleCheckout() {
    if (!user) {
      router.push('/register')
      return
    }

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
        body: JSON.stringify({ plan: 'pro_monthly' }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      window.location.href = result.url
    } catch (err) {
      console.error('Checkout error:', err)
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

  const tier = SUBSCRIPTION_TIERS.pro_monthly

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-gradient mb-2">
          One last step
        </h1>
        <p className="text-white/50 text-sm">
          Subscribe to unlock your full K-beauty intelligence suite.
        </p>
      </div>

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
        <p className="text-xs text-white/40 mb-6">Cancel anytime. No commitment.</p>

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
              Subscribe Now <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-white/30 mt-3">
          Powered by Claude Opus AI. Secure payment via Stripe.
        </p>
      </div>
    </div>
  )
}
