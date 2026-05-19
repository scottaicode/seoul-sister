'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Lock,
  ArrowRight,
  Star,
  Package,
  Shield,
  FlaskConical,
  Sparkles,
} from 'lucide-react'
import ProductEnrichment from './ProductEnrichment'

interface Props {
  productId: string
  productName: string | null
  productBrand: string | null
  ingredientCount: number
}

export default function ProductIntelligenceSection({ productId, productName, productBrand, ingredientCount }: Props) {
  const [isSubscriber, setIsSubscriber] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkAuth() {
      // v10.7.0 Phase F: server-side subscription check via /api/me/subscription.
      // The previous client-side `supabase.from('ss_user_profiles').select('plan')`
      // path was unreliable on the public /products/[id] route — Bailey hit a
      // false-negative despite plan='pro_monthly' in the DB, which surfaced as
      // permanently-blurred gated teasers on every product detail page she
      // opened. The server endpoint uses the same hasActiveSubscription helper
      // every AI route uses (Yuri chat, scan, etc.), so behavior is consistent
      // across auth-gated surfaces.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setIsSubscriber(false)
        return
      }

      try {
        const res = await fetch('/api/me/subscription', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        })
        if (!res.ok) {
          setIsSubscriber(false)
          return
        }
        const body = (await res.json()) as { active: boolean }
        setIsSubscriber(!!body.active)
      } catch {
        // Network failure — fail closed (treat as non-subscriber) rather than
        // accidentally flashing premium content to a non-subscriber.
        setIsSubscriber(false)
      }
    }

    checkAuth()
  }, [])

  // Still checking auth — show nothing (avoids flash)
  if (isSubscriber === null) return null

  // Subscriber — show full enrichment
  if (isSubscriber) {
    return (
      <div className="mb-8">
        <ProductEnrichment
          productId={productId}
          productName={productName ?? undefined}
          productBrand={productBrand ?? undefined}
        />
      </div>
    )
  }

  // Not a subscriber — show gated sections + subscribe CTA
  return (
    <>
      <div className="product-gated-content space-y-4 mb-8">
        <GatedTeaser
          icon={<Sparkles className="w-5 h-5 text-amber-400" />}
          title="Your Skin Match Score"
          description="See how this product matches your skin type, concerns, and allergies. Get personalized warnings and benefits."
        />
        <GatedTeaser
          icon={<FlaskConical className="w-5 h-5 text-emerald-400" />}
          title="Full Ingredient Analysis"
          description={`Complete breakdown of all ${ingredientCount || 'N/A'} ingredients with safety ratings, comedogenic scores, and interaction warnings.`}
        />
        <GatedTeaser
          icon={<Package className="w-5 h-5 text-sky-400" />}
          title="Price Comparison Across 6+ Retailers"
          description="Compare exact prices at Olive Young, Soko Glam, YesStyle, Amazon, and more. Find the best deal with savings calculations."
        />
        <GatedTeaser
          icon={<Star className="w-5 h-5 text-rose-400" />}
          title="Community Reviews by Skin Type"
          description="Read reviews filtered by your skin type, age, and concerns. See Holy Grail and Broke Me Out counts."
        />
        <GatedTeaser
          icon={<Shield className="w-5 h-5 text-violet-400" />}
          title="Ask Yuri About This Product"
          description="Get AI-powered analysis from Yuri, your K-beauty advisor. Counterfeit detection, dupe suggestions, and routine placement."
        />
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-rose-500/10 rounded-2xl border border-amber-500/20 p-8 text-center mb-8">
        <h2 className="font-display font-bold text-xl text-white mb-2">
          Unlock Full Product Intelligence
        </h2>
        <p className="text-white/60 text-sm mb-6 max-w-lg mx-auto">
          Seoul Sister Pro gives you personalized skin matching, full ingredient analysis,
          multi-retailer price comparison, community reviews, AI-powered advice, and more
          for every product in our database.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Start Your K-Beauty Journey — $39.99/mo
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-white/30 mt-3">
          Full access to Yuri AI advisor, unlimited scans, and all intelligence features
        </p>
      </div>
    </>
  )
}

function GatedTeaser({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="relative bg-white/[0.03] rounded-xl border border-white/10 p-5 overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[2px] bg-[#0a0a0a]/40 z-10 flex items-center justify-center">
        <Link
          href="/register"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white hover:bg-white/15 transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          Subscribe to unlock
        </Link>
      </div>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="font-medium text-sm text-white mb-1">{title}</h3>
          <p className="text-xs text-white/50">{description}</p>
        </div>
      </div>
    </div>
  )
}
