'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Pull the latest worker on every launch. Without this, a returning
          // visitor can sit on an old worker indefinitely — the trap that kept
          // a shipped auth fix from reaching the user it was written for
          // (see the CACHE_NAME note in public/sw.js).
          registration.update().catch(() => {})
        })
        .catch((err) => {
          // NOT non-critical, and no longer silent (July 29 2026).
          //
          // On the apex origin every path — including /sw.js — answers with a
          // 307 to www, so `register()` rejects with a bad-MIME-type error and
          // the PWA silently has no service worker at all. That failure was
          // swallowed here for months, which is why nobody knew the offline
          // shell and cache-versioning were dead on any apex install.
          console.error(
            '[sw] registration failed — the PWA is running with no service worker. ' +
              'If this is a redirecting origin (apex vs www), /sw.js is answering ' +
              'with a redirect instead of JavaScript.',
            err
          )
        })
    }
  }, [])

  return null
}
