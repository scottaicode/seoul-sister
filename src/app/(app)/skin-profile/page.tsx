'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  CalendarClock,
  Heart,
  AlertTriangle,
  Sun,
  Moon,
  Camera,
  Loader2,
  RefreshCw,
  CheckCircle2,
  CircleDot,
  Circle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  PhasePhotoGallery,
  type PhasePhotoEntry,
  type PhaseTabData,
} from '@/components/skin-profile/PhasePhotoGallery'

interface ProfilePayload {
  skin_type: string | null
  skin_concerns: string[] | null
  fitzpatrick_scale: number | null
  climate: string | null
  location_text: string | null
  age_range: string | null
  allergies: string[] | null
  cycle_tracking_enabled: boolean
  timezone: string | null
  onboarding_completed: boolean | null
}

interface PhaseRow {
  id: string
  phase_number: number
  name: string
  goal: string | null
  status: 'planned' | 'active' | 'completed' | 'paused'
  started_at: string | null
  completed_at: string | null
  protocol: Record<string, unknown>
  decisions: Array<{ decision: string; date: string }>
  watch_for: string[]
  outcomes: Record<string, unknown>
  last_yuri_update_at: string | null
  photo_count: number
}

interface SkinBreakdownPayload {
  text: string
  generatedAt: string
  generationReason: string
  treatmentPhaseId: string | null
  isCached: boolean
  isStale?: boolean
}

interface ReactionEntry {
  product_id: string
  name: string
  brand: string
  recorded_at: string
}

interface RoutineProductView {
  id: string
  step_order: number
  product_id: string | null
  notes: string | null
  frequency: string | null
  ss_products: { name_en: string; brand_en: string } | null
}

interface RoutineView {
  id: string
  name: string
  routine_type: string
  is_active: boolean
  ss_routine_products: RoutineProductView[]
}

interface SkinProfilePayload {
  profile: ProfilePayload | null
  phases: PhaseRow[]
  skin_breakdown: SkinBreakdownPayload | null
  holy_grails: ReactionEntry[]
  broke_me_outs: ReactionEntry[]
  current_routines: RoutineView[]
  conversation_count: number
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const days = daysSince(iso) ?? 0
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

/**
 * Render Skin Breakdown prose with minimal markdown — paragraphs, **bold**.
 * Deliberately bare-bones so the AI's structure shows through; we don't
 * impose visual templating on the content (Principle 2).
 */
function renderBreakdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  return paragraphs.map((para, i) => {
    const segments = para.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    return (
      <p key={i} className="text-white/85 leading-relaxed text-sm md:text-base">
        {segments.map((seg, j) => {
          if (seg.startsWith('**') && seg.endsWith('**')) {
            return (
              <strong key={j} className="text-white font-semibold">
                {seg.slice(2, -2)}
              </strong>
            )
          }
          return <span key={j}>{seg}</span>
        })}
      </p>
    )
  })
}

