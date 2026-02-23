'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Beaker,
  ChevronRight,
  Leaf,
  Loader2,
  Search,
  Snowflake,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopIngredient {
  ingredientName: string
  concern: string
  effectivenessScore: number
  sampleSize: number
}

interface SeasonalInsight {
  pattern_description: string
  texture_advice: string
  ingredients_to_emphasize: string[]
  ingredients_to_reduce: string[]
  season: string
  climate: string
}

interface IntelligenceData {
  topIngredients: TopIngredient[]
  seasonalInsight: SeasonalInsight | null
  relevantTrendingIds: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function EffectivenessBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 60
        ? 'bg-amber-500'
        : 'bg-rose-500'

  return (
    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  )
}

function seasonIcon(season: string) {
  // Snowflake for winter, Leaf for fall/spring, generic for summer
  if (season === 'winter') return <Snowflake className="w-3 h-3 text-sky-400/70" />
  return <Leaf className="w-3 h-3 text-emerald-400/70" />
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IntelligenceWidgetsProps {
  onRelevantTrendingIds?: (ids: string[]) => void
}

export default function IntelligenceWidgets({ onRelevantTrendingIds }: IntelligenceWidgetsProps) {
  const [data, setData] = useState<IntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          if (!cancelled) setLoading(false)
          return
        }

        const res = await fetch('/api/dashboard/intelligence', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          if (!cancelled) setLoading(false)
          return
        }

        const json: IntelligenceData = await res.json()
        if (!cancelled) {
          setData(json)
          onRelevantTrendingIds?.(json.relevantTrendingIds)
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-white/20" />
      </div>
    )
  }

  // Nothing to show — no auth or no data
  if (!data) return null

  const hasIngredients = data.topIngredients.length > 0
  const hasSeasonal = data.seasonalInsight !== null

  // Nothing useful to render
  if (!hasIngredients && !hasSeasonal) return null

  return (
    <div className="space-y-4">
      {/* Your Top Ingredients */}
      {hasIngredients && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Beaker className="w-4 h-4 text-gold" strokeWidth={1.75} />
              <span className="text-xs font-medium text-white/70">
                Your Top Ingredients
              </span>
            </div>
            <Link
              href="/products"
              className="text-[10px] text-gold-light hover:text-gold font-medium flex items-center gap-0.5"
            >
              Browse <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {data.topIngredients.map((ing) => (
              <div key={`${ing.ingredientName}-${ing.concern}`} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/60 w-28 truncate capitalize">
                    {ing.ingredientName}
                  </span>
                  <EffectivenessBar score={ing.effectivenessScore} />
                  <span className="text-[11px] font-medium text-white/70 w-9 text-right">
                    {ing.effectivenessScore}%
                  </span>
                </div>
                <div className="flex items-center justify-between pl-0.5">
                  <span className="text-[10px] text-white/30 capitalize">
                    {ing.concern}
                  </span>
                  <Link
                    href={`/products?include_ingredients=${encodeURIComponent(ing.ingredientName)}`}
                    className="text-gold-light hover:text-gold text-[10px] font-medium flex items-center gap-0.5"
                  >
                    <Search className="w-2.5 h-2.5" />
                    Find products
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seasonal Tip */}
      {hasSeasonal && data.seasonalInsight && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            {seasonIcon(data.seasonalInsight.season)}
            <span className="text-xs font-medium text-white/70 capitalize">
              {data.seasonalInsight.season} Skincare Tip
            </span>
          </div>

          <p className="text-[11px] text-white/50 leading-relaxed">
            {data.seasonalInsight.texture_advice}
          </p>

          {data.seasonalInsight.ingredients_to_emphasize.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {data.seasonalInsight.ingredients_to_emphasize.slice(0, 3).map((ing) => (
                <Link
                  key={ing}
                  href={`/products?include_ingredients=${encodeURIComponent(ing)}`}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                >
                  + {ing}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

