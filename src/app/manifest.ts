import type { MetadataRoute } from 'next'

/**
 * The canonical origin, matching `metadataBase` in layout.tsx.
 *
 * `seoulsister.com` and `www.seoulsister.com` are SEPARATE BROWSER ORIGINS, and
 * the apex serves nothing but 307 redirects to www — every path, including
 * /sw.js and this manifest. Because localStorage is partitioned per origin, a
 * Supabase session written on www is INVISIBLE from the apex.
 *
 * That is why `start_url` must be ABSOLUTE. A relative '/' resolves against
 * whichever origin the user installed from, so an install started at
 * seoulsister.com produced a home-screen app that booted on the apex, 307'd to
 * www on every launch, and could not see its own session — a login screen every
 * single time (Bailey, July 29 2026, reproduced on video). It also meant no
 * service worker could ever register from that install, because the apex
 * answers /sw.js with a redirect rather than JavaScript.
 */
const ORIGIN = 'https://www.seoulsister.com'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` pins the app identity to the canonical origin so an existing install
    // updates in place instead of being treated as a second, separate app.
    id: `${ORIGIN}/`,
    name: 'Seoul Sister - K-Beauty Intelligence',
    short_name: 'Seoul Sister',
    description: 'The world\'s first English-language K-beauty intelligence platform. Scan labels, build routines, detect counterfeits.',
    // ABSOLUTE, not '/' — see the ORIGIN note above. This is the whole fix for
    // the launch-lands-on-login bug.
    start_url: `${ORIGIN}/`,
    // Keep the installed app on the canonical origin. Without a scope, a
    // navigation to the apex drops out of the installed context.
    scope: `${ORIGIN}/`,
    display: 'standalone',
    background_color: '#0D0D0F',
    theme_color: '#0D0D0F',
    orientation: 'portrait-primary',
    categories: ['beauty', 'lifestyle', 'shopping'],
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
