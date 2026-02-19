'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Package } from 'lucide-react'
import ProductCard from '@/components/products/ProductCard'
import ProductFilters from '@/components/products/ProductFilters'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import type { Product } from '@/types/database'

export default function ProductsPage() {
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

      const res = await fetch(`/api/products?${params}`)
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
  }, [query, category, sortBy, page, includeIngredients, excludeIngredients, fragranceFree, comedogenicMax])

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
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onSortChange={setSortBy}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onIncludeIngredientsChange={setIncludeIngredients}
        onExcludeIngredientsChange={setExcludeIngredients}
        onFragranceFreeChange={setFragranceFree}
        onComedogenicMaxChange={setComedogenicMax}
      />

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
            <ProductCard key={product.id} product={product} />
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

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
