'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PRICING } from '@/lib/pricing'

/**
 * Tells a member on the free trial when it ends and what happens then, and
 * lets them add a card (Nov 10 2026). Before this, nothing in the app showed a
 * trial's end date, so a no-card trial would have stopped on day 7 with no
 * warning.
 *
 * Facts only, from /api/me/trial. `card_on_file` comes from Stripe by its own
 * end-of-trial rule; when Stripe could not be asked (null) the notice states
 * the end date and makes no claim about a card. Renders nothing for anyone
 * who is not on a trial.
 */
interface TrialFacts {
  trial: { ends_at: string | null; card_on_file: boolean | null; cancelled: boolean | null } | null
}

/**
 * Which of the notice's states applies. Pure and exported so the test executes
 * it: each state makes a different promise, and "unknown" must never read as
 * either "a card is on file" or "no card is on file".
 */
export type TrialNoticeState = 'none' | 'cancelled' | 'card_on_file' | 'card_just_saved' | 'no_card' | 'unknown_card'

export function trialNoticeState(trial: TrialFacts['trial'], justSaved: boolean): TrialNoticeState {
  if (!trial) return 'none'
  if (trial.cancelled === true) return 'cancelled'
  if (trial.card_on_file === true) return 'card_on_file'
  // They just came back from saving a card, but Stripe's confirmation has not
  // reached us yet. Saying "no card is on file" here would contradict what
  // they did seconds ago.
  if (justSaved) return 'card_just_saved'
  if (trial.card_on_file === false) return 'no_card'
  return 'unknown_card'
}

export default function TrialNotice() {
  const [facts, setFacts] = useState<TrialFacts['trial']>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    let live = true
    const saved = new URLSearchParams(window.location.search).get('card') === 'saved'
    setJustSaved(saved)
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const res = await fetch('/api/me/trial', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) {
          console.error('[trial notice] trial facts unavailable:', res.status)
          return
        }
        const body = (await res.json()) as TrialFacts
        if (live) setFacts(body.trial ?? null)
      } catch (err) {
        console.error('[trial notice] could not load trial facts:', err)
      }
    }
    void load()
    // After saving a card, look again shortly: the webhook that attaches it
    // usually lands within seconds.
    const again = saved ? window.setTimeout(() => void load(), 4000) : null
    return () => {
      live = false
      if (again) window.clearTimeout(again)
    }
  }, [])

  const state = trialNoticeState(facts, justSaved)
  if (state === 'none' || !facts) return null

  const ends = facts.ends_at ? new Date(facts.ends_at) : null
  const endText = ends
    ? ends.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : null
  const until = endText ? `on ${endText}` : 'when it ends'

  async function addCard() {
    setBusy(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Please sign in again.')
      const res = await fetch('/api/stripe/add-card', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const body = await res.json()
      if (!res.ok || !body.url) throw new Error(body.error || 'Could not open the card page.')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the card page.')
      setBusy(false)
    }
  }

  const shell = 'bg-gold/5 border-b border-gold/20 px-4 py-2 text-center text-xs text-white/70'

  if (state === 'cancelled') {
    return (
      <div className={shell} role="status">
        You cancelled. Your free trial runs until it ends {until}, and nothing will be charged.
      </div>
    )
  }
  if (state === 'card_on_file') {
    return (
      <div className={shell} role="status">
        {justSaved ? 'Your card is saved. ' : ''}
        Your free trial ends {until}. Your card will be charged {PRICING.monthly_display_long} on that day, and every month
        after that until you cancel.
      </div>
    )
  }
  if (state === 'card_just_saved') {
    return (
      <div className={shell} role="status">
        Your card was received. It can take a minute to show here. Your free trial ends {until}.
      </div>
    )
  }

  return (
    <div className={shell} role="status">
      <span>
        Your free trial ends {until}.{' '}
        {state === 'no_card'
          ? `You have not added a card, so your membership will stop on that day and nothing will be charged. To continue, add a card: ${PRICING.monthly_display_long}, starting when the trial ends.`
          : `To continue after that, add a card: ${PRICING.monthly_display_long}, starting when the trial ends.`}
      </span>{' '}
      <button
        type="button"
        onClick={addCard}
        disabled={busy}
        className="inline-block ml-1 py-1 px-3 rounded-lg bg-gold/20 text-gold-light hover:bg-gold/30 disabled:opacity-50 min-h-[28px]"
      >
        {busy ? 'Opening…' : 'Add a card'}
      </button>
      {error && <span className="block text-rose-300 mt-1" role="alert">{error}</span>}
    </div>
  )
}
