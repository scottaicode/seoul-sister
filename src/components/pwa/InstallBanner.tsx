'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Smartphone, X } from 'lucide-react'

const DISMISSED_KEY = 'ss-install-banner-dismissed'
const VISIT_KEY = 'ss-install-banner-visits'

/**
 * A slim, dismissible bar offering the install page to mobile visitors.
 *
 * WHY (July 29 2026)
 *
 * Scott: "Are people going to know to go there? How would they know?"
 *
 * Fair. /install existed and was correct, but the only route to it was 12px grey
 * footer text at the bottom of a long landing page. He refreshed looking for it
 * and could not find it. A page nobody can find is not a fix.
 *
 * So discovery is now layered, weakest to strongest:
 *   1. footer link — for someone deliberately hunting
 *   2. mobile menu item — where a phone user actually looks for "app"
 *   3. THIS — the only one that reaches a visitor who was not looking
 *
 * Deliberate design constraints:
 *   - MOBILE ONLY. Install matters on a phone; a desktop bar is noise.
 *   - NOT on the first visit. A stranger who has not yet decided they like Yuri
 *     does not want to install anything, and asking immediately reads as a
 *     pop-up. It appears from the second visit, matching the PWA convention.
 *   - Hidden once installed — `display-mode: standalone` means they already did.
 *   - Dismissible, and it STAYS dismissed. Unlike the old dashboard card, this
 *     is safe to dismiss because the menu and footer links remain, so
 *     dismissing never destroys the only route (the trap Scott and Bailey hit).
 *   - A BAR, not a modal. It must never cover the Yuri widget — the widget is
 *     the conversion surface and outranks this.
 */
function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod|Android/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (!isMobile()) return

    let dismissed: string | null = null
    let visits = 0
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY)
      visits = Number(localStorage.getItem(VISIT_KEY) ?? '0') + 1
      localStorage.setItem(VISIT_KEY, String(visits))
    } catch {
      // Private browsing / storage blocked. Without a visit count we cannot tell
      // a first-timer from a returning visitor, so stay silent rather than
      // pop a bar at someone on their very first look.
      return
    }
    if (dismissed) return
    if (visits < 2) return

    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    } catch {
      // Dismissal won't persist, but honouring it for this session still beats
      // ignoring the tap.
    }
  }

  return (
    // NOT sticky: it sits above the nav, which owns `sticky top-0`. Two sticky
    // elements competing for the same slot leaves one overlapping the other. This
    // scrolls away and the nav keeps its behaviour.
    <div className="md:hidden relative z-30 bg-gold/12 backdrop-blur border-b border-gold/25">
      <div className="px-4 py-2.5 flex items-center gap-3">
        <Smartphone className="w-4 h-4 text-gold flex-shrink-0" />
        <p className="flex-1 text-xs text-white/80 leading-snug">
          Seoul Sister works as an app.{' '}
          <Link href="/install" className="text-gold-light font-medium underline underline-offset-2">
            Add it to your home screen
          </Link>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 text-white/40 hover:text-white/70 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
