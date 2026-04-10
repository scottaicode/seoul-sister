'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Package, Star, Heart, Sparkles } from 'lucide-react'
import Link from 'next/link'
import ProductCard from '@/components/products/ProductCard'
import LazyImage from '@/components/ui/LazyImage'
import type { TrendingInfo } from '@/components/products/ProductCard'
import ProductFilters from '@/components/products/ProductFilters'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/database'

interface LovedProduct {
  id: string
  name_en: string
  brand_en: string
  category: string
  rating_avg: number | null
  price_usd: number | null
  image_url: string | null
  volume_display: string | null
  effectiveness_score: number
  concern: string
}

export default function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sortBy, setSortBy] = useState('rating')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Ingredient filter state
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([])
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([])
  const [fragranceFree, setFragranceFree] = useState(false)
  const [comedogenicMax, setComedogenicMax] = useState<number | null>(null)

  // Discovery data (fetched once)
  const [trendingMap, setTrendingMap] = useState<Record<string, TrendingInfo>>({})
  const [lovedProducts, setLovedProducts] = useState<LovedProduct[]>([])
  const [lovedSkinType, setLovedSkinType] = useState<string | null>(null)
  const [discoveryLoaded, setDiscoveryLoaded] = useState(false)

  // Fetch discovery data (trending map + loved products) once on mount
  useEffect(() => {
    async function loadDiscovery() {
      try {
        const headers: Record<string, string> = {}
        if (user) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
        }

        const res = await fetch('/api/products/discovery', { headers })
        if (res.ok) {
          const data = await res.json()
          setTrendingMap(data.trendingMap ?? {})
          setLovedProducts(data.lovedProducts ?? [])
          setLovedSkinType(data.skinType ?? null)
        }
      } catch {
        // Discovery is non-critical
      } finally {
        setDiscoveryLoaded(true)
      }
    }

    loadDiscovery()
  }, [user])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      if (category) params.set('category', category)
      if (sortBy) params.set('sort_by', sortBy)
      params.set('page', String(page))
      params.set('limit', '20')

      // Ingredient filters
      if (includeIngredients.length > 0) {
        params.set('include_ingredients', includeIngredients.join(','))
      }
      if (excludeIngredients.length > 0) {
        params.set('exclude_ingredients', excludeIngredients.join(','))
      }
      if (fragranceFree) {
        params.set('fragrance_free', 'true')
      }
      if (comedogenicMax !== null) {
        params.set('comedogenic_max', String(comedogenicMax))
      }

      // Add auth header for recommended sort
      const headers: Record<string, string> = {}
      if (sortBy === 'recommended' && user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }

      const res = await fetch(`/api/products?${params}`, { headers })
      if (!res.ok) throw new Error('Failed to fetch products')
      const data = await res.json()

      setProducts(data.products)
      setTotalPages(data.total_pages)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }, [query, category, sortBy, page, includeIngredients, excludeIngredients, fragranceFree, comedogenicMax, user])

  useEffect(() => {
    const timeout = setTimeout(fetchProducts, query ? 300 : 0)
    return () => clearTimeout(timeout)
  }, [fetchProducts, query])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [query, category, sortBy, includeIngredients, excludeIngredients, fragranceFree, comedogenicMax])

  const hasIngredientFilters = includeIngredients.length > 0 || excludeIngredients.length > 0 || fragranceFree || comedogenicMax !== null

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-2xl text-white">
          Product Database
        </h1>
        <p className="text-white/40 text-sm">
          {total > 0 ? `${total} K-beauty products` : 'Explore K-beauty products'} with full ingredient analysis.
        </p>
      </div>

      {/* Filters */}
      <ProductFilters
        query={query}
        category={category}
        sortBy={sortBy}
        showFilters={showFilters}
        includeIngredients={includeIngredients}
        excludeIngredients={excludeIngredients}
        fragranceFree={fragranceFree}
        comedogenicMax={comedogenicMax}
        isAuthenticated={!!user}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onSortChange={setSortBy}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onIncludeIngredientsChange={setIncludeIngredients}
        onExcludeIngredientsChange={setExcludeIngredients}
        onFragranceFreeChange={setFragranceFree}
        onComedogenicMaxChange={setComedogenicMax}
      />

      {/* Recommended sort indicator */}
      {sortBy === 'recommended' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gold/10 border border-gold/20">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          <span className="text-xs text-gold">
            Sorted by ingredient effectiveness for your skin type
          </span>
        </div>
      )}

      {/* Active ingredient filter summary (visible when filter panel is closed) */}
      {!showFilters && hasIngredientFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-white/30 mr-1">Filtering by:</span>
          {includeIngredients.map(name => (
            <span key={`inc-${name}`} className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
              + {name}
            </span>
          ))}
          {excludeIngredients.map(name => (
            <span key={`exc-${name}`} className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300">
              - {name}
            </span>
          ))}
          {fragranceFree && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300">
              Fragrance-free
            </span>
          )}
          {comedogenicMax !== null && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
              Low comedogenic
            </span>
          )}
        </div>
      )}

      {/* "People With Your Skin Type Love" section */}
      {discoveryLoaded && lovedProducts.length > 0 && lovedSkinType && !query && !hasIngredientFilters && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            <h2 className="font-display font-semibold text-sm text-white">
              Loved by {lovedSkinType} skin
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {lovedProducts.map(product => (
              <Link
                key={product.id}
                href={`/browse/${product.id}`}
                className="flex-shrink-0 w-36 glass-card p-3 transition-all duration-300 hover:bg-white/10 group"
              >
                <div className="w-full h-20 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden mb-2">
                  {product.image_url ? (
                    <LazyImage
                      src={product.image_url}
                      alt={product.name_en}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="w-5 h-5 text-gold" strokeWidth={1.5} />
                  )}
                </div>
                <p className="font-display font-semibold text-xs text-white truncate group-hover:text-gold transition-colors">
                  {product.name_en}
                </p>
                <p className="text-[10px] text-white/40 truncate">{product.brand_en}</p>
                <div className="flex items-center justify-between mt-1.5">
                  {product.rating_avg && (
                    <span className="flex items-center gap-0.5 text-[10px] text-white/40">
                      <Star className="w-2.5 h-2.5 fill-gold text-gold" />
                      {Number(product.rating_avg).toFixed(1)}
                    </span>
                  )}
                  <span className="text-[10px] text-emerald-400 font-medium">
                    {Math.round(product.effectiveness_score * 100)}%
                  </span>
                </div>
                <p className="text-[9px] text-white/30 mt-0.5 truncate capitalize">
                  {product.concern}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={query || hasIngredientFilters ? Search : Package}
          title={query || hasIngredientFilters ? 'No results found' : 'No products yet'}
          description={
            query
              ? `No products matching "${query}". Try a different search term.`
              : hasIngredientFilters
                ? 'No products match your ingredient filters. Try adjusting your criteria.'
                : 'Products are being added to the database.'
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              trendingInfo={trendingMap[product.id]}
              basePath="/browse"
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            Previous
          </button>
          <span className="text-sm text-white/60 px-3">
            {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            Next
          </button>
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
