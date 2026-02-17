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

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      if (category) params.set('category', category)
      if (sortBy) params.set('sort_by', sortBy)
      params.set('page', String(page))
      params.set('limit', '20')

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
  }, [query, category, sortBy, page])

  useEffect(() => {
    const timeout = setTimeout(fetchProducts, query ? 300 : 0)
    return () => clearTimeout(timeout)
  }, [fetchProducts, query])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [query, category, sortBy])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-2xl text-seoul-charcoal">
          Product Database
        </h1>
        <p className="text-seoul-soft text-sm">
          {total > 0 ? `${total} K-beauty products` : 'Explore K-beauty products'} with full ingredient analysis.
        </p>
      </div>

      {/* Filters */}
      <ProductFilters
        query={query}
        category={category}
        sortBy={sortBy}
        showFilters={showFilters}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onSortChange={setSortBy}
        onToggleFilters={() => setShowFilters(!showFilters)}
      />

      {/* Product list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={query ? Search : Package}
          title={query ? 'No results found' : 'No products yet'}
          description={
            query
              ? `No products matching "${query}". Try a different search term.`
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
            className="px-4 py-2 rounded-xl text-sm font-medium glass-card hover:shadow-glass-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            Previous
          </button>
          <span className="text-sm text-seoul-soft px-3">
            {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium glass-card hover:shadow-glass-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
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
