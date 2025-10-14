import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

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
        .from('user_profiles')
        .select('id, email')
        .eq('email', user.email)
        .single()

      if (existingUser) {
        // Update existing user
        const { data: updatedUser, error } = await supabase
          .from('user_profiles')
          .update({
            subscription_status: user.subscription_status,
            bypass_subscription: user.bypass_subscription,
            updated_at: new Date().toISOString()
          })
          .eq('email', user.email)
          .select()
          .single()

        if (error) {
          console.error(`Error updating user ${user.email}:`, error)
          results.push({ email: user.email, status: 'error', error: error.message })
        } else {
          results.push({ email: user.email, status: 'updated', data: updatedUser })
        }
      } else {
        // Create new user
        const { data: newUser, error } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            name: user.name,
            subscription_status: user.subscription_status,
            bypass_subscription: user.bypass_subscription,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          console.error(`Error creating user ${user.email}:`, error)
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
    console.error('Error creating bypass users:', error)
    return NextResponse.json(
      { error: 'Failed to create bypass users', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint to check existing bypass users
export async function GET() {
  try {
    const supabase = createClient()

    const { data: bypassUsers, error } = await supabase
      .from('user_profiles')
      .select('id, email, name, subscription_status, bypass_subscription, created_at, updated_at')
      .or('bypass_subscription.eq.true,subscription_status.eq.bypass_admin,subscription_status.eq.bypass_test')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      bypassUsers: bypassUsers || [],
      count: bypassUsers?.length || 0
    })

  } catch (error) {
    console.error('Error fetching bypass users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bypass users', details: String(error) },
      { status: 500 }
    )
  }
}