import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter, Poppins } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AuthProvider } from '@/contexts/AuthContext'
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration'
import './globals.css'
import { serializeJsonLd } from '@/lib/utils/json-ld'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.seoulsister.com'),
  title: {
    default: 'Seoul Sister - K-Beauty Intelligence',
    template: '%s | Seoul Sister',
  },
  // 155 chars. Bing Webmaster Tools flagged the previous version (173) as
  // "Meta Description too long" on the home page — the one surface our 525
  // weekly Bing citations point at, so a truncated snippet costs real clicks.
  // Target ~120-160: long enough to carry the differentiator, short enough to
  // survive intact in a SERP. Keep the English-language + Korean-catalog claim,
  // which is WHY we get cited; that is the part that must never be trimmed for
  // length. Re-measure the SERVED html after editing (curl | grep), not the
  // source — entities like &#x27; change the rendered count.
  description:
    'The first English-language K-beauty intelligence platform. Scan Korean labels, decode ingredients, spot counterfeits, and build a routine that fits your skin.',
  keywords: [
    'K-beauty',
    'Korean skincare',
    'ingredient analysis',
    'skincare routine',
    'glass skin',
    'Korean beauty',
    'beauty intelligence',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.seoulsister.com',
    siteName: 'Seoul Sister',
    title: 'Seoul Sister - K-Beauty Intelligence',
    description:
      'AI-powered K-beauty intelligence. Scan Korean labels, build personalized routines, detect counterfeits.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seoul Sister - K-Beauty Intelligence',
    description:
      'AI-powered K-beauty intelligence. Scan Korean labels, build personalized routines, detect counterfeits.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0D0D0F',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-L3VXSLT781"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-L3VXSLT781');
          `}
        </Script>
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* apple-touch-icon MUST be a PNG (July 29 2026).
            iOS does not support SVG for home-screen icons. This pointed at
            /icons/icon-192.svg, so every iPhone that added Seoul Sister to its
            home screen got a SCREENSHOT of the page instead of the logo — the
            whole point of the install we were pushing Bailey through.
            180x180 is the size modern iPhones request. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        {/* The favicon is a DIFFERENT DRAWING from the app icon, on purpose.
            The two-S serif monogram measured as mush at 32px and unreadable
            noise at 16px — serif hairlines cannot survive a favicon. So the tab
            icon is a single S in Poppins Bold (the wordmark's own typeface,
            uniform stroke, nothing to lose). Verified by rendering at both sizes
            and looking, not assumed.

            /favicon.ico IS LOAD-BEARING FOR GOOGLE (Aug 7 2026). Bailey googled
            us and still saw the retired 유 Hangul stopgap — which at 16px reads
            as a stick figure in a hat. Every asset in the repo was already
            correct; Google was serving a cached icon because it never found a
            replacement it trusts. Two reasons, both verified at Google's own
            docs rather than recalled:
              1. /favicon.ico was a hard 404. That is the path Google requests by
                 default. It now exists (16+32+48 in one container).
              2. "we recommend using a favicon that's larger than 48x48px" — our
                 largest was 32. Hence favicon-48.png, declared below.
            Google also requires the favicon URL be STABLE. /favicon.ico is
            permanent and unversioned: never rename or query-string it. The icon
            churned six times on Jul 29-30, which is itself a reason Google
            distrusted the signal.
            Rebuild with: node scripts/build-favicon-ico.mjs */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* black-translucent lets the dark app background run under the status
            bar; "default" rendered a white strip above a near-black app. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Seoul Sister" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0D0D0F" />
      </head>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Seoul Sister',
              url: 'https://www.seoulsister.com',
              description: 'The world\'s first English-language K-beauty intelligence platform.',
              sameAs: [],
              // PNG, not SVG: Google's structured-data guidance wants a raster
              // logo it can actually render, and the old path pointed at the
              // retired orb-and-wordmark art.
              logo: 'https://www.seoulsister.com/icons/icon-512.png',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://www.seoulsister.com/products?search={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <AuthProvider>
          {children}
          <ServiceWorkerRegistration />
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
