'use client'

import { useState } from 'react'
import { Star, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'
import Link from 'next/link'
import { pricingCardLines } from '@/lib/offers'
import { MAX_FREE_MESSAGES } from '@/lib/utils/widget-session'
import { LANDING_CHAT_OPEN } from '@/lib/landing-chat'

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
  const lines = pricingCardLines()

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

        {/* The free week leads (Bailey, Nov 11 2026: "you have to happen to
            read it to see it's free for a week"). The price stays in plain
            view directly under it. Wording comes from offers.ts. */}
        <p className="text-4xl font-bold text-white leading-tight">{lines.headline}</p>
        <p className="text-base font-semibold text-gold-light mb-3">{lines.noCard}</p>
        <p className="text-sm text-white/80 mb-1">{lines.after}</p>
        <p className="text-sm text-white/60 mb-6">{lines.who} Less than a single skin consult, and she never closes.</p>

        <ul className="space-y-3 mb-6">
          {tier.features.map((f) => (
            <li key={f} className="flex gap-2.5 text-sm text-white/85">
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
            lines.cta
          )}
        </button>

        {checkoutError && <p className="text-center text-xs text-rose-300 mt-3" role="alert">{checkoutError}</p>}
        {LANDING_CHAT_OPEN && (
          <p className="text-center text-xs text-white/50 mt-3">
            Try {MAX_FREE_MESSAGES} free preview messages before subscribing.
          </p>
        )}

      </div>
    </div>
  )
}
