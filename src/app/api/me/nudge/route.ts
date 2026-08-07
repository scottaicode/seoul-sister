import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET  /api/me/nudge        → latest unresolved proactive nudge for the user (or null)
 * POST /api/me/nudge        → mark a nudge surfaced / dismissed / acted
 *
 * The proactive-nudge cron writes ss_user_nudges rows (status 'pending'). The
 * dashboard polls GET to render the most recent one as a Yuri-voiced card, and
 * POSTs status transitions as the user interacts. v10.10.0.
 *
 * WHY 'surfaced' IS INCLUDED HERE (Aug 7 2026 — Bailey: "my note went away,
 * what happened to that??").
 *
 * The card renders under the heading "A note from Yuri" and POSTs
 * status:'surfaced' on first render (YuriNudgeCard.tsx). This query used to
 * filter `.eq('status','pending')` alone — so the act of LOOKING at the note
 * removed it from the only query that could ever return it again. One render,
 * and it was gone on the next dashboard load. Bailey had also been emailed the
 * same note (email_status='delivered'), so she saw it twice, came back for it,
 * and found nothing.
 *
 * 'surfaced' was a terminal state with NO READER anywhere in the tree — the only
 * other consumers are 'pending' (send-pending-nudge-emails.ts) and 'acted'
 * (nudge-outcome-grader.ts). A message whose entire job is bringing a subscriber
 * back was destroyed by being seen once.
 *
 * The lifecycle is now driven by the user's INTENT, not by render:
 *   pending / surfaced          → still unresolved, keep showing it
 *   dismissed                   → she said no. Gone.
 *   acted                       → she tapped through. Gone (and gradeable).
 * `surfaced_at` is preserved as first-seen telemetry, which is all it was ever
 * good for — it must not double as a deletion.
 */

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()
    const { data, error } = await db
      .from('ss_user_nudges')
      .select('id, nudge_type, message, deep_link, nudge_sequence, created_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'surfaced'])
      .is('dismissed_at', null)
      .is('acted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      // Table may not be applied yet — treat as "no nudge" rather than erroring.
      return NextResponse.json({ nudge: null })
    }
    return NextResponse.json({ nudge: data ?? null })
  } catch {
    return NextResponse.json({ nudge: null })
  }
}

const postSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['surfaced', 'dismissed', 'acted']),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const { id, status } = parsed.data
    const db = getServiceClient()

    const stamp =
      status === 'surfaced'
        ? { surfaced_at: new Date().toISOString() }
        : status === 'dismissed'
          ? { dismissed_at: new Date().toISOString() }
          : { acted_at: new Date().toISOString() }

    const { error } = await db
      .from('ss_user_nudges')
      .update({ status, ...stamp })
      .eq('id', id)
      .eq('user_id', user.id) // ownership enforced server-side too

    if (error) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
