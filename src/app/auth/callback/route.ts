import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Auth Callback Handler
 *
 * Handles redirects from:
 * - Email verification (type=signup)
 * - Password recovery (type=recovery)
 * - OAuth providers (Google, etc.)
 *
 * Supabase sends users here with a `code` query param that gets
 * exchanged for a session via PKCE flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Password recovery: redirect to login with recovery flag
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/login?recovered=true', request.url))
      }

      // Check if user already has a profile with subscription + onboarding
      // This handles returning OAuth users who don't need to go through subscribe again
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: profile } = await serviceClient
        .from('ss_user_profiles')
        .select('plan, onboarding_completed')
        .eq('user_id', data.session.user.id)
        .maybeSingle()

      if (profile?.plan && profile.plan !== 'free') {
        // Existing subscriber -- send to onboarding or dashboard
        return NextResponse.redirect(
          new URL(profile.onboarding_completed ? '/dashboard' : '/onboarding', request.url)
        )
      }

      // New user or free plan -- send to subscribe for payment
      return NextResponse.redirect(new URL('/subscribe', request.url))
    }
  }

  // Fallback: something went wrong
  return NextResponse.redirect(new URL('/login?error=callback_failed', request.url))
}
