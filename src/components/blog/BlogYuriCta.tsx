'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function BlogYuriCta() {
  const { user } = useAuth()

  const openYuriBubble = () => {
    window.dispatchEvent(new CustomEvent('open-yuri'))
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-gradient-to-r from-amber-500/20 to-rose-500/20 rounded-2xl p-8 text-center border border-amber-500/30">
        <h3 className="font-display font-semibold text-xl text-white mb-2">
          Have a question about this?
        </h3>
        <p className="text-white/60 mb-5">
          {user
            ? 'Yuri has access to our full product database — ingredients, prices, and personalized recommendations for your skin.'
            : 'Get personalized K-beauty advice from Yuri, our AI advisor. 20 free messages, no account needed.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={openYuriBubble}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Ask Yuri
          </button>
          {user && (
            <Link
              href="/yuri"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/20 text-white/70 text-sm font-medium hover:border-amber-500/40 hover:text-white transition-colors"
            >
              Full conversation
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
