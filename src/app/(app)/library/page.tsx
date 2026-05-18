'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Sparkles, Loader2, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import OwnedSection, { type OwnedItem } from '@/components/library/OwnedSection'
import SavedSection, { type SavedItem } from '@/components/library/SavedSection'
import InRoutineSection, { type RoutineStep } from '@/components/library/InRoutineSection'
import TaggedSection, { type TagEntry } from '@/components/library/TaggedSection'
import ExpiringSection, { type ExpiringItem } from '@/components/library/ExpiringSection'
import LibraryAddModal from '@/components/library/LibraryAddModal'

interface LibraryPayload {
  owned: OwnedItem[]
  saved: SavedItem[]
  in_routine: { am: RoutineStep[]; pm: RoutineStep[] }
  tagged: { holy_grail: TagEntry[]; broke_me_out: TagEntry[] }
  expiring: ExpiringItem[]
  expiring_total: number
  summary: {
    owned_count: number
    saved_count: number
    routine_step_count: number
    ownership_gap_count: number
    holy_grail_count: number
    broke_me_out_count: number
    tracking_count: number
    expiring_soon_count: number
  }
}

function buildYuriPrefill(summary: LibraryPayload['summary']): string {
  const lines: string[] = [
    `I'm looking at My Library. Quick stats:`,
    `- ${summary.owned_count} products in my collection`,
    `- ${summary.routine_step_count} routine steps across AM + PM`,
  ]
  if (summary.ownership_gap_count > 0) {
    lines.push(`- ${summary.ownership_gap_count} products in my routine that I haven't marked as owned`)
  }
  if (summary.holy_grail_count > 0) {
    lines.push(`- ${summary.holy_grail_count} Holy Grail tag${summary.holy_grail_count === 1 ? '' : 's'}`)
  }
  if (summary.broke_me_out_count > 0) {
    lines.push(`- ${summary.broke_me_out_count} Broke Me Out tag${summary.broke_me_out_count === 1 ? '' : 's'}`)
  }
  if (summary.expiring_soon_count > 0) {
    lines.push(`- ${summary.expiring_soon_count} product${summary.expiring_soon_count === 1 ? '' : 's'} expiring within 30 days`)
  }
  lines.push('')
  lines.push(`Looking at what's actually in my world right now, what should I focus on?`)
  return lines.join('\n')
}

function LibraryPageInner() {
  const searchParams = useSearchParams()
  const initialSection = searchParams.get('section')

  const [data, setData] = useState<LibraryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Please sign in to view your Library.')
        setLoading(false)
        return
      }
      const res = await fetch('/api/library', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to load Library' }))
        throw new Error(body.error || 'Failed to load Library')
      }
      const payload = (await res.json()) as LibraryPayload
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Library')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // After data loads, deep-link to the requested section (single-shot)
  useEffect(() => {
    if (!data || !initialSection) return
    const target = document.getElementById(`section-${initialSection}`)
    if (target) {
      // Slight delay so layout settles before scroll
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [data, initialSection])

  const handleMarkOwned = useCallback(
    async (productId: string, displayName: string) => {
      const confirmed = window.confirm(`Mark "${displayName}" as owned?`)
      if (!confirmed) return
      setBusyAction(`mark-${productId}`)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch('/api/library/owned', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ product_id: productId, learned_from: 'library_routine_gap' }),
        })
        if (!res.ok && res.status !== 409) {
          const body = await res.json().catch(() => ({ error: 'Failed' }))
          throw new Error(body.error || 'Failed to mark as owned')
        }
        await load()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to mark as owned')
      } finally {
        setBusyAction(null)
      }
    },
    [load]
  )

  const handleRemove = useCallback(
    async (id: string, displayName: string) => {
      const confirmed = window.confirm(`Remove "${displayName}" from your collection?`)
      if (!confirmed) return
      setBusyAction(`remove-${id}`)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`/api/library/owned?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Failed' }))
          throw new Error(body.error || 'Failed to remove')
        }
        await load()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to remove')
      } finally {
        setBusyAction(null)
      }
    },
    [load]
  )

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-rose-300">{error || 'No library data'}</p>
          <button onClick={load} className="mt-3 text-xs text-white/70 underline">Try again</button>
        </div>
      </div>
    )
  }

  const yuriHref = `/yuri?ask=${encodeURIComponent(buildYuriPrefill(data.summary))}`

  return (
    <div className="container mx-auto px-4 py-8 space-y-10 max-w-5xl">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5" />
          My Library
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Your collection at a glance</h1>
        <p className="text-sm text-white/70 max-w-2xl">
          Everything you own, save, use in your routine, love, or track for expiration — in one place.
          Want a read on what to focus on? Ask Yuri.
        </p>
        <Link
          href={yuriHref}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 ring-1 ring-rose-400/30 transition text-sm font-medium"
        >
          <Sparkles className="w-4 h-4" />
          Ask Yuri about my library
        </Link>
      </header>

      <OwnedSection
        items={data.owned}
        onAdd={() => setAddOpen(true)}
        onRemove={handleRemove}
      />

      <SavedSection items={data.saved} />

      <InRoutineSection
        am={data.in_routine.am}
        pm={data.in_routine.pm}
        onMarkOwned={handleMarkOwned}
      />

      <TaggedSection holyGrail={data.tagged.holy_grail} brokeMeOut={data.tagged.broke_me_out} />

      <ExpiringSection items={data.expiring} total={data.expiring_total} />

      <LibraryAddModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false)
          load()
        }}
      />

      {busyAction && (
        <div className="fixed bottom-4 right-4 bg-zinc-900 ring-1 ring-white/10 px-3 py-2 rounded-full text-xs text-white/80 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Working…
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-12 flex items-center justify-center"><Loader2 className="w-6 h-6 text-white/60 animate-spin" /></div>}>
      <LibraryPageInner />
    </Suspense>
  )
}
