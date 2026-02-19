'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Heart,
  ChevronDown,
  ChevronUp,
  Calendar,
  Loader2,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type {
  CyclePhaseInfo,
  CycleRoutineAdjustment,
} from '@/types/database'
import {
  getPhaseLabel,
} from '@/lib/intelligence/cycle-routine'

interface CycleData {
  enabled: boolean
  phase: CyclePhaseInfo | null
  adjustments: CycleRoutineAdjustment[]
  message?: string
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  menstrual: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  follicular: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  ovulatory: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  luteal: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
}

const PHASE_ICONS: Record<string, string> = {
  menstrual: '\uD83C\uDF19',
  follicular: '\uD83C\uDF31',
  ovulatory: '\u2728',
  luteal: '\uD83C\uDF3F',
}

const ADJUSTMENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  add: { label: 'Add', color: 'text-emerald-400' },
  reduce: { label: 'Reduce', color: 'text-amber-400' },
  swap: { label: 'Swap', color: 'text-blue-400' },
  avoid: { label: 'Avoid', color: 'text-red-400' },
  emphasize: { label: 'Emphasize', color: 'text-violet-400' },
}

function LogCycleModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (date: string, length?: number) => Promise<void>
}) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [cycleLength, setCycleLength] = useState(28)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit(date, cycleLength)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm glass-card p-5 space-y-4">
        <h3 className="font-display font-semibold text-base text-white">
          Log Cycle Start
        </h3>
        <div>
          <label className="block text-xs text-white/50 mb-1">Start Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-gold/50"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">
            Cycle Length (days)
          </label>
          <input
            type="number"
            min={20}
            max={45}
            value={cycleLength}
            onChange={(e) => setCycleLength(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-gold/50"
          />
          <p className="text-[10px] text-white/30 mt-1">Average is 28 days. Range: 20-45.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-xs font-semibold hover:shadow-glow-gold transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Log
          </button>
        </div>
      </div>
    </div>
  )
}

export function CycleAdjustment() {
  const [data, setData] = useState<CycleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)

  const loadCycleData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) {
        setLoading(false)
        return
      }
      const res = await fetch('/api/cycle', { headers })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCycleData()
  }, [loadCycleData])

  async function handleLogCycle(date: string, length?: number) {
    const headers = await getAuthHeaders()
    await fetch('/api/cycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        cycle_start_date: date,
        cycle_length_days: length,
      }),
    })
    await loadCycleData()
  }

  // Don't render anything if loading, not enabled, or user not logged in
  if (loading || !data?.enabled) return null

  // Enabled but no data yet — show prompt to log
  if (!data.phase) {
    return (
      <>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Cycle Tracking Active</p>
              <p className="text-[10px] text-white/40">
                Log your cycle start date for personalized routine adjustments.
              </p>
            </div>
            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              Log
            </button>
          </div>
        </div>
        <LogCycleModal
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          onSubmit={handleLogCycle}
        />
      </>
    )
  }

  const phase = data.phase
  const colors = PHASE_COLORS[phase.phase] || PHASE_COLORS.follicular
  const icon = PHASE_ICONS[phase.phase] || ''

  return (
    <>
      <div className={`glass-card p-4 border ${colors.border}`}>
        {/* Phase header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3"
        >
          <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center text-lg`}>
            {icon}
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold ${colors.text}`}>
                {getPhaseLabel(phase.phase)}
              </p>
              <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                Day {phase.day_in_cycle}
              </span>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5">
              {phase.days_until_next_phase} day{phase.days_until_next_phase !== 1 ? 's' : ''} until next phase
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowLogModal(true)
              }}
              className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-all"
              title="Log new cycle"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-white/30" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/30" />
            )}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-3">
            {/* Skin behavior */}
            <div className="bg-white/3 rounded-lg p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Your Skin Right Now
              </p>
              <p className="text-xs text-white/70 leading-relaxed">
                {phase.skin_behavior}
              </p>
            </div>

            {/* Routine adjustments */}
            {data.adjustments.length > 0 && (
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                  Routine Adjustments
                </p>
                <div className="space-y-2">
                  {data.adjustments.map((adj, i) => {
                    const typeInfo = ADJUSTMENT_TYPE_LABELS[adj.type] || { label: adj.type, color: 'text-white/60' }
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowRight className={`w-3 h-3 mt-0.5 flex-shrink-0 ${typeInfo.color}`} />
                        <div>
                          <span className={`text-[10px] font-semibold uppercase ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          <span className="text-[10px] text-white/30 ml-1.5">
                            {adj.product_category.replace(/_/g, ' ')}
                          </span>
                          <p className="text-xs text-white/60 mt-0.5">
                            {adj.suggestion}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tips */}
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                Tips for This Phase
              </p>
              <ul className="space-y-1">
                {phase.recommendations.slice(0, 3).map((rec, i) => (
                  <li key={i} className="text-xs text-white/50 flex items-start gap-1.5">
                    <span className="text-white/20 mt-0.5">&#x2022;</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <LogCycleModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSubmit={handleLogCycle}
      />
    </>
  )
}
