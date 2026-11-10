import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { stampRegisterClick } from '@/lib/widget/register-click'

/**
 * POST /api/widget/register-click
 *
 * Records (set-once) that a landing-chat visitor clicked a sign-up link inside
 * the chat, and how many messages they had sent. Before Nov 10 2026 the step
 * between "chatted" and "has an account" left no row: 13 people had used all 12
 * preview messages, 10 left an email, and there was no way to tell whether any
 * of them ever clicked through.
 *
 * Deterministic fact recording, no AI judgment. The logic lives in
 * src/lib/widget/register-click.ts so it can be executed by tests. Unauthenticated
 * by necessity (the visitor has no account yet); it can only stamp one timestamp,
 * once, on a row whose visitor id the caller already holds, and it is rate
 * limited per IP.
 *
 * "Nothing clicked" and "the write failed" are distinguishable: a failed write
 * logs an error and returns ok:false; a NULL column with no error means no click.
 */
const Body = z.object({
  visitor_id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
})

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const limit = await checkRateLimit(`widget-register-click:${ip}`, 20, 60 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })

  let visitorId: string
  try {
    const result = Body.safeParse(await request.json())
    if (!result.success) return NextResponse.json({ ok: false, error: 'Invalid visitor id' }, { status: 400 })
    visitorId = result.data.visitor_id
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 })
  }

  const outcome = await stampRegisterClick(getServiceClient(), visitorId, new Date().toISOString())
  if (outcome === 'error') return NextResponse.json({ ok: false }, { status: 500 })
  return NextResponse.json({ ok: true, recorded: outcome === 'recorded' })
}
