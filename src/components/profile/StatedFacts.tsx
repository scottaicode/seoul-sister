'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Facts {
  gender: 'woman' | 'man' | 'nonbinary' | null
  age_years: number | null
  age_stated_on: string | null
  age_now: number | null
  medical_history: string[]
  sun_history: string | null
  location_text: string | null
}

const GENDER_LABEL: Record<NonNullable<Facts['gender']>, string> = { woman: 'Woman', man: 'Man', nonbinary: 'Non-binary' }

/**
 * What is stored on the profile about the member's body, exactly as stored,
 * with a way to take a piece off the profile (Nov 15 2026). It shows what is
 * on file and nothing else: no advice, and "Not stated" where nothing is.
 * Removal reaches the profile and the setup record only; the copy says so.
 */
export default function StatedFacts() {
  const [facts, setFacts] = useState<Facts | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function call(body?: Record<string, unknown>): Promise<Facts | null> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return null
    const res = await fetch('/api/me/stated-facts', {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { ok?: boolean; facts?: Facts }
    return json.ok && json.facts ? json.facts : null
  }

  useEffect(() => {
    let live = true
    call()
      .then((f) => { if (live) { setFacts(f); setState(f ? 'ready' : 'error') } })
      .catch(() => { if (live) setState('error') })
    return () => { live = false }
  }, [])

  async function remove(key: string, body: Record<string, unknown>) {
    setBusy(key)
    setNote(null)
    try {
      const next = await call(body)
      if (next) setFacts(next)
      else setNote('That could not be removed just now. Nothing was changed. Please try again in a minute.')
    } catch {
      setNote('That could not be removed just now. Nothing was changed. Please try again in a minute.')
    } finally {
      setBusy(null)
    }
  }

  const Row = ({ label, value, onRemove, id }: { label: string; value: string | null; onRemove?: () => void; id: string }) => (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-white/60 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white font-medium break-words">{value ?? 'Not stated'}</p>
      </div>
      {value && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy !== null}
          className="shrink-0 text-xs text-white/70 underline underline-offset-2 disabled:opacity-50"
        >
          {busy === id ? 'Removing' : 'Remove'}
        </button>
      )}
    </div>
  )

  return (
    <div className="glass-card p-5">
      <h2 className="font-display font-semibold text-sm text-white/60 uppercase tracking-wider mb-1">On your profile</h2>
      <p className="text-xs text-white/60 mb-2">
        This is what is stored on your profile about you. Removing something takes it off your profile only. Your conversations with Yuri are not edited, so she may still see it there, and it can be added back from them.
      </p>
      {state === 'loading' && <p className="text-sm text-white/60 py-3">Loading.</p>}
      {state === 'error' && <p className="text-sm text-white/70 py-3" role="alert">This could not be loaded just now. Please reload the page.</p>}
      {state === 'ready' && facts && (
        <>
          <Row id="gender" label="Gender" value={facts.gender ? GENDER_LABEL[facts.gender] : null} onRemove={() => remove('gender', { action: 'clear_gender' })} />
          <Row
            id="age"
            label="Age"
            value={facts.age_years !== null ? `${facts.age_years}${facts.age_stated_on ? `, said on ${facts.age_stated_on}` : ''}` : null}
            onRemove={() => remove('age', { action: 'clear_age' })}
          />
          {facts.medical_history.length === 0 ? (
            <Row id="medical" label="Medical history" value={null} />
          ) : (
            facts.medical_history.map((entry) => (
              <Row key={entry} id={`medical:${entry}`} label="Medical history" value={entry} onRemove={() => remove(`medical:${entry}`, { action: 'remove_medical', entry })} />
            ))
          )}
          <Row id="sun" label="Sun history" value={facts.sun_history} />
          <Row id="location" label="Location" value={facts.location_text} />
        </>
      )}
      {note && <p className="text-xs text-rose-300 mt-2" role="alert">{note}</p>}
    </div>
  )
}
