import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Update email confirmation for development purposes
    const { data, error } = await supabase.auth.admin.updateUserById(
      // First get the user by email
      (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id || '',
      {
        email_confirm: true
      }
    )

    if (error) {
      console.error('Error confirming email:', error)
      return NextResponse.json({ error: 'Failed to confirm email' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Email confirmed successfully',
      user: data.user
    })

  } catch (error) {
    console.error('Error in POST /api/fix-email-confirmation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}