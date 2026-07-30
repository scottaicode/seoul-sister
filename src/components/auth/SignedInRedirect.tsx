'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Send an already-signed-in visitor from the marketing homepage to the app.
 *
 * WHY THIS EXISTS (July 30 2026)
 *
 * Bailey reported being "logged out every time" from the installed home-screen
 * app. Three separate fixes chased session persistence before the actual cause
 * turned out to be routing, not auth:
 *
 * The PWA manifest's `start_url` is `https://www.seoulsister.com/` — the
 * MARKETING page. That page (src/app/page.tsx) had NO auth awareness whatsoever,
 * so it rendered "Get Started", "Start Your Journey" and "Talk to Yuri Free.
 * 12 messages, no signup" unconditionally — to everyone, including paying
 * subscribers with a perfectly valid session. Every launch of the icon looked
 * exactly like being signed out.
 *
 * The evidence that settled it, after two wrong diagnoses:
 *   - Every request from her device carried `referer:
 *     https://www.seoulsister.com/`, so she was already on the CORRECT origin.
 *     The apex-origin re-install theory was wrong.
 *   - `GET /user` returned 200 immediately after each of her logins — the server
 *     accepted her session every single time.
 *   - Her sessions ACCUMULATED (five live rows) rather than being deleted, so the
 *     global-signOut revocation bug was already fixed.
 *   - Her screenshot had no browser chrome (standalone PWA) and showed the
 *     logged-out marketing page.
 *   - The auth log showed her own `POST /logout` taps and a
 *     `POST /signup → 422 user_repeated_signup`: the behaviour of someone who
 *     believes she is locked out and is trying every door, not of a broken session.
 *
 * DESIGN CONSTRAINTS
 *
 * `/` is the public SEO/GEO surface (525 Bing citations/week) and the Yuri
 * widget's front door, so it must keep rendering instantly and completely for
 * anonymous visitors. Therefore:
 *   - This renders NOTHING. It never gates, blocks, or spinner-covers the page.
 *   - It reads the session locally (`getSession()` hits storage, not the network)
 *     and only redirects on a positive hit. No session, or any error, leaves the
 *     marketing page exactly as it was.
 *   - It does NOT redirect when the URL carries intent that belongs to the
 *     landing page — `?ask=`/`?from=` feeder prefills into the widget, or a hash
 *     link like `#pricing`. A subscriber following a link to the pricing section
 *     or a blog CTA should land where the link pointed.
 *   - `router.replace` so the marketing page does not become a Back-button trap
 *     between the app and itself.
 */
export default function SignedInRedirect() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    // Respect explicit intent to be ON this page. A feeder CTA (?ask=/?from=)
    // targets the hero widget, and #pricing targets a section here — redirecting
    // those to /dashboard would break links we deliberately ship.
    const params = new URLSearchParams(window.location.search)
    if (params.has('ask') || params.has('from') || window.location.hash) return

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return
        // Only a real, present session redirects. Absent/expired/errored → the
        // visitor stays on the marketing page, which is the safe default.
        if (session?.user) router.replace('/dashboard')
      })
      .catch(() => {
        // Never let an auth hiccup break the public homepage.
      })

    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
