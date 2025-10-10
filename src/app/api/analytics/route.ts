import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const event = await request.json()

    // Store analytics event in database
    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        event_name: event.event,
        event_category: event.category,
        session_id: event.metadata?.sessionId,
        user_id: event.metadata?.userId,
        page_url: event.metadata?.url,
        metadata: event.metadata,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error storing analytics:', error)
      return NextResponse.json({ error: 'Failed to store event' }, { status: 500 })
    }

    // Update aggregate metrics
    await updateMetrics(event)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '7d'
    const metric = searchParams.get('metric')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()

    switch (timeframe) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24)
        break
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
    }

    // Fetch analytics data
    let query = supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (metric) {
      query = query.eq('event_name', metric)
    }

    const { data: events, error } = await query
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Error fetching analytics:', error)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Calculate metrics
    const metrics = calculateMetrics(events || [])

    return NextResponse.json({
      timeframe,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      events: events?.length || 0,
      metrics
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function updateMetrics(event: any) {
  try {
    // Update daily metrics
    const today = new Date().toISOString().split('T')[0]

    const { data: existingMetric } = await supabase
      .from('analytics_metrics')
      .select('*')
      .eq('date', today)
      .single()

    if (existingMetric) {
      // Update existing metric
      const updates: any = {
        total_events: (existingMetric.total_events || 0) + 1,
        updated_at: new Date().toISOString()
      }

      // Update specific counters based on event type
      switch (event.event) {
        case 'session_start':
          updates.unique_visitors = (existingMetric.unique_visitors || 0) + 1
          break
        case 'whatsapp_click':
          updates.conversions = (existingMetric.conversions || 0) + 1
          break
        case 'share':
          updates.viral_shares = (existingMetric.viral_shares || 0) + 1
          break
      }

      await supabase
        .from('analytics_metrics')
        .update(updates)
        .eq('date', today)
    } else {
      // Create new metric entry
      await supabase
        .from('analytics_metrics')
        .insert({
          date: today,
          total_events: 1,
          unique_visitors: event.event === 'session_start' ? 1 : 0,
          conversions: event.event === 'whatsapp_click' ? 1 : 0,
          viral_shares: event.event === 'share' ? 1 : 0
        })
    }
  } catch (error) {
    console.error('Error updating metrics:', error)
  }
}

function calculateMetrics(events: any[]) {
  const metrics = {
    totalPageViews: 0,
    uniqueSessions: new Set(),
    conversionEvents: 0,
    avgTimeOnPage: 0,
    bounceRate: 0,
    viralShares: 0,
    topEvents: {} as Record<string, number>,
    deviceBreakdown: {
      mobile: 0,
      tablet: 0,
      desktop: 0
    },
    trafficSources: {} as Record<string, number>,
    funnelCompletion: {} as Record<string, number>
  }

  events.forEach(event => {
    // Count page views
    if (event.event_name === 'page_view') {
      metrics.totalPageViews++
    }

    // Track unique sessions
    if (event.session_id) {
      metrics.uniqueSessions.add(event.session_id)
    }

    // Count conversions
    if (event.event_name === 'whatsapp_click' || event.event_name === 'purchase') {
      metrics.conversionEvents++
    }

    // Count viral shares
    if (event.event_name === 'share') {
      metrics.viralShares++
    }

    // Track top events
    if (!metrics.topEvents[event.event_name]) {
      metrics.topEvents[event.event_name] = 0
    }
    metrics.topEvents[event.event_name]++

    // Device breakdown
    const device = event.metadata?.device
    if (device && metrics.deviceBreakdown[device as keyof typeof metrics.deviceBreakdown] !== undefined) {
      metrics.deviceBreakdown[device as keyof typeof metrics.deviceBreakdown]++
    }

    // Traffic sources
    const source = event.metadata?.source
    if (source) {
      if (!metrics.trafficSources[source]) {
        metrics.trafficSources[source] = 0
      }
      metrics.trafficSources[source]++
    }

    // Funnel steps
    if (event.event_category === 'conversion') {
      const step = event.metadata?.step
      if (step) {
        if (!metrics.funnelCompletion[step]) {
          metrics.funnelCompletion[step] = 0
        }
        metrics.funnelCompletion[step]++
      }
    }
  })

  // Calculate conversion rate
  const conversionRate = metrics.uniqueSessions.size > 0
    ? (metrics.conversionEvents / metrics.uniqueSessions.size) * 100
    : 0

  return {
    ...metrics,
    uniqueSessions: metrics.uniqueSessions.size,
    conversionRate: Math.round(conversionRate * 100) / 100
  }
}