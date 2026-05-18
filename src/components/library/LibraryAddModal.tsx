'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X, Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import LazyImage from '@/components/ui/LazyImage'

interface SearchResult {
  id: string
  name_en: string
  brand_en: string
  category: string
  image_url: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdded: () => void
}

/**
 * Library-specific add-product modal. Search ss_products, tap to add to
 * ss_user_products via /api/library/owned. Unlike the routine AddProductModal,
 * this doesn't run conflict checks — that's Yuri's job in conversation.
 */
export default function LibraryAddModal({ isOpen, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: searchError } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category, image_url')
        .or(`name_en.ilike.%${q}%,brand_en.ilike.%${q}%`)
        .eq('is_verified', true)
        .limit(20)
      if (searchError) throw searchError
      setResults((data || []) as SearchResult[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handle = setTimeout(() => search(query), 250)
    return () => clearTimeout(handle)
  }, [query, isOpen, search])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setError(null)
    }
  }, [isOpen])

  const handleAdd = async (productId: string) => {
    setAdding(productId)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Please sign in again')
        return
      }
      const res = await fetch('/api/library/owned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ product_id: productId }),
      })
      if (res.status === 409) {
        setError('Already in your collection')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Add failed' }))
        throw new Error(body.error || 'Add failed')
      }
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed')
    } finally {
      setAdding(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 ring-1 ring-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Add a product</h3>
          <button onClick={onClose} className="p-1 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product or brand"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-rose-400/50"
              autoFocus
            />
          </div>
          {error && (
            <p className="mt-2 text-xs text-rose-300">{error}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
            </div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-white/50 text-center py-8">No products found.</p>
          )}
          {!loading && query.trim().length < 2 && (
            <p className="text-sm text-white/50 text-center py-8">
              Type to search across thousands of K-beauty products.
            </p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p.id)}
              disabled={adding === p.id}
              className="w-full flex items-center gap-3 p-3 rounded-lg ring-1 ring-white/10 hover:bg-white/5 transition text-left disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded bg-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.image_url ? (
                  <LazyImage src={p.image_url} alt={p.name_en} className="w-full h-full object-cover" />
                ) : (
                  <Plus className="w-4 h-4 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 truncate">{p.brand_en}</p>
                <p className="text-sm text-white truncate">{p.name_en}</p>
              </div>
              {adding === p.id ? (
                <Loader2 className="w-4 h-4 text-rose-300 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 text-rose-300" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
