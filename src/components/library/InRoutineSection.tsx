'use client'

import Link from 'next/link'
import { Sun, Moon, ArrowUpRight } from 'lucide-react'
import ProductLibraryCard from './ProductLibraryCard'

export interface RoutineStep {
  id: string
  step_order: number
  product_id: string | null
  display_name: string
  display_brand: string | null
  image_url: string | null
  category: string | null
  notes: string | null
  frequency: string | null
  ownership_gap: boolean
}

interface Props {
  am: RoutineStep[]
  pm: RoutineStep[]
  onMarkOwned: (productId: string, displayName: string) => void
}

function StepGroup({
  title,
  icon,
  steps,
  onMarkOwned,
}: {
  title: string
  icon: React.ReactNode
  steps: RoutineStep[]
  onMarkOwned: (productId: string, displayName: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-white/50">{steps.length} step{steps.length === 1 ? '' : 's'}</span>
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-white/50 italic">No steps</p>
      ) : (
        <div className="space-y-2">
          {steps.map((step) => (
            <ProductLibraryCard
              key={step.id}
              productId={step.product_id}
              displayName={`${step.step_order}. ${step.display_name}`}
              displayBrand={step.display_brand}
              imageUrl={step.image_url}
              category={step.category}
              metadata={step.frequency && step.frequency !== 'daily' ? step.frequency.replace(/_/g, ' ') : null}
              ribbonLabel={step.ownership_gap ? 'Not owned' : null}
              ribbonTone={step.ownership_gap ? 'amber' : 'gray'}
              actionSlot={
                step.ownership_gap && step.product_id ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onMarkOwned(step.product_id as string, step.display_name)
                    }}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/25 transition"
                  >
                    Mark as owned
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function InRoutineSection({ am, pm, onMarkOwned }: Props) {
  const hasAny = am.length > 0 || pm.length > 0
  const gapCount = am.filter((s) => s.ownership_gap).length + pm.filter((s) => s.ownership_gap).length

  return (
    <section id="section-routine" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">In Routine</h2>
          <p className="text-sm text-white/60 mt-0.5">
            {hasAny
              ? gapCount > 0
                ? `${gapCount} product${gapCount === 1 ? '' : 's'} in your routine but not in your collection.`
                : 'Your active AM and PM routines.'
              : 'No active routines.'}
          </p>
        </div>
        {hasAny && (
          <Link
            href="/routine"
            className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition"
          >
            Edit routines
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {!hasAny ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-white/70">
            <Link href="/routine" className="text-rose-300 underline underline-offset-2">
              Build your AM and PM routines
            </Link>{' '}
            to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StepGroup title="AM" icon={<Sun className="w-4 h-4 text-amber-300" />} steps={am} onMarkOwned={onMarkOwned} />
          <StepGroup title="PM" icon={<Moon className="w-4 h-4 text-indigo-300" />} steps={pm} onMarkOwned={onMarkOwned} />
        </div>
      )}
    </section>
  )
}
