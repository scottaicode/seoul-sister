import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get email from query params (passed from client)
    const email = request.nextUrl.searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    // Fetch user profile from user_profiles table using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" - we'll handle that below
      console.error('Failed to fetch user profile:', profileError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // If no profile found, return default profile with email
    if (!profile) {
      return NextResponse.json({
        id: null,
        email: email,
        name: null,
        subscription_status: null,
        trial_end: null,
        current_period_start: null,
        created_at: null,
        updated_at: null
      })
    }

    return NextResponse.json({
      id: profile?.id || null,
      email: profile?.email || email,
      name: profile?.name || null,
      subscription_status: profile?.subscription_status || null,
      trial_end: profile?.trial_end || null,
      current_period_start: profile?.current_period_start || null,
      created_at: profile?.created_at || null,
      updated_at: profile?.updated_at || null
    })

  } catch (error) {
    console.error('User profile API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}