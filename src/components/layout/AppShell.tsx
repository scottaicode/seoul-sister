'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Header from './Header'
import BottomNav from './BottomNav'

interface AppShellProps {
  children: React.ReactNode
}

// Public-equivalent fallback routes. When an unauthenticated visitor lands
// on a subscriber-only surface (e.g., shared by a subscriber), route them
// to the public surface that delivers comparable value, preserving query
// params. Better than bouncing every shared URL through /login.
//
// Shipped v10.6.3 (May 18 2026) — Scott explicitly asked for subscriber-
// driven sharing to add value for friends/family even when they're not
// signed in. /browse → /products preserves category/q filters so shared
// filtered views land on the right marketing page.
const SHARED_FALLBACKS: Record<string, string> = {
  '/browse': '/products',
}

export default function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      // If this is a surface with a public equivalent, route there instead
      // of /login so subscriber-shared URLs work for friends/family.
      // Read query string directly from window.location to avoid the
      // useSearchParams Suspense requirement during static prerender.
      const fallback = pathname ? SHARED_FALLBACKS[pathname] : null
      if (fallback) {
        const params =
          typeof window !== 'undefined' ? window.location.search : ''
        router.replace(`${fallback}${params}`)
        return
      }
      router.replace('/login')
    }
  }, [user, loading, router, pathname])

  // Check subscription + onboarding before showing app content
  useEffect(() => {
    if (!user || loading || pathname === '/onboarding') {
      setReady(true)
      return
    }

    async function checkAccess() {
      try {
        const { data } = await supabase
          .from('ss_user_profiles')
          .select('plan, onboarding_completed')
          .eq('user_id', user!.id)
          .maybeSingle()

        // No subscription → redirect to subscribe page
        if (!data?.plan || data.plan === 'free') {
          router.replace('/subscribe')
          return
        }

        // Not onboarded → redirect to onboarding
        if (data && !data.onboarding_completed) {
          router.replace('/onboarding')
          return
        }

        setReady(true)
      } catch {
        // Profile fetch failed — don't block the app
        setReady(true)
      }
    }

    checkAccess()
  }, [user, loading, pathname, router])

  // Show nothing while checking auth or onboarding to prevent flash of protected content
  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-seoul-darker flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-seoul-darker">
      <Header />
      <main className="pt-0 pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
