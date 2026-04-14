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
      // Product image CDNs — mirrors the CSP img-src allowlist below.
      // 5,470+ products hotlink to images across 23 domains (Olive Young,
      // Shopify, brand sites). Using broad patterns since the pipeline
      // continuously adds new brand domains as products are enriched.
      { protocol: 'https', hostname: 'cdn-image.oliveyoung.com' },
      { protocol: 'https', hostname: 'image.oliveyoung.com' },
      { protocol: 'https', hostname: 'dist.oliveyoung.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'image.yesstyle.com' },
      { protocol: 'https', hostname: 'img.yesstyle.com' },
      { protocol: 'https', hostname: 'medicube.us' },
      { protocol: 'https', hostname: 'www.cosrx.com' },
      { protocol: 'https', hostname: 'theisntree.com' },
      { protocol: 'https', hostname: 'heimish.us' },
      { protocol: 'https', hostname: 'www.dodoskin.com' },
      { protocol: 'https', hostname: 'neogenlab.us' },
      { protocol: 'https', hostname: 'tonymoly.us' },
      { protocol: 'https', hostname: 'us.laneige.com' },
      { protocol: 'https', hostname: 'us.innisfree.com' },
      { protocol: 'https', hostname: 'misshaus.com' },
      { protocol: 'https', hostname: 'us.sulwhasoo.com' },
      { protocol: 'https', hostname: 'www.wishtrend.com' },
      { protocol: 'https', hostname: 'wishtrend.com' },
      { protocol: 'https', hostname: 'beautyofjoseon.com' },
      { protocol: 'https', hostname: 'dalba.com' },
      { protocol: 'https', hostname: 'anua.com' },
      { protocol: 'https', hostname: 'www.sephora.com' },
      { protocol: 'https', hostname: 'd1flfk77wl2xk4.cloudfront.net' },
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
              "img-src 'self' data: blob: https://images.unsplash.com https://gzqjvbhmndnovhlgumdk.supabase.co https://tjzhhfczyjvfjjmuvegd.supabase.co https://www.seoulsister.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://cdn-image.oliveyoung.com https://image.oliveyoung.com https://dist.oliveyoung.com https://cdn.shopify.com https://image.yesstyle.com https://img.yesstyle.com https://medicube.us https://www.cosrx.com https://theisntree.com https://heimish.us https://www.dodoskin.com https://neogenlab.us https://tonymoly.us https://us.laneige.com https://us.innisfree.com https://misshaus.com https://us.sulwhasoo.com https://www.wishtrend.com https://wishtrend.com https://beautyofjoseon.com https://dalba.com https://anua.com https://www.sephora.com https://d1flfk77wl2xk4.cloudfront.net",
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
