'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Check, AlertTriangle } from 'lucide-react'

interface GeneratedStep {
  step_order: number
  product_id: string
  product_name: string
  brand: string
  category: string
  frequency: string
  wait_minutes_after: number
  notes: string
}

interface GeneratedRoutine {
  routine_name: string
  steps: GeneratedStep[]
  conflicts: Array<{
    product_a: string
    product_b: string
    severity: string
    description: string
    recommendation: string
  }>
  rationale: string
  skin_cycling_note: string | null
}

interface RoutineGeneratorProps {
  routineType: 'am' | 'pm'
  onAccept: (generated: GeneratedRoutine) => Promise<void>
  onCancel: () => void
}

export function RoutineGenerator({ routineType, onAccept, onCancel }: RoutineGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState<GeneratedRoutine | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const token = (await import('@/lib/supabase')).supabase
      const { data: { session } } = await token.auth.getSession()

      const res = await fetch('/api/routine/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ routine_type: routineType }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate routine')
      }

      const data = await res.json()
      setGenerated(data.generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate routine')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!generated) return
    setAccepting(true)
    try {
      await onAccept(generated)
    } finally {
      setAccepting(false)
    }
  }

  // Initial state: show generate button
  if (!loading && !generated && !error) {
    return (
      <div className="dark-card-gold p-6 text-center">
        <Sparkles className="w-10 h-10 text-gold mx-auto mb-3" />
        <h3 className="font-display font-semibold text-lg text-white mb-2">
          Generate {routineType === 'am' ? 'Morning' : 'Evening'} Routine with AI
        </h3>
        <p className="text-sm text-white/40 mb-5 max-w-sm mx-auto">
          Yuri&apos;s Routine Architect will analyze your skin profile and build a personalized
          {routineType === 'am' ? ' morning' : ' evening'} routine with the right products in the right order.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Generate Routine
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="dark-card-gold p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold mx-auto mb-3" />
        <p className="text-sm text-white/60">
          Yuri is building your personalized routine...
        </p>
        <p className="text-[10px] text-white/30 mt-1">This may take 15-30 seconds</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="dark-card-gold p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-400 mb-3">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-white/40 hover:text-white/60"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 text-sm text-gold-light hover:text-gold"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Results state
  if (!generated) return null

  return (
    <div className="dark-card-gold p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-gold" />
        <h3 className="font-display font-semibold text-white">
          {generated.routine_name}
        </h3>
      </div>

      <p className="text-sm text-white/50">{generated.rationale}</p>

      {/* Steps preview */}
      <div className="space-y-2">
        {generated.steps.map((step, i) => (
          <div key={i}>
            <div className="flex items-center gap-3 py-2 px-3 bg-white/5 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0">
                {step.step_order}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {step.product_name}
                </p>
                <p className="text-[10px] text-white/40">
                  {step.brand} &middot; {step.category}
                  {step.frequency !== 'daily' && ` &middot; ${step.frequency.replace(/_/g, ' ')}`}
                </p>
              </div>
            </div>
            {step.wait_minutes_after > 0 && (
              <div className="flex items-center gap-2 py-1 px-3 ml-3 text-[10px] text-blue-400">
                ⏱ Wait {step.wait_minutes_after} min before next step
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Conflicts */}
      {generated.conflicts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">
              {generated.conflicts.length} potential conflict{generated.conflicts.length !== 1 ? 's' : ''}
            </span>
          </div>
          {generated.conflicts.map((c, i) => (
            <p key={i} className="text-[10px] text-white/50 ml-6 mb-1">
              {c.product_a} + {c.product_b}: {c.recommendation}
            </p>
          ))}
        </div>
      )}

      {/* Skin cycling note */}
      {generated.skin_cycling_note && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
          <p className="text-xs text-purple-300">
            <span className="font-medium">Skin Cycling Tip:</span> {generated.skin_cycling_note}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleGenerate}
          disabled={accepting}
          className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Regenerate
        </button>
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all disabled:opacity-50"
        >
          {accepting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Accept & Create Routine
        </button>
      </div>
    </div>
  )
}
