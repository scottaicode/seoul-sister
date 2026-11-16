'use client'

import { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { directStartedLines } from '@/lib/offers'

/**
 * Shown on the membership page the moment a free week has been started there
 * (no Stripe page). One press spends the only free week a person gets, so the
 * page says plainly that it has started, when it ends, and that nothing will
 * be charged, before moving on. The wording is in offers.ts.
 */
export default function FreeWeekStarted({ endsAt, onContinue }: { endsAt: string | null; onContinue: () => void }) {
  const end = endsAt ? new Date(endsAt) : null
  // The day and the time, in the reader's own zone, as the banner in the app shows it.
  const endText = end && !Number.isNaN(end.getTime())
    ? end.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
  const lines = directStartedLines(endText)
  // A freshly mounted status region is not announced; move focus to the heading instead.
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="dark-card-gold p-8 text-center shadow-glow-gold">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-gradient mb-3 outline-none">{lines.heading}</h1>
        <p className="text-sm text-white/80 mb-6">{lines.body}</p>
        <button onClick={onContinue} className="glass-button-primary w-full flex items-center justify-center gap-2 text-sm py-3">
          {lines.cta} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
