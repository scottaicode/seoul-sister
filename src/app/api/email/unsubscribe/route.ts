import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET /api/email/unsubscribe?token=<uuid>
 *
 * One-click unsubscribe for the nurture sequence. The token is the
 * capability: it's a per-lead UUID that only ever appears in that lead's
 * own emails, so no auth is needed and no email address is exposed.
 * Idempotent — clicking twice is fine.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)

  let ok = false
  if (isUuid) {
    const db = getServiceClient()
    const { data } = await db
      .from('ss_nurture_leads')
      .update({ suppressed: true, suppressed_reason: 'unsubscribed', updated_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .select('id')
    ok = (data?.length ?? 0) > 0
  }

  const message = ok
    ? `You're unsubscribed. No hard feelings, and no more emails from us.`
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
