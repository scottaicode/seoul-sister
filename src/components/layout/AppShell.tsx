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

  // Check subscription + onboarding before showing app content.
  // /onboarding and /settings are ALWAYS reachable regardless of plan:
  // onboarding is the pre-paywall value-moment build (Priority 2), and a user
  // must ALWAYS be able to manage and DELETE their account even on the free
  // plan — gating /settings behind the paywall trapped unpaid users with no way
  // to delete their data (a GDPR/CCPA right-to-erasure + trust problem).
  const ALWAYS_ALLOWED = pathname === '/onboarding' || pathname.startsWith('/settings')
  useEffect(() => {
    if (!user || loading || ALWAYS_ALLOWED) {
      setReady(true)
      return
    }

    async function checkAccess() {
      try {
        let { data } = await supabase
          .from('ss_user_profiles')
          .select('plan, onboarding_completed')
          .eq('user_id', user!.id)
          .maybeSingle()

        // WEBHOOK-LAG RETRY (July 21 2026).
        //
        // Stripe redirects the buyer back the instant payment succeeds, but the
        // plan is flipped to paid by the checkout.session.completed WEBHOOK,
        // which arrives out-of-band a moment later. In that window the profile
        // still reads 'free', so a customer who JUST PAID would be bounced to
        // /subscribe and asked to pay again — the single worst experience this
        // funnel can produce, and it lands on the first real customers.
        //
        // /subscribe self-corrects once the webhook lands, so this was never a
        // permanent lock; it was a jarring flash of the paywall at the moment
        // of highest trust. A short bounded re-check absorbs the normal lag.
        // Deliberately NOT optimistic: we never grant access without a real
        // paid plan in the database — we just give the webhook a beat to land.
        if (!data?.plan || data.plan === 'free') {
          for (let attempt = 0; attempt < 3 && (!data?.plan || data.plan === 'free'); attempt++) {
            await new Promise((r) => setTimeout(r, 1200))
            const retry = await supabase
              .from('ss_user_profiles')
              .select('plan, onboarding_completed')
              .eq('user_id', user!.id)
              .maybeSingle()
            data = retry.data
          }
        }

        // Still free after the grace window → genuinely unpaid.
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
  }, [user, loading, pathname, router, ALWAYS_ALLOWED])

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
