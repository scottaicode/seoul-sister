import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET /api/email/unsubscribe?token=<uuid>        — nurture sequence (leads)
 * GET /api/email/unsubscribe?nudge_token=<uuid>  — proactive nudge emails (subscribers)
 *
 * One-click unsubscribe. The token is the capability: a UUID that only ever
 * appears in that recipient's own emails, so no auth is needed and no email
 * address is exposed. Idempotent — clicking twice is fine.
 *
 * The two tokens are deliberately separate parameters against separate tables.
 * A nurture lead and a paying subscriber are different relationships: nurture
 * enrollment EXCLUDES active subscribers, so a subscriber has no ss_nurture_leads
 * row and could never have unsubscribed from nudges through the original path.
 *
 * Opting out of nudge EMAIL does not opt out of care — the dashboard card still
 * surfaces every nudge. We say so on the confirmation page so it doesn't read as
 * "you have turned Yuri off."
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const nudgeToken = request.nextUrl.searchParams.get('nudge_token') ?? ''

  let ok = false
  let isNudge = false

  if (UUID_RE.test(nudgeToken)) {
    isNudge = true
    const db = getServiceClient()
    const { data, error } = await db
      .from('ss_user_profiles')
      .update({ nudge_email_opt_out: true, updated_at: new Date().toISOString() })
      .eq('nudge_unsubscribe_token', nudgeToken)
      .select('id')
    if (error) {
      console.error('[unsubscribe] nudge opt-out failed:', error.message)
    }
    ok = (data?.length ?? 0) > 0
  } else if (UUID_RE.test(token)) {
    const db = getServiceClient()
    const { data, error } = await db
      .from('ss_nurture_leads')
      .update({ suppressed: true, suppressed_reason: 'unsubscribed', updated_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .select('id')
    if (error) {
      console.error('[unsubscribe] nurture suppression failed:', error.message)
    }
    ok = (data?.length ?? 0) > 0
  }

  const message = ok
    ? isNudge
      ? `Done, no more check-in emails from me. You'll still see them in the app when you're there, and everything else about your subscription is unchanged.`
      : `You're unsubscribed. No hard feelings, and no more emails from us.`
    : `That unsubscribe link didn't match anything, so there's nothing to unsubscribe. If you keep getting emails, reply to one and a human will sort it out.`

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Seoul Sister</title></head>
<body style="background:#0D0D0F;color:#eee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="max-width:420px;text-align:center;padding:24px;">
<p style="color:#C9A55C;font-weight:600;font-size:18px;margin-bottom:12px;">Seoul Sister</p>
<p style="line-height:1.6;">${message}</p>
</div></body></html>`,
    { status: ok ? 200 : 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
