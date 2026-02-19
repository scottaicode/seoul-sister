'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Lock, UserCircle } from 'lucide-react'
import {
  PersonalizedMatch,
  EnrichmentPriceComparison,
  CommunityIntelligence,
  AuthenticityCheck,
  TrendContext,
} from '@/components/shared/EnrichmentSections'
import type { ScanEnrichment } from '@/lib/scanning/enrich-scan'

interface ProductEnrichmentProps {
  productId: string
}

export default function ProductEnrichment({ productId }: ProductEnrichmentProps) {
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
        <span className="text-sm text-seoul-soft">Loading personalized intelligence...</span>
      </div>
    )
  }

  // Nothing to show
  const hasData = enrichment && (
    enrichment.personalization ||
    enrichment.pricing ||
    enrichment.community ||
    enrichment.counterfeit ||
    enrichment.trending
  )

  if (!hasData && isAuthenticated) return null

  // Not authenticated — show sign-in CTA
  if (!isAuthenticated && !hasData) {
    return (
      <div className="glass-card p-5 flex items-center gap-3">
        <Lock className="w-5 h-5 text-gold flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-seoul-charcoal">
            Sign in for personalized intelligence
          </p>
          <p className="text-xs text-seoul-soft mt-0.5">
            Get skin match analysis, price comparison, community ratings, and authenticity checks.
          </p>
        </div>
      </div>
    )
  }

  // Show CTA for profile completion if authenticated but no personalization
  const showProfileCta = isAuthenticated && !enrichment?.personalization

  return (
    <div className="flex flex-col gap-3">
      {showProfileCta && (
        <div className="glass-card p-4 flex items-center gap-3">
          <UserCircle className="w-5 h-5 text-gold flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-seoul-charcoal">
              Complete your skin profile
            </p>
            <p className="text-xs text-seoul-soft mt-0.5">
              Get personalized skin match warnings and recommendations for this product.
            </p>
          </div>
        </div>
      )}

      {enrichment?.personalization && (
        <PersonalizedMatch data={enrichment.personalization} />
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
