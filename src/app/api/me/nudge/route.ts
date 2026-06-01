import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET  /api/me/nudge        → latest pending proactive nudge for the user (or null)
 * POST /api/me/nudge        → mark a nudge surfaced / dismissed / acted
 *
 * The proactive-nudge cron writes ss_user_nudges rows (status 'pending'). The
 * dashboard polls GET to render the most recent pending nudge as a Yuri-voiced
 * card, and POSTs status transitions as the user interacts. v10.10.0.
 */

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()
    const { data, error } = await db
      .from('ss_user_nudges')
      .select('id, nudge_type, message, deep_link, nudge_sequence, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
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
