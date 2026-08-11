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
      capturedEmailResult,
      convertedResult,
      subscriptionSourceResult,
    ] = await Promise.all([
      // Total visitors. Fetches identity columns rather than a bare row count so
      // the One Metric denominator can collapse the same human across devices
      // (see the conversion queries below for the defect this prevents).
      db.from('ss_widget_visitors').select('visitor_id, captured_email'),

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

      // --- The One Metric (NORTH-STAR.md): conversion ---
      //
      // These fetch ROWS and are collapsed to distinct HUMANS below. They are
      // deliberately not `count: 'exact', head: true` any more.
      //
      // Why (Aug 11 2026, caught by Bailey): one person — the first paying
      // subscriber — used the widget from two devices, so she owns two
      // ss_widget_visitors rows. attributeConversion() correctly stamps BOTH
      // (you want the whole cross-device trail attributed), and the row count
      // then reported "2 paid" for 1 human. The One Metric, the number this
      // project's entire build freeze is keyed to, was reading 2x high.
      //
      // A row is not a person. Anything counted over this table needs a
      // distinct-identity key. See NUDGE-DATE-HONESTY-FIX.md.
      db.from('ss_widget_visitors')
        .select('visitor_id, captured_email')
        .not('captured_email', 'is', null),

      db.from('ss_widget_visitors')
        .select('visitor_id, captured_email, converted_user_id')
        .not('converted_at', 'is', null),

      // Active paid subscriptions broken down by lead source
      db.from('ss_subscriptions')
        .select('lead_source')
        .eq('status', 'active'),
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
    const visitorRows = visitorCountResult.data || []
    const totalVisitors = visitorRows.length
    const returningVisitors = returningResult.count || 0
    const highEngagement = (recentVisitorsResult.data || []).filter(
      v => v.total_messages >= 5
    ).length

    // --- The One Metric: visitor → email → paid conversion (NORTH-STAR.md) ---
    // Collapse rows to distinct HUMANS. Identity key: the captured email when we
    // have one (case-insensitive — the same person typing Kim@x.com and
    // kim@x.com is one lead), else the visitor_id. An anonymous visitor still
    // counts once; a person who identified themselves on three devices counts
    // once. This is deterministic identity linkage, not judgment — the same
    // class as attributeConversion().
    const identityOf = (r: { visitor_id: string | null; captured_email?: string | null }): string =>
      r.captured_email ? `email:${r.captured_email.trim().toLowerCase()}` : `visitor:${r.visitor_id ?? ''}`

    const distinctPeople = new Set(visitorRows.map(identityOf)).size

    const capturedEmails = new Set(
      (capturedEmailResult.data || [])
        .map((r) => (r.captured_email || '').trim().toLowerCase())
        .filter(Boolean)
    ).size

    // Numerator: distinct paying humans. converted_user_id is the authoritative
    // key (one auth user = one subscription); fall back to the email/visitor
    // identity if attribution ever lands without a user id.
    const convertedVisitors = new Set(
      (convertedResult.data || []).map((r) =>
        r.converted_user_id ? `user:${r.converted_user_id}` : identityOf(r)
      )
    ).size
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0)

    // Lead-source breakdown of active paid subscriptions (null = organic/unknown)
    const sourceCounts: Record<string, number> = {}
    for (const row of subscriptionSourceResult.data || []) {
      const src = (row.lead_source as string | null) || 'organic_or_unknown'
      sourceCounts[src] = (sourceCounts[src] || 0) + 1
    }
    const leadSourceBreakdown = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }))

    return Response.json({
      overview: {
        total_visitors: totalVisitors,
        total_sessions: sessionCountResult.count || 0,
        total_messages: messageCountResult.count || 0,
        returning_visitors: returningVisitors,
        returning_pct: totalVisitors > 0 ? Math.round((returningVisitors / totalVisitors) * 100) : 0,
      },
      // The number the whole charter is keyed to. Until this moves, building is
      // frozen — so it has to be counted in PEOPLE, not table rows. Every figure
      // in this block is distinct-human; `visitor_rows` is exposed alongside so
      // the gap between rows and people stays visible rather than silently
      // reconciled.
      conversion: {
        total_visitors: distinctPeople,
        visitor_rows: totalVisitors,
        captured_emails: capturedEmails,
        converted_visitors: convertedVisitors,
        email_capture_rate_pct: pct(capturedEmails, distinctPeople),
        visitor_to_paid_pct: pct(convertedVisitors, distinctPeople),
        email_to_paid_pct: pct(convertedVisitors, capturedEmails),
        lead_source_breakdown: leadSourceBreakdown,
      },
      funnel: {
        visitors: totalVisitors,
        sent_message: totalVisitors, // all visitors with records sent at least 1
        multi_message: returningVisitors,
        high_engagement: highEngagement,
        captured_email: capturedEmails,
        converted_paid: convertedVisitors,
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
