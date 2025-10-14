import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    // Get all auth users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
    const bypassEmails = ['baileydonmartin@gmail.com', 'vibetrendai@gmail.com', 'test@email.com']

    const authUsers = authData.users.filter(user =>
      bypassEmails.includes(user.email || '')
    )

    const results = []

    for (const authUser of authUsers) {
      try {
        // Delete old profile record if it exists (with different ID)
        await supabaseAdmin
          .from('user_profiles')
          .delete()
          .eq('email', authUser.email)
          .neq('id', authUser.id)

        // Create or update profile with correct auth ID
        const profileData = {
          id: authUser.id,
          email: authUser.email,
          name: authUser.email === 'baileydonmartin@gmail.com' ? 'Bailey Don Martin' :
                authUser.email === 'vibetrendai@gmail.com' ? 'VibeTrend AI Admin' : 'Test User',
          subscription_status: authUser.email === 'test@email.com' ? 'bypass_test' : 'bypass_admin',
          bypass_subscription: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: profile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .upsert(profileData)
          .select()
          .single()

        if (profileError) {
          results.push({
            email: authUser.email,
            auth_id: authUser.id,
            status: 'error',
            error: profileError.message
          })
        } else {
          results.push({
            email: authUser.email,
            auth_id: authUser.id,
            profile_id: profile.id,
            status: 'success'
          })
        }

      } catch (error) {
        results.push({
          email: authUser.email,
          auth_id: authUser.id,
          status: 'error',
          error: String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Auth profiles linked successfully',
      results
    })

  } catch (error) {
    console.error('Error linking auth profiles:', error)
    return NextResponse.json(
      { error: 'Failed to link auth profiles', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint to check linking status
export async function GET() {
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
    const bypassEmails = ['baileydonmartin@gmail.com', 'vibetrendai@gmail.com', 'test@email.com']

    const results = []

    for (const email of bypassEmails) {
      const authUser = authData.users.find(u => u.email === email)

      if (authUser) {
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        results.push({
          email,
          auth_id: authUser.id,
          profile_exists: !!profile,
          profile_id_matches: profile?.id === authUser.id,
          bypass_status: profile?.bypass_subscription,
          subscription_status: profile?.subscription_status
        })
      } else {
        results.push({
          email,
          auth_exists: false
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Error checking link status:', error)
    return NextResponse.json(
      { error: 'Failed to check link status', details: String(error) },
      { status: 500 }
    )
  }
}