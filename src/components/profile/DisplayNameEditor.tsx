'use client'

import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const MAX_LEN = 32

/**
 * Lets the user set what the app calls them on screen.
 *
 * WHY (July 29 2026)
 *
 * Bailey, about to screen-record for TikTok: "can you please change the username
 * to baileyydonn to match TikTok. I don't need everyone knowing EVERYTHING 😂 /
 * Even tho they'll figure it out... I want consistency"
 *
 * Her dashboard said "baileydonmartin" because three surfaces fell back to
 * `email.split('@')[0]` — so every user with a firstnamelastname@ address had
 * their legal name on screen. That is fixed at the read sites, but the deeper
 * point is that she should not need a developer to change her own name. A
 * creator whose handle is her brand will change it again.
 *
 * Deliberately writes `display_name` and NOT `first_name`: first_name is what
 * Yuri calls her in conversation and is only captured when volunteered (see the
 * clinical-honesty rules in CLAUDE.md). "baileyydonn" is a handle for the
 * screen; "Bailey" is what a friend says out loud. Both should be true at once,
 * so they stay separate fields.
 */
export default function DisplayNameEditor({
  userId,
  current,
  onSaved,
}: {
  userId: string
  current: string | null
  onSaved: (next: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const trimmed = value.trim()
    // Empty clears it back to NULL — the neutral greeting — rather than storing
    // a blank string that would render as an empty gold gap in the heading.
    const next = trimmed.length === 0 ? null : trimmed

    if (next && next.length > MAX_LEN) {
      setError(`Keep it under ${MAX_LEN} characters.`)
      return
    }

    setSaving(true)
    setError(null)
    const { error: dbError } = await supabase
      .from('ss_user_profiles')
      .update({ display_name: next })
      .eq('user_id', userId)
    setSaving(false)

    if (dbError) {
      // Never swallow it — a silent failure here looks like the app ignored her.
      console.error('[display-name] save failed', dbError)
      setError('Could not save that. Try again.')
      return
    }

    onSaved(next)
    setEditing(false)
  }

  function cancel() {
    setValue(current ?? '')
    setError(null)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-light hover:text-gold transition-colors"
      >
        <Pencil className="w-3 h-3" />
        {current ? 'Change name' : 'Set a display name'}
      </button>
    )
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          maxLength={MAX_LEN}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') cancel()
          }}
          placeholder="e.g. baileyydonn"
          aria-label="Display name"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50"
        />
        <button
          onClick={save}
          disabled={saving}
          aria-label="Save display name"
          className="p-2 rounded-xl bg-gold/20 text-gold-light hover:bg-gold/30 transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          aria-label="Cancel"
          className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white/80 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-white/40">
        This is what the app calls you on screen. Leave it empty and we&apos;ll just say
        &quot;Welcome.&quot;
      </p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
