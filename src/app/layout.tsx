import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import './globals.css'

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
  title: {
    default: 'Seoul Sister - K-Beauty Intelligence',
    template: '%s | Seoul Sister',
  },
  description:
    'The world\'s first English-language K-beauty intelligence platform. AI-powered label scanning, routine building, counterfeit detection, and personalized skincare advice.',
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
    url: 'https://seoulsister.com',
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
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Seoul Sister" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0D0D0F" />
      </head>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Seoul Sister',
              url: 'https://seoulsister.com',
              description: 'The world\'s first English-language K-beauty intelligence platform.',
              sameAs: [],
              logo: 'https://seoulsister.com/icons/icon-512.svg',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://seoulsister.com/products?search={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <AuthProvider>
          {children}
          <ServiceWorkerRegistration />
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  )
}
