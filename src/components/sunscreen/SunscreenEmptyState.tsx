'use client'

import { useEffect, useState } from 'react'
import { Sun, X } from 'lucide-react'

/**
 * v10.8.21 (Bailey investigation): when sunscreen filters return 0, show WHY.
 *
 * Bailey hit Tinted + PA++++ + Water resistant and saw a generic "No
 * sunscreens match your filters" with no clue which filter was binding. Real
 * world: tinted sunscreens are designed for daily-wear under makeup; water-
 * resistant sunscreens are designed for sport/beach. Those two categories
 * don't intersect in K-beauty, but the user can't see that from a flat empty
 * state.
 *
 * This component runs "what if I remove filter X" probes against the API,
 * computes the count for each single-relaxation, and shows the user the
 * biggest gain — letting them tap to clear that one filter and try again.
 */

export interface ActiveFilter {
  key: string
  label: string
  clear: () => void
}

interface Props {
  /** Active filters in the user's current query. */
  active: ActiveFilter[]
  /** Base query string with all current filters, used for what-if probes. */
  baseQueryParams: URLSearchParams
}

interface RelaxationProbe {
  filter: ActiveFilter
  count: number | null  // null = probe failed / still loading
}

export default function SunscreenEmptyState({ active, baseQueryParams }: Props) {
  const [probes, setProbes] = useState<RelaxationProbe[]>([])
  const [probing, setProbing] = useState(false)

  useEffect(() => {
    if (active.length < 2) {
      // With only 0 or 1 filter, there's no relaxation to suggest.
      setProbes([])
      return
    }
    let cancelled = false
    setProbing(true)

    async function probe() {
      const results: RelaxationProbe[] = await Promise.all(
        active.map(async (f) => {
          // Clone params, remove this one filter
          const params = new URLSearchParams(baseQueryParams)
          params.delete(f.key)
          // For tinted (tri-state), removing means clearing entirely
          if (f.key === 'tinted') params.delete('tinted')
          params.set('limit', '1')  // we only need the count
          try {
            const res = await fetch(`/api/sunscreen?${params}`)
            if (!res.ok) return { filter: f, count: null }
            const data = await res.json()
            return { filter: f, count: (data.total as number) ?? null }
          } catch {
            return { filter: f, count: null }
          }
        })
      )
      if (cancelled) return
      // Sort by impact (highest count first — what relaxation unlocks the most)
      results.sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      setProbes(results)
      setProbing(false)
    }
    probe()
    return () => { cancelled = true }
  }, [active, baseQueryParams])

  const hasMultipleFilters = active.length >= 2
  const topSuggestion = probes.find((p) => (p.count ?? 0) > 0) ?? null

  return (
    <div className="glass-card p-8 text-center">
      <div className="inline-flex w-12 h-12 rounded-full bg-amber-500/10 ring-1 ring-amber-400/20 items-center justify-center mb-4">
        <Sun className="w-5 h-5 text-amber-400" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">
        No sunscreens match all your filters
      </h3>
      {!hasMultipleFilters && (
        <p className="text-sm text-white/60 max-w-md mx-auto">
          Try clearing your filter or browsing the full list.
        </p>
      )}

      {hasMultipleFilters && (
        <>
          <p className="text-sm text-white/60 max-w-md mx-auto mb-5">
            You have {active.length} filters active. Tap any to clear it and widen the search.
          </p>

          {/* Active filter chips with clear actions */}
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {active.map((f) => {
              const probe = probes.find((p) => p.filter.key === f.key)
              const wouldUnlock = probe?.count ?? null
              const isTop = topSuggestion?.filter.key === f.key && (wouldUnlock ?? 0) > 0
              return (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition ${
                    isTop
                      ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40 hover:bg-amber-500/30'
                      : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                  title={`Clear "${f.label}" filter`}
                >
                  <X className="w-3 h-3" />
                  <span>{f.label}</span>
                  {probing ? (
                    <span className="text-[10px] text-white/40">…</span>
                  ) : wouldUnlock !== null && wouldUnlock > 0 ? (
                    <span className={`text-[10px] ${isTop ? 'text-amber-300' : 'text-white/40'}`}>
                      → {wouldUnlock}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {topSuggestion && (topSuggestion.count ?? 0) > 0 && (
            <p className="text-xs text-white/45 max-w-md mx-auto">
              Clearing <span className="text-amber-200 font-medium">{topSuggestion.filter.label}</span>
              {' '}would show{' '}
              <span className="text-amber-200 font-medium">{topSuggestion.count}</span> matches.
            </p>
          )}
          {!probing && topSuggestion && (topSuggestion.count ?? 0) === 0 && (
            <p className="text-xs text-white/45 max-w-md mx-auto">
              No single filter unlocks results — your combination is rare in K-beauty.
              Try clearing two or more filters.
            </p>
          )}
        </>
      )}
    </div>
  )
}
