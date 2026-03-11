import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET /api/admin/widget/analytics
 * Aggregate widget analytics: visitor counts, signal breakdown, conversion funnel.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const db = getServiceClient()

    // Run all analytics queries in parallel
    const [
      visitorCountResult,
      sessionCountResult,
      messageCountResult,
      topSignalsResult,
      recentVisitorsResult,
      returningResult,
      specialistResult,
    ] = await Promise.all([
      // Total unique visitors
      db.from('ss_widget_visitors').select('*', { count: 'exact', head: true }),

      // Total sessions
      db.from('ss_widget_sessions').select('*', { count: 'exact', head: true }),

      // Total messages
      db.from('ss_widget_messages').select('*', { count: 'exact', head: true }),

      // Top intent signals (signal_type → count)
      db.from('ss_widget_intent_signals')
        .select('signal_type')
        .order('created_at', { ascending: false })
        .limit(1000),

      // Recent active visitors (last 7 days)
      db.from('ss_widget_visitors')
        .select('visitor_id, total_messages, total_sessions, total_tool_calls, first_seen_at, last_seen_at, ai_memory')
        .gte('last_seen_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('last_seen_at', { ascending: false })
        .limit(20),

      // Returning visitors (total_sessions > 1)
      db.from('ss_widget_visitors')
        .select('*', { count: 'exact', head: true })
        .gt('total_sessions', 1),

      // Specialist domains detected across all sessions
      db.from('ss_widget_sessions')
        .select('specialist_domains_detected')
        .not('specialist_domains_detected', 'eq', '{}')
        .limit(500),
    ])

    // Aggregate signal counts
    const signalCounts: Record<string, number> = {}
    for (const row of topSignalsResult.data || []) {
      const type = row.signal_type as string
      signalCounts[type] = (signalCounts[type] || 0) + 1
    }
    const topSignals = Object.entries(signalCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([signal_type, count]) => ({ signal_type, count }))

    // Aggregate specialist mentions
    const specialistCounts: Record<string, number> = {}
    for (const row of specialistResult.data || []) {
      const domains = row.specialist_domains_detected as string[]
      for (const d of domains) {
        specialistCounts[d] = (specialistCounts[d] || 0) + 1
      }
    }
    const topSpecialists = Object.entries(specialistCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([specialist, count]) => ({ specialist, count }))

    // Engagement funnel
    const totalVisitors = visitorCountResult.count || 0
    const returningVisitors = returningResult.count || 0
    const highEngagement = (recentVisitorsResult.data || []).filter(
      v => v.total_messages >= 5
    ).length

    return Response.json({
      overview: {
        total_visitors: totalVisitors,
        total_sessions: sessionCountResult.count || 0,
        total_messages: messageCountResult.count || 0,
        returning_visitors: returningVisitors,
        returning_pct: totalVisitors > 0 ? Math.round((returningVisitors / totalVisitors) * 100) : 0,
      },
      funnel: {
        visitors: totalVisitors,
        sent_message: totalVisitors, // all visitors with records sent at least 1
        multi_message: returningVisitors,
        high_engagement: highEngagement,
      },
      top_signals: topSignals,
      top_specialists: topSpecialists,
      recent_visitors: recentVisitorsResult.data || [],
    })
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode || 500
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    )
  }
}
