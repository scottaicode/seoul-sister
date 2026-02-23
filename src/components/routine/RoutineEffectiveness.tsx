'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, Leaf, TrendingUp, Loader2, Snowflake } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ConcernEffectiveness {
  concern: string
  averageScore: number
  sampleSize: number
}

interface MissingIngredient {
  ingredientName: string
  concern: string
  effectivenessScore: number
}

interface SeasonalInsight {
  pattern_description: string
  texture_advice: string
  ingredients_to_emphasize: string[]
  ingredients_to_reduce: string[]
  season: string
  climate: string
}

interface EffectivenessData {
  concerns: ConcernEffectiveness[]
  missingIngredients: MissingIngredient[]
  seasonalInsight: SeasonalInsight | null
}

function BarFill({ score }: { score: number }) {
  const color =
    score >= 75
      ? 'bg-emerald-500'
      : score >= 50
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

export function RoutineEffectiveness({ routineId }: { routineId: string }) {
  const [data, setData] = useState<EffectivenessData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        const res = await fetch(
          `/api/routine/effectiveness?routine_id=${routineId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        )
        if (!res.ok) return

        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [routineId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-white/20" />
      </div>
    )
  }

  if (!data) return null

  const hasConcerns = data.concerns.length > 0
  const hasMissing = data.missingIngredients.length > 0
  const hasSeasonal = data.seasonalInsight !== null

  if (!hasConcerns && !hasMissing && !hasSeasonal) return null

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-gold" />
        <span className="text-xs font-medium text-white/70">
          Routine Intelligence
        </span>
      </div>

      {/* Concern effectiveness bars */}
      {hasConcerns && (
        <div className="space-y-2">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            Effectiveness by concern
          </p>
          {data.concerns.slice(0, 4).map((c) => (
            <div key={c.concern} className="flex items-center gap-2">
              <span className="text-[11px] text-white/60 w-24 capitalize truncate">
                {c.concern}
              </span>
              <BarFill score={c.averageScore} />
              <span className="text-[11px] font-medium text-white/70 w-9 text-right">
                {c.averageScore}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Missing high-value ingredients */}
      {hasMissing && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3 h-3 text-emerald-400/70" />
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              Missing high-value ingredients
            </p>
          </div>
          {data.missingIngredients.map((m) => (
            <div
              key={m.ingredientName}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="text-white/60">
                <span className="text-emerald-400/80 font-medium">
                  {m.ingredientName}
                </span>
                {' '}
                <span className="text-white/30">
                  ({m.effectivenessScore}% for {m.concern})
                </span>
              </span>
              <Link
                href={`/products?include_ingredients=${encodeURIComponent(m.ingredientName)}`}
                className="text-gold-light hover:text-gold text-[10px] font-medium flex items-center gap-0.5 flex-shrink-0 ml-2"
              >
                <TrendingUp className="w-3 h-3" />
                Find products
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Seasonal suggestion */}
      {hasSeasonal && data.seasonalInsight && (
        <div className="bg-sky-500/5 border border-sky-500/10 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Snowflake className="w-3 h-3 text-sky-400/70" />
            <span className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider">
              {data.seasonalInsight.season} tip
            </span>
          </div>
          <p className="text-[11px] text-white/50">
            {data.seasonalInsight.texture_advice}
          </p>
          {data.seasonalInsight.ingredients_to_emphasize.length > 0 && (
            <p className="text-[10px] text-white/30 mt-1">
              Emphasize:{' '}
              {data.seasonalInsight.ingredients_to_emphasize.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
