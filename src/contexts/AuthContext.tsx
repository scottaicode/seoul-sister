'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { captureAttribution, getAttribution } from '@/lib/attribution'
import { reduceGetSession, reduceAuthEvent } from '@/lib/auth/session-state'

interface AuthContextType {
  user: User | null
  loading: boolean
  // captchaToken (July 28 2026): Cloudflare Turnstile token, forwarded to
  // Supabase so it can verify the caller is human before minting an account or
  // sending mail. Optional so callers that predate the captcha still compile;
  // when Supabase's Bot and Abuse Protection is ON, a missing token is rejected
  // server-side. See src/components/auth/AuthCaptcha.tsx for the full rationale.
  signIn: (email: string, password: string, captchaToken?: string) => Promise<Session | null>
  signUp: (
    email: string,
    password: string,
    captchaToken?: string
  ) => Promise<{ user: User | null; session: Session | null }>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Record first-touch attribution on the visitor's FIRST landing — which is
    // usually long before they create an account. Idempotent; never overwrites
    // an existing first touch; fails silent if localStorage is unavailable.
    captureAttribution()

    let cancelled = false

    // COLD-LAUNCH REFRESH FAILURE IS NOT A LOGOUT (July 29 2026).
    //
    // Bailey: "As soon as I closed everything out and clicked the app it was
    // back to main login page." The July 29 fix pinned persistSession /
    // autoRefreshToken, but those were already the library defaults, so it
    // changed nothing. The DB proved persistence worked: her session
    // 24b13d70 was created 13:57 and successfully REFRESHED at 20:11.
    // She was still shown /login.
    //
    // The real cause is here. On a cold PWA launch the stored access token is
    // usually past the 90s expiry margin, so auth-js refreshes it INLINE
    // inside getSession(). If the network is not up yet — the normal case when
    // iOS restores a home-screen app — that refresh fails with a RETRYABLE
    // AuthRetryableFetchError and getSession() resolves
    // `{ session: null, error }`. auth-js deliberately does NOT delete the
    // stored session for a retryable error, and it recovers on its own via the
    // visibility handler and the 30s refresh tick.
    //
    // But this code read only `session?.user`, discarded `error`, and reported
    // a logged-out user — so AppShell bounced her to /login while valid
    // credentials sat in localStorage. That is why she had FIVE sessions in one
    // day: each bounce made her sign in again instead of reusing the good one.
    //
    // So: a transient network error must leave `user` untouched and keep us in
    // the loading state, never resolve to logged-out. Only a real
    // auth failure (invalid/revoked token — auth-js clears storage and emits
    // SIGNED_OUT) may do that. The two decisions live in
    // src/lib/auth/session-state.ts so the guard tests can execute them.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return

      const outcome = reduceGetSession({ session, error })
      // 'wait' → credentials are still on disk and auth-js is already retrying.
      // Stay on the spinner and let onAuthStateChange deliver the session when
      // the refresh succeeds, rather than showing a login screen to someone who
      // never logged out.
      if (outcome.kind === 'wait') return

      setUser((outcome.user as User | null) ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return

        const outcome = reduceAuthEvent(event, session)
        if (outcome.kind === 'wait') return

        setUser((outcome.user as User | null) ?? null)
        setLoading(false)
      }
    )

    // Backstop: if the network never comes up, we must not spin forever. Give
    // auth-js its retry window (~13s of backoff) plus margin, then fall through
    // to the real session state. If it is still absent, showing /login is
    // correct at that point — we tried.
    const timeout = setTimeout(() => {
      if (cancelled) return
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return
        setUser(session?.user ?? null)
        setLoading(false)
      })
    }, 15000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    })
    if (error) throw error
    return data.session
  }, [])

  const signUp = useCallback(async (email: string, password: string, captchaToken?: string) => {
    // First-touch attribution rides along with account creation. This is the one
    // chokepoint EVERY signup passes through, regardless of which code path
    // later creates the ss_user_profiles row (the Yuri onboarding flow uses a
    // server-side service client and never sees the browser's localStorage).
    // Landing it in auth.users.raw_user_meta_data means it survives to be read
    // server-side, whichever path gets there.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { attribution: getAttribution() ?? undefined }, captchaToken },
    })
    if (error) throw error
    return { user: data.user, session: data.session }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Same attribution payload on the OAuth path, so a Google signup from
        // Bailey's bio link is credited identically to an email signup.
        queryParams: {},
        data: { attribution: getAttribution() ?? undefined },
      } as Parameters<typeof supabase.auth.signInWithOAuth>[0]['options'],
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
