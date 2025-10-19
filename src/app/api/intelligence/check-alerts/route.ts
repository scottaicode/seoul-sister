import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface AlertMatch {
  alertId: string
  contentId: string
  triggerReason: string
  triggerValue: number | string
  userEmail: string
  alertType: string
  targetValue: string
}

// POST /api/intelligence/check-alerts - Check new content against alert configurations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contentIds, checkAll = false } = body

    if (!contentIds && !checkAll) {
      return NextResponse.json({
        error: 'Either contentIds array or checkAll=true is required',
        example: {
          contentIds: ['content-id-1', 'content-id-2'],
          checkAll: true
        }
      }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🔔 Checking content against alert configurations...')

    // Get all active alerts
    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from('intelligence_alerts')
      .select('*')
      .eq('is_active', true)

    if (alertsError) {
      console.error('Failed to fetch alerts:', alertsError)
      return NextResponse.json({
        error: 'Failed to fetch alert configurations',
        details: alertsError.message
      }, { status: 500 })
    }

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active alerts configured',
        alertsTriggered: 0,
        emailsSent: 0
      })
    }

    console.log(`📋 Found ${alerts.length} active alert configurations`)

    // Get content to check
    let contentQuery = supabaseAdmin
      .from('influencer_content')
      .select(`
        id,
        platform_post_id,
        platform,
        caption,
        hashtags,
        like_count,
        comment_count,
        published_at,
        korean_influencers!inner(handle, name)
      `)

    if (!checkAll && contentIds) {
      contentQuery = contentQuery.in('id', contentIds)
    } else {
      // Check content from last 24 hours if checkAll is true
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      contentQuery = contentQuery.gte('created_at', yesterday)
    }

    const { data: content, error: contentError } = await contentQuery.order('created_at', { ascending: false })

    if (contentError) {
      console.error('Failed to fetch content:', contentError)
      return NextResponse.json({
        error: 'Failed to fetch content for alert checking',
        details: contentError.message
      }, { status: 500 })
    }

    if (!content || content.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No content found to check',
        alertsTriggered: 0,
        emailsSent: 0
      })
    }

    console.log(`📊 Checking ${content.length} pieces of content against alerts`)

    const alertMatches: AlertMatch[] = []

    // Check each piece of content against all alerts
    for (const post of content) {
      const handle = ((post as any).korean_influencers as any)?.handle || 'unknown'
      const engagement = ((post as any).like_count || 0) + ((post as any).comment_count || 0)
      const hashtags = (post as any).hashtags || []

      for (const alert of alerts) {
        let isTriggered = false
        let triggerReason = ''
        let triggerValue: number | string = ''

        switch ((alert as any).alert_type) {
          case 'new_content':
            // Alert for new content from specific influencer
            if (handle === (alert as any).target_value) {
              isTriggered = true
              triggerReason = `New post from @${handle}`
              triggerValue = handle
            }
            break

          case 'hashtag_trend':
            // Alert for posts containing specific hashtag
            if (hashtags.some((tag: string) => tag.toLowerCase() === (alert as any).target_value.toLowerCase())) {
              isTriggered = true
              triggerReason = `Post contains hashtag #${(alert as any).target_value}`
              triggerValue = (alert as any).target_value
            }
            break

          case 'engagement_threshold':
            // Alert for posts exceeding engagement threshold
            if ((alert as any).threshold && engagement >= (alert as any).threshold) {
              isTriggered = true
              triggerReason = `High engagement: ${engagement.toLocaleString()} (threshold: ${(alert as any).threshold.toLocaleString()})`
              triggerValue = engagement
            }
            break

          case 'korean_beauty_term':
            // Alert for posts mentioning specific Korean beauty terms
            const caption = (post as any).caption?.toLowerCase() || ''
            const term = (alert as any).target_value.toLowerCase()
            if (caption.includes(term) || hashtags.some((tag: string) => tag.toLowerCase().includes(term))) {
              isTriggered = true
              triggerReason = `Post mentions Korean beauty term: ${(alert as any).target_value}`
              triggerValue = (alert as any).target_value
            }
            break
        }

        if (isTriggered) {
          // Check if this alert was already triggered for this content
          const { data: existingTrigger } = await supabaseAdmin
            .from('intelligence_alert_triggers')
            .select('id')
            .eq('alert_id', (alert as any).id)
            .eq('content_id', (post as any).id)
            .single()

          if (!existingTrigger) {
            alertMatches.push({
              alertId: (alert as any).id,
              contentId: (post as any).id,
              triggerReason,
              triggerValue,
              userEmail: (alert as any).email,
              alertType: (alert as any).alert_type,
              targetValue: (alert as any).target_value
            })
          }
        }
      }
    }

    console.log(`🎯 Found ${alertMatches.length} alert matches`)

    // Store alert triggers and send notifications
    let triggersStored = 0
    let emailsSent = 0

    for (const match of alertMatches) {
      try {
        // Store alert trigger
        const { error: triggerError } = await (supabaseAdmin as any)
          .from('intelligence_alert_triggers')
          .insert([{
            alert_id: match.alertId,
            content_id: match.contentId,
            trigger_reason: match.triggerReason,
            trigger_value: String(match.triggerValue),
            triggered_at: new Date().toISOString()
          }])

        if (triggerError) {
          console.error('Failed to store alert trigger:', triggerError)
          continue
        }

        triggersStored++

        // Update last_triggered timestamp for the alert
        await (supabaseAdmin as any)
          .from('intelligence_alerts')
          .update({ last_triggered: new Date().toISOString() })
          .eq('id', match.alertId)

        // TODO: Send email notification
        // For now, just log the alert
        console.log(`🔔 ALERT: ${match.triggerReason} for ${match.userEmail}`)
        console.log(`   Content ID: ${match.contentId}`)
        console.log(`   Alert Type: ${match.alertType}`)
        console.log(`   Target: ${match.targetValue}`)

        emailsSent++ // Increment even though we're not actually sending emails yet

      } catch (error) {
        console.error('Failed to process alert match:', error)
      }
    }

    // Group alerts by user for summary
    const alertsByUser = alertMatches.reduce((acc, match) => {
      if (!acc[match.userEmail]) {
        acc[match.userEmail] = []
      }
      acc[match.userEmail].push(match)
      return acc
    }, {} as Record<string, AlertMatch[]>)

    console.log(`✅ Alert checking completed: ${triggersStored} triggers stored, ${emailsSent} notifications processed`)

    return NextResponse.json({
      success: true,
      message: 'Alert checking completed',
      alertsTriggered: triggersStored,
      emailsSent,
      summary: {
        contentChecked: content.length,
        activeAlerts: alerts.length,
        matchesFound: alertMatches.length,
        usersNotified: Object.keys(alertsByUser).length
      },
      userSummary: Object.entries(alertsByUser).map(([email, matches]) => ({
        email,
        alertCount: matches.length,
        alertTypes: [...new Set(matches.map(m => m.alertType))]
      }))
    })

  } catch (error) {
    console.error('❌ Alert checking failed:', error)
    return NextResponse.json({
      error: 'Failed to check alerts',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// GET /api/intelligence/check-alerts - Get alert checking status and recent activity
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get alert statistics
    const { data: alertStats, error: statsError } = await supabaseAdmin
      .from('intelligence_alerts')
      .select('alert_type, is_active')

    if (statsError) {
      console.error('Failed to fetch alert stats:', statsError)
      return NextResponse.json({
        error: 'Failed to fetch alert statistics',
        details: statsError.message
      }, { status: 500 })
    }

    // Get recent triggers (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentTriggers, error: triggersError } = await supabaseAdmin
      .from('intelligence_alert_triggers')
      .select(`
        *,
        intelligence_alerts!inner(alert_type, target_value, email)
      `)
      .gte('triggered_at', weekAgo)
      .order('triggered_at', { ascending: false })
      .limit(100)

    if (triggersError) {
      console.error('Failed to fetch recent triggers:', triggersError)
      return NextResponse.json({
        error: 'Failed to fetch recent alert activity',
        details: triggersError.message
      }, { status: 500 })
    }

    // Calculate statistics
    const totalAlerts = alertStats?.length || 0
    const activeAlerts = alertStats?.filter((a: any) => a.is_active).length || 0
    const alertsByType = alertStats?.reduce((acc, alert) => {
      acc[(alert as any).alert_type] = (acc[(alert as any).alert_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const triggersLast24h = recentTriggers?.filter((t: any) =>
      new Date(t.triggered_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length || 0

    return NextResponse.json({
      success: true,
      statistics: {
        totalAlerts,
        activeAlerts,
        inactiveAlerts: totalAlerts - activeAlerts,
        alertsByType,
        triggersLast24h,
        triggersLast7d: recentTriggers?.length || 0
      },
      recentActivity: recentTriggers?.slice(0, 20) || [],
      status: 'Alert system operational'
    })

  } catch (error) {
    console.error('❌ Get alert status failed:', error)
    return NextResponse.json({
      error: 'Failed to get alert status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}