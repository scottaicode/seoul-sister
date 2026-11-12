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
  PackageCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ConflictWarning } from '@/components/routine/ConflictWarning'
import { WaitTimeIndicator } from '@/components/routine/WaitTimeIndicator'
import { AddProductModal } from '@/components/routine/AddProductModal'
import {
  suggestWaitTimes,
  type WaitTimeSuggestion,
} from '@/lib/intelligence/layering-order'
import { CycleAdjustment } from '@/components/routine/CycleAdjustment'
import { RoutineEffectiveness } from '@/components/routine/RoutineEffectiveness'

interface ProductInfo {
  id: string
  name_en: string
  brand_en: string
  category: string
  image_url: string | null
  price_usd: number | null
}

interface ProductOwnership {
  custom_name: string | null
}

interface RoutineProduct {
  id: string
  step_order: number
  frequency: string | null
  notes: string | null
  // Nullable: custom steps (devices, actions like "shower / cleanse") have no
  // backing ss_products row. Schema allows NULL here as of v10.3.3.
  product_id: string | null
  product: ProductInfo | null
  ownership: ProductOwnership | null
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
  // Distinguishes "checked, nothing found" from "the check never ran". Without
  // it a broken safety check renders identically to a clean routine.
  const [conflictCheckFailed, setConflictCheckFailed] = useState(false)
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

  // The "Missing Steps" box was removed on Nov 11 2026. It told a new member
  // her morning routine was missing a moisturizer while step 2 was one (a
  // product saved under its own name, which the rule could not classify),
  // minutes after Yuri had built that routine with her. A page rule telling a
  // member what her routine lacks is advice, and advice is Yuri's alone
  // (Yuri Sole Authority, CLAUDE.md). Do not bring it back in another form.

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
          setConflictCheckFailed(Boolean(data.conflict_check_failed))
        } else {
          setConflictCheckFailed(true)
        }
      } catch {
        // The routine still renders — but say the check didn't run.
        setConflictCheckFailed(true)
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

  // Both handlers address rows by ss_routine_products.id, so a custom step (a
  // device, a shower step, a product we don't carry) is as removable and
  // reorderable as a catalog product. Keying on product_id made those rows
  // permanently stuck — the buttons had to be hidden because the API could not
  // express the request at all.
  async function handleRemoveStep(stepId: string) {
    setRemoving(stepId)
    try {
      const headers = await getAuthHeaders()
      await fetch(`/api/routine/${routine.id}/products?step_id=${stepId}`, {
        method: 'DELETE',
        headers,
      })
      onRefresh()
    } finally {
      setRemoving(null)
    }
  }

  async function handleMoveStep(stepId: string, direction: 'up' | 'down') {
    // Order over ALL steps, not just the catalog ones. The old version worked in
    // a null-filtered space, which left custom steps pinned to their saved
    // step_order and let them collide with a renumbered product.
    const ordered = [...routine.products].sort((a, b) => a.step_order - b.step_order)
    const currentIndex = ordered.findIndex((rp) => rp.id === stepId)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= ordered.length) return

    const newOrder = ordered.map((rp) => rp.id)
    ;[newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]]

    const headers = await getAuthHeaders()
    await fetch(`/api/routine/${routine.id}/products`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ step_ids: newOrder }),
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
        {!loadingConflicts && (conflicts.length > 0 || conflictCheckFailed) && (
          <div className="mb-3">
            <ConflictWarning conflicts={conflicts} checkFailed={conflictCheckFailed} />
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
                    {/* Reorder is available on EVERY step — rows are addressed by their
                        own id, so a custom step moves like any other. */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveStep(rp.id, 'up')}
                        disabled={index === 0}
                        className="p-0.5 rounded text-white/20 hover:text-white/50 disabled:opacity-0 transition-all"
                        aria-label="Move step up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveStep(rp.id, 'down')}
                        disabled={index === routine.products.length - 1}
                        className="p-0.5 rounded text-white/20 hover:text-white/50 disabled:opacity-0 transition-all"
                        aria-label="Move step down"
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
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/products/${rp.product.id}`}
                              className="text-sm text-white font-medium hover:text-gold-light transition-colors truncate"
                            >
                              {rp.ownership?.custom_name || rp.product.name_en}
                            </Link>
                            {rp.ownership && (
                              <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                <PackageCheck className="w-2.5 h-2.5" />
                                Owned
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/40">
                            {rp.ownership?.custom_name
                              ? `${rp.product.name_en} · ${rp.product.brand_en}`
                              : `${rp.product.brand_en} · ${rp.product.category}`
                            }
                          </p>
                        </>
                      ) : rp.notes ? (
                        <p className="text-sm text-white/70">{rp.notes}</p>
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
                      className="p-1 rounded text-white/15 hover:text-amber-400 md:opacity-0 md:group-hover:opacity-100 transition-all"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>

                    {/* Removable on every step, custom entries included. */}
                    <button
                      onClick={() => handleRemoveStep(rp.id)}
                      disabled={removing === rp.id}
                      className="p-1 rounded text-white/15 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-all"
                      aria-label="Remove step"
                    >
                      {removing === rp.id ? (
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
        existingProductIds={routine.products.map((rp) => rp.product_id).filter(Boolean) as string[]}
      />
    </>
  )
}

export default function RoutinePage() {
  const { user } = useAuth()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const loadRoutines = useCallback(async () => {
    // Clear the spinner before bailing (July 27 2026). `loading` starts true and
    // is only cleared in the try/finally below, so an early return on a null
    // user (expired token, session hiccup) left the page spinning forever with
    // no error and no timeout.
    if (!user) {
      setLoading(false)
      return
    }
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

      {/* Cycle phase adjustment banner */}
      <CycleAdjustment />

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
                <div key={routine.id} className="flex flex-col gap-2">
                  <RoutineCard
                    routine={routine}
                    onRefresh={loadRoutines}
                  />
                  {routine.products.length > 0 && (
                    <RoutineEffectiveness routineId={routine.id} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* There was a one-shot "AI Generate" here, labelled as Yuri's (Nov 11
              2026). It built a routine from the profile and shelf alone: none of
              what the member and Yuri had worked out in chat, no treatment phase,
              no corrections, and outside the monthly allowance and the cost log.
              A routine is advice, and advice is Yuri's (Yuri Sole Authority,
              CLAUDE.md), so the button now opens the chat with the request ready. */}
          {/* Create new routine buttons */}
          {(!hasAM || !hasPM) && (
            <div className="space-y-3">
              {routines.length === 0 && (
                <div className="dark-card-gold p-6 text-center">
                  <Sparkles className="w-10 h-10 text-gold mx-auto mb-3" />
                  <h2 className="font-display font-semibold text-lg text-white mb-2">
                    Build Your First Routine
                  </h2>
                  <p className="text-sm text-white/40 mb-5 max-w-sm mx-auto">
                    Choose how to start: build it with Yuri in chat, where she knows your
                    skin and what you have already worked out together, or add products yourself.
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
                      <Link
                        href="/yuri?ask=Build%20my%20morning%20routine."
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-xs font-semibold hover:shadow-glow-gold transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Build with Yuri
                      </Link>
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
                      <Link
                        href="/yuri?ask=Build%20my%20evening%20routine."
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-xs font-semibold hover:shadow-glow-gold transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Build with Yuri
                      </Link>
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
