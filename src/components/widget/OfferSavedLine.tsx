'use client'

import { useEffect, useState } from 'react'
import { captureOfferCode, getOfferCode, clearOfferCode } from '@/lib/offers'

/**
 * Tells someone who arrived with a creator code (e.g. Bailey's link) that the
 * code was kept, as soon as they land (Nov 10 2026). Without it the first sign
 * of the code was the membership page, several steps later.
 *
 * The words come from Stripe through /api/offer, never from the URL. A code
 * Stripe does not accept is forgotten. If Stripe cannot be asked, nothing is
 * shown. It never says how many uses are left.
 */
export default function OfferSavedLine() {
  const [line, setLine] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    // Child effects run before AuthContext's, so read the URL here too.
    captureOfferCode()
    const code = getOfferCode()
    if (!code) return
    void (async () => {
      try {
        const res = await fetch(`/api/offer?code=${encodeURIComponent(code)}`)
        if (!res.ok) return
        const o = (await res.json()) as { state?: string; line?: string; saved_line?: string }
        if (o.state === 'active') {
          if (live) setLine(o.saved_line ?? null)
          return
        }
        clearOfferCode()
        if (live && o.state === 'ended') setLine(o.line ?? null)
      } catch (err) {
        console.error('[offer] could not check the saved code:', err)
      }
    })()
    return () => {
      live = false
    }
  }, [])

  if (!line) return null
  return (
    <p className="mt-3 text-center text-xs text-gold-light" role="status">
      {line}
    </p>
  )
}
