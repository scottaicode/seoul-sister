'use client'

import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { buildBlogPrefill } from './blog-prefill'

interface BlogYuriCtaProps {
  title?: string | null
  category?: string | null
  primaryKeyword?: string | null
}

export default function BlogYuriCta({ title, category, primaryKeyword }: BlogYuriCtaProps) {
  const { user } = useAuth()
  const router = useRouter()

  const openYuri = () => {
    if (user) {
      router.push('/yuri')
    } else {
      // Carry the visitor's implied question into the widget so they land in a
      // warm, in-progress conversation instead of a blank box. Yuri answers freely.
      const prefill = buildBlogPrefill({ title, category, primaryKeyword })
      window.dispatchEvent(new CustomEvent('open-yuri', { detail: { prefill } }))
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
            ? 'Yuri has access to our full product database — ingredients, prices, and personalized recommendations for your skin.'
            : 'Ask Yuri. She reads your labels, spots the fakes, and tells you what actually works for your skin — free, no account needed.'}
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
