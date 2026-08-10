// Seoul Sister Service Worker
//
// CACHE_NAME is a deploy fence. Bumping it makes the `activate` handler below
// delete every older cache, so returning visitors get the new build instead of
// a stale one. BUMP IT whenever a change must reach existing visitors
// immediately — auth, security, or anything that would otherwise break a user
// who has been here before.
//
// v2 (Jul 28 2026): a real user was LOCKED OUT of login by v1. The Turnstile
// captcha shipped that morning, but `/_next/static/` is served cache-first
// (below), so her browser kept replaying the PRE-captcha login chunk: no widget
// rendered, no token could be produced, and the client-side guard refused the
// submit with "Please complete the verification check below" — a check with
// nothing to check. Server was correct the whole time; the stale bundle was the
// entire bug. Cache-first on immutable hashed assets is right in general, but
// it means a shipped fix does NOT reach a returning visitor until this name
// changes.
// v3 (Jul 29 2026): the cold-launch logout fix in AuthContext must reach the
// people already affected by it. Bailey had the installed PWA and a v2 cache,
// so without this bump she would keep replaying the bundle that bounced her to
// /login on every launch — the same returning-visitor trap as v2.
// v4 (Jul 29 2026): STATIC_ASSETS now precaches the PNG icons. The old list
// referenced icon-192.svg / icon-512.svg, which iOS cannot use for a home-screen
// icon at all — bumping makes the activate handler purge v3 so returning
// visitors stop precaching assets nothing points at.
// v5 (Jul 30 2026): the signOut scope fix. `signOut()` was defaulting to
// scope:'global', so a sign-out on ANY device revoked EVERY session for that
// user — Scott's sign-out ended Bailey's session four seconds later, per the
// auth logs. That fix lives in the JS bundle, and `/_next/static/` is served
// cache-first below, so a returning visitor keeps replaying the old chunk until
// this name changes. Bailey is exactly that returning visitor, on a v4 cache,
// and she is the person the fix is for. Same returning-visitor trap as v2/v3.
// v6 (Jul 30 2026): the mobile Sign Out confirm step. Same returning-visitor
// reasoning as v5 — it ships in the JS bundle, and the person it protects is
// already holding an older cache.
// v7 (Jul 30 2026): the signed-in landing redirect. This is THE fix for
// "logged out every launch" — start_url is `/`, and `/` was showing subscribers
// the signup pitch. It must reach an installed app that is caching the old
// bundle, and Bailey is that install.
// v8 (Jul 30 2026): the new SS monogram. STATIC_ASSETS precaches the icon PNGs
// below, so a returning visitor keeps the OLD 유 stopgap icon until this name
// changes — and the icon is the thing Bailey asked for.
// v9 (Jul 30 2026): v8's home-screen icon had PRE-ROUNDED corners on a black
// field. iOS applies its OWN mask, so those corners showed as black wedges just
// inside the OS curve. The PNGs are precached here, so the corrected full-bleed
// art cannot reach an installed app without this bump.
// v10 (Jul 30 2026): src/app/icon.svg and apple-icon.svg were a leftover GOLD
// STAR. They are a Next FILE CONVENTION, so their existence emits <link> tags —
// /icon.svg goes out last with sizes="any" and can win the browser tab over the
// favicons we set deliberately. Replaced with the monogram.
// v11 (Jul 30 2026): the favicon was the two-S serif monogram shrunk down, which
// Scott spotted as blurry at 32px and which magnification showed as unreadable
// NOISE at 16px. Replaced with a purpose-drawn single sans S. Favicons are
// precached under /icons/, so the fix needs this bump.
// v12 (Jul 30 2026): the favicons were still soft. Measured: 38% of pixels were
// MID-TONES — anti-aliasing smear from downscaling a 512-unit drawing to 16px.
// Now drawn AT the target size with the glyph box snapped to whole pixels and
// rendered 1:1 with no downscale. 38% -> 25%, remainder is the gold gradient.
// v13 (Jul 30 2026): header/nav mark 28px -> 36px (the two-S monogram mushed at
// 28 next to the wordmark) and the footer wordmark gained the mark it was missing.
// v14 (Aug 7 2026): Bailey googled us and STILL saw the retired 유 stopgap ("the
// ugly guy"). Our assets were already right — Google was serving a cached icon
// because /favicon.ico, the path it requests by default, was a hard 404, and our
// largest declared favicon was 32px against Google's ">48x48px" recommendation.
// Added /favicon.ico (16+32+48) and /icons/favicon-48.png, and DELETED
// src/app/icon.svg: it was the same single-S drawing, and as a Next file
// convention it emitted a query-versioned /icon.svg?<hash> link LAST with
// sizes="any" — an unstable URL (Google: "The favicon URL must be stable") that
// could also outrank the icons we set deliberately. /icons/ is cache-first here,
// so returning visitors need this bump to see the new tab icon.
const CACHE_NAME = 'seoul-sister-v17'
const STATIC_ASSETS = [
  '/',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
]

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API/pages, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests and API routes
  if (event.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return

  // Auth surfaces: ALWAYS network-first, never cached.
  // These gate access to the product and can carry a security control (the
  // Turnstile captcha). A stale auth bundle does not degrade gracefully — it
  // locks a real user out with an error they cannot act on, which is exactly
  // what happened on Jul 28 2026. Correctness beats offline support here;
  // nobody logs in offline anyway.
  if (
    url.pathname === '/login' ||
    url.pathname === '/register' ||
    url.pathname === '/forgot-password' ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/(auth)/')
  ) {
    event.respondWith(fetch(event.request))
    return
  }

  // Static assets: cache-first (hashed filenames make them immutable, so this
  // is safe — but see the CACHE_NAME note: a new build only reaches returning
  // visitors when that name changes).
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    )
    return
  }

  // Pages: network-first with fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  )
})
