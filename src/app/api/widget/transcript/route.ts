import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { findResumableSession } from '@/lib/widget/session'

/**
 * GET /api/widget/transcript?visitor_id=...[&session_id=...]
 *
 * Returns the stored transcript for ONE widget session so the client can
 * repaint a conversation that a reload wiped.
 *
 * WHY THIS EXISTS (Aug 18 2026). The widget keeps `messages` in React state
 * only (TryYuriSection.tsx), while the session id lives in sessionStorage. So a
 * mid-conversation reload left the visitor staring at an EMPTY chat that had
 * just eaten her conversation, while the server still had every message. The
 * first organic blog visitor hit exactly this: she reloaded 60 seconds after
 * answering a substantive question, saw nothing, and re-sent her opening
 * question — burning a second of her 12 LIFETIME free messages. (The `?ask=`
 * re-arm made it worse by pre-filling the same canned line, but stripping that
 * alone would only have made her retype it herself.)
 *
 * Server-side rehydration for YURI's context already existed (getSessionTranscript,
 * v11.2.0) — so Yuri knew the history while the visitor could not see it. This
 * closes that asymmetry for the UI.
 *
 * SECURITY. A session id alone is not an authorisation token, so this requires
 * the visitor_id to match the session's owner. Both are client-supplied, but an
 * attacker would need a valid (session_id, visitor_id) PAIR, which is exactly
 * the pair the legitimate browser already holds. No email, no lead data, and no
 * tool payloads are returned — only the message roles and text the visitor
 * already saw on their own screen.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const visitorId = req.nextUrl.searchParams.get('visitor_id')

  if (!visitorId) {
    return NextResponse.json({ error: 'visitor_id is required' }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()

    // With a session id: ownership check — `.eq(visitor_id)` stops a guessed
    // session id from reading someone else's conversation.
    // Without one (Oct 26 2026: the tab that held it was closed or discarded):
    // the visitor's own conversation if it was active within the resume window,
    // the same rule the chat route uses to continue it.
    let session: { id: string } | null = null
    if (sessionId) {
      const { data, error: sessionError } = await supabase
        .from('ss_widget_sessions')
        .select('id, visitor_id')
        .eq('id', sessionId)
        .eq('visitor_id', visitorId)
        .maybeSingle()
      // Check the error explicitly — a failed query must not read as "no such
      // session", which is the silent-failure class this repo keeps paying for.
      if (sessionError) {
        console.error('[widget/transcript] session lookup failed:', sessionError.message)
        return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
      }
      session = data
    } else {
      session = await findResumableSession(visitorId)
    }
    if (!session) {
      // Not an error: an expired, foreign or absent session simply restores nothing.
      return NextResponse.json({ messages: [], session_id: null })
    }

    const { data, error } = await supabase
      .from('ss_widget_messages')
      .select('role, content, created_at')
      .eq('session_id', session.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(40)

    if (error) {
      console.error('[widget/transcript] message load failed:', error.message)
      return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
    }

    return NextResponse.json({
      messages: (data || []).map((m) => ({ role: m.role, content: m.content })),
      session_id: session.id,
    })
  } catch (err) {
    console.error('[widget/transcript] unexpected error:', err)
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
  }
}
