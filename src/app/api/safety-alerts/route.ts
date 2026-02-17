import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const alertType = searchParams.get('type')

    let query = supabase
      .from('ss_safety_alerts')
      .select('*')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })

    if (severity) {
      query = query.eq('severity', severity)
    }
    if (alertType) {
      query = query.eq('alert_type', alertType)
    }

    const { data: alerts, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      alerts: alerts || [],
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// Dismiss an alert for a user
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      throw new AppError('Authentication required', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new AppError('Invalid authentication', 401)
    }

    const body = await request.json()
    if (!body.alert_id) {
      throw new AppError('Missing alert_id', 400)
    }

    const { error } = await supabase
      .from('ss_user_dismissed_alerts')
      .upsert({
        user_id: user.id,
        alert_id: body.alert_id,
      })

    if (error) {
      throw new AppError('Failed to dismiss alert', 500)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
