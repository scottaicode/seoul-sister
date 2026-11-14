'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { postSignInDestination } from '@/lib/auth/post-sign-in'
import { afterSignIn, RETURN_TO_STORAGE_KEY } from '@/lib/auth/return-to'
import { oauthSignupMetadata } from '@/lib/auth/oauth-signup-source'
import { getAttribution } from '@/lib/attribution'
import { readSignupFrom } from '@/lib/landing-chat'
import { getExistingVisitorId } from '@/lib/utils/widget-session'
import type { User } from '@supabase/supabase-js'

/**
 * OAuth Callback Page (Client-Side)
 *
 * Supabase sends OAuth tokens as URL hash fragments (#access_token=...).
 * The browser-side Supabase client automatically picks these up via
 * onAuthStateChange. This page waits for the session, then checks the
 * user's subscription status and redirects accordingly.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      try {
        // The Supabase client automatically exchanges the hash fragment
        // for a session. Wait for it to be available.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Auth callback session error:', sessionError)
          setError('Authentication failed. Please try again.')
          setTimeout(() => router.replace('/login'), 2000)
          return
        }

        if (!session) {
          // No session yet — listen for auth state change
          // The timeout must be cleared on success: left running, it fired 10s
          // after a good sign-in and sent the user (by then mid-onboarding)
          // to /login.
          let timeoutId: ReturnType<typeof setTimeout> | undefined
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
              if (event === 'SIGNED_IN' && newSession) {
                clearTimeout(timeoutId)
                subscription.unsubscribe()
                await recordSignupSource(newSession.user)
                await redirectBasedOnProfile(newSession.user.id)
              }
            }
          )

          // Timeout after 10 seconds
          timeoutId = setTimeout(() => {
            subscription.unsubscribe()
            setError('Authentication timed out. Please try again.')
            setTimeout(() => router.replace('/login'), 2000)
          }, 10000)
          return
        }

        // Session exists — redirect based on profile
        await recordSignupSource(session.user)
        await redirectBasedOnProfile(session.user.id)
      } catch (err) {
        console.error('Auth callback error:', err)
        setError('Something went wrong. Redirecting to login...')
        setTimeout(() => router.replace('/login'), 2000)
      }
    }

    // A new Google account gets the same three source facts an email sign-up
    // carries. Measurement never blocks sign-in: a failure is logged and the
    // person carries on.
    async function recordSignupSource(user: User) {
      try {
        let signupFrom: string | undefined
        try {
          signupFrom = readSignupFrom(window.sessionStorage)
        } catch {
          signupFrom = undefined
        }
        const data = oauthSignupMetadata(
          user,
          { attribution: getAttribution(), widgetVisitorId: getExistingVisitorId(), signupFrom },
          Date.now()
        )
        if (!data) return
        const { error: updateError } = await supabase.auth.updateUser({ data })
        if (updateError) console.error('[auth/callback] could not record sign-up source:', updateError.message)
      } catch (err) {
        console.error('[auth/callback] could not record sign-up source:', err)
      }
    }

    async function redirectBasedOnProfile(userId: string) {
      const { data: profile } = await supabase
        .from('ss_user_profiles')
        .select('plan, onboarding_completed')
        .eq('user_id', userId)
        .maybeSingle()

      // Where they were going before Google sign-in (stashed by /login), if any.
      let next: string | null = null
      try {
        next = sessionStorage.getItem(RETURN_TO_STORAGE_KEY)
        sessionStorage.removeItem(RETURN_TO_STORAGE_KEY)
      } catch {
        next = null
      }
      router.replace(afterSignIn(postSignInDestination(profile), next))
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <>
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Setting up your account...</p>
        </>
      )}
    </div>
  )
}
