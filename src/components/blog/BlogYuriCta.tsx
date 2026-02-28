'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function BlogYuriCta() {
  const { user } = useAuth()

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-gradient-to-r from-amber-500/20 to-rose-500/20 rounded-2xl p-8 text-center border border-amber-500/30">
        <h3 className="font-display font-semibold text-xl text-white mb-2">
          Want personalized K-beauty advice?
        </h3>
        <p className="text-white/60 mb-4">
          {user
            ? 'Chat with Yuri, your AI beauty advisor, for recommendations tailored to your skin.'
            : 'Sign up to chat with Yuri, our AI beauty advisor, for recommendations tailored to your skin.'}
        </p>
        <Link
          href={user ? '/yuri' : '/register'}
          className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors"
        >
          {user ? 'Talk to Yuri' : 'Get Started Free'}
        </Link>
      </div>
    </div>
  )
}
