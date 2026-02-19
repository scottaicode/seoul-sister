'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Sun,
  Moon,
  Sparkles,
  Loader2,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ConflictWarning } from '@/components/routine/ConflictWarning'
import { WaitTimeIndicator } from '@/components/routine/WaitTimeIndicator'
import { AddProductModal } from '@/components/routine/AddProductModal'
import { RoutineGenerator } from '@/components/routine/RoutineGenerator'
import {
  suggestWaitTimes,
  detectMissingSteps,
  type WaitTimeSuggestion,
  type MissingStepAlert,
} from '@/lib/intelligence/layering-order'

interface ProductInfo {
  id: string
  name_en: string
  brand_en: string
  category: string
  image_url: string | null
  price_usd: number | null
}

interface RoutineProduct {
  id: string
  step_order: number
  frequency: string | null
  notes: string | null
  product_id: string
  product: ProductInfo | null
}

interface Routine {
  id: string
  name: string
  routine_type: 'am' | 'pm' | 'weekly'
  is_active: boolean
  products: RoutineProduct[]
}

interface Conflict {
  ingredient_a: string
  ingredient_b: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: string
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

function MissingStepBanner({ alerts }: { alerts: MissingStepAlert[] }) {
  const required = alerts.filter((a) => a.importance === 'required')
  if (required.length === 0) return null

  return (
    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-medium text-amber-400">Missing Steps</span>
      </div>
      {required.map((a) => (
        <p key={a.category} className="text-[10px] text-white/50 ml-5.5 mb-0.5">
          <span className="text-amber-400/80">{a.label}</span> &mdash; {a.reason}
        </p>
      ))}
    </div>
  )
}

function RoutineCard({
  routine,
  onRefresh,
}: {
  routine: Routine
  onRefresh: () => void
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loadingConflicts, setLoadingConflicts] = useState(false)

  const isAM = routine.routine_type === 'am'
  const Icon = isAM ? Sun : Moon

  // Compute wait time suggestions from products
  const productsForAnalysis = routine.products
    .filter((rp) => rp.product)
    .map((rp) => ({
      id: rp.product!.id,
      name_en: rp.product!.name_en,
      brand_en: rp.product!.brand_en,
      category: rp.product!.category,
    }))

  const waitTimes = suggestWaitTimes(productsForAnalysis)
  const waitTimeByStep = new Map<number, WaitTimeSuggestion>()
  for (const wt of waitTimes) {
    waitTimeByStep.set(wt.after_step, wt)
  }

  const missingSteps = routine.products.length > 0
    ? detectMissingSteps(
        routine.routine_type as 'am' | 'pm',
        productsForAnalysis
      )
    : []

  // Load conflicts for this routine
  useEffect(() => {
    if (routine.products.length < 2) return
    setLoadingConflicts(true)
    async function loadConflicts() {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`/api/routine/${routine.id}?check_conflicts=true`, { headers })
        if (res.ok) {
          const data = await res.json()
          if (data.conflicts) setConflicts(data.conflicts)
        }
      } catch {
        // Non-critical
      } finally {
        setLoadingConflicts(false)
      }
    }
    loadConflicts()
  }, [routine.id, routine.products.length])

  async function handleAddProduct(productId: string) {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/routine/${routine.id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ product_id: productId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to add product')
    }
    const data = await res.json()
    onRefresh()
    return { has_conflicts: data.has_conflicts, conflicts: data.conflicts }
  }

  async function handleRemoveProduct(productId: string) {
    setRemoving(productId)
    try {
      const headers = await getAuthHeaders()
      await fetch(`/api/routine/${routine.id}/products?product_id=${productId}`, {
        method: 'DELETE',
        headers,
      })
      onRefresh()
    } finally {
      setRemoving(null)
    }
  }

  async function handleMoveProduct(productId: string, direction: 'up' | 'down') {
    const currentIndex = routine.products.findIndex((rp) => rp.product_id === productId)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= routine.products.length) return

    const newOrder = routine.products.map((rp) => rp.product_id)
    ;[newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]]

    const headers = await getAuthHeaders()
    await fetch(`/api/routine/${routine.id}/products`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ product_ids: newOrder }),
    })
    onRefresh()
  }

  return (
    <>
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isAM ? 'bg-amber-500/10' : 'bg-indigo-500/10'
          }`}>
            <Icon className={`w-4 h-4 ${isAM ? 'text-amber-400' : 'text-indigo-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-sm text-white">
              {routine.name || (isAM ? 'Morning Routine' : 'Evening Routine')}
            </h3>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              {routine.products.length} step{routine.products.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold/10 text-gold-light text-xs font-medium hover:bg-gold/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {/* Conflict warnings */}
        {!loadingConflicts && conflicts.length > 0 && (
          <div className="mb-3">
            <ConflictWarning conflicts={conflicts} />
          </div>
        )}

        {/* Missing steps */}
        {missingSteps.length > 0 && (
          <div className="mb-3">
            <MissingStepBanner alerts={missingSteps} />
          </div>
        )}

        {routine.products.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-white/30">No products added yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1 text-xs text-gold-light mt-2 hover:text-gold transition-colors"
            >
              <Plus className="w-3 h-3" /> Add your first product
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {routine.products
              .sort((a, b) => a.step_order - b.step_order)
              .map((rp, index) => (
                <div key={rp.id}>
                  <div className="flex items-center gap-2.5 py-2 px-1 group">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveProduct(rp.product_id, 'up')}
                        disabled={index === 0}
                        className="p-0.5 rounded text-white/20 hover:text-white/50 disabled:opacity-0 transition-all"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveProduct(rp.product_id, 'down')}
                        disabled={index === routine.products.length - 1}
                        className="p-0.5 rounded text-white/20 hover:text-white/50 disabled:opacity-0 transition-all"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40 flex-shrink-0">
                      {rp.step_order}
                    </span>

                    <div className="flex-1 min-w-0">
                      {rp.product ? (
                        <>
                          <Link
                            href={`/products/${rp.product.id}`}
                            className="text-sm text-white font-medium hover:text-gold-light transition-colors truncate block"
                          >
                            {rp.product.name_en}
                          </Link>
                          <p className="text-[10px] text-white/40">
                            {rp.product.brand_en} &middot; {rp.product.category}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-white/50 italic">Product removed</p>
                      )}
                    </div>

                    {rp.frequency && rp.frequency !== 'daily' && (
                      <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                        {rp.frequency.replace(/_/g, ' ')}
                      </span>
                    )}

                    <button
                      onClick={async () => {
                        if (!rp.product) return
                        try {
                          const headers = await getAuthHeaders()
                          await fetch('/api/tracking', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...headers },
                            body: JSON.stringify({ product_id: rp.product_id }),
                          })
                          alert('Now tracking expiry for ' + rp.product.name_en)
                        } catch { /* ignore */ }
                      }}
                      title="Track expiry"
                      className="p-1 rounded text-white/15 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleRemoveProduct(rp.product_id)}
                      disabled={removing === rp.product_id}
                      className="p-1 rounded text-white/15 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {removing === rp.product_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Wait time indicator */}
                  {waitTimeByStep.has(index + 1) && index < routine.products.length - 1 && (
                    <WaitTimeIndicator suggestion={waitTimeByStep.get(index + 1)!} />
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddProduct}
        routineType={routine.routine_type}
        existingProductIds={routine.products.map((rp) => rp.product_id)}
      />
    </>
  )
}

export default function RoutinePage() {
  const { user } = useAuth()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerator, setShowGenerator] = useState<'am' | 'pm' | null>(null)
  const [creating, setCreating] = useState(false)

  const loadRoutines = useCallback(async () => {
    if (!user) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/routine', { headers })
      if (res.ok) {
        const data = await res.json()
        setRoutines(
          (data.routines ?? []).map((r: Record<string, unknown>) => ({
            ...r,
            products: ((r.products ?? r.ss_routine_products ?? []) as RoutineProduct[])
              .sort((a: RoutineProduct, b: RoutineProduct) => a.step_order - b.step_order),
          }))
        )
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadRoutines()
  }, [loadRoutines])

  const hasAM = routines.some((r) => r.routine_type === 'am')
  const hasPM = routines.some((r) => r.routine_type === 'pm')

  async function createEmptyRoutine(type: 'am' | 'pm') {
    setCreating(true)
    try {
      const headers = await getAuthHeaders()
      await fetch('/api/routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          name: type === 'am' ? 'Morning Routine' : 'Evening Routine',
          routine_type: type,
        }),
      })
      await loadRoutines()
    } finally {
      setCreating(false)
    }
  }

  interface GeneratedStep {
    product_id: string
    frequency: string
  }
  interface GeneratedRoutine {
    routine_name: string
    steps: GeneratedStep[]
  }

  async function handleAcceptGenerated(generated: GeneratedRoutine) {
    const type = showGenerator!
    const headers = await getAuthHeaders()

    // Create the routine
    const createRes = await fetch('/api/routine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        name: generated.routine_name,
        routine_type: type,
      }),
    })

    if (!createRes.ok) throw new Error('Failed to create routine')
    const { routine } = await createRes.json()

    // Add each product in order
    for (let i = 0; i < generated.steps.length; i++) {
      const step = generated.steps[i]
      await fetch(`/api/routine/${routine.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          product_id: step.product_id,
          step_order: i + 1,
          frequency: step.frequency || 'daily',
        }),
      })
    }

    setShowGenerator(null)
    await loadRoutines()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-semibold text-2xl text-white section-heading">
            My Routine
          </h1>
          <p className="text-white/40 text-sm">
            Your personalized K-beauty AM/PM routine with intelligent layering.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : (
        <>
          {/* Active routines */}
          {routines.length > 0 && (
            <div className="flex flex-col gap-4">
              {routines.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  onRefresh={loadRoutines}
                />
              ))}
            </div>
          )}

          {/* Generator UI */}
          {showGenerator && (
            <RoutineGenerator
              routineType={showGenerator}
              onAccept={handleAcceptGenerated}
              onCancel={() => setShowGenerator(null)}
            />
          )}

          {/* Create new routine buttons */}
          {(!hasAM || !hasPM) && !showGenerator && (
            <div className="space-y-3">
              {routines.length === 0 && (
                <div className="dark-card-gold p-6 text-center">
                  <Sparkles className="w-10 h-10 text-gold mx-auto mb-3" />
                  <h2 className="font-display font-semibold text-lg text-white mb-2">
                    Build Your First Routine
                  </h2>
                  <p className="text-sm text-white/40 mb-5 max-w-sm mx-auto">
                    Choose how to start: let Yuri&apos;s AI build a personalized routine,
                    or add products manually.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!hasAM && (
                  <div className="glass-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-white">Morning Routine</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowGenerator('am')}
                        disabled={creating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-xs font-semibold hover:shadow-glow-gold transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Generate
                      </button>
                      <button
                        onClick={() => createEmptyRoutine('am')}
                        disabled={creating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition-colors"
                      >
                        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        Build Manually
                      </button>
                    </div>
                  </div>
                )}

                {!hasPM && (
                  <div className="glass-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-medium text-white">Evening Routine</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowGenerator('pm')}
                        disabled={creating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-xs font-semibold hover:shadow-glow-gold transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Generate
                      </button>
                      <button
                        onClick={() => createEmptyRoutine('pm')}
                        disabled={creating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition-colors"
                      >
                        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        Build Manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="h-16 md:h-0" />
    </div>
  )
}
