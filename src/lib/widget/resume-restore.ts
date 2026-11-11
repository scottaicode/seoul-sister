/**
 * Restore a widget conversation from an email resume link (Nov 7 2026).
 * Used by GET /api/widget/transcript?resume=<token>. See resume-token.ts.
 *
 * Returns null when the token or the conversation is not usable (invalid,
 * expired, a different visitor's session, or a conversation the visitor ended
 * with "Start over"); the caller then behaves exactly as without the param.
 *
 * Also returns the visitor's remaining free messages (server truth: lifetime
 * ss_widget_visitors.total_messages vs MAX_FREE_MESSAGES), so a visitor who
 * already used her preview sees the paywall under her restored transcript
 * instead of a misleading "12 remaining".
 */

import { getServiceClient } from '@/lib/supabase'
import { verifyResumeToken } from '@/lib/widget/resume-token'
import { MAX_FREE_MESSAGES } from '@/lib/widget/visitor'
import { logAIUsage } from '@/lib/ai-usage-logger'

export interface ResumeRestoreResult {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  session_id: string
  visitor_id: string
  remaining_messages: number
}

export async function restoreFromResumeToken(token: string): Promise<ResumeRestoreResult | null> {
  const payload = verifyResumeToken(token)
  if (!payload) {
    console.warn('[widget/resume] token rejected (invalid, expired, or no secret)')
    return null
  }
  try {
    const supabase = getServiceClient()
    const { data: session, error } = await supabase
      .from('ss_widget_sessions')
      .select('id, visitor_id, ended_naturally')
      .eq('id', payload.s)
      .eq('visitor_id', payload.v)
      .maybeSingle()
    if (error) {
      console.error('[widget/resume] session lookup failed:', error.message)
      return null
    }
    if (!session || session.ended_naturally === true) {
      console.warn('[widget/resume] token points at no open session for its visitor')
      return null
    }

    const { data: visitor, error: vError } = await supabase
      .from('ss_widget_visitors')
      .select('total_messages')
      .eq('visitor_id', payload.v)
      .maybeSingle()
    if (vError || !visitor) {
      console.error('[widget/resume] visitor lookup failed:', vError?.message ?? 'no visitor row')
      return null
    }
    const used = typeof visitor.total_messages === 'number' ? visitor.total_messages : 0

    const { data, error: msgError } = await supabase
      .from('ss_widget_messages')
      .select('role, content, created_at')
      .eq('session_id', session.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(40)
    if (msgError) {
      console.error('[widget/resume] message load failed:', msgError.message)
      return null
    }

    // A link OPEN is countable in SQL, but an open is not a person: mail
    // scanners load every link in an incoming email. The count of people who
    // came back is `widget_resume_message_sent` (logged by the chat route when
    // a message follows the reopen).
    // Email returns are countable in SQL. There is no column on
    // ss_widget_sessions that fits (source/landing_path are first-touch and
    // already set), so this is a zero-cost breadcrumb rather than a migration.
    void logAIUsage({
      feature: 'widget_resume_link_opened',
      conversationId: session.id,
      model: 'n/a',
      inputTokens: 0,
      outputTokens: 0,
      cached: true,
    }).catch(() => {})

    return {
      messages: (data || []).map((m) => ({ role: m.role, content: m.content })),
      session_id: session.id as string,
      visitor_id: payload.v,
      remaining_messages: Math.max(0, MAX_FREE_MESSAGES - used),
    }
  } catch (err) {
    console.error('[widget/resume] restore failed:', err)
    return null
  }
}
