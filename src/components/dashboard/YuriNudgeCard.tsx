'use client'

/**
 * Proactive nudge card (v10.10.0). Renders the most recent pending nudge the
 * proactive-nudge cron generated for this user — a short Yuri-voiced check-in
 * that brings them back at the right moment (open loop, phase/routine mismatch,
 * cycle-timed actives, glass-skin cadence).
 *
 * Per the Yuri Sole Authority Principle, the card does NOT make a recommendation;
 * it routes the user back into a Yuri conversation via a prefilled ?ask= deep
 * link, where Yuri reasons with full context. The card just carries the invitation.
 *
 * Marks the nudge 'surfaced' on render, 'acted' when the user taps through, and
 * 'dismissed' on dismiss — so the cron's cap/spacing logic and the dashboard
 * analytics see real interaction state.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Nudge {
  id: string
  nudge_type: string
  message: string
  deep_link: string | null
  nudge_sequence: number
}

async function authedFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
}

export default function YuriNudgeCard() {
  const router = useRouter()
  const [nudge, setNudge] = useState<Nudge | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await authedFetch('/api/me/nudge')
        if (!res.ok) return
        const data = (await res.json()) as { nudge: Nudge | null }
        if (cancelled || !data.nudge) return
        setNudge(data.nudge)
        // Mark surfaced (fire-and-forget — display shouldn't block on it).
        void authedFetch('/api/me/nudge', {
          method: 'POST',
          body: JSON.stringify({ id: data.nudge.id, status: 'surfaced' }),
        })
      } catch {
        // Non-critical surface — stay silent on failure.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!nudge) return null

  function dismiss() {
    if (!nudge) return
    void authedFetch('/api/me/nudge', {
      method: 'POST',
      body: JSON.stringify({ id: nudge.id, status: 'dismissed' }),
    })
    setNudge(null)
  }

  function act() {
    if (!nudge) return
    void authedFetch('/api/me/nudge', {
      method: 'POST',
      body: JSON.stringify({ id: nudge.id, status: 'acted' }),
    })
    router.push(nudge.deep_link || '/yuri')
  }

  return (
    <section className="relative rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-white/5 to-transparent p-5 overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 p-1 text-white/40 hover:text-white/80 transition-colors"
      >
        <X className="w-4 h-4" strokeWidth={1.75} />
      </button>

      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1 p-2.5 rounded-xl bg-gold/15 border border-gold/30">
          <Sparkles className="w-5 h-5 text-gold" strokeWidth={1.75} />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-medium text-gold uppercase tracking-wide">
              A note from Yuri
            </span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed mb-3 whitespace-pre-line">
            {nudge.message}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={act}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gold text-deep-black text-sm font-medium hover:bg-gold-light transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
              Talk to Yuri
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
