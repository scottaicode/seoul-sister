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
          .from('profiles')
          .delete()
          .eq('email', authUser.email)
          .neq('id', authUser.id)

        // Create or update profile with correct auth ID
        const profileData = {
          id: authUser.id,
          email: authUser.email,
          first_name: authUser.email === 'baileydonmartin@gmail.com' ? 'Bailey Don' :
                     authUser.email === 'vibetrendai@gmail.com' ? 'VibeTrend AI' : 'Test',
          last_name: authUser.email === 'baileydonmartin@gmail.com' ? 'Martin' :
                     authUser.email === 'vibetrendai@gmail.com' ? 'Admin' : 'User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          total_savings: 0,
          order_count: 0,
          viral_shares_count: 0
        }

        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
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
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        results.push({
          email,
          auth_id: authUser.id,
          profile_exists: !!profile,
          profile_id_matches: profile?.id === authUser.id,
          first_name: profile?.first_name,
          last_name: profile?.last_name
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
    return NextResponse.json(
      { error: 'Failed to check link status', details: String(error) },
      { status: 500 }
    )
  }
}