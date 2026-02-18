import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Auth Callback Handler
 *
 * Handles redirects from Supabase auth emails:
 * - Email verification (type=signup)
 * - Password recovery (type=recovery)
 * - Magic link login (type=magiclink)
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Password recovery: redirect to a page where they can set new password
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/login?recovered=true', request.url))
      }

      // Email verification: redirect to onboarding or dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Fallback: something went wrong, send to login with error hint
  return NextResponse.redirect(new URL('/login?error=callback_failed', request.url))
}
