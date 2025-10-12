import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import AnalyticsTracker from '../components/AnalyticsTracker'
import { AuthProvider } from '../contexts/AuthContext'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'Seoul Sister - Authentic K-Beauty at Seoul Street Prices',
  description: 'Save 40-70% on authentic Korean beauty products. Get the same products sold in Seoul at real Seoul prices, not inflated US retail prices.',
  keywords: 'korean beauty, k-beauty, seoul, skincare, cosmetics, korean products, authentic, discount',
  authors: [{ name: 'Seoul Sister' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#CD2E3A',
  openGraph: {
    title: 'Seoul Sister - Authentic K-Beauty at Seoul Street Prices',
    description: 'Save 40-70% on authentic Korean beauty products. Expose the beauty industry price gouging.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seoul Sister - K-Beauty at Real Seoul Prices',
    description: 'Save 40-70% on authentic Korean beauty products',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'GA_MEASUREMENT_ID', {
                page_title: 'Seoul Sister - K-Beauty Revolution',
                custom_map: {'custom_parameter_1': 'viral_mechanism'}
              });
            `,
          }}
        />
      </head>
      <body className="antialiased bg-white text-gray-900">
        <AuthProvider>
          <AnalyticsTracker />
          <div className="min-h-screen">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}