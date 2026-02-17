'use client'

import { useState } from 'react'
import { Search, TrendingUp, Star, Sparkles, AlertTriangle, Package, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Product } from '@/types/database'

interface TikTokResult extends Product {
  trending: {
    trend_score: number
    mention_count: number
    source: string
  } | null
  review_summary: {
    count: number
    avg_rating: number
    holy_grail_count: number
    broke_me_out_count: number
  } | null
}

export default function TikTokCapture() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TikTokResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch('/api/trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      setResults(data.products ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="glass-card-strong p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
            <span className="text-white text-xs font-bold">TT</span>
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-seoul-charcoal">
              TikTok Moment Capture
            </h3>
            <p className="text-[10px] text-seoul-soft">
              Just saw a product on TikTok? Search it here for instant analysis.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-seoul-soft" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='"Beauty of Joseon sunscreen" or "snail mucin"'
              className="glass-input pl-9 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="glass-button-primary text-sm px-4 py-2 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-rose-gold" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-seoul-soft">
            No products found for &ldquo;{query}&rdquo;. Try different keywords.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-seoul-soft">
            Found {results.length} product{results.length !== 1 ? 's' : ''} matching your search
          </p>

          {results.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="glass-card p-4 space-y-3 block hover:shadow-glass-lg transition-all duration-300"
            >
              <div className="flex gap-3">
                {/* Image */}
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-seoul-pearl flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name_en}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <Package className="w-5 h-5 text-rose-gold/50" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-seoul-charcoal truncate">
                    {product.name_en}
                  </p>
                  <p className="text-[10px] text-seoul-soft">{product.brand_en}</p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {product.rating_avg && (
                      <span className="flex items-center gap-0.5 text-[10px]">
                        <Star className="w-2.5 h-2.5 fill-rose-gold text-rose-gold" />
                        {Number(product.rating_avg).toFixed(1)}
                      </span>
                    )}
                    {product.trending && (
                      <span className="flex items-center gap-0.5 text-[10px] text-rose-dark font-medium">
                        <TrendingUp className="w-2.5 h-2.5" />
                        Trending ({product.trending.trend_score})
                      </span>
                    )}
                    {product.price_usd && (
                      <span className="text-[10px] font-semibold text-seoul-charcoal">
                        ${Number(product.price_usd).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Review summary if available */}
              {product.review_summary && product.review_summary.count > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/30">
                  <span className="text-[10px] text-seoul-soft">
                    {product.review_summary.count} reviews
                  </span>
                  {product.review_summary.holy_grail_count > 0 && (
                    <span className="inline-flex items-center gap-0.5 badge-pink text-[10px]">
                      <Sparkles className="w-2.5 h-2.5" />
                      {product.review_summary.holy_grail_count} Holy Grail
                    </span>
                  )}
                  {product.review_summary.broke_me_out_count > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {product.review_summary.broke_me_out_count} Broke Me Out
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
