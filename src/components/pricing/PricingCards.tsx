'use client'

import { useState } from 'react'
import { Star, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'
import { PRICING } from '@/lib/pricing'
import { MAX_FREE_MESSAGES } from '@/lib/utils/widget-session'

interface PricingCardsProps {
  /** If true, renders checkout CTAs for authenticated users */
  isAuthenticated?: boolean
}

export default function PricingCards({ isAuthenticated }: PricingCardsProps) {
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    if (!isAuthenticated) {
      window.location.href = '/register?plan=monthly'
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
        body: JSON.stringify({ plan: 'monthly' }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      window.location.href = result.url
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutError(err instanceof Error && err.message ? err.message : 'Could not start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const tier = SUBSCRIPTION_TIERS.monthly

  return (
    <div className="max-w-md mx-auto">
      {/* Seoul Sister Pro */}
      <div className="relative dark-card-gold p-8 text-left shadow-glow-gold">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge-gold font-semibold px-4 py-1 text-xs">
          Your K-Beauty Advisor, Available 24/7
        </span>

        <div className="flex items-center gap-2 mb-2 mt-2">
          <Star className="w-5 h-5 text-gold" />
          <p className="font-display font-bold text-xl text-white">Seoul Sister Pro</p>
        </div>

        <div className="flex items-baseline gap-1 mb-1">
          <p className="text-4xl font-bold text-white">${tier.price}</p>
          <span className="text-base font-normal text-white/40">/month</span>
        </div>
        <p className="text-xs text-white/40 mb-1">Less than a single skin consult, and she never closes.</p>
        <p className="text-xs text-white/40 mb-6">New members: first {PRICING.trial_days} days free, then {PRICING.monthly_display_long}. Cancel anytime.</p>

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
          className="glass-button-primary w-full text-center text-sm py-3 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : isAuthenticated ? (
            'Subscribe'
          ) : (
            'Get Started'
          )}
        </button>

        {checkoutError && <p className="text-center text-xs text-rose-300 mt-3" role="alert">{checkoutError}</p>}
        <p className="text-center text-[10px] text-white/30 mt-3">
          Try {MAX_FREE_MESSAGES} free preview messages before subscribing.
        </p>
      </div>
    </div>
  )
}
