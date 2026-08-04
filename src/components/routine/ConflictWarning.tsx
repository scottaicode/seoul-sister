'use client'

import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface Conflict {
  ingredient_a: string
  ingredient_b: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: string
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: 'text-red-400' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: 'text-orange-400' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: 'text-amber-400' },
  low: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: 'text-yellow-400' },
}

export function ConflictWarning({
  conflicts,
  checkFailed = false,
}: {
  conflicts: Conflict[]
  /**
   * The check could not run. This is NOT the same as finding no conflicts, and
   * rendering nothing for it is how a broken safety check looks identical to a
   * clean routine. Say so plainly instead — "nothing came back" is never
   * "nothing's wrong".
   */
  checkFailed?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  if (checkFailed) {
    return (
      <div className="bg-white/5 border border-white/15 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-white/50" />
          <span className="text-xs text-white/70">
            We couldn&apos;t check this routine for ingredient conflicts just now
            — this doesn&apos;t mean it&apos;s clear. Refresh to try again, or ask
            Yuri to look at it.
          </span>
        </div>
      </div>
    )
  }

  if (conflicts.length === 0) return null

  const highest = conflicts.reduce((max, c) => {
    const order = ['low', 'medium', 'high', 'critical']
    return order.indexOf(c.severity) > order.indexOf(max.severity) ? c : max
  }, conflicts[0])

  const styles = SEVERITY_STYLES[highest.severity] ?? SEVERITY_STYLES.medium

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-xl p-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${styles.icon}`} />
        <span className={`text-xs font-medium ${styles.text} flex-1`}>
          {conflicts.length} ingredient conflict{conflicts.length !== 1 ? 's' : ''} detected
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-white/40" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {conflicts.map((c, i) => {
            const s = SEVERITY_STYLES[c.severity] ?? SEVERITY_STYLES.medium
            return (
              <div key={i} className={`${s.bg} rounded-lg p-2.5`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] uppercase font-bold ${s.text}`}>
                    {c.severity}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {c.ingredient_a} + {c.ingredient_b}
                  </span>
                </div>
                <p className="text-xs text-white/60">{c.description}</p>
                {c.recommendation && (
                  <p className="text-xs text-white/40 mt-1 italic">{c.recommendation}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ConflictBadge({ severity }: { severity: string }) {
  const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${styles.text} ${styles.bg} px-1.5 py-0.5 rounded-full`}>
      <AlertTriangle className="w-2.5 h-2.5" />
      {severity}
    </span>
  )
}
