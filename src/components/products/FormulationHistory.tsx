'use client'

import { useState, useEffect } from 'react'
import { FlaskConical, Plus, Minus, ArrowUpDown, Calendar, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { FormulationHistory as FormulationHistoryType } from '@/types/database'

interface FormulationHistoryProps {
  productId: string
}

const changeTypeLabels: Record<string, string> = {
  reformulation: 'Reformulation',
  packaging: 'Packaging Change',
  both: 'Formula + Packaging',
  minor_tweak: 'Minor Adjustment',
}

const changeTypeColors: Record<string, string> = {
  reformulation: 'text-amber-400 bg-amber-500/10',
  packaging: 'text-blue-400 bg-blue-500/10',
  both: 'text-red-400 bg-red-500/10',
  minor_tweak: 'text-white/50 bg-white/5',
}

export default function FormulationHistory({ productId }: FormulationHistoryProps) {
  const [history, setHistory] = useState<FormulationHistoryType[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reformulations/${productId}`)
        if (res.ok) {
          const data = await res.json()
          setHistory(data.history ?? [])
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [productId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-gold/40" />
      </div>
    )
  }

  // Don't render if no reformulation history (only version 1 = original)
  if (history.length === 0) return null

  return (
    <div className="glass-card p-4 space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">
              Formulation History
            </h3>
            <p className="text-[10px] text-white/40">
              {history.length} version{history.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>
        <span className="text-[10px] text-gold-light font-medium">
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          {history.map((entry, idx) => (
            <div
              key={entry.id}
              className="relative pl-6 pb-3 last:pb-0"
            >
              {/* Timeline connector */}
              {idx < history.length - 1 && (
                <div className="absolute left-[9px] top-5 bottom-0 w-px bg-white/10" />
              )}
              {/* Timeline dot */}
              <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-2 border-white/20 bg-seoul-dark flex items-center justify-center">
                {entry.confirmed ? (
                  <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                )}
              </div>

              <div className="space-y-1.5">
                {/* Version header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">
                    v{entry.version_number}
                  </span>
                  {entry.change_type && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${changeTypeColors[entry.change_type] ?? 'text-white/50 bg-white/5'}`}>
                      {changeTypeLabels[entry.change_type] ?? entry.change_type}
                    </span>
                  )}
                  {!entry.confirmed && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                      Unconfirmed
                    </span>
                  )}
                </div>

                {/* Date */}
                {entry.change_date && (
                  <div className="flex items-center gap-1 text-[10px] text-white/30">
                    <Calendar className="w-2.5 h-2.5" />
                    {new Date(entry.change_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                )}

                {/* Ingredient changes */}
                {(entry.ingredients_added.length > 0 || entry.ingredients_removed.length > 0 || entry.ingredients_reordered) && (
                  <div className="space-y-1">
                    {entry.ingredients_added.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <Plus className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-green-400/80">
                          {entry.ingredients_added.join(', ')}
                        </p>
                      </div>
                    )}
                    {entry.ingredients_removed.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <Minus className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-red-400/80">
                          {entry.ingredients_removed.join(', ')}
                        </p>
                      </div>
                    )}
                    {entry.ingredients_reordered && (
                      <div className="flex items-start gap-1.5">
                        <ArrowUpDown className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-blue-400/80">
                          Ingredient order changed
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                {entry.change_summary && (
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    {entry.change_summary}
                  </p>
                )}

                {/* Impact assessment */}
                {entry.impact_assessment && (
                  <div className="bg-white/5 rounded-lg px-2.5 py-2 mt-1">
                    <p className="text-[10px] text-gold-light font-medium mb-0.5">Impact</p>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      {entry.impact_assessment}
                    </p>
                  </div>
                )}

                {/* Detection method */}
                <p className="text-[9px] text-white/20">
                  Detected via {entry.detected_by === 'scan_comparison' ? 'label scan' : entry.detected_by}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
