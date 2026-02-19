'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sun, SlidersHorizontal, ShieldCheck } from 'lucide-react'
import SunscreenCard from '@/components/sunscreen/SunscreenCard'
import SunscreenFilters from '@/components/sunscreen/SunscreenFilters'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import type { Product, PaRating, SunscreenType, WhiteCast, SunscreenFinish, SunscreenActivity } from '@/types/database'

export default function SunscreenFinderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showFilters, setShowFilters] = useState(true)

  // Filter state
  const [paRating, setPaRating] = useState<PaRating | ''>('')
  const [whiteCast, setWhiteCast] = useState<WhiteCast | ''>('')
  const [finish, setFinish] = useState<SunscreenFinish | ''>('')
  const [sunscreenType, setSunscreenType] = useState<SunscreenType | ''>('')
  const [underMakeup, setUnderMakeup] = useState(false)
  const [waterResistant, setWaterResistant] = useState(false)
  const [activity, setActivity] = useState<SunscreenActivity | ''>('')
  const [sortBy, setSortBy] = useState('rating')

  const clearAll = () => {
    setPaRating('')
    setWhiteCast('')
    setFinish('')
    setSunscreenType('')
    setUnderMakeup(false)
    setWaterResistant(false)
    setActivity('')
    setSortBy('rating')
  }

  const fetchSunscreens = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (paRating) params.set('pa_rating', paRating)
      if (whiteCast) params.set('white_cast', whiteCast)
      if (finish) params.set('finish', finish)
      if (sunscreenType) params.set('sunscreen_type', sunscreenType)
      if (underMakeup) params.set('under_makeup', 'true')
      if (waterResistant) params.set('water_resistant', 'true')
      if (activity) params.set('activity', activity)
      if (sortBy) params.set('sort_by', sortBy)
      params.set('page', String(page))
      params.set('limit', '20')

      const res = await fetch(`/api/sunscreen?${params}`)
      if (!res.ok) throw new Error('Failed to fetch sunscreens')
      const data = await res.json()

      setProducts(data.products)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err) {
      console.error('Failed to fetch sunscreens:', err)
    } finally {
      setLoading(false)
    }
  }, [paRating, whiteCast, finish, sunscreenType, underMakeup, waterResistant, activity, sortBy, page])

  useEffect(() => {
    fetchSunscreens()
  }, [fetchSunscreens])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [paRating, whiteCast, finish, sunscreenType, underMakeup, waterResistant, activity, sortBy])

  const hasActiveFilters =
    paRating || whiteCast || finish || sunscreenType || underMakeup || waterResistant || activity

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sun className="w-6 h-6 text-gold" />
          <h1 className="font-display font-bold text-2xl text-white">
            Sunscreen Finder
          </h1>
        </div>
        <p className="text-white/40 text-sm">
          {total > 0 ? `${total} Korean sunscreens` : 'Find your perfect Korean sunscreen'} with K-beauty-specific filters.
        </p>
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          showFilters || hasActiveFilters
            ? 'bg-gold text-white'
            : 'glass-card text-white'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {showFilters ? 'Hide filters' : 'Show filters'}
        {hasActiveFilters && !showFilters && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        )}
      </button>

      {/* Filters */}
      {showFilters && (
        <SunscreenFilters
          paRating={paRating}
          whiteCast={whiteCast}
          finish={finish}
          sunscreenType={sunscreenType}
          underMakeup={underMakeup}
          waterResistant={waterResistant}
          activity={activity}
          sortBy={sortBy}
          onPaRatingChange={setPaRating}
          onWhiteCastChange={setWhiteCast}
          onFinishChange={setFinish}
          onSunscreenTypeChange={setSunscreenType}
          onUnderMakeupChange={setUnderMakeup}
          onWaterResistantChange={setWaterResistant}
          onActivityChange={setActivity}
          onSortChange={setSortBy}
          onClearAll={clearAll}
        />
      )}

      {/* Active filter summary when collapsed */}
      {!showFilters && hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-white/30 mr-1">Active:</span>
          {paRating && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300">
              Min {paRating}
            </span>
          )}
          {whiteCast && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
              {whiteCast === 'none' ? 'No white cast' : 'Minimal cast'}
            </span>
          )}
          {finish && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300">
              {finish}
            </span>
          )}
          {sunscreenType && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
              {sunscreenType}
            </span>
          )}
          {underMakeup && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-pink-500/20 text-pink-300">
              Under makeup
            </span>
          )}
          {waterResistant && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300">
              Water resistant
            </span>
          )}
          {activity && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/50">
              {activity === 'water_sports' ? 'Water sports' : activity}
            </span>
          )}
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={hasActiveFilters ? Sun : ShieldCheck}
          title={hasActiveFilters ? 'No sunscreens match your filters' : 'No sunscreens yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your filters to see more results.'
              : 'Sunscreen products are being added to the database.'
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {products.map((product) => (
            <SunscreenCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-medium glass-card disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            Previous
          </button>
          <span className="text-sm text-white/40 px-3">
            {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium glass-card disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            Next
          </button>
        </div>
      )}

      {/* Sunscreen education section */}
      <div className="glass-card p-5 space-y-4 mt-4">
        <h2 className="font-display font-semibold text-base text-white">
          Korean Sunscreen Guide
        </h2>
        <div className="grid gap-3 text-xs text-white/50 leading-relaxed">
          <div>
            <p className="text-white/70 font-medium mb-1">SPF vs PA Rating</p>
            <p>
              SPF measures UVB protection (burning rays). PA measures UVA protection (aging rays) -- unique to Asian sunscreens.
              PA++++ is the highest rating, blocking 95%+ of UVA rays. Always look for both high SPF and PA++++.
            </p>
          </div>
          <div>
            <p className="text-white/70 font-medium mb-1">Chemical vs Physical vs Hybrid</p>
            <p>
              Chemical filters (avobenzone, octinoxate) absorb UV and tend to be lightweight with no white cast.
              Physical/mineral filters (zinc oxide, titanium dioxide) reflect UV and are gentler on sensitive skin.
              Hybrid combines both for balanced protection.
            </p>
          </div>
          <div>
            <p className="text-white/70 font-medium mb-1">Why Korean Sunscreens?</p>
            <p>
              Korean sunscreen formulations are years ahead of Western counterparts -- lightweight, cosmetically elegant,
              no white cast, and designed to wear well under makeup. They prioritize daily wearability because Korean
              skincare culture treats sunscreen as the most important skincare step.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
