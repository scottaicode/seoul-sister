import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface AlertConfig {
  id?: string
  userId: string
  alertType: 'new_content' | 'hashtag_trend' | 'engagement_threshold' | 'korean_beauty_term'
  targetValue: string // Handle, hashtag, term, or threshold number
  threshold?: number // For engagement alerts
  isActive: boolean
  email: string
  createdAt?: string
  lastTriggered?: string
}

interface AlertTrigger {
  contentId: string
  alertId: string
  triggerReason: string
  triggerValue: number | string
  triggeredAt: string
}

// GET /api/intelligence/alerts - Get user's alert configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get user's alert configurations
    const { data: alerts, error: alertsError } = await (supabaseAdmin as any)
      .from('intelligence_alerts')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })

    if (alertsError) {
      console.error('Failed to fetch alerts:', alertsError)
      return NextResponse.json({
        error: 'Failed to fetch alert configurations',
        details: alertsError.message
      }, { status: 500 })
    }

    // Get recent alert triggers for this user
    const { data: triggers, error: triggersError } = await (supabaseAdmin as any)
      .from('intelligence_alert_triggers')
      .select(`
        *,
        intelligence_alerts!inner(email)
      `)
      .eq('intelligence_alerts.email', email)
      .order('triggered_at', { ascending: false })
      .limit(50)

    if (triggersError) {
      console.warn('Failed to fetch alert triggers:', triggersError)
    }

    return NextResponse.json({
      success: true,
      alerts: alerts || [],
      recentTriggers: triggers || [],
      totalAlerts: alerts?.length || 0,
      activeAlerts: alerts?.filter((a: any) => a.is_active).length || 0
    })

  } catch (error) {
    console.error('❌ Get alerts failed:', error)
    return NextResponse.json({
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST /api/intelligence/alerts - Create new alert configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, alertType, targetValue, threshold, isActive = true } = body

    if (!email || !alertType || !targetValue) {
      return NextResponse.json({
        error: 'Email, alertType, and targetValue are required',
        example: {
          email: 'user@example.com',
          alertType: 'new_content',
          targetValue: 'ponysmakeup',
          threshold: 10000, // optional, for engagement alerts
          isActive: true
        }
      }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Check if alert already exists
    const { data: existingAlert } = await (supabaseAdmin as any)
      .from('intelligence_alerts')
      .select('id')
      .eq('email', email)
      .eq('alert_type', alertType)
      .eq('target_value', targetValue)
      .single()

    if (existingAlert) {
      return NextResponse.json({
        error: 'Alert configuration already exists',
        suggestion: 'Use PUT to update existing alert'
      }, { status: 409 })
    }

    // Create new alert
    const { data: newAlert, error: insertError } = await (supabaseAdmin as any)
      .from('intelligence_alerts')
      .insert([{
        user_id: email, // Using email as user_id for now
        email,
        alert_type: alertType,
        target_value: targetValue,
        threshold: threshold || null,
        is_active: isActive
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create alert:', insertError)
      return NextResponse.json({
        error: 'Failed to create alert',
        details: insertError.message
      }, { status: 500 })
    }

    console.log(`✅ Created new alert: ${alertType} for ${targetValue} (${email})`)

    return NextResponse.json({
      success: true,
      message: 'Alert configuration created successfully',
      alert: newAlert
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Create alert failed:', error)
    return NextResponse.json({
      error: 'Failed to create alert',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// PUT /api/intelligence/alerts - Update alert configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, email, alertType, targetValue, threshold, isActive } = body

    if (!id || !email) {
      return NextResponse.json({
        error: 'Alert ID and email are required'
      }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Verify ownership
    const { data: existingAlert, error: checkError } = await (supabaseAdmin as any)
      .from('intelligence_alerts')
      .select('*')
      .eq('id', id)
      .eq('email', email)
      .single()

    if (checkError || !existingAlert) {
      return NextResponse.json({
        error: 'Alert not found or access denied'
      }, { status: 404 })
    }

    // Build update object
    const updateData: any = {}
    if (alertType !== undefined) updateData.alert_type = alertType
    if (targetValue !== undefined) updateData.target_value = targetValue
    if (threshold !== undefined) updateData.threshold = threshold
    if (isActive !== undefined) updateData.is_active = isActive

    // Update alert
    const { data: updatedAlert, error: updateError } = await (supabaseAdmin as any)
      .from('intelligence_alerts')
      .update(updateData)
      .eq('id', id)
      .eq('email', email)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update alert:', updateError)
      return NextResponse.json({
        error: 'Failed to update alert',
        details: updateError.message
      }, { status: 500 })
    }

    console.log(`✅ Updated alert ${id}: ${alertType} for ${targetValue}`)

    return NextResponse.json({
      success: true,
      message: 'Alert configuration updated successfully',
      alert: updatedAlert
    })

  } catch (error) {
    console.error('❌ Update alert failed:', error)
    return NextResponse.json({
      error: 'Failed to update alert',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// DELETE /api/intelligence/alerts - Delete alert configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const email = searchParams.get('email')

    if (!id || !email) {
      return NextResponse.json({
        error: 'Alert ID and email are required'
      }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Delete alert (with ownership check)
    const { error: deleteError } = await (supabaseAdmin as any)
      .from('intelligence_alerts')
      .delete()
      .eq('id', id)
      .eq('email', email)

    if (deleteError) {
      console.error('Failed to delete alert:', deleteError)
      return NextResponse.json({
        error: 'Failed to delete alert',
        details: deleteError.message
      }, { status: 500 })
    }

    console.log(`✅ Deleted alert ${id} for ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Alert configuration deleted successfully'
    })

  } catch (error) {
    console.error('❌ Delete alert failed:', error)
    return NextResponse.json({
      error: 'Failed to delete alert',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}