'use client'

/**
 * v10.8.0 Path B — Browse becomes Yuri's curated shortlist.
 *
 * Default view: products that don't structurally conflict with the subscriber's
 * active treatment phase, decision_memory exclusions, or allergens (Layer 1
 * deterministic filter, $0 cost). Single "Ask Yuri about my browse" CTA at top.
 *
 * Skip toggle (default collapsed): reveals products Yuri would skip, with a
 * lazy-fetched "Why Yuri would skip this" expander per card that fetches
 * Opus 4.7 reasoning on demand.
 *
 * What's been killed from the pre-v10.8.0 /browse:
 *   - "For You" sort button (algorithmic ingredient-effectiveness rank with
 *     zero phase awareness — same shape as the 5 Yuri Sole Authority Principle
 *     violations earned through Bailey-caught misses)
 *   - "Loved by Combination Skin" carousel (same algorithmic rank, different
 *     UI shape)
 *   - "Sorted by ingredient effectiveness for your skin type" indicator
 *
 * Architecture: PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md
 * Origin: Bailey iMessage May 20-22 2026 + May 22 deep audit
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Package, Sparkles, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import ProductFilters from '@/components/products/ProductFilters'
import CuratedProductCard from '@/components/products/CuratedProductCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/database'
import type { MatchedItemDTO } from '@/components/products/SkipReasoning'

interface ActivePhase {
  phase_number: number
  name: string
  goal: string | null
}

interface CuratedSkippedProduct extends Product {
  skip_preview?: {
    matched_items: MatchedItemDTO[]
  }
}

interface CuratedPayload {
  fits: Product[]
  skipped: CuratedSkippedProduct[]
  total_fits: number
  total_skipped: number
  page: number
  total_pages: number
  active_phase: ActivePhase | null
  has_decision_memory_exclusions: boolean
  allergens: string[]
}

function buildBrowseYuriPrefill(payload: CuratedPayload, query: string, category: string): string {
  const parts: string[] = []
  parts.push(`I'm looking at the curated browse page.`)
  if (payload.active_phase) {
    parts.push(`I'm on Phase ${payload.active_phase.phase_number} (${payload.active_phase.name}).`)
  }
  if (query) parts.push(`Searching for "${query}".`)
  if (category) parts.push(`Filtered to category: ${category}.`)
  parts.push(`You've classified ${payload.total_fits} products as fits and ${payload.total_skipped} as skips. What's the smartest thing to focus on right now?`)
  return parts.join(' ')
}

function CuratedBrowseInner() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const initialQuery = searchParams?.get('q') || ''
  const initialCategory = searchParams?.get('category') || ''

  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  // Filter state retained from v10.7.x for compatibility — UI still surfaces
  // ingredient filters even on curated browse (additive on top of the
  // phase-filter, not a replacement).
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([])
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([])
  const [fragranceFree, setFragranceFree] = useState(false)
  const [comedogenicMax, setComedogenicMax] = useState<number | null>(null)

  const [data, setData] = useState<CuratedPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [skipExpanded, setSkipExpanded] = useState(false) // default collapsed

  const fetchCurated = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Please sign in to use curated browse.')
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (query) params.set('query', query)
      if (category) params.set('category', category)
      params.set('page', String(page))
      params.set('limit', '20')

      const res = await fetch(`/api/products/curated?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' }))
        // 400 = no profile yet (graceful onboarding nudge)
        if (res.status === 400) {
          setError(body.error || 'Set up your skin profile first.')
          setData(null)
          setLoading(false)
          return
        }
        // 403 = no subscription
        if (res.status === 403) {
          setError('Curated browse requires an active subscription.')
          setData(null)
          setLoading(false)
          return
        }
        throw new Error(body.error || 'Failed to load curated browse')
      }
      const payload = (await res.json()) as CuratedPayload
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [user, query, category, page])

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    const t = setTimeout(fetchCurated, query ? 300 : 0)
    return () => clearTimeout(t)
  }, [authLoading, user, fetchCurated, query])

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1)
  }, [query, category])

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Curated browse is subscriber-only by design. AuthAwareNav handles routing
  // non-subscribers to /products (the public marketing surface) via the
  // SHARED_FALLBACKS mapping in AppShell.tsx.
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-white/70">Please sign in to access curated browse.</p>
          <Link href="/login" className="mt-3 inline-block text-xs text-rose-300 underline">Sign in</Link>
        </div>
      </div>
    )
  }

  const hasIngredientFilters = includeIngredients.length > 0 || excludeIngredients.length > 0 || fragranceFree || comedogenicMax !== null

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-display font-bold text-2xl text-white">Browse</h1>
        {data?.active_phase ? (
          <p className="text-white/55 text-sm leading-relaxed">
            Filtered against your <span className="text-rose-200">Phase {data.active_phase.phase_number} — {data.active_phase.name}</span> protocol
            {data.allergens.length > 0 ? `, your declared allergens,` : ''}
            {data.has_decision_memory_exclusions ? ` and what Yuri's flagged in past conversations` : ''}.
            {' '}Want a deeper read? Ask her.
          </p>
        ) : (
          <p className="text-white/55 text-sm leading-relaxed">
            Filtered against your skin profile and allergens. For phase-aware curation, talk to Yuri about your treatment plan.
          </p>
        )}

        {/* Single page-level Ask Yuri CTA (Library pattern from v10.6.5) */}
        {data && (
          <Link
            href={`/yuri?ask=${encodeURIComponent(buildBrowseYuriPrefill(data, query, category))}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 ring-1 ring-rose-400/30 transition text-sm font-medium self-start mt-1"
          >
            <Sparkles className="w-4 h-4" />
            Ask Yuri about my browse
          </Link>
        )}
      </div>

      {/* Filters — ingredient picker etc. still useful additively on top of curation */}
      <ProductFilters
        query={query}
        category={category}
        sortBy="curated"
        showFilters={showFilters}
        includeIngredients={includeIngredients}
        excludeIngredients={excludeIngredients}
        fragranceFree={fragranceFree}
        comedogenicMax={comedogenicMax}
        isAuthenticated={!!user}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onSortChange={() => { /* sort is curated; ignore */ }}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onIncludeIngredientsChange={setIncludeIngredients}
        onExcludeIngredientsChange={setExcludeIngredients}
        onFragranceFreeChange={setFragranceFree}
        onComedogenicMaxChange={setComedogenicMax}
      />

      {/* Active ingredient filter summary */}
      {!showFilters && hasIngredientFilters && (
        <p className="text-[11px] text-white/40">
          Ingredient filters are client-side only on curated browse for now. Open Filters to adjust.
        </p>
      )}

      {/* Error states */}
      {error && (
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <Link href="/profile" className="mt-2 inline-block text-xs text-white/70 underline">
            Update profile
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Curated fits list */}
      {data && (
        <>
          {data.fits.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No matches in your current state"
              description={`Nothing in this filter avoided your Phase ${data.active_phase?.phase_number || ''} watch_for items. Try a different category, or ask Yuri what would actually work right now.`}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  {data.total_fits} product{data.total_fits === 1 ? '' : 's'} that fit your current state
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {data.fits.map((product, idx) => (
                  <CuratedProductCard
                    key={product.id}
                    product={product}
                    activePhase={data.active_phase}
                    priority={idx < 5}
                  />
                ))}
              </div>
            </>
          )}

          {/* Skip toggle — default collapsed per Scott's May 22 decision */}
          {data.total_skipped > 0 && (
            <div className="space-y-3 pt-4">
              <button
                onClick={() => setSkipExpanded(!skipExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] ring-1 ring-white/10 transition-colors"
                aria-expanded={skipExpanded}
              >
                <div className="flex items-center gap-2.5">
                  {skipExpanded
                    ? <ChevronDown className="w-4 h-4 text-white/60" />
                    : <ChevronRight className="w-4 h-4 text-white/60" />
                  }
                  <span className="text-sm text-white/85">
                    Show products Yuri would skip ({data.total_skipped})
                  </span>
                </div>
                {!skipExpanded && (
                  <span className="text-[11px] text-white/35">
                    Click to see what conflicts with your protocol
                  </span>
                )}
              </button>

              {skipExpanded && (
                <div className="flex flex-col gap-3 animate-slide-down">
                  <p className="text-[11px] text-white/40 px-1">
                    These products conflict with your declared allergens, Yuri's past corrections, or your current phase&apos;s watch_for items. Expand any card for her reasoning.
                  </p>
                  {data.skipped.map((product, idx) => (
                    <CuratedProductCard
                      key={product.id}
                      product={product}
                      activePhase={data.active_phase}
                      showSkipReasoning={true}
                      priority={idx < 2}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pagination — only over the fits list */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page === 1}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>
              <span className="text-sm text-white/60 px-3">
                {data.page} of {data.total_pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={data.page === data.total_pages}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Inline loading indicator on subsequent fetches */}
      {loading && data && (
        <div className="fixed bottom-4 right-4 bg-zinc-900 ring-1 ring-white/10 px-3 py-2 rounded-full text-xs text-white/80 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Re-filtering…
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CuratedBrowseInner />
    </Suspense>
  )
}
