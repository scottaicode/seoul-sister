'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  FlaskConical,
  ArrowRight,
  Loader2,
  Package,
  Star,
  MessageCircle,
} from 'lucide-react'
import DupeCard from '@/components/dupes/DupeCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import LazyImage from '@/components/ui/LazyImage'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/database'

interface DupeResult {
  product: Product
  match_score: number
  shared_ingredients: string[]
  unique_to_original: string[]
  unique_to_dupe: string[]
  price_savings_pct: number
  effectiveness_insight?: {
    ingredientName: string
    concern: string
    score: number
  } | null
}

interface DupeResponse {
  original: Product
  dupes: DupeResult[]
}

/**
 * This page shows DATA: catalog products whose ingredient lists overlap with
 * the one chosen, with the overlap and the price difference. Which of them
 * suits a member, or whether to switch at all, is Yuri's call.
 *
 * It used to have a second tab, "AI Dupe Search", that sent any product name
 * to a one-shot model call presented as "Yuri's Budget Optimizer" and showed
 * "AI-recommended dupes" with estimated prices: products and prices named from
 * the model's memory, with none of what Yuri knows about the member and outside
 * her monthly allowance. Removed Nov 14 2026 (Yuri Sole Authority, CLAUDE.md).
 * A product we do not list now goes to Yuri's chat, where she can look it up.
 */
function askYuriForAlternative(productText: string): string {
  const name = productText.replace(/\s+/g, ' ').trim().slice(0, 120)
  return name
    ? `Is there a cheaper product with the same key ingredients as ${name}? Tell me if it is worth switching.`
    : ''
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

  // A product we do not list: typed here, then taken to Yuri's chat.
  const [otherProduct, setOtherProduct] = useState('')

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
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch(`/api/dupes?product_id=${productId}&max_dupes=10`, { headers })
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

      {/* Database mode: product search + ingredient matching */}
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
                        <LazyImage
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
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
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
                    {dupeData.dupes.length} product{dupeData.dupes.length !== 1 ? 's' : ''} with overlapping key ingredients
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
                  description={`No products in our database share enough key ingredients with ${selectedProduct.name_en}. Yuri can look further.`}
                />
              )}

              {/* Ask Yuri CTA */}
              <Link
                href={`/yuri?ask=${encodeURIComponent(askYuriForAlternative(`${selectedProduct.brand_en} ${selectedProduct.name_en}`))}`}
                className="glass-card p-4 flex items-center gap-3 group"
              >
                <MessageCircle className="w-5 h-5 text-gold group-hover:scale-110 transition-transform duration-200" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white group-hover:text-gold transition-colors duration-200">
                    Ask Yuri whether to switch
                  </p>
                  <p className="text-[10px] text-white/40">
                    This list is ingredient overlap and price. She knows your skin and what you own.
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

      {/* A product that is not in our catalog goes to Yuri, who can look it up. */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-xs text-white/40">
          Looking at a product we do not list, or a Western brand? Type it and ask Yuri.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={otherProduct}
            onChange={e => setOtherProduct(e.target.value)}
            placeholder="e.g. Sulwhasoo Concentrated Ginseng Cream"
            className="glass-input px-3 py-2.5 text-sm flex-1"
          />
          {otherProduct.trim() ? (
            <Link
              href={`/yuri?ask=${encodeURIComponent(askYuriForAlternative(otherProduct))}`}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold flex items-center gap-1.5 flex-shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              Ask Yuri
            </Link>
          ) : (
            <span className="px-4 py-2.5 rounded-xl bg-white/5 text-white/30 text-sm font-semibold flex items-center gap-1.5 flex-shrink-0">
              <MessageCircle className="w-4 h-4" />
              Ask Yuri
            </span>
          )}
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
