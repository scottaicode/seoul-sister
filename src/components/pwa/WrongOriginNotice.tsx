'use client'

import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

/**
 * Shown on /login when the app is running from the apex origin.
 *
 * WHY THIS IS ON THE LOGIN PAGE SPECIFICALLY (July 29 2026)
 *
 * `seoulsister.com` and `www.seoulsister.com` are separate browser origins, and
 * localStorage is partitioned per origin. A home-screen icon added from the apex
 * boots there, 307s to www, and arrives with no readable session — so it asks for
 * a login on every single launch (Bailey, reproduced on video). The manifest fix
 * pins new installs to www but CANNOT relocate an install that already exists.
 *
 * The re-install instructions also live on the dashboard card, but a user stuck
 * in this loop may never reach the dashboard — that is the whole symptom. The
 * login screen is the one surface she is guaranteed to see, so the escape route
 * has to be here too.
 *
 * Deliberately not dismissible: it is the only way out, and it disappears by
 * itself the moment the app is re-added from the correct origin.
 */
export default function WrongOriginNotice() {
  const [wrongOrigin, setWrongOrigin] = useState(false)

  useEffect(() => {
    // Checked client-side on the origin the document actually ended up on.
    setWrongOrigin(window.location.hostname === 'seoulsister.com')
  }, [])

  if (!wrongOrigin) return null

  return (
    <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-gold/10 border border-gold/30 text-white/80">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-gold" />
      <div className="text-sm leading-snug">
        <p className="font-semibold text-white">Asked to sign in every time?</p>
        <p className="mt-1 text-white/60">
          If you opened this from a home-screen icon, that icon uses an older web
          address that can&apos;t keep you signed in. Delete it, then add it again from{' '}
          <a
            href="https://www.seoulsister.com/login"
            className="text-gold underline underline-offset-2"
          >
            www.seoulsister.com
          </a>
          . You&apos;ll only need to do this once.{' '}
          <a href="/install" className="text-gold underline underline-offset-2">
            Step-by-step instructions
          </a>
          .
        </p>
      </div>
    </div>
  )
}
