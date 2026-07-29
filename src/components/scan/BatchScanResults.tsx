'use client'

import { useState } from 'react'
import { Camera, ChevronDown, AlertTriangle, RotateCcw } from 'lucide-react'
import ScanResults from './ScanResults'
import type { ScanQueueItem } from './scan-upload'

interface BatchScanResultsProps {
  items: ScanQueueItem[]
  scanning: boolean
  onReset: () => void
  onRetryFailed: () => void
}

function scoreColor(score: number): string {
  return score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
}

/**
 * Results view for a multi-photo scan. Each successful scan is an
 * expandable card (first one open by default) rendering the full
 * ScanResults inside. Failed photos show which one failed and why,
 * with a retry that only re-runs the failures.
 */
export default function BatchScanResults({ items, scanning, onReset, onRetryFailed }: BatchScanResultsProps) {
  const firstDone = items.find((item) => item.status === 'done')
  const [expandedId, setExpandedId] = useState<string | null>(firstDone?.id ?? null)
  const failedCount = items.filter((item) => item.status === 'error').length

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        if (item.status === 'done' && item.result) {
          const expanded = expandedId === item.id
          const analysis = item.result.analysis
          return (
            <div key={item.id} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : item.id)}
                className="w-full p-3 flex items-center gap-3 text-left"
              >
                <img
                  src={item.dataUrl}
                  alt={`Label photo ${i + 1}`}
                  className="w-12 h-12 rounded-xl object-cover bg-white/5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-white truncate">
                    {analysis.product_name_en || `Photo ${i + 1}`}
                  </p>
                  <p className="text-xs text-white/40 truncate">{analysis.brand}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${scoreColor(analysis.overall_safety_score)}`}>
                  {analysis.overall_safety_score}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expanded && (
                <div className="p-3 pt-0 border-t border-white/5">
                  <ScanResults result={item.result} onReset={onReset} />
                </div>
              )}
            </div>
          )
        }

        if (item.status === 'error') {
          return (
            <div key={item.id} className="glass-card p-3 flex items-center gap-3">
              <img
                src={item.dataUrl}
                alt={`Label photo ${i + 1}`}
                className="w-12 h-12 rounded-xl object-cover bg-white/5 opacity-50 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Photo {i + 1} failed
                </p>
                <p className="text-xs text-white/40 mt-0.5">{item.error}</p>
              </div>
            </div>
          )
        }

        return null
      })}

      {failedCount > 0 && !scanning && (
        <button
          onClick={onRetryFailed}
          className="glass-card py-3 text-sm font-medium text-gold hover:text-gold-light transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Retry {failedCount === 1 ? 'failed photo' : `${failedCount} failed photos`}
        </button>
      )}

      <button
        onClick={onReset}
        className="glass-card py-3 text-sm font-medium text-white/60 hover:text-white transition-colors duration-200 flex items-center justify-center gap-2"
      >
        <Camera className="w-4 h-4" />
        Scan More Products
      </button>
    </div>
  )
}
