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
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Explicit HSTS (Vercel sets a default, but pin it + cover subdomains).
          // Mail-only subdomains (send, resend._domainkey, _dmarc) serve no HTTP, so includeSubDomains is safe.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Camera stays self-allowed — label scanning / Glass Skin photos use getUserMedia.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // challenges.cloudflare.com (Jul 28 2026): Cloudflare Turnstile on the
              // auth forms. Turnstile needs THREE directives — script-src (loads
              // api.js), frame-src (renders the challenge in an iframe), and
              // connect-src (posts the verification). Miss any one and the widget
              // fails SILENTLY: no visible captcha, no token, and once Supabase's
              // Bot and Abuse Protection is on that means nobody can log in with no
              // obvious cause. Same failure class as the v10.13.4 GTM/connect-src
              // gap below — a missing CSP host breaking a third party invisibly.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://va.vercel-scripts.com https://challenges.cloudflare.com", // Next.js + GA4 + Vercel Analytics + Turnstile
              "style-src 'self' 'unsafe-inline'", // Tailwind + framer-motion inject inline styles
              "img-src 'self' data: blob: https://images.unsplash.com https://gzqjvbhmndnovhlgumdk.supabase.co https://tjzhhfczyjvfjjmuvegd.supabase.co https://www.seoulsister.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://cdn-image.oliveyoung.com https://image.oliveyoung.com https://dist.oliveyoung.com https://cdn.shopify.com https://image.yesstyle.com https://img.yesstyle.com https://medicube.us https://www.cosrx.com https://theisntree.com https://heimish.us https://www.dodoskin.com https://neogenlab.us https://tonymoly.us https://us.laneige.com https://us.innisfree.com https://misshaus.com https://us.sulwhasoo.com https://www.wishtrend.com https://wishtrend.com https://beautyofjoseon.com https://dalba.com https://anua.com https://www.sephora.com https://d1flfk77wl2xk4.cloudfront.net https://media.theresanaiforthat.com",
              "font-src 'self'",
              // v10.13.4: googletagmanager.com added — the service worker's fetch()
              // of the GTM script is governed by connect-src (script-src only covers
              // <script> tags), and its absence was CSP-blocking GA4 for SW-active
              // visitors (caught in the June 10 live funnel test).
              "connect-src 'self' https://gzqjvbhmndnovhlgumdk.supabase.co https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com https://www.googletagmanager.com https://va.vercel-scripts.com https://challenges.cloudflare.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
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

  // Clean bio-link vanity redirects (Priority 2, Jul 2026).
  // Bailey's social bios show a short, non-scary link (seoulsister.com/tt);
  // the redirect applies the source tag server-side so the visitor never sees
  // the query string. The tag lands in ss_widget_sessions.source (own-data moat)
  // so we can answer "did the TikTok visitor actually talk to Yuri?", which is
  // the question that matters. Underscore form is required — the widget's
  // sanitizer strips hyphens.
  //
  // UTMs added Aug 3 2026, after a real gap was found by walking the funnel.
  // Scott clicked Bailey's bio link, landed, and did not chat. Our own data
  // correctly showed nothing (a ss_widget_visitors row is only created when a
  // message is SENT, by design — we count conversations, not pageviews). But
  // GA4 filed the visit under Direct too, because `?from=` is our internal
  // convention and GA4 only names a source from utm_* parameters. So a visitor
  // who arrives from TikTok and browses without chatting was invisible in BOTH
  // systems, and we would have had no way to prove the channel worked even if
  // it did.
  //
  // Appending utm_source/utm_medium here keeps the bio link short and clean
  // (the whole reason /tt exists — a bare, non-scary link converts better on a
  // profile) while making the arrival a NAMED source in GA4 acquisition
  // reports. Safe by construction: the widget reads utm_source FIRST and falls
  // back to ?from=, so both land the same value in ss_widget_sessions.source —
  // 'tiktok'/'instagram' now instead of 'tt_ss'/'ig_ss'.
  async redirects() {
    return [
      {
        source: '/tt',
        destination: '/?utm_source=tiktok&utm_medium=bio&from=tt_ss',
        permanent: false,
      },
      {
        source: '/ig',
        destination: '/?utm_source=instagram&utm_medium=bio&from=ig_ss',
        permanent: false,
      },
      // Comma-trap ingredient merges (Aug 12 2026). A parser split INCI names on
      // their INTERNAL comma, minting "2-Hexanediol" and "3-Butanediol" — both
      // chemically DIFFERENT compounds from the real ingredients. Those wrong
      // names were LIVE ingredient pages (ingredient routes resolve on
      // toSlug(name_inci)), and /ingredients/2-hexanediol advertised 4,543
      // products under a name that does not exist in the catalog.
      //
      // The identities are now merged into the correct rows, so the old slugs
      // resolve to nothing. These are `permanent: true` (301) on purpose: the
      // old URLs were indexed and crawled, and citation is the moat — a 301
      // passes their accumulated authority to the correct page instead of
      // handing crawlers a 404. The destinations are the real slugs produced by
      // toSlug('1,2-Hexanediol') and toSlug('1,3-Butanediol').
      {
        source: '/ingredients/2-hexanediol',
        destination: '/ingredients/1-2-hexanediol',
        permanent: true,
      },
      {
        source: '/ingredients/3-butanediol',
        destination: '/ingredients/1-3-butanediol',
        permanent: true,
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
