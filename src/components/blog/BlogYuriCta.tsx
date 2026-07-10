'use client'

import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  const openYuri = () => {
    trackEvent(BlogEvent.ctaClick, { placement: 'hero_cta', authed: !!user })
    if (user) {
      router.push('/yuri')
    } else {
      // Route the visitor to the LANDING hero widget (the big, immersive Yuri
      // surface) with their implied question prefilled, instead of the small
      // corner bubble. Single-front-door funnel: every "Ask Yuri" leads to the
      // one conversion surface. Yuri answers freely from there (AI-First).
      const prefill = buildBlogPrefill({ title, category, primaryKeyword })
      router.push(`/?ask=${encodeURIComponent(prefill)}&from=blog`)
    }
  }

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
          <button
            onClick={openYuri}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {user ? 'Open Yuri' : 'Ask Yuri about this'}
          </button>
        </div>
      </div>
    </div>
  )
}
