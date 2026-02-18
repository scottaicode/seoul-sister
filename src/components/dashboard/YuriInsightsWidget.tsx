'use client'

import { useState, useEffect, useCallback } from 'react'
import { Beaker, Layers, Zap, BarChart3, Lightbulb } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface LearningInsight {
  title: string
  description: string
  confidence: number
  sample_size: number
  type: 'ingredient' | 'routine' | 'trend' | 'price'
}

function InsightIcon({ type }: { type: LearningInsight['type'] }) {
  switch (type) {
    case 'ingredient':
      return <Beaker className="w-4 h-4" strokeWidth={1.75} />
    case 'routine':
      return <Layers className="w-4 h-4" strokeWidth={1.75} />
    case 'trend':
      return <Zap className="w-4 h-4" strokeWidth={1.75} />
    case 'price':
      return <BarChart3 className="w-4 h-4" strokeWidth={1.75} />
  }
}

function InsightCard({ insight }: { insight: LearningInsight }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
        <InsightIcon type={insight.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white">
          {insight.title}
        </p>
        <p className="text-xs text-white/40 mt-0.5 leading-snug">
          {insight.description}
        </p>
        {insight.sample_size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                style={{ width: `${Math.round(insight.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-white/30 whitespace-nowrap">
              {Math.round(insight.confidence * 100)}% confidence
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function YuriInsightsWidget() {
  const { user } = useAuth()
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInsights = useCallback(async () => {
    if (!user) return

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) return

      const res = await fetch('/api/learning/recommendations', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        const recs = data.recommendations || []
        const mapped: LearningInsight[] = recs.slice(0, 3).map(
          (r: { product_name: string; brand: string; match_score: number; reasons: string[]; effectiveness_data: { score: number; sample_size: number } | null }) => ({
            title: `${r.product_name} by ${r.brand}`,
            description: r.reasons[0] || 'Recommended for your skin profile',
            confidence: (r.match_score || 50) / 100,
            sample_size: r.effectiveness_data?.sample_size || 0,
            type: 'ingredient' as const,
          })
        )
        setInsights(mapped)
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/10 rounded w-2/3" />
                <div className="h-2 bg-white/10 rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
        <Lightbulb className="w-8 h-8 text-gold/30 mx-auto mb-2" strokeWidth={1.5} />
        <p className="font-display font-semibold text-sm text-white">
          Yuri is learning
        </p>
        <p className="text-xs text-white/40 mt-1">
          As more users share reviews and scan products, Yuri builds personalized
          insights for your skin type. Check back soon!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {insights.map((insight, idx) => (
        <InsightCard key={idx} insight={insight} />
      ))}
    </div>
  )
}
