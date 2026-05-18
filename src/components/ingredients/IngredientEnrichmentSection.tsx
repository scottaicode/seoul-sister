'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Package,
  TrendingUp,
  Eye,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

/**
 * Phase 13.G — Subscriber-aware ingredient detail enrichment (v10.6.4).
 *
 * Renders a "For You" panel on /ingredients/[slug] pages when the user is
 * authenticated. Unauthenticated visitors see NOTHING — the public SEO
 * surface stays unchanged for bots and non-subscribers.
 *
 * Yuri Sole Authority Principle compliance:
 *   - All four panels show observational DATA, not generated recommendations
 *   - "You use this in" — facts (products the user owns containing this ingredient)
 *   - "Effective for your skin type" — community effectiveness data with sample size
 *   - "Phase relevance" — Yuri's own watch_for items for the user's active phase
 *   - "Ask Yuri" CTA — routes to /yuri with ?ask= prefilled, Yuri synthesizes
 *
 * The component never claims the ingredient is good or bad for the user.
 * That synthesis is Yuri's job, with full context, in a conversation.
 */

interface EnrichmentResponse {
  products_using: Array<{
    product_id: string
    name_en: string
    brand_en: string
    ownership: 'owned' | 'in_routine' | 'both'
  }>
  effectiveness: {
    skin_type: string
    score: number
    concern: string
    sample_size: number
  } | null
  current_phase: {
    id: string
    phase_number: number
    name: string
    days_in_phase: number | null
    watch_for: string[]
  } | null
}

export interface IngredientEnrichmentSectionProps {
  ingredientId: string
  ingredientName: string
}

function ownershipLabel(ownership: 'owned' | 'in_routine' | 'both'): string {
  if (ownership === 'both') return 'Owned · In routine'
  if (ownership === 'owned') return 'In your collection'
  return 'In your routine'
}

export function IngredientEnrichmentSection({
  ingredientId,
  ingredientName,
}: IngredientEnrichmentSectionProps) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<EnrichmentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!ingredientId) return

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          if (!cancelled) setLoading(false)
          return
        }
        const res = await fetch(`/api/ingredients/${ingredientId}/enrichment`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          if (!cancelled) {
            setErrored(true)
            setLoading(false)
          }
          return
        }
        const json = (await res.json()) as EnrichmentResponse
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setErrored(true)
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, ingredientId])

  // Unauthenticated visitors see nothing — preserve public SEO surface unchanged
  if (authLoading) return null
  if (!user) return null

  // Errored or loading — render nothing rather than a noisy placeholder.
  // The public content above this section is the primary value; the enrichment
  // is bonus. Silent failure preserves the page experience.
  if (errored) return null
  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center gap-3 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your context...
        </div>
      </div>
    )
  }

  const { products_using, effectiveness, current_phase } = data
  const hasAnyData =
    products_using.length > 0 || effectiveness !== null || current_phase !== null

  if (!hasAnyData) {
    // Authenticated user with no relevant data — render just the Yuri CTA
    // so the section isn't empty
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <AskYuriCTA ingredientName={ingredientName} currentPhase={null} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-amber-500/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" strokeWidth={2} />
          <h2 className="font-display font-semibold text-sm text-white">
            For You
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* You use this in */}
          {products_using.length > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-white">
                  You use this in {products_using.length}{' '}
                  {products_using.length === 1 ? 'product' : 'products'}
                </span>
              </div>
              <ul className="space-y-1.5">
                {products_using.slice(0, 4).map((p) => (
                  <li key={p.product_id}>
                    <Link
                      href={`/products/${p.product_id}`}
                      className="text-xs text-white/80 hover:text-gold transition-colors block"
                    >
                      <div className="truncate">
                        {p.brand_en} {p.name_en}
                      </div>
                      <div className="text-[10px] text-white/40">
                        {ownershipLabel(p.ownership)}
                      </div>
                    </Link>
                  </li>
                ))}
                {products_using.length > 4 && (
                  <li className="text-[10px] text-white/40">
                    + {products_using.length - 4} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Effectiveness for your skin type */}
          {effectiveness && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-medium text-white">
                  For {effectiveness.skin_type} skin
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-2xl text-sky-300">
                  {Math.round(effectiveness.score * 100)}%
                </span>
                <span className="text-[10px] text-white/40">effectiveness</span>
              </div>
              <p className="text-xs text-white/60 mt-1 capitalize">
                for {effectiveness.concern.replace(/_/g, ' ')}
              </p>
              <p className="text-[10px] text-white/30 mt-1">
                Based on {effectiveness.sample_size}+ community reports
              </p>
            </div>
          )}

          {/* Phase relevance (observational — Yuri's watch_for) */}
          {current_phase && current_phase.watch_for.length > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-medium text-white">
                  Phase {current_phase.phase_number}: {current_phase.name}
                  {current_phase.days_in_phase !== null && (
                    <span className="text-white/40 font-normal ml-1">
                      · Day {current_phase.days_in_phase}
                    </span>
                  )}
                </span>
              </div>
              <p className="text-[10px] text-white/50 mb-2">
                Yuri's current phase plan watches for:
              </p>
              <ul className="space-y-1">
                {current_phase.watch_for.slice(0, 3).map((w, i) => (
                  <li
                    key={i}
                    className="text-xs text-white/70 flex items-start gap-1.5"
                  >
                    <span className="text-violet-400 mt-0.5">·</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <AskYuriCTA
          ingredientName={ingredientName}
          currentPhase={current_phase}
        />
      </div>
    </div>
  )
}

function AskYuriCTA({
  ingredientName,
  currentPhase,
}: {
  ingredientName: string
  currentPhase: EnrichmentResponse['current_phase']
}) {
  // Build the prefilled question. If user is in an active phase, anchor the
  // question to the phase so Yuri's response respects the treatment context.
  // Otherwise, generic ingredient question — Yuri's normal context-load
  // already gives her phase/skin-type/routine awareness.
  const phaseContext = currentPhase
    ? ` (I'm currently in Phase ${currentPhase.phase_number}: ${currentPhase.name})`
    : ''
  const prefill = `Tell me how ${ingredientName} fits into my routine${phaseContext}.`

  return (
    <Link
      href={`/yuri?ask=${encodeURIComponent(prefill)}`}
      className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-gold/15 to-amber-500/10 border border-gold/25 hover:border-gold/40 px-3 py-2.5 transition-colors group"
    >
      <Sparkles className="w-4 h-4 text-gold flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white">
          Ask Yuri how {ingredientName} fits your routine
        </p>
        <p className="text-[10px] text-white/50 mt-0.5">
          She'll factor in your phase plan, current products, and what she
          knows about your skin
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gold/60 group-hover:text-gold transition-colors flex-shrink-0" />
    </Link>
  )
}
