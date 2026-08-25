'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { buildBlogPrefill } from './blog-prefill'
import { trackEvent, BlogEvent } from '@/lib/analytics'

interface BlogYuriCtaProps {
  title?: string | null
  category?: string | null
  primaryKeyword?: string | null
}

export default function BlogYuriCta({ title, category, primaryKeyword }: BlogYuriCtaProps) {
  const { user } = useAuth()

  // A real <Link href>, not a router.push in an onClick.
  //
  // Measured Aug 25 2026: this CTA shipped ZERO `?ask=` links in the delivered
  // HTML, because navigation lived in a click handler. Blog posts take ~70% of
  // Google clicks, so the pages that earn the traffic had no crawlable,
  // ask-carrying link to the one conversion surface — no internal link equity
  // reached `/`, and an AI crawler reading this page saw the offer text ("Start
  // a free chat right now") with no destination to cite. `/best/*` and
  // `/ingredients/*` already shipped real anchors; blog was the anomaly.
  //
  // Single-front-door funnel: every "Ask Yuri" leads to the LANDING hero
  // widget with the implied question prefilled. Yuri answers freely from there
  // (AI-First). The widget is never embedded on this page — that was
  // consolidated away June 29 2026.
  //
  // The href SWAPS on auth rather than calling preventDefault: `useAuth` starts
  // null and resolves in an effect, so server HTML and first client render are
  // both the anonymous shape (no hydration mismatch), and middle-click /
  // cmd-click keep working. A signed-in visitor landing on `/?ask=` is already
  // blessed behaviour — `SignedInRedirect` deliberately does NOT bounce them
  // off `/` when `ask`/`from` is present.
  const prefill = buildBlogPrefill({ title, category, primaryKeyword })
  const href = user ? '/yuri' : `/?ask=${encodeURIComponent(prefill)}&from=blog`

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-gradient-to-r from-amber-500/20 to-rose-500/20 rounded-2xl p-8 text-center border border-amber-500/30">
        <h3 className="font-display font-semibold text-xl text-white mb-2">
          Still not sure what&apos;s right for your skin?
        </h3>
        <p className="text-white/60 mb-5">
          {user
            ? 'Yuri has access to our full product database: ingredients, prices, and personalized recommendations for your skin.'
            : 'Yuri builds your routine, tells you what is worth your money, and tracks your skin as it changes. Start a free chat right now, no account needed. She just gets sharper once she really knows you.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={href}
            onClick={() => trackEvent(BlogEvent.ctaClick, { placement: 'hero_cta', authed: !!user })}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {user ? 'Open Yuri' : 'Ask Yuri about this'}
          </Link>
        </div>
      </div>
    </div>
  )
}
