'use client'

import { useState } from 'react'
import { Check, Star, Sparkles, GraduationCap, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe'

interface PricingCardsProps {
  /** If true, renders checkout CTAs for authenticated users */
  isAuthenticated?: boolean
  /** Compact mode for landing page embedding */
  compact?: boolean
}

export default function PricingCards({ isAuthenticated, compact }: PricingCardsProps) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(plan: 'pro_monthly' | 'pro_annual' | 'student') {
    if (!isAuthenticated) {
      window.location.href = `/register?plan=${plan}`
      return
    }

    setLoading(plan)
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
        body: JSON.stringify({ plan }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      window.location.href = result.url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(null)
    }
  }

  const tiers = SUBSCRIPTION_TIERS

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Free */}
      <div className="glass-card p-6 text-left flex flex-col">
        <p className="font-display font-bold text-lg text-seoul-charcoal mb-1">Free</p>
        <p className="text-3xl font-bold text-seoul-charcoal mb-1">$0</p>
        <p className="text-xs text-seoul-soft mb-5">Forever free</p>
        <ul className="space-y-2.5 mb-6 flex-1">
          {tiers.free.features.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-seoul-soft">
              <Check className="w-4 h-4 text-glass-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        {isAuthenticated ? (
          <div className="glass-button w-full text-center text-sm opacity-50 cursor-default">
            Current Plan
          </div>
        ) : (
          <a href="/register" className="glass-button w-full text-center block text-sm">
            Get Started
          </a>
        )}
      </div>

      {/* Pro Monthly - Featured */}
      <div className="relative glass-card p-6 text-left border-rose-gold/30 shadow-glow-pink flex flex-col">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge-pink font-semibold px-4 py-1 text-xs shadow-glass">
          Most Popular
        </span>
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-4 h-4 text-rose-gold" />
          <p className="font-display font-bold text-lg text-seoul-charcoal">Pro</p>
        </div>
        <p className="text-3xl font-bold text-seoul-charcoal mb-1">
          $14.99
          <span className="text-base font-normal text-seoul-soft">/mo</span>
        </p>
        <p className="text-xs text-seoul-soft mb-5">Full AI intelligence suite</p>
        <ul className="space-y-2.5 mb-6 flex-1">
          {tiers.pro_monthly.features.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-seoul-soft">
              <Star className="w-4 h-4 text-rose-gold shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        <button
          onClick={() => handleCheckout('pro_monthly')}
          disabled={loading === 'pro_monthly'}
          className="glass-button-primary w-full text-center text-sm disabled:opacity-50"
        >
          {loading === 'pro_monthly' ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Start Pro'
          )}
        </button>
      </div>

      {/* Pro Annual - Best Value */}
      <div className="relative glass-card p-6 text-left flex flex-col">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge-blue font-semibold px-4 py-1 text-xs shadow-glass">
          Best Value
        </span>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-glass-600" />
          <p className="font-display font-bold text-lg text-seoul-charcoal">Pro Annual</p>
        </div>
        <p className="text-3xl font-bold text-seoul-charcoal mb-1">
          $8.33
          <span className="text-base font-normal text-seoul-soft">/mo</span>
        </p>
        <p className="text-xs text-seoul-soft mb-5">$99.99 billed annually</p>
        <ul className="space-y-2.5 mb-6 flex-1">
          {tiers.pro_annual.features.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-seoul-soft">
              <Check className="w-4 h-4 text-glass-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        <button
          onClick={() => handleCheckout('pro_annual')}
          disabled={loading === 'pro_annual'}
          className="glass-button-primary w-full text-center text-sm disabled:opacity-50"
        >
          {loading === 'pro_annual' ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Start Annual'
          )}
        </button>
      </div>

      {/* Student */}
      <div className="glass-card p-6 text-left flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-4 h-4 text-glass-600" />
          <p className="font-display font-bold text-lg text-seoul-charcoal">Student</p>
        </div>
        <p className="text-3xl font-bold text-seoul-charcoal mb-1">
          $6.99
          <span className="text-base font-normal text-seoul-soft">/mo</span>
        </p>
        <p className="text-xs text-seoul-soft mb-5">Valid .edu email required</p>
        <ul className="space-y-2.5 mb-6 flex-1">
          {tiers.student.features.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-seoul-soft">
              <Check className="w-4 h-4 text-glass-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        <button
          onClick={() => handleCheckout('student')}
          disabled={loading === 'student'}
          className="glass-button w-full text-center text-sm disabled:opacity-50"
        >
          {loading === 'student' ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Claim Student Rate'
          )}
        </button>
      </div>
    </div>
  )
}
