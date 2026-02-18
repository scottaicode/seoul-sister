// Seoul Sister Service Worker
const CACHE_NAME = 'seoul-sister-v1'
const STATIC_ASSETS = [
  '/',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
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

  // Static assets: cache-first
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
