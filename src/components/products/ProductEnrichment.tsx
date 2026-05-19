'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Loader2, Lock, UserCircle, Sparkles } from 'lucide-react'
import {
  PersonalizedMatch,
  EnrichmentPriceComparison,
  CommunityIntelligence,
  AuthenticityCheck,
  TrendContext,
  IngredientInsights,
  SeasonalContext,
  OverlapPreview,
} from '@/components/shared/EnrichmentSections'
import type { ScanEnrichment } from '@/lib/scanning/enrich-scan'

interface ProductEnrichmentProps {
  productId: string
  /**
   * Optional product display info — when provided, the enrichment renders a
   * Yuri CTA at the top with `?ask=` prefill carrying product context. v10.6.6
   * Phase G adds this so subscribers can route any product question through
   * Yuri instead of trying to interpret the algorithmic enrichment in isolation.
   * Without these props the CTA is hidden (legacy callers).
   */
  productName?: string
  productBrand?: string
}

/**
 * Build the Yuri prefill question. Stays observational — Yuri reasons with
 * full context (skin profile, decision memory, treatment phase) when the
 * conversation opens; this just hands her the product + lets her take it
 * from there. Per the Yuri Sole Authority Principle, this surface offers a
 * CTA, not an algorithmic verdict.
 */
function buildYuriProductPrefill(name: string, brand: string): string {
  const display = brand ? `${brand} ${name}` : name
  return `I'm looking at ${display}. Given my skin profile, current routine, and where I am in my treatment phase — would this be a good fit, or should I skip it?`
}

export default function ProductEnrichment({ productId, productName, productBrand }: ProductEnrichmentProps) {
  const [enrichment, setEnrichment] = useState<ScanEnrichment | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    async function fetchEnrichment() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setIsAuthenticated(!!session)

        const headers: Record<string, string> = {}
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }

        const res = await fetch(`/api/products/${productId}/enrichment`, { headers })
        if (!res.ok) return

        const data = await res.json()
        setEnrichment(data)
      } catch {
        // Enrichment is non-critical — silently fail
      } finally {
        setLoading(false)
      }
    }

    fetchEnrichment()
  }, [productId])

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gold" />
        <span className="text-sm text-white/40">Loading personalized intelligence...</span>
      </div>
    )
  }

  // Nothing to show
  const hasData = enrichment && (
    enrichment.personalization ||
    enrichment.pricing ||
    enrichment.community ||
    enrichment.counterfeit ||
    enrichment.trending ||
    enrichment.ingredientInsights ||
    enrichment.seasonalContext ||
    enrichment.overlapPreview
  )

  if (!hasData && isAuthenticated) return null

  // Not authenticated — show sign-in CTA
  if (!isAuthenticated && !hasData) {
    return (
      <div className="glass-card p-5 flex items-center gap-3">
        <Lock className="w-5 h-5 text-gold flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-white">
            Sign in for personalized intelligence
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            Get skin match analysis, price comparison, community ratings, and authenticity checks.
          </p>
        </div>
      </div>
    )
  }

  // Show CTA for profile completion if authenticated but no personalization
  const showProfileCta = isAuthenticated && !enrichment?.personalization

  // v10.6.6 Phase G — Yuri CTA at the top. Only renders when productName +
  // productBrand are provided (parent route supplies them). Per the Yuri Sole
  // Authority Principle, this is the SINGLE recommendation surface on the
  // page — every other enrichment section displays data (effectiveness, prices,
  // counterfeit signals, etc.). Yuri reasons with full context (skin profile,
  // treatment phase, decision memory) when the user lands in chat with the
  // product question pre-filled.
  const yuriHref =
    productName
      ? `/yuri?ask=${encodeURIComponent(buildYuriProductPrefill(productName, productBrand || ''))}`
      : null

  return (
    <div className="flex flex-col gap-3">
      {yuriHref && (
        <Link
          href={yuriHref}
          className="glass-card p-4 flex items-center gap-3 hover:bg-white/[0.07] transition group"
        >
          <Sparkles className="w-5 h-5 text-rose-300 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              Ask Yuri if this is right for you
            </p>
            <p className="text-xs text-white/50 mt-0.5">
              She&rsquo;ll weigh it against your skin profile, current phase, and routine. The data below is observational — her read is where the recommendation lives.
            </p>
          </div>
          <span className="text-xs text-rose-200/80 group-hover:text-rose-200 transition flex-shrink-0">
            Ask →
          </span>
        </Link>
      )}

      {showProfileCta && (
        <div className="glass-card p-4 flex items-center gap-3">
          <UserCircle className="w-5 h-5 text-gold flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">
              Complete your skin profile
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Get personalized skin match warnings and recommendations for this product.
            </p>
          </div>
        </div>
      )}

      {enrichment?.personalization && (
        <PersonalizedMatch data={enrichment.personalization} />
      )}

      {enrichment?.overlapPreview && (
        <OverlapPreview data={enrichment.overlapPreview} />
      )}

      {enrichment?.ingredientInsights && (
        <IngredientInsights data={enrichment.ingredientInsights} />
      )}

      {enrichment?.seasonalContext && (
        <SeasonalContext data={enrichment.seasonalContext} />
      )}

      {enrichment?.trending && (
        <TrendContext data={enrichment.trending} />
      )}

      {enrichment?.pricing && (
        <EnrichmentPriceComparison data={enrichment.pricing} />
      )}

      {enrichment?.community && (
        <CommunityIntelligence data={enrichment.community} />
      )}

      {enrichment?.counterfeit && (
        <AuthenticityCheck data={enrichment.counterfeit} />
      )}
    </div>
  )
}
