'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function IngredientsNav() {
  const { user } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/icons/icon-512.svg"
            alt="Seoul Sister"
            className="h-8 w-8"
          />
          <span className="font-display font-semibold text-white text-sm hidden sm:inline">
            Seoul Sister
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href={user ? '/dashboard' : '/'}
            className="text-white/60 hover:text-gold transition-colors text-sm font-medium"
          >
            {user ? 'Dashboard' : 'Home'}
          </Link>
          <Link
            href="/ingredients"
            className="text-gold font-medium text-sm"
          >
            Ingredients
          </Link>
        </div>
      </div>
    </nav>
  )
}
