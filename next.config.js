const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Exclude @sparticuz/chromium and playwright-core from serverless bundling
  // so they can load native binaries at runtime
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'gzqjvbhmndnovhlgumdk.supabase.co' },
      { protocol: 'https', hostname: 'tjzhhfczyjvfjjmuvegd.supabase.co' }, // LGAAS Supabase — blog hero images
      { protocol: 'https', hostname: 'seoulsister.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  compiler: {
    // Strip console.log in production but keep error/warn for debugging cron jobs and API routes
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://va.vercel-scripts.com", // Next.js + GA4 + Vercel Analytics
              "style-src 'self' 'unsafe-inline'", // Tailwind + framer-motion inject inline styles
              "img-src 'self' data: blob: https://images.unsplash.com https://gzqjvbhmndnovhlgumdk.supabase.co https://tjzhhfczyjvfjjmuvegd.supabase.co https://www.seoulsister.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://cdn-image.oliveyoung.com https://image.oliveyoung.com https://cdn.shopify.com https://image.yesstyle.com",
              "font-src 'self'",
              "connect-src 'self' https://gzqjvbhmndnovhlgumdk.supabase.co https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://va.vercel-scripts.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
