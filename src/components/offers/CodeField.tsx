'use client'

import { useState } from 'react'
import { haveACodeLabel, codeCheckFailedLine } from '@/lib/offers'

/**
 * "Have a code?" Closed until asked for, so it adds nothing to a page for the
 * people who have no code. What a code does is decided by `onApply`, which
 * answers with the sentence to show: this component states nothing itself.
 * A code is not case sensitive.
 */
export default function CodeField({ onApply, className = '' }: { onApply: (code: string) => Promise<{ ok: boolean; line: string }>; className?: string }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; line: string } | null>(null)

  async function apply() {
    if (busy || !value.trim()) return
    setBusy(true)
    try {
      const r = await onApply(value)
      setResult(r)
      if (r.ok) { setValue(''); setOpen(false) }
    } catch (err) {
      console.error('[code field] could not apply the code:', err)
      setResult({ ok: false, line: codeCheckFailedLine() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      {!open && !result?.ok && (
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-white/70 underline underline-offset-2 hover:text-white">
          {haveACodeLabel()}
        </button>
      )}
      {open && (
        <div className="flex gap-2 justify-center">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void apply() } }}
            aria-label="Code"
            placeholder="Code"
            maxLength={20}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            className="w-40 rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-base text-white placeholder:text-white/50"
          />
          <button type="button" onClick={() => void apply()} disabled={busy || !value.trim()} className="rounded-lg border border-white/25 px-3 py-2 text-sm text-white/85 disabled:opacity-40">
            {busy ? 'Checking' : 'Apply'}
          </button>
        </div>
      )}
      {result && (
        <p className={`text-xs mt-2 ${result.ok ? 'text-gold-light' : 'text-white/80'}`} role="status">{result.line}</p>
      )}
    </div>
  )
}
