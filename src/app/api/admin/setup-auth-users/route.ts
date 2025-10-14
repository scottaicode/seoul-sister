import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin Supabase client with service role key for user creation
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
    // Define bypass users with passwords
    const authUsers = [
      {
        email: 'baileydonmartin@gmail.com',
        password: 'pre1999',
        name: 'Bailey Don Martin',
        subscription_status: 'bypass_admin',
        bypass_subscription: true
      },
      {
        email: 'vibetrendai@gmail.com',
        password: 'ariastar',
        name: 'VibeTrend AI Admin',
        subscription_status: 'bypass_admin',
        bypass_subscription: true
      },
      {
        email: 'test@email.com',
        password: 'test',
        name: 'Test User',
        subscription_status: 'bypass_test',
        bypass_subscription: true
      }
    ]

    const results = []

    for (const user of authUsers) {
      try {
        // Check if auth user already exists
        const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existingAuthUsers.users.find(u => u.email === user.email)

        if (existingUser) {
          results.push({
            email: user.email,
            status: 'auth_exists',
            auth_id: existingUser.id,
            message: 'Auth user already exists'
          })
          continue
        }

        // Create auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true
        })

        if (authError) {
          results.push({
            email: user.email,
            status: 'error',
            error: authError.message
          })
          continue
        }

        // Update or create user profile with auth ID
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authUser.user.id,
            email: user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            total_savings: 0,
            order_count: 0,
            viral_shares_count: 0
          })
          .select()
          .single()

        if (profileError) {
          results.push({
            email: user.email,
            status: 'auth_created_profile_error',
            auth_id: authUser.user.id,
            error: profileError.message
          })
        } else {
          results.push({
            email: user.email,
            status: 'success',
            auth_id: authUser.user.id,
            profile_id: profile.id
          })
        }

      } catch (error) {
        results.push({
          email: user.email,
          status: 'error',
          error: String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bypass auth users setup completed',
      results
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to setup auth users', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint to check auth users status
export async function GET() {
  try {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const bypassEmails = ['baileydonmartin@gmail.com', 'vibetrendai@gmail.com', 'test@email.com']

    const bypassAuthUsers = authUsers.users.filter(user =>
      bypassEmails.includes(user.email || '')
    )

    // Get corresponding profiles
    const profiles = []
    for (const authUser of bypassAuthUsers) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      profiles.push({
        auth_id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        profile: profile
      })
    }

    return NextResponse.json({
      success: true,
      authUsers: profiles,
      count: profiles.length
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch auth users', details: String(error) },
      { status: 500 }
    )
  }
}