'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'
import TrendingCard from '@/components/community/TrendingCard'
import TikTokCapture from '@/components/community/TikTokCapture'
import EmptyState from '@/components/ui/EmptyState'
import type { LucideIcon } from 'lucide-react'
import type { Product } from '@/types/database'

interface TrendingItem {
  id: string
  product_id: string
  source: string
  trend_score: number
  mention_count: number
  sentiment_score: number | null
  trending_since: string
  product: Product
}

const sourceFilters = [
  { value: '', label: 'All' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'korean_market', label: 'Seoul' },
]

export default function TrendingPage() {
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'trending' | 'tiktok'>('trending')

  useEffect(() => {
    async function fetchTrending() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (sourceFilter) params.set('source', sourceFilter)
        params.set('limit', '20')

        const res = await fetch(`/api/trending?${params.toString()}`)
        const data = await res.json()
        setTrending(data.trending ?? [])
      } catch {
        setTrending([])
      } finally {
        setLoading(false)
      }
    }
    fetchTrending()
  }, [sourceFilter])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-seoul-charcoal section-heading">
          Trending in Korea
        </h1>
        <p className="text-seoul-soft text-sm">
          Emerging ingredients, viral products, and market movements before they hit the US.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-seoul-pearl rounded-xl p-1">
        <button
          onClick={() => setActiveTab('trending')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'trending'
              ? 'bg-white shadow-glass text-seoul-charcoal'
              : 'text-seoul-soft hover:text-seoul-charcoal'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Trending Now
        </button>
        <button
          onClick={() => setActiveTab('tiktok')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'tiktok'
              ? 'bg-white shadow-glass text-seoul-charcoal'
              : 'text-seoul-soft hover:text-seoul-charcoal'
          }`}
        >
          <span className="w-4 h-4 rounded bg-black text-white text-[8px] font-bold flex items-center justify-center">TT</span>
          TikTok Capture
        </button>
      </div>

      {activeTab === 'trending' && (
        <>
          {/* Source filter */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {sourceFilters.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSourceFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  sourceFilter === value
                    ? 'bg-glass-100 text-glass-700 border border-glass-300'
                    : 'bg-white/50 text-seoul-soft border border-white/30 hover:bg-seoul-pearl'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Trending list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-rose-gold" />
            </div>
          ) : trending.length === 0 ? (
            <EmptyState
              icon={TrendingUp as LucideIcon}
              title="No Trending Products"
              description="Check back soon for the latest K-beauty trends from Seoul."
            />
          ) : (
            <div className="space-y-3">
              {trending.map((item) => (
                <TrendingCard
                  key={item.id}
                  product={item.product}
                  source={item.source}
                  trendScore={item.trend_score}
                  mentionCount={item.mention_count}
                  sentimentScore={item.sentiment_score}
                  trendingSince={item.trending_since}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'tiktok' && <TikTokCapture />}

      {/* Bottom spacer for mobile nav */}
      <div className="h-16 md:h-0" />
    </div>
  )
}
