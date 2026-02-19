'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Sparkles,
  FlaskConical,
  ArrowRight,
  Loader2,
  Package,
  Star,
  MessageCircle,
} from 'lucide-react'
import DupeCard from '@/components/dupes/DupeCard'
import AiDupeCard from '@/components/dupes/AiDupeCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import type { Product } from '@/types/database'

interface DupeResult {
  product: Product
  match_score: number
  shared_ingredients: string[]
  unique_to_original: string[]
  unique_to_dupe: string[]
  price_savings_pct: number
}

interface DupeResponse {
  original: Product
  dupes: DupeResult[]
}

interface AiDupe {
  name: string
  brand: string
  estimated_price_usd: number
  key_shared_actives: string[]
  match_reasoning: string
  key_differences: string
  where_to_buy: string
}

interface AiDupeResponse {
  success: boolean
  analysis: {
    original_analysis: {
      key_actives: string[]
      price_range_usd: string
      why_its_popular: string
    }
    dupes: AiDupe[]
    savings_summary: string
  }
}

export default function DupesPage() {
  const searchParams = useSearchParams()
  const preselectedId = searchParams.get('product_id')

  // Product search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Database dupe state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [dupeData, setDupeData] = useState<DupeResponse | null>(null)
  const [dupeLoading, setDupeLoading] = useState(false)

  // AI dupe state
  const [aiQuery, setAiQuery] = useState('')
  const [aiResult, setAiResult] = useState<AiDupeResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const [activeMode, setActiveMode] = useState<'database' | 'ai'>('database')

  // Auto-fetch dupes for preselected product
  useEffect(() => {
    if (preselectedId) {
      fetchDupesForProduct(preselectedId)
    }
  }, [preselectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Product search with debounce
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/products?query=${encodeURIComponent(query)}&limit=8`)
      if (!res.ok) return
      const data = await res.json()
      setSearchResults(data.products ?? [])
      setShowDropdown(true)
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => searchProducts(searchQuery), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchProducts])

  async function fetchDupesForProduct(productId: string) {
    setDupeLoading(true)
    setDupeData(null)
    try {
      const res = await fetch(`/api/dupes?product_id=${productId}&max_dupes=10`)
      if (!res.ok) throw new Error('Failed to fetch dupes')
      const data: DupeResponse = await res.json()
      setDupeData(data)
      setSelectedProduct(data.original)
    } catch {
      setDupeData(null)
    } finally {
      setDupeLoading(false)
    }
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product)
    setSearchQuery(product.name_en)
    setShowDropdown(false)
    fetchDupesForProduct(product.id)
  }

  async function handleAiSearch() {
    if (!aiQuery.trim()) return
    setAiLoading(true)
    setAiResult(null)
    try {
      const res = await fetch('/api/dupes/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_name: aiQuery }),
      })
      if (!res.ok) throw new Error('AI search failed')
      const data: AiDupeResponse = await res.json()
      setAiResult(data)
    } catch {
      setAiResult(null)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-2xl text-white">
          K-Beauty Dupe Finder
        </h1>
        <p className="text-white/40 text-sm">
          Find cheaper alternatives with the same key ingredients.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        <button
          onClick={() => setActiveMode('database')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeMode === 'database'
              ? 'bg-gold/20 text-gold shadow-sm'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Ingredient Match
        </button>
        <button
          onClick={() => setActiveMode('ai')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeMode === 'ai'
              ? 'bg-gold/20 text-gold shadow-sm'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Dupe Search
        </button>
      </div>

      {/* Database mode: product search + ingredient matching */}
      {activeMode === 'database' && (
        <div className="space-y-4">
          {/* Product search */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  if (!e.target.value) {
                    setSelectedProduct(null)
                    setDupeData(null)
                  }
                }}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Search a product to find dupes..."
                className="glass-input pl-9 pr-4 py-2.5 text-sm w-full"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />
              )}
            </div>

            {/* Search dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 glass-card-strong divide-y divide-white/5 max-h-64 overflow-y-auto">
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors duration-150 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name_en}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-3.5 h-3.5 text-gold/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{product.name_en}</p>
                      <p className="text-[10px] text-white/40">{product.brand_en}</p>
                    </div>
                    {product.price_usd && (
                      <span className="text-xs font-medium text-white/60 flex-shrink-0">
                        ${Number(product.price_usd).toFixed(0)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Click-away handler */}
          {showDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          )}

          {/* Loading */}
          {dupeLoading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {/* Selected product header */}
          {dupeData && selectedProduct && !dupeLoading && (
            <>
              <div className="glass-card-strong p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedProduct.image_url ? (
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name_en}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <Package className="w-5 h-5 text-gold/50" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-white truncate">
                    {selectedProduct.name_en}
                  </p>
                  <p className="text-xs text-white/40">{selectedProduct.brand_en}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedProduct.price_usd && (
                      <span className="font-display font-bold text-sm text-white">
                        ${Number(selectedProduct.price_usd).toFixed(0)}
                      </span>
                    )}
                    {selectedProduct.rating_avg && (
                      <span className="flex items-center gap-0.5 text-[10px] text-white/40">
                        <Star className="w-2.5 h-2.5 fill-gold text-gold" />
                        {Number(selectedProduct.rating_avg).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gold/20 text-gold">
                    Original
                  </span>
                </div>
              </div>

              {/* Dupe results */}
              {dupeData.dupes.length > 0 ? (
                <div className="space-y-2.5">
                  <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-gold" />
                    {dupeData.dupes.length} alternative{dupeData.dupes.length !== 1 ? 's' : ''} found
                  </h2>
                  {dupeData.dupes.map((dupe, idx) => (
                    <DupeCard
                      key={dupe.product.id}
                      original={selectedProduct}
                      dupe={dupe}
                      rank={idx + 1}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FlaskConical}
                  title="No dupes found"
                  description={`No products in our database share enough key ingredients with ${selectedProduct.name_en}. Try the AI search for broader results.`}
                />
              )}

              {/* Ask Yuri CTA */}
              <Link
                href={`/yuri?ask=${encodeURIComponent(`Find me a cheaper alternative to ${selectedProduct.name_en} by ${selectedProduct.brand_en}`)}`}
                className="glass-card p-4 flex items-center gap-3 group"
              >
                <MessageCircle className="w-5 h-5 text-gold group-hover:scale-110 transition-transform duration-200" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white group-hover:text-gold transition-colors duration-200">
                    Ask Yuri for deeper dupe analysis
                  </p>
                  <p className="text-[10px] text-white/40">
                    Budget Optimizer specialist for formulation-level comparison
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-gold transition-colors duration-200" />
              </Link>
            </>
          )}

          {/* Initial empty state */}
          {!dupeLoading && !dupeData && !preselectedId && (
            <EmptyState
              icon={FlaskConical}
              title="Find your dupes"
              description="Search for a K-beauty product above to discover budget-friendly alternatives with matching key ingredients."
            />
          )}
        </div>
      )}

      {/* AI mode: free-text search */}
      {activeMode === 'ai' && (
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs text-white/40">
              Describe any product — even brands not in our database. Yuri&apos;s Budget Optimizer will find K-beauty dupes.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                placeholder="e.g. Sulwhasoo Concentrated Ginseng Cream"
                className="glass-input px-3 py-2.5 text-sm flex-1"
              />
              <button
                onClick={handleAiSearch}
                disabled={aiLoading || !aiQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold disabled:opacity-40 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Find Dupes
              </button>
            </div>
          </div>

          {/* AI loading */}
          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-white/40">Analyzing formulations...</p>
            </div>
          )}

          {/* AI results */}
          {aiResult?.analysis && !aiLoading && (
            <div className="space-y-4">
              {/* Original analysis */}
              <div className="glass-card-strong p-4 space-y-2">
                <h3 className="font-display font-semibold text-sm text-white">Original Product Analysis</h3>
                <p className="text-xs text-white/60">{aiResult.analysis.original_analysis.why_its_popular}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {aiResult.analysis.original_analysis.key_actives.map(active => (
                    <span
                      key={active}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-gold/15 text-gold-light"
                    >
                      {active}
                    </span>
                  ))}
                </div>
                {aiResult.analysis.original_analysis.price_range_usd && (
                  <p className="text-[10px] text-white/30">
                    Estimated price: {aiResult.analysis.original_analysis.price_range_usd}
                  </p>
                )}
              </div>

              {/* AI dupes */}
              {aiResult.analysis.dupes?.length > 0 && (
                <div className="space-y-2.5">
                  <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-gold" />
                    {aiResult.analysis.dupes.length} AI-recommended dupe{aiResult.analysis.dupes.length !== 1 ? 's' : ''}
                  </h2>
                  {aiResult.analysis.dupes.map((dupe, idx) => (
                    <AiDupeCard key={`${dupe.brand}-${dupe.name}`} dupe={dupe} rank={idx + 1} />
                  ))}
                </div>
              )}

              {/* Savings summary */}
              {aiResult.analysis.savings_summary && (
                <div className="glass-card p-3">
                  <p className="text-xs text-emerald-300/80">
                    <span className="font-semibold">Savings Summary:</span>{' '}
                    {aiResult.analysis.savings_summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Initial state for AI */}
          {!aiLoading && !aiResult && (
            <EmptyState
              icon={Sparkles}
              title="AI-powered dupe search"
              description="Enter any product name — even Western brands or products outside our database. Yuri will find K-beauty alternatives with similar formulations."
            />
          )}
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
