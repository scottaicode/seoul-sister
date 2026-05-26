'use client'

import { useState, useEffect } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ConcernEffectiveness {
  concern: string
  averageScore: number
  sampleSize: number
}

interface EffectivenessData {
  concerns: ConcernEffectiveness[]
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

  if (!hasConcerns) return null

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

      {/* Missing-ingredients widget removed in v10.5.2 (Bailey feedback).
          Seasonal "SPRING TIP" recommender removed in v10.8.9 (Bailey feedback,
          May 26 2026). Both were algorithmic prescriptions ("switch to lightweight
          gel," "emphasize niacinamide") that ignored the user's treatment phase and
          decision memory. The seasonal tip survived the v10.5.2 and v10.6.2 sweeps.
          Per the Yuri Sole Authority Principle, prescriptions route through Yuri;
          this widget now only DISPLAYS effectiveness-by-concern data (observational,
          derived from the user's own routine ingredients). */}
    </div>
  )
}
