'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Beaker, Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TopIngredient {
  ingredientName: string
  concern: string
  effectivenessScore: number
  sampleSize: number
}

export interface ProductEffectivenessMap {
  [productId: string]: { ingredientName: string; score: number }
}

interface InsightsData {
  topIngredients: TopIngredient[]
  productEffectiveness: ProductEffectivenessMap
}

interface CommunityInsightsProps {
  productIds: string[]
  onEffectivenessData?: (data: ProductEffectivenessMap) => void
}

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

export default function CommunityInsights({ productIds, onEffectivenessData }: CommunityInsightsProps) {
  const [data, setData] = useState<InsightsData | null>(null)
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

        const params = new URLSearchParams()
        if (productIds.length > 0) {
          params.set('product_ids', productIds.join(','))
        }

        const res = await fetch(`/api/community/insights?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          if (!cancelled) setLoading(false)
          return
        }

        const json: InsightsData = await res.json()
        if (!cancelled) {
          setData(json)
          onEffectivenessData?.(json.productEffectiveness)
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
  }, [productIds.join(',')])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-white/20" />
      </div>
    )
  }

  if (!data || data.topIngredients.length === 0) return null

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beaker className="w-4 h-4 text-gold" strokeWidth={1.75} />
          <span className="text-xs font-medium text-white/70">
            Community Insights for Your Skin
          </span>
        </div>
        <Link
          href="/products"
          className="text-[10px] text-gold-light hover:text-gold font-medium flex items-center gap-0.5"
        >
          Browse <span className="hidden sm:inline">products</span>
        </Link>
      </div>

      <p className="text-[10px] text-white/30">
        Most effective ingredients for your skin type
      </p>

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
  )
}
