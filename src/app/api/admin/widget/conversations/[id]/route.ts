import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET /api/admin/widget/conversations/:id
 * Get full conversation detail: session + all messages + visitor + signals.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
    const db = getServiceClient()
    const { id } = await params

    // Load session
    const { data: session, error: sessionErr } = await db
      .from('ss_widget_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (sessionErr || !session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    // Load messages, visitor, and signals in parallel
    const [messagesResult, visitorResult, signalsResult] = await Promise.all([
      db
        .from('ss_widget_messages')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true }),
      db
        .from('ss_widget_visitors')
        .select('*')
        .eq('visitor_id', session.visitor_id)
        .single(),
      db
        .from('ss_widget_intent_signals')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true }),
    ])

    return Response.json({
      session,
      messages: messagesResult.data || [],
      visitor: visitorResult.data || null,
      signals: signalsResult.data || [],
    })
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode || 500
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    )
  }
}
