'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, Loader2, ShoppingBag, MessageCircle, Sparkles, Heart } from 'lucide-react'
import TrendingCard from '@/components/community/TrendingCard'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

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
  // Phase 10.3 fields
  gap_score: number | null
  // Phase 12.7: Personalized cohort data
  cohort_label?: string | null
  cohort_score?: number | null
  relevance_score?: number | null
}

type ActiveTab = 'trending' | 'emerging' | 'for_you' | 'tiktok'

const sourceFilters = [
  { value: '', label: 'All', active: true },
  { value: 'olive_young', label: 'Olive Young', active: true },
  { value: 'reddit', label: 'Reddit', active: true },
]

export default function TrendingPage() {
  const { user } = useAuth()
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [emerging, setEmerging] = useState<TrendingItem[]>([])
  const [forYou, setForYou] = useState<TrendingItem[]>([])
  const [forYouSkinType, setForYouSkinType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('olive_young')
  const [activeTab, setActiveTab] = useState<ActiveTab>('trending')
  const [error, setError] = useState<string | null>(null)

  // Build auth headers for personalized API calls
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {}
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` }
      }
    } catch {
      // Non-critical
    }
    return {}
  }, [user])

  // Fetch trending data (standard tab)
  const fetchTrending = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (sourceFilter) params.set('source', sourceFilter)
      params.set('limit', sourceFilter === '' ? '50' : '30')

      const headers = await getAuthHeaders()
      const res = await fetch(`/api/trending?${params.toString()}`, { headers })
      if (!res.ok) throw new Error('Failed to load trends')
      const data = await res.json()
      setTrending(data.trending ?? [])
    } catch {
      setError('Failed to load trending products. Please try again.')
      setTrending([])
    } finally {
      setLoading(false)
    }
  }, [sourceFilter, getAuthHeaders])

  // Fetch emerging data (gap score tab)
  const fetchEmerging = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/trending?tab=emerging&limit=30', { headers })
      if (!res.ok) throw new Error('Failed to load emerging trends')
      const data = await res.json()
      setEmerging(data.trending ?? [])
    } catch {
      setError('Failed to load emerging trends. Please try again.')
      setEmerging([])
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  // Fetch personalized "For You" data
  const fetchForYou = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/trending?tab=for_you&limit=30', { headers })
      if (!res.ok) throw new Error('Failed to load personalized trends')
      const data = await res.json()
      setForYou(data.trending ?? [])
      setForYouSkinType(data.skinType ?? null)
    } catch {
      setError('Failed to load personalized trends. Please try again.')
      setForYou([])
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrending()
    } else if (activeTab === 'emerging') {
      fetchEmerging()
    } else if (activeTab === 'for_you') {
      fetchForYou()
    }
  }, [activeTab, fetchTrending, fetchEmerging, fetchForYou])

  // Count entries by source for the "All" view
  const oliveYoungCount = trending.filter(t => t.source === 'olive_young').length
  const redditCount = trending.filter(t => t.source === 'reddit').length

  // Tab descriptions
  const tabDescriptions: Record<ActiveTab, string> = {
    trending:
      sourceFilter === 'olive_young'
        ? 'Real-time Olive Young bestseller rankings from Korea.'
        : sourceFilter === 'reddit'
        ? 'What the K-beauty community is talking about on Reddit.'
        : 'Korean sales rankings + Reddit community mentions.',
    emerging:
      'Products trending in Korea that the US hasn\u2019t discovered yet \u2014 your early-access edge.',
    for_you:
      forYouSkinType
        ? `Trending products matched to your ${forYouSkinType} skin profile.`
        : 'Trending products personalized for your skin type.',
    tiktok: '',
  }

  // Header text based on active tab
  const headerTitle: Record<ActiveTab, string> = {
    trending: 'Trending in Korea',
    emerging: 'Emerging from Korea',
    for_you: 'Trending for You',
    tiktok: 'Trending in Korea',
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-white section-heading">
          {headerTitle[activeTab]}
        </h1>
        <p className="text-white/40 text-sm">
          {tabDescriptions[activeTab]}
        </p>
      </div>

      {/* Tab switcher — 4 tabs (For You only visible when authenticated) */}
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
          <span className="hidden sm:inline">Trending</span>
          <span className="sm:hidden">Hot</span>
        </button>
        <button
          onClick={() => setActiveTab('emerging')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'emerging'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Emerging</span>
          <span className="sm:hidden">New</span>
        </button>
        {user && (
          <button
            onClick={() => setActiveTab('for_you')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'for_you'
                ? 'bg-gold/20 text-gold border border-gold/30'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">For You</span>
            <span className="sm:hidden">You</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('tiktok')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'tiktok'
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <span className="w-4 h-4 rounded bg-black text-white text-[8px] font-bold flex items-center justify-center">TT</span>
          <span className="hidden sm:inline">TikTok</span>
          <span className="sm:hidden">TT</span>
        </button>
      </div>

      {/* ---- Trending Now tab ---- */}
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
                onClick={() => fetchTrending()}
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
              {/* Source section headers */}
              {sourceFilter === 'olive_young' && (
                <div className="flex items-center gap-2 text-xs text-white/30 pb-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Based on real Olive Young Korean sales rankings</span>
                </div>
              )}
              {sourceFilter === 'reddit' && (
                <div className="flex items-center gap-2 text-xs text-white/30 pb-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Mentions from r/AsianBeauty, r/SkincareAddiction + K-beauty communities</span>
                </div>
              )}

              {/* "All" view: group by source with section headers */}
              {sourceFilter === '' ? (
                <>
                  {oliveYoungCount > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-xs text-white/30 pb-1">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Top sellers on Olive Young Korea</span>
                      </div>
                      {trending.filter(t => t.source === 'olive_young').slice(0, 10).map((item) => (
                        <TrendingCard key={item.id} product={item.product} source={item.source}
                          trendScore={item.trend_score} mentionCount={item.mention_count}
                          sentimentScore={item.sentiment_score} trendingSince={item.trending_since}
                          sourceProductName={item.source_product_name} sourceProductBrand={item.source_product_brand}
                          sourceUrl={item.source_url} rankPosition={item.rank_position}
                          rankChange={item.rank_change} daysOnList={item.days_on_list}
                          gapScore={item.gap_score}
                          cohortLabel={item.cohort_label} cohortScore={item.cohort_score} />
                      ))}
                    </>
                  )}
                  {redditCount > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-xs text-white/30 pb-1 pt-3">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Trending on Reddit K-beauty communities</span>
                      </div>
                      {trending.filter(t => t.source === 'reddit').slice(0, 10).map((item) => (
                        <TrendingCard key={item.id} product={item.product} source={item.source}
                          trendScore={item.trend_score} mentionCount={item.mention_count}
                          sentimentScore={item.sentiment_score} trendingSince={item.trending_since}
                          sourceProductName={item.source_product_name} sourceProductBrand={item.source_product_brand}
                          sourceUrl={item.source_url} rankPosition={item.rank_position}
                          rankChange={item.rank_change} daysOnList={item.days_on_list}
                          gapScore={item.gap_score}
                          cohortLabel={item.cohort_label} cohortScore={item.cohort_score} />
                      ))}
                    </>
                  )}
                </>
              ) : (
                /* Single source view */
                trending.map((item) => (
                  <TrendingCard key={item.id} product={item.product} source={item.source}
                    trendScore={item.trend_score} mentionCount={item.mention_count}
                    sentimentScore={item.sentiment_score} trendingSince={item.trending_since}
                    sourceProductName={item.source_product_name} sourceProductBrand={item.source_product_brand}
                    sourceUrl={item.source_url} rankPosition={item.rank_position}
                    rankChange={item.rank_change} daysOnList={item.days_on_list}
                    gapScore={item.gap_score}
                    cohortLabel={item.cohort_label} cohortScore={item.cohort_score} />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ---- Emerging from Korea tab ---- */}
      {activeTab === 'emerging' && (
        <>
          {error ? (
            <div className="glass-card p-6 text-center">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={() => fetchEmerging()}
                className="text-xs text-gold-light hover:text-gold transition-colors"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : emerging.length === 0 ? (
            <EmptyState
              icon={Sparkles as LucideIcon}
              title="No Emerging Trends Yet"
              description="Gap scores are calculated daily after Olive Young and Reddit scans complete. Products trending in Korea but not yet popular in the US will appear here."
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/30 pb-1">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Trending in Korea, not yet on the US radar</span>
              </div>

              {/* Explainer card */}
              <div className="glass-card p-4 border-violet-500/20">
                <p className="text-xs text-white/50 leading-relaxed">
                  These products are selling well in Korea (Olive Young bestsellers) but have little to no
                  discussion in English K-beauty communities. History shows these often become the next big
                  trends — you&apos;re seeing them first.
                </p>
              </div>

              {emerging.map((item) => (
                <TrendingCard key={item.id} product={item.product} source={item.source}
                  trendScore={item.trend_score} mentionCount={item.mention_count}
                  sentimentScore={item.sentiment_score} trendingSince={item.trending_since}
                  sourceProductName={item.source_product_name} sourceProductBrand={item.source_product_brand}
                  sourceUrl={item.source_url} rankPosition={item.rank_position}
                  rankChange={item.rank_change} daysOnList={item.days_on_list}
                  gapScore={item.gap_score}
                  cohortLabel={item.cohort_label} cohortScore={item.cohort_score} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- For You tab ---- */}
      {activeTab === 'for_you' && (
        <>
          {error ? (
            <div className="glass-card p-6 text-center">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={() => fetchForYou()}
                className="text-xs text-gold-light hover:text-gold transition-colors"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : forYou.length === 0 ? (
            <EmptyState
              icon={Heart as LucideIcon}
              title="No Personalized Trends Yet"
              description={
                forYouSkinType
                  ? 'No trending products match your skin profile right now. Check back as new trends emerge.'
                  : 'Complete your skin profile so we can match trending products to your skin type.'
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/30 pb-1">
                <Heart className="w-3.5 h-3.5 text-gold" />
                <span>
                  Trending products with ingredients proven effective for{' '}
                  <span className="text-gold font-medium">{forYouSkinType}</span> skin
                </span>
              </div>

              {/* Explainer card */}
              <div className="glass-card p-4 border-gold/20">
                <p className="text-xs text-white/50 leading-relaxed">
                  These trending products contain ingredients with high effectiveness scores for your
                  skin type, ranked by trend momentum and personal relevance.
                </p>
              </div>

              {forYou.map((item) => (
                <TrendingCard key={item.id} product={item.product} source={item.source}
                  trendScore={item.trend_score} mentionCount={item.mention_count}
                  sentimentScore={item.sentiment_score} trendingSince={item.trending_since}
                  sourceProductName={item.source_product_name} sourceProductBrand={item.source_product_brand}
                  sourceUrl={item.source_url} rankPosition={item.rank_position}
                  rankChange={item.rank_change} daysOnList={item.days_on_list}
                  gapScore={item.gap_score}
                  cohortLabel={item.cohort_label} cohortScore={item.cohort_score} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- TikTok Capture tab ---- */}
      {activeTab === 'tiktok' && <TikTokCapture />}

      {/* Bottom spacer for mobile nav */}
      <div className="h-16 md:h-0" />
    </div>
  )
}
