'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Archive,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import ExpiryCard from '@/components/tracking/ExpiryCard'
import type { UserProductTracking, Product } from '@/types/database'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

// ---------------------------------------------------------------------------
// Add Product Modal
// ---------------------------------------------------------------------------

function AddTrackingModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: () => void
}) {
  const [mode, setMode] = useState<'search' | 'custom'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [customName, setCustomName] = useState('')
  const [paoMonths, setPaoMonths] = useState<string>('')
  const [adding, setAdding] = useState(false)

  async function searchProducts(q: string) {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/products?query=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json()
      setResults(data.products ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => searchProducts(query), 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function handleAddProduct(productId: string) {
    setAdding(true)
    try {
      const headers = await getAuthHeaders()
      const body: Record<string, unknown> = { product_id: productId }
      if (paoMonths) body.pao_months = parseInt(paoMonths, 10)
      const res = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onAdd()
        onClose()
        resetForm()
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleAddCustom() {
    if (!customName.trim()) return
    setAdding(true)
    try {
      const headers = await getAuthHeaders()
      const body: Record<string, unknown> = { custom_product_name: customName.trim() }
      if (paoMonths) body.pao_months = parseInt(paoMonths, 10)
      const res = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onAdd()
        onClose()
        resetForm()
      }
    } finally {
      setAdding(false)
    }
  }

  function resetForm() {
    setQuery('')
    setResults([])
    setCustomName('')
    setPaoMonths('')
    setMode('search')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card-strong p-5 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-base text-white">Track a Product</h3>
          <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-4">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'search' ? 'bg-gold/20 text-gold-light' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Search Database
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'custom' ? 'bg-gold/20 text-gold-light' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Custom Name
          </button>
        </div>

        {mode === 'search' ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/40"
              />
            </div>

            {searching && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gold/40" />
              </div>
            )}

            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
              {results.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleAddProduct(product.id)}
                  disabled={adding}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{product.name_en}</p>
                    <p className="text-[10px] text-white/40">{product.brand_en} · {product.category}</p>
                  </div>
                  <Plus className="w-4 h-4 text-gold flex-shrink-0" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Product name (e.g., COSRX Snail Mucin)"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/40"
            />

            <div>
              <label className="text-[10px] text-white/30 block mb-1">
                PAO (Period After Opening) in months
              </label>
              <input
                type="number"
                value={paoMonths}
                onChange={(e) => setPaoMonths(e.target.value)}
                placeholder="12"
                min="1"
                max="60"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/40"
              />
            </div>

            <button
              onClick={handleAddCustom}
              disabled={adding || !customName.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all disabled:opacity-40"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Start Tracking
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'expiring' | 'active' | 'inactive'

export default function TrackingPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<UserProductTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const loadTracking = useCallback(async () => {
    if (!user) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/tracking', { headers })
      if (res.ok) {
        const data = await res.json()
        setItems(data.tracked_products ?? [])
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadTracking()
  }, [loadTracking])

  async function handleStatusChange(id: string, status: 'finished' | 'discarded') {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/tracking/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ status }),
    })
    if (res.ok) loadTracking()
  }

  async function handleDelete(id: string) {
    const headers = await getAuthHeaders()
    await fetch(`/api/tracking/${id}`, { method: 'DELETE', headers })
    loadTracking()
  }

  // Filter items
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const thirtyDays = new Date(now)
  thirtyDays.setDate(thirtyDays.getDate() + 30)

  const filtered = items.filter((item) => {
    switch (activeFilter) {
      case 'expiring': {
        if (item.status !== 'active' || !item.expiry_date) return false
        const exp = new Date(item.expiry_date)
        return exp <= thirtyDays
      }
      case 'active':
        return item.status === 'active'
      case 'inactive':
        return item.status === 'finished' || item.status === 'discarded' || item.status === 'expired'
      default:
        return true
    }
  })

  const expiringCount = items.filter((item) => {
    if (item.status !== 'active' || !item.expiry_date) return false
    return new Date(item.expiry_date) <= thirtyDays
  }).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-semibold text-2xl text-white section-heading">
            Product Shelf Life
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Track when you opened products and never use expired skincare.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-xs font-semibold hover:shadow-glow-gold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Track
        </button>
      </div>

      {/* Stats bar */}
      {!loading && items.length > 0 && (
        <div className="flex gap-3">
          <div className="glass-card p-3 flex-1 text-center">
            <p className="text-lg font-display font-bold text-white">
              {items.filter((i) => i.status === 'active').length}
            </p>
            <p className="text-[10px] text-white/40">Active</p>
          </div>
          {expiringCount > 0 && (
            <div className="glass-card p-3 flex-1 text-center border-amber-500/20">
              <p className="text-lg font-display font-bold text-amber-400">{expiringCount}</p>
              <p className="text-[10px] text-amber-400/60">Expiring Soon</p>
            </div>
          )}
          <div className="glass-card p-3 flex-1 text-center">
            <p className="text-lg font-display font-bold text-white/50">
              {items.filter((i) => i.status === 'finished' || i.status === 'discarded').length}
            </p>
            <p className="text-[10px] text-white/40">Completed</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {!loading && items.length > 0 && (
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([
            { key: 'all', label: 'All', icon: Archive },
            { key: 'expiring', label: 'Expiring', icon: AlertTriangle },
            { key: 'active', label: 'Active', icon: CheckCircle2 },
            { key: 'inactive', label: 'Done', icon: Clock },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === key
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {label}
              {key === 'expiring' && expiringCount > 0 && (
                <span className="ml-1 text-amber-400">({expiringCount})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Clock className="w-12 h-12 text-gold/30 mx-auto mb-3" />
          <h2 className="font-display font-semibold text-lg text-white mb-2">
            No Products Tracked
          </h2>
          <p className="text-sm text-white/40 mb-4 max-w-sm mx-auto">
            Start tracking when you open products to get expiry alerts and never use
            expired skincare again.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all"
          >
            <Plus className="w-4 h-4" />
            Track Your First Product
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-white/40">No products match this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <ExpiryCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AddTrackingModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={loadTracking}
      />

      <div className="h-16 md:h-0" />
    </div>
  )
}
