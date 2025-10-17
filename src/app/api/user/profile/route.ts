import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface UserProfile {
  id: string
  email: string
  name: string | null
  subscription_status: string | null
  trial_end: string | null
  current_period_start: string | null
  created_at: string
  updated_at: string
}

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
      .select('id, email, name, subscription_status, trial_end, current_period_start, created_at, updated_at')
      .eq('email', email)
      .single() as { data: UserProfile | null, error: any }

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
      id: profile.id,
      email: profile.email,
      name: profile.name,
      subscription_status: profile.subscription_status,
      trial_end: profile.trial_end,
      current_period_start: profile.current_period_start,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    })

  } catch (error) {
    console.error('User profile API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}