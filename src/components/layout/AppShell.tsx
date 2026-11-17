'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { loginUrlFor } from '@/lib/auth/return-to'
import { appGateDestination } from '@/lib/auth/post-sign-in'
import TrialNotice from './TrialNotice'
import Header from './Header'
import SetupHeader from './SetupHeader'
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

/**
 * Tell the server this device's timezone, once per browser session. The server
 * only stores it when the profile has none (see /api/me/timezone): weekly
 * check-ins need it to know the member's Sunday. Never blocks or throws.
 */
async function reportTimezoneOnce(): Promise<void> {
  try {
    if (sessionStorage.getItem('ss_tz_reported')) return
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!timezone) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const res = await fetch('/api/me/timezone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timezone }),
    })
    if (res.ok) sessionStorage.setItem('ss_tz_reported', '1')
    else console.error('[app shell] timezone not recorded:', res.status)
  } catch (err) {
    console.error('[app shell] timezone not recorded:', err)
  }
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
      // Carry where they were going (e.g. a check-in email's /yuri?ask=...)
      // through sign-in, instead of dropping them on /dashboard after login.
      router.replace(loginUrlFor(pathname, typeof window !== 'undefined' ? window.location.search : ''))
    }
  }, [user, loading, router, pathname])

  // Check subscription + onboarding before showing app content.
  // /onboarding and /settings are ALWAYS reachable regardless of plan:
  // onboarding is the pre-paywall value-moment build (Priority 2), and a user
  // must ALWAYS be able to manage and DELETE their account even on the free
  // plan — gating /settings behind the paywall trapped unpaid users with no way
  // to delete their data (a GDPR/CCPA right-to-erasure + trust problem).
  const ALWAYS_ALLOWED = pathname === '/onboarding' || pathname.startsWith('/settings')
  // Settings is open to everyone (log out, delete the account), but the member
  // menu is not: for someone who is not a member every item in it bounces.
  // Bailey, on a new account, Nov 16 2026: "All these options need to just
  // disappear if they aren't gonna work before the membership." null = unread.
  // The question is whether the member menu WORKS for this account: the same
  // gate that guards every member page decides (a non-member is sent to
  // membership, and anyone still in setup, member or not, back to the setup
  // chat). First asked only "is this a member?", and a new member in their
  // free week, mid-setup, still got a menu that bounced (seen in a browser the
  // same day). null = unread.
  const [menuWorks, setMenuWorks] = useState<boolean | null>(null)
  const onSettings = pathname.startsWith('/settings')
  useEffect(() => {
    if (!user || !onSettings) return
    let live = true
    Promise.all([
      supabase.from('ss_user_profiles').select('plan, onboarding_completed').eq('user_id', user.id).maybeSingle(),
      supabase.from('ss_onboarding_progress').select('onboarding_status').eq('user_id', user.id).maybeSingle(),
    ]).then(([profileRes, progressRes]) => {
      if (!live) return
      // A failed profile read shows the member menu, as before this check
      // existed: a member must not lose their menu to a read error. Until the
      // read answers, the plain header shows.
      if (profileRes.error) return setMenuWorks(true)
      const setupStatus = progressRes.error ? undefined : (progressRes.data?.onboarding_status ?? null)
      setMenuWorks(appGateDestination(profileRes.data, setupStatus) === null)
    })
    return () => { live = false }
  }, [user, onSettings])
  const inSetup = pathname === '/onboarding'
  const plainHeader = inSetup || (onSettings && menuWorks !== true)
  useEffect(() => {
    if (!user || loading || ALWAYS_ALLOWED) {
      setReady(true)
      return
    }

    async function checkAccess() {
      try {
        const readProfile = () =>
          supabase
            .from('ss_user_profiles')
            .select('plan, onboarding_completed')
            .eq('user_id', user!.id)
            .maybeSingle()
        const [profileRes, progressRes] = await Promise.all([
          readProfile(),
          supabase
            .from('ss_onboarding_progress')
            .select('onboarding_status')
            .eq('user_id', user!.id)
            .maybeSingle(),
        ])
        // A failed read is not "no profile". Treating it as one would send a
        // member to the setup chat, which sends a finished setup straight back
        // here. Let them in; every member API checks the plan on the server.
        if (profileRes.error) {
          console.error('[app shell] profile read failed; not gating this page:', profileRes.error.message)
          setReady(true)
          return
        }
        if (progressRes.error) {
          console.error('[app shell] setup status read failed; gating on the profile alone:', progressRes.error.message)
        }
        // undefined = could not be read; null = no setup row yet.
        const setupStatus = progressRes.error ? undefined : (progressRes.data?.onboarding_status ?? null)
        let data = profileRes.data
        let destination = appGateDestination(data, setupStatus)

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
        // Only an account headed for the pricing page waits; one still in
        // setup goes back to the setup chat at once.
        for (let attempt = 0; attempt < 3 && destination === '/subscribe'; attempt++) {
          await new Promise((r) => setTimeout(r, 1200))
          const retry = await readProfile()
          if (!retry.error) {
            data = retry.data
            destination = appGateDestination(data, setupStatus)
          }
        }

        if (destination) {
          router.replace(destination)
          return
        }

        setReady(true)
        void reportTimezoneOnce()
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
      {/* During the setup chat no member page is open yet, so the member menu
          is not shown: its buttons could only bounce back here. */}
      {plainHeader ? <SetupHeader backToSetup={!inSetup} /> : <Header />}
      <TrialNotice />
      <main className={plainHeader ? 'pt-0' : 'pt-0 pb-20 md:pb-0'}>
        {children}
      </main>
      {!plainHeader && <BottomNav />}
    </div>
  )
}
