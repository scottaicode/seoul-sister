import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET /api/admin/widget/conversations
 * List widget sessions with visitor info. Supports pagination and filtering.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const db = getServiceClient()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
    const offset = (page - 1) * limit
    const visitorFilter = searchParams.get('visitor_id') || null

    // Get total count
    let countQuery = db.from('ss_widget_sessions').select('*', { count: 'exact', head: true })
    if (visitorFilter) countQuery = countQuery.eq('visitor_id', visitorFilter)
    const { count: totalCount } = await countQuery

    // Get sessions with message counts
    let query = db
      .from('ss_widget_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (visitorFilter) query = query.eq('visitor_id', visitorFilter)

    const { data: sessions, error } = await query
    if (error) throw error

    // Enrich with visitor data
    const visitorIds = [...new Set((sessions || []).map(s => s.visitor_id))]
    const { data: visitors } = await db
      .from('ss_widget_visitors')
      .select('visitor_id, total_messages, total_sessions, total_tool_calls, ai_memory, first_seen_at, last_seen_at')
      .in('visitor_id', visitorIds.length > 0 ? visitorIds : ['__none__'])

    const visitorMap = new Map((visitors || []).map(v => [v.visitor_id, v]))

    const enriched = (sessions || []).map(s => ({
      ...s,
      visitor: visitorMap.get(s.visitor_id) || null,
    }))

    return Response.json({
      sessions: enriched,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    })
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode || 500
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    )
  }
}
