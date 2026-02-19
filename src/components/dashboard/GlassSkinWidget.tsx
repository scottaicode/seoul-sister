'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface LatestScore {
  overall_score: number
  luminosity_score: number
  smoothness_score: number
  clarity_score: number
  hydration_score: number
  evenness_score: number
  created_at: string
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Glass Skin Goals'
  if (score >= 80) return 'Almost Glass'
  if (score >= 70) return 'Glowing'
  if (score >= 60) return 'Getting There'
  if (score >= 50) return 'On the Journey'
  if (score >= 40) return 'Building Foundation'
  return 'Just Starting'
}

export default function GlassSkinWidget() {
  const [latest, setLatest] = useState<LatestScore | null>(null)
  const [previous, setPrevious] = useState<LatestScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch('/api/skin-score?limit=2', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.scores?.length > 0) {
            setLatest(data.scores[0])
            if (data.scores.length > 1) {
              setPrevious(data.scores[1])
            }
          }
        }
      } catch {
        // Non-critical widget
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return null

  // No scores yet — show CTA
  if (!latest) {
    return (
      <Link
        href="/glass-skin"
        className="glass-card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition-colors duration-200 group"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-gold-light/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Check your Glass Skin Score</p>
          <p className="text-xs text-white/40 mt-0.5">Take a selfie and track your skin progress</p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold transition-colors" />
      </Link>
    )
  }

  // Has score — show summary
  const change = previous ? latest.overall_score - previous.overall_score : null

  return (
    <Link
      href="/glass-skin"
      className="glass-card p-4 flex items-center gap-4 hover:bg-white/[0.06] transition-colors duration-200 group"
    >
      {/* Score circle */}
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="4"
          />
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke="#D4A574"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(latest.overall_score / 100) * 150.8} 150.8`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gold">
          {latest.overall_score}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          {getScoreLabel(latest.overall_score)}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {change !== null && change !== 0 ? (
            <>
              {change > 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-400" />
              )}
              <span className={`text-xs font-medium ${
                change > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {change > 0 ? '+' : ''}{change} from last check
              </span>
            </>
          ) : (
            <span className="text-xs text-white/40">
              Last checked {new Date(latest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold transition-colors flex-shrink-0" />
    </Link>
  )
}
