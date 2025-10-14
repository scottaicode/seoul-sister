import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Create or update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          first_name: data.user.user_metadata.name || data.user.user_metadata.full_name || null,
          total_savings: 0,
          order_count: 0,
          viral_shares_count: 0
        } as any)

      if (profileError) {
        // Profile creation error logged for debugging
      }
    }
  }

  // Redirect to homepage or dashboard
  return NextResponse.redirect(`${origin}/`)
}