import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Define bypass users
    const bypassUsers = [
      {
        id: 'admin-bailey-bypass-001',
        email: 'baileydonmartin@gmail.com',
        name: 'Bailey Don Martin',
        subscription_status: 'bypass_admin',
        bypass_subscription: true
      },
      {
        id: 'admin-vibetrend-bypass-002',
        email: 'vibetrendai@gmail.com',
        name: 'VibeTrend AI Admin',
        subscription_status: 'bypass_admin',
        bypass_subscription: true
      },
      {
        id: 'test-user-bypass-003',
        email: 'test@email.com',
        name: 'Test User',
        subscription_status: 'bypass_test',
        bypass_subscription: true
      }
    ]

    const results = []

    for (const user of bypassUsers) {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', user.email)
        .single()

      if (existingUser) {
        // User already exists, skip
        results.push({ email: user.email, status: 'exists', data: existingUser })
      } else {
        // Create new user with only valid fields
        const { data: newUser, error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            total_savings: 0,
            order_count: 0,
            viral_shares_count: 0
          } as any)
          .select()
          .single()

        if (error) {
          results.push({ email: user.email, status: 'error', error: error.message })
        } else {
          results.push({ email: user.email, status: 'created', data: newUser })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bypass users processed successfully',
      results
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create bypass users', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint to check existing bypass users
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: bypassUsers, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      bypassUsers: bypassUsers || [],
      count: bypassUsers?.length || 0
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bypass users', details: String(error) },
      { status: 500 }
    )
  }
}