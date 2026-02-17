import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
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
  themeColor: '#D4A574',
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
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Seoul Sister" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#D4A574" />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
