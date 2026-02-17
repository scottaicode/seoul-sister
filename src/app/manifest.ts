import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Seoul Sister - K-Beauty Intelligence',
    short_name: 'Seoul Sister',
    description: 'The world\'s first English-language K-beauty intelligence platform. Scan labels, build routines, detect counterfeits.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF8F0',
    theme_color: '#D4A574',
    orientation: 'portrait-primary',
    categories: ['beauty', 'lifestyle', 'shopping'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