function PhaseStatusBadge({ status }: { status: PhaseRow['status'] }) {
  const styles = {
    active: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    completed: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    planned: 'bg-white/10 text-white/60 border-white/20',
    paused: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  }[status]
  const Icon = status === 'active' ? CircleDot : status === 'completed' ? CheckCircle2 : Circle
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${styles}`}
    >
      <Icon size={12} strokeWidth={2} />
      {status}
    </span>
  )
}

function PhaseRowCard({ phase }: { phase: PhaseRow }) {
  const [expanded, setExpanded] = useState(phase.status === 'active')
  const days = phase.started_at ? daysSince(phase.started_at) : null

  const protocolEntries = Object.entries(phase.protocol).filter(
    ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-seoul-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-gold font-semibold text-sm">Phase {phase.phase_number}</span>
          <span className="text-white font-medium truncate">{phase.name}</span>
          <PhaseStatusBadge status={phase.status} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-white/40 hidden sm:inline">
            {phase.status === 'active' && days !== null
              ? `Day ${days + 1}`
              : phase.completed_at
                ? `Completed ${formatRelativeTime(phase.completed_at)}`
                : phase.started_at
                  ? `Started ${formatRelativeTime(phase.started_at)}`
                  : 'Not started'}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-3">
          {phase.goal && (
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Goal</div>
              <p className="text-sm text-white/80">{phase.goal}</p>
            </div>
          )}

          {protocolEntries.length > 0 && (
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Protocol</div>
              <div className="space-y-2 text-sm">
                {protocolEntries.map(([key, val]) => (
                  <div key={key}>
                    <div className="text-white/60 text-xs capitalize">{key.replace(/_/g, ' ')}</div>
                    <div className="text-white/80">
                      {Array.isArray(val)
                        ? (val as unknown[]).map((item, i) => (
                            <div key={i} className="ml-2">
                              · {String(item)}
                            </div>
                          ))
                        : String(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(phase.decisions) && phase.decisions.length > 0 && (
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1">Key decisions</div>
              <ul className="space-y-1 text-sm text-white/80">
                {phase.decisions.map((d, i) => (
                  <li key={i}>
                    · {d.decision}
                    {d.date && <span className="text-white/40 text-xs ml-1">({d.date})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(phase.watch_for) && phase.watch_for.length > 0 && (
            <div>
              <div className="text-xs text-amber-300/80 uppercase tracking-wide mb-1">Watch for</div>
              <ul className="space-y-1 text-sm text-white/80">
                {phase.watch_for.map((w, i) => (
                  <li key={i}>· {String(w)}</li>
                ))}
              </ul>
            </div>
          )}

          {phase.outcomes && Object.keys(phase.outcomes).length > 0 && phase.status === 'completed' && (
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wide mb-1">What happened</div>
              <div className="space-y-2 text-sm">
                {(phase.outcomes as { what_worked?: string[] }).what_worked && (
                  <div>
                    <div className="text-white/60 text-xs">What worked</div>
                    <ul className="space-y-0.5 text-white/80">
                      {(phase.outcomes as { what_worked: string[] }).what_worked.map((w, i) => (
                        <li key={i}>· {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(phase.outcomes as { carried_forward?: string[] }).carried_forward && (
                  <div>
                    <div className="text-white/60 text-xs">Carried forward into next phase</div>
                    <ul className="space-y-0.5 text-white/80">
                      {(phase.outcomes as { carried_forward: string[] }).carried_forward.map(
                        (w, i) => (
                          <li key={i}>· {w}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 text-xs text-white/40">
            <span className="inline-flex items-center gap-1">
              <Camera size={11} /> {phase.photo_count} {phase.photo_count === 1 ? 'photo' : 'photos'}
            </span>
            {phase.last_yuri_update_at && (
              <span>Last update {formatRelativeTime(phase.last_yuri_update_at)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RoutineSnapshotCard({ routine }: { routine: RoutineView }) {
  const Icon = routine.routine_type === 'am' ? Sun : Moon
  const sortedSteps = [...(routine.ss_routine_products || [])].sort(
    (a, b) => a.step_order - b.step_order
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-seoul-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-gold" />
        <span className="text-sm font-medium text-white">{routine.name}</span>
      </div>
      <ol className="space-y-1.5">
        {sortedSteps.map((step, i) => {
          const label = step.ss_products
            ? `${step.ss_products.brand_en} ${step.ss_products.name_en}`.trim()
            : step.notes || 'Custom step'
          return (
            <li key={step.id} className="flex gap-2 text-sm text-white/75">
              <span className="text-white/40 w-5 flex-shrink-0">{i + 1}.</span>
              <span className="min-w-0">{label}</span>
              {step.frequency && (
                <span className="text-xs text-white/40 flex-shrink-0">({step.frequency})</span>
              )}
            </li>
          )
        })}
        {sortedSteps.length === 0 && (
          <li className="text-sm text-white/40 italic">No steps yet</li>
        )}
      </ol>
    </div>
  )
}

export default function SkinProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<SkinProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [photos, setPhotos] = useState<PhasePhotoEntry[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const headers = await getAuthHeaders()
        const [profileRes, photosRes] = await Promise.all([
          fetch('/api/skin-profile', { headers }),
          fetch('/api/skin-profile/phase-photos', { headers }),
        ])
        if (!profileRes.ok) throw new Error(`Failed to load profile (${profileRes.status})`)
        const profileBody = (await profileRes.json()) as SkinProfilePayload
        const photosBody = (await photosRes.json().catch(() => ({ photos: [] }))) as {
          photos: PhasePhotoEntry[]
        }
        if (cancelled) return
        setData(profileBody)
        setPhotos(photosBody.photos || [])
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load skin profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const handleRefreshBreakdown = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/skin-profile?regenerate=true', { headers })
      if (res.ok) {
        const body = (await res.json()) as SkinProfilePayload
        setData(body)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const phaseTabs: PhaseTabData[] = useMemo(() => {
    if (!data) return []
    return data.phases.map((p) => ({
      id: p.id,
      label: `Phase ${p.phase_number} · ${p.name}`,
      phaseNumber: p.phase_number,
    }))
  }, [data])

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-white/70 mb-4">Sign in to view your Skin Profile.</p>
        <Link href="/login" className="text-gold underline">
          Sign in
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  const activePhase = data.phases.find((p) => p.status === 'active')
  const profile = data.profile
  const hasProfile = profile && profile.onboarding_completed
  const dayCount = activePhase?.started_at ? (daysSince(activePhase.started_at) ?? 0) + 1 : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-8">
      {/* Section 1: Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Sparkles className="text-gold" size={22} strokeWidth={2} />
          <h1 className="text-2xl md:text-3xl font-semibold text-white">Your Skin, Right Now</h1>
        </div>
        {activePhase ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 text-sm">
              Phase {activePhase.phase_number}: {activePhase.name}
            </span>
            {dayCount !== null && (
              <span className="text-sm text-white/60">· Day {dayCount}</span>
            )}
          </div>
        ) : data.phases.length > 0 ? (
          <p className="text-sm text-white/60">No active phase right now.</p>
        ) : (
          <p className="text-sm text-white/60">
            No treatment phases yet — they'll show up here once Yuri starts structuring your journey.
          </p>
        )}
        {data.skin_breakdown?.generatedAt && (
          <p className="text-xs text-white/40 flex items-center gap-1.5">
            <CalendarClock size={11} />
            Last Yuri check-in: {formatRelativeTime(data.skin_breakdown.generatedAt)}
          </p>
        )}
      </header>

      {/* Section 2: Skin Breakdown (the headline) */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-seoul-card/80 to-seoul-card/40 p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Yuri's Read of Your Skin</h2>
          <button
            type="button"
            onClick={handleRefreshBreakdown}
            disabled={refreshing}
            className="text-xs text-white/60 hover:text-gold flex items-center gap-1.5 disabled:opacity-40 transition"
            title="Regenerate Yuri's read"
          >
            {refreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {refreshing ? 'Generating...' : 'Refresh'}
          </button>
        </div>
        {data.skin_breakdown?.text ? (
          <div className="space-y-4">{renderBreakdown(data.skin_breakdown.text)}</div>
        ) : (
          <p className="text-sm text-white/50">Yuri is preparing your read — refresh in a moment.</p>
        )}
        {data.skin_breakdown?.isStale && (
          <p className="text-xs text-white/40 italic">
            Yuri's regenerating this in the background based on your latest conversations.
          </p>
        )}
      </section>

      {/* Section 3: Phase Journey Timeline */}
      {data.phases.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Phase Journey</h2>
          <div className="space-y-3">
            {data.phases.map((p) => (
              <PhaseRowCard key={p.id} phase={p} />
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Phase Photo Gallery */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Progress Photos</h2>
          <Link
            href="/glass-skin"
            className="text-xs text-gold hover:underline flex items-center gap-1"
          >
            <Camera size={12} />
            Take new photo
          </Link>
        </div>
        <PhasePhotoGallery photos={photos} phases={phaseTabs} />
      </section>

      {/* Section 5: Current Routine Snapshot */}
      {data.current_routines.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Current Routine</h2>
            <Link
              href="/routine"
              className="text-xs text-gold hover:underline"
            >
              Edit in Routine →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.current_routines.map((r) => (
              <RoutineSnapshotCard key={r.id} routine={r} />
            ))}
          </div>
        </section>
      )}

      {/* Section 6: What Yuri Has Learned */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">What Yuri Has Learned About You</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Holy Grail */}
          <div className="rounded-2xl border border-white/10 bg-seoul-card/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-rose-400" />
              <span className="text-sm font-medium text-white">Holy Grail products</span>
            </div>
            {data.holy_grails.length === 0 ? (
              <p className="text-sm text-white/40 italic">None tagged yet.</p>
            ) : (
              <ul className="space-y-1 text-sm text-white/80">
                {data.holy_grails.slice(0, 8).map((r) => (
                  <li key={r.product_id}>
                    · {r.brand} {r.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Broke Me Out */}
          <div className="rounded-2xl border border-white/10 bg-seoul-card/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-400" />
              <span className="text-sm font-medium text-white">Products that caused reactions</span>
            </div>
            {data.broke_me_outs.length === 0 ? (
              <p className="text-sm text-white/40 italic">None tagged yet.</p>
            ) : (
              <ul className="space-y-1 text-sm text-white/80">
                {data.broke_me_outs.slice(0, 8).map((r) => (
                  <li key={r.product_id}>
                    · {r.brand} {r.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Allergies */}
          {profile?.allergies && profile.allergies.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-seoul-card/50 p-4 md:col-span-2">
              <div className="text-sm font-medium text-white mb-2">Known allergies / sensitivities</div>
              <div className="flex flex-wrap gap-2">
                {profile.allergies.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-rose-500/15 text-rose-200 border border-rose-400/30 px-2.5 py-0.5 text-xs"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer hint */}
      {!hasProfile && (
        <div className="rounded-2xl border border-white/10 bg-seoul-card/40 p-4 text-sm text-white/60 text-center">
          Your profile is still light. Chat with Yuri to fill in the picture — every conversation
          deepens her read.
        </div>
      )}
    </div>
  )
}
