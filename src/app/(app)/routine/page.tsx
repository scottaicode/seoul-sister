'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sun,
  Moon,
  Layers,
  Sparkles,
  Loader2,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface RoutineProduct {
  id: string
  step_order: number
  frequency: string | null
  notes: string | null
  product: {
    id: string
    name_en: string
    brand_en: string
    category: string
  } | null
}

interface Routine {
  id: string
  name: string
  routine_type: string
  is_active: boolean
  products: RoutineProduct[]
}

function RoutineCard({ routine }: { routine: Routine }) {
  const isAM = routine.routine_type === 'am'
  const Icon = isAM ? Sun : Moon

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          isAM ? 'bg-amber-500/10' : 'bg-indigo-500/10'
        }`}>
          <Icon className={`w-4 h-4 ${isAM ? 'text-amber-400' : 'text-indigo-400'}`} />
        </div>
        <div>
          <h3 className="font-display font-semibold text-sm text-white">
            {routine.name || (isAM ? 'Morning Routine' : 'Evening Routine')}
          </h3>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            {routine.products.length} step{routine.products.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {routine.products.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-white/30">No products added yet.</p>
          <Link
            href="/yuri"
            className="inline-flex items-center gap-1 text-xs text-gold-light mt-2 hover:text-gold transition-colors"
          >
            Ask Yuri to build this routine <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {routine.products
            .sort((a, b) => a.step_order - b.step_order)
            .map((rp) => (
              <div
                key={rp.id}
                className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
              >
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
                    {rp.frequency}
                  </span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default function RoutinePage() {
  const { user } = useAuth()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data } = await supabase
          .from('ss_user_routines')
          .select(`
            id, name, routine_type, is_active,
            ss_routine_products (
              id, step_order, frequency, notes,
              product:product_id (id, name_en, brand_en, category)
            )
          `)
          .eq('user_id', user!.id)
          .eq('is_active', true)
          .order('routine_type', { ascending: true })

        if (data) {
          setRoutines(
            data.map((r) => ({
              ...r,
              products: (r.ss_routine_products ?? []) as unknown as RoutineProduct[],
            }))
          )
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-semibold text-2xl text-white section-heading">
            My Routine
          </h1>
          <p className="text-white/40 text-sm">
            Your personalized K-beauty AM/PM routine.
          </p>
        </div>
        <Link
          href="/yuri"
          className="flex items-center gap-1.5 text-xs font-medium text-gold-light hover:text-gold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Build with Yuri
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : routines.length === 0 ? (
        <div className="dark-card-gold p-6 text-center">
          <Sparkles className="w-10 h-10 text-gold mx-auto mb-3" />
          <h2 className="font-display font-semibold text-lg text-white mb-2">
            Build Your First Routine
          </h2>
          <p className="text-sm text-white/40 mb-5 max-w-sm mx-auto">
            Tell Yuri about your skin and she&apos;ll create a personalized AM/PM
            K-beauty routine with proper layering order and ingredient conflict
            detection.
          </p>
          <Link
            href="/yuri"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all duration-200"
          >
            <Layers className="w-4 h-4" />
            Ask Yuri to Build My Routine
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}

      <div className="h-16 md:h-0" />
    </div>
  )
}
