import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { getGa4Config, fetchSessionsBySource } from '@/lib/analytics/ga4-client'

/**
 * GET /api/admin/traffic
 *
 * The honest funnel for Scott and Bailey: how many people LANDED (GA4 session
 * sources, the only slice that resists bot inflation) against how many actually
 * TALKED to Yuri (our own database, which cannot be inflated because a row
 * exists only when someone sends a message).
 *
 * Built Aug 10 2026 so neither of them has to ask for a manual database check
 * after every video.
 *
 * DELIBERATELY ABSENT: GA4 users/pageviews. On Aug 10 GA4 reported 265 active
 * users of which 120 were Singapore datacenter traffic, and on Jul 27 it showed
 * 346 phantom users against 0 database rows. Putting that number on a dashboard
 * Bailey reads would tell her the site is failing to convert huge traffic that
 * does not exist. Session-source rows are kept because a crawler does not
 * append utm_source=tiktok to its request.
 */

export const dynamic = 'force-dynamic'

interface DayRow {
  day: string
  conversations: number
  messages: number
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const db = getServiceClient()

    const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString()

    // --- Our own data: the numerator, and the only un-inflatable number ------
    // A visitor row exists only once someone SENDS a message, so
    // total_messages > 0 is the honest definition of "a real human talked to
    // Yuri". Everything below derives from that.
    const [visitorsRes, sessionsRes] = await Promise.all([
      db
        .from('ss_widget_visitors')
        .select('visitor_id, first_seen_at, total_messages, captured_email, converted_at')
        .gt('total_messages', 0)
        .gte('first_seen_at', since30)
        .order('first_seen_at', { ascending: false }),
      db
        .from('ss_widget_sessions')
        .select('visitor_id, source, message_count, started_at')
        .gte('started_at', since30)
        .order('started_at', { ascending: false }),
    ])

    // Destructure `error` explicitly. A failed query that only reads `data`
    // renders as an empty dashboard — indistinguishable from "no traffic",
    // which is the exact silent-failure class this codebase keeps paying for.
    if (visitorsRes.error) {
      console.error('[admin/traffic] visitors query failed:', visitorsRes.error.message)
      return Response.json(
        { error: 'Failed to load visitor data', detail: visitorsRes.error.message },
        { status: 500 }
      )
    }
    if (sessionsRes.error) {
      console.error('[admin/traffic] sessions query failed:', sessionsRes.error.message)
      return Response.json(
        { error: 'Failed to load session data', detail: sessionsRes.error.message },
        { status: 500 }
      )
    }

    const visitors = visitorsRes.data || []
    const sessions = sessionsRes.data || []

    // Conversations per day (last 30), by first_seen_at in UTC.
    const dayMap = new Map<string, DayRow>()
    for (const v of visitors) {
      const day = (v.first_seen_at || '').slice(0, 10)
      if (!day) continue
      const row = dayMap.get(day) || { day, conversations: 0, messages: 0 }
      row.conversations += 1
      row.messages += v.total_messages || 0
      dayMap.set(day, row)
    }
    const daily = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day))

    // Source breakdown, restricted to sessions that actually exchanged a
    // message. A session row with message_count 0 is not a conversation.
    const sourceMap = new Map<string, { sessions: number; messages: number }>()
    for (const s of sessions) {
      if (!s.message_count || s.message_count < 1) continue
      const key = s.source || 'landing'
      const row = sourceMap.get(key) || { sessions: 0, messages: 0 }
      row.sessions += 1
      row.messages += s.message_count
      sourceMap.set(key, row)
    }
    const bySource = Array.from(sourceMap.entries())
      .map(([source, v]) => ({
        source,
        conversations: v.sessions,
        messages: v.messages,
        avgMessages: v.sessions ? Number((v.messages / v.sessions).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.conversations - a.conversations)

    const in7 = visitors.filter((v) => (v.first_seen_at || '') >= since7)
    const totals = {
      last7: {
        conversations: in7.length,
        messages: in7.reduce((n, v) => n + (v.total_messages || 0), 0),
        emails: in7.filter((v) => v.captured_email).length,
        conversions: in7.filter((v) => v.converted_at).length,
      },
      last30: {
        conversations: visitors.length,
        messages: visitors.reduce((n, v) => n + (v.total_messages || 0), 0),
        emails: visitors.filter((v) => v.captured_email).length,
        conversions: visitors.filter((v) => v.converted_at).length,
      },
    }

    // Depth distribution — separates a bounce from a real conversation.
    const depth = {
      oneMessage: visitors.filter((v) => (v.total_messages || 0) === 1).length,
      twoToThree: visitors.filter(
        (v) => (v.total_messages || 0) >= 2 && (v.total_messages || 0) <= 3
      ).length,
      fourPlus: visitors.filter((v) => (v.total_messages || 0) >= 4).length,
    }

    // Most recent conversations, with their source.
    const sourceByVisitor = new Map<string, string>()
    for (const s of sessions) {
      if (!sourceByVisitor.has(s.visitor_id)) {
        sourceByVisitor.set(s.visitor_id, s.source || 'landing')
      }
    }
    const recent = visitors.slice(0, 20).map((v) => ({
      visitor_id: v.visitor_id,
      first_seen_at: v.first_seen_at,
      messages: v.total_messages,
      source: sourceByVisitor.get(v.visitor_id) || 'landing',
      email: Boolean(v.captured_email),
      converted: Boolean(v.converted_at),
    }))

    // --- GA4: the denominator, optional -------------------------------------
    // Soft-fails to `not_configured` so the database panels above always
    // render. A missing credential must never take the dashboard down.
    let ga4: {
      status: 'ok' | 'not_configured' | 'error'
      sources?: Array<{ source: string; sessions: number }>
      message?: string
    } = { status: 'not_configured' }

    const ga4Config = getGa4Config()
    if (ga4Config) {
      try {
        const sources = await fetchSessionsBySource(ga4Config, 7)
        ga4 = { status: 'ok', sources }
      } catch (err) {
        console.error('[admin/traffic] GA4 fetch failed:', err)
        ga4 = {
          status: 'error',
          message: err instanceof Error ? err.message : 'GA4 request failed',
        }
      }
    }

    return Response.json({ success: true, totals, daily, bySource, depth, recent, ga4 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    const status = /unauthor|forbidden|admin/i.test(message) ? 403 : 500
    console.error('[admin/traffic]', message)
    return Response.json({ error: message }, { status })
  }
}
