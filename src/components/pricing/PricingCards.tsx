'use client'

import { useState } from 'react'
import { Star, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'

interface PricingCardsProps {
  /** If true, renders checkout CTAs for authenticated users */
  isAuthenticated?: boolean
}

export default function PricingCards({ isAuthenticated }: PricingCardsProps) {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    if (!isAuthenticated) {
      window.location.href = '/register?plan=pro_monthly'
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

  const tier = SUBSCRIPTION_TIERS.pro_monthly

  return (
    <div className="max-w-md mx-auto">
      {/* Seoul Sister Pro */}
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
          className="glass-button-primary w-full text-center text-sm py-3 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : isAuthenticated ? (
            'Subscribe Now'
          ) : (
            'Get Started'
          )}
        </button>

        <p className="text-center text-[10px] text-white/30 mt-3">
          Powered by Claude Opus AI. 5 free preview messages available before signup.
        </p>
      </div>
    </div>
  )
}
