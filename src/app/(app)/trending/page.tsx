'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, Loader2, ShoppingBag, MessageCircle } from 'lucide-react'
import TrendingCard from '@/components/community/TrendingCard'
import EmptyState from '@/components/ui/EmptyState'

const TikTokCapture = dynamic(() => import('@/components/community/TikTokCapture'), { ssr: false })
import type { LucideIcon } from 'lucide-react'
import type { Product } from '@/types/database'

interface TrendingItem {
  id: string
  product_id: string | null
  source: string
  trend_score: number
  mention_count: number
  sentiment_score: number | null
  trending_since: string
  product: Product | null
  // Phase 10.1 fields
  source_product_name: string | null
  source_product_brand: string | null
  source_url: string | null
  rank_position: number | null
  rank_change: number | null
  days_on_list: number | null
}

const sourceFilters = [
  { value: '', label: 'All', active: true },
  { value: 'olive_young', label: 'Olive Young', active: true },
  { value: 'reddit', label: 'Reddit', active: true },
]

export default function TrendingPage() {
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'trending' | 'tiktok'>('trending')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTrending() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (sourceFilter) params.set('source', sourceFilter)
        params.set('limit', '30')

        const res = await fetch(`/api/trending?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load trends')
        const data = await res.json()
        setTrending(data.trending ?? [])
      } catch {
        setError('Failed to load trending products. Please try again.')
        setTrending([])
      } finally {
        setLoading(false)
      }
    }
    fetchTrending()
  }, [sourceFilter])

  // Count entries by source for the header subtitle
  const oliveYoungCount = trending.filter(t => t.source === 'olive_young').length
  const redditCount = trending.filter(t => t.source === 'reddit').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-white section-heading">
          Trending in Korea
        </h1>
        <p className="text-white/40 text-sm">
          {oliveYoungCount > 0 && redditCount > 0
            ? 'Korean sales rankings + Reddit community mentions.'
            : oliveYoungCount > 0
            ? 'Real-time Olive Young bestseller rankings + community signals.'
            : redditCount > 0
            ? 'What the K-beauty community is talking about on Reddit.'
            : 'Emerging ingredients, viral products, and market movements before they hit the US.'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('trending')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'trending'
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Trending Now
        </button>
        <button
          onClick={() => setActiveTab('tiktok')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'tiktok'
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white'
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
            {sourceFilters.map(({ value, label, active }) => (
              <button
                key={value}
                onClick={() => setSourceFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  sourceFilter === value
                    ? 'bg-glass-100 text-glass-700 border border-glass-300'
                    : !active
                    ? 'bg-white/[0.02] text-white/20 border border-white/5'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Trending list */}
          {error ? (
            <div className="glass-card p-6 text-center">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={() => setSourceFilter(sourceFilter)}
                className="text-xs text-gold-light hover:text-gold transition-colors"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : trending.length === 0 ? (
              <EmptyState
                icon={TrendingUp as LucideIcon}
                title="No Trending Products"
                description={
                  sourceFilter === 'olive_young'
                    ? 'Olive Young bestseller data will appear after the daily scan runs.'
                    : sourceFilter === 'reddit'
                    ? 'Reddit mention data will appear after the daily scan runs.'
                    : 'Check back soon for the latest K-beauty trends from Seoul.'
                }
              />
          ) : (
            <div className="space-y-3">
              {/* Show source section headers */}
              {(sourceFilter === 'olive_young' || sourceFilter === '') && trending.some(t => t.source === 'olive_young') && (
                <div className="flex items-center gap-2 text-xs text-white/30 pb-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Based on real Olive Young Korean sales rankings</span>
                </div>
              )}
              {sourceFilter === 'reddit' && trending.some(t => t.source === 'reddit') && (
                <div className="flex items-center gap-2 text-xs text-white/30 pb-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Mentions from r/AsianBeauty, r/SkincareAddiction + K-beauty communities</span>
                </div>
              )}
              {trending.map((item) => (
                <TrendingCard
                  key={item.id}
                  product={item.product}
                  source={item.source}
                  trendScore={item.trend_score}
                  mentionCount={item.mention_count}
                  sentimentScore={item.sentiment_score}
                  trendingSince={item.trending_since}
                  sourceProductName={item.source_product_name}
                  sourceProductBrand={item.source_product_brand}
                  sourceUrl={item.source_url}
                  rankPosition={item.rank_position}
                  rankChange={item.rank_change}
                  daysOnList={item.days_on_list}
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
