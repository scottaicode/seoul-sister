'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  name_en: string
  brand_en: string
  category: string
  image_url: string | null
  price_usd: number | null
}

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (productId: string) => Promise<{ has_conflicts: boolean; conflicts: Array<{ ingredient_a: string; ingredient_b: string; severity: string; description: string }> } | null>
  routineType: string
  existingProductIds: string[]
}

export function AddProductModal({ isOpen, onClose, onAdd, routineType, existingProductIds }: AddProductModalProps) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addResult, setAddResult] = useState<{ productId: string; conflicts: Array<{ ingredient_a: string; ingredient_b: string; severity: string; description: string }> } | null>(null)

  const searchProducts = useCallback(async (searchQuery: string) => {
    setLoading(true)
    try {
      let q = supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category, image_url, price_usd')
        .eq('is_verified', true)
        .order('rating_avg', { ascending: false })
        .limit(20)

      if (searchQuery.trim()) {
        q = q.or(`name_en.ilike.%${searchQuery}%,brand_en.ilike.%${searchQuery}%`)
      }

      const { data } = await q
      setProducts((data ?? []).filter((p) => !existingProductIds.includes(p.id)))
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [existingProductIds])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => searchProducts(query), 300)
    return () => clearTimeout(timer)
  }, [query, isOpen, searchProducts])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setAddResult(null)
      searchProducts('')
    }
  }, [isOpen, searchProducts])

  if (!isOpen) return null

  async function handleAdd(productId: string) {
    setAdding(productId)
    setAddResult(null)
    try {
      const result = await onAdd(productId)
      if (result?.has_conflicts) {
        setAddResult({ productId, conflicts: result.conflicts })
      } else {
        onClose()
      }
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[80vh] bg-seoul-dark border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="font-display font-semibold text-white">
            Add Product to {routineType === 'am' ? 'Morning' : 'Evening'} Routine
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/30"
              autoFocus
            />
          </div>
        </div>

        {/* Conflict feedback */}
        {addResult && (
          <div className="mx-3 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                Product added with {addResult.conflicts.length} conflict{addResult.conflicts.length !== 1 ? 's' : ''}
              </span>
            </div>
            {addResult.conflicts.map((c, i) => (
              <p key={i} className="text-[10px] text-white/50 ml-6">
                {c.ingredient_a} + {c.ingredient_b}: {c.description}
              </p>
            ))}
            <button
              onClick={onClose}
              className="mt-2 ml-6 text-xs text-gold-light hover:text-gold"
            >
              Got it, close
            </button>
          </div>
        )}

        {/* Product list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gold" />
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-8">
              {query ? 'No matching products found' : 'No products available'}
            </p>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-white/20">
                      {product.category.slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {product.name_en}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {product.brand_en} &middot; {product.category}
                    {product.price_usd ? ` &middot; $${product.price_usd}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(product.id)}
                  disabled={adding === product.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gold/10 text-gold-light text-xs font-medium hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  {adding === product.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
