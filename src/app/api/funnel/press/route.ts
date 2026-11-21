import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { networkKey } from '@/lib/trial'
import { signupPressRow, pressRequestAllowed, SIGNUP_PRESS_MAX_BYTES } from '@/lib/signup-press'

/**
 * POST /api/funnel/press
 *
 * One row in ss_signup_presses for one press of a sign-up button on the
 * landing page or a blog post (src/lib/signup-press.ts). Public and
 * unauthenticated by nature: the person pressing has no account yet.
 *
 * It stores a button, a channel and a page, each from a fixed list, and nothing
 * about who pressed. The address is used for the rate limit only, as a short
 * one-way key (networkKey), never as the address itself: the rate-limit table
 * keeps its keys, and other endpoints' raw addresses have been found sitting in
 * it for months. Requests from another site are refused.
 *
 * A failed write answers 500 and is logged: an empty table must mean "nobody
 * pressed", never "the write was failing".
 */
export async function POST(request: NextRequest) {
  const h = request.headers
  if (!pressRequestAllowed({ secFetchSite: h.get('sec-fetch-site'), origin: h.get('origin'), host: h.get('host'), contentLength: h.get('content-length') })) {
    return new NextResponse(null, { status: 403 })
  }
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  const limit = await checkRateLimit(`signup-press:${networkKey(ip) ?? 'unknown'}`, 60, 60 * 60 * 1000)
  if (!limit.allowed) return new NextResponse(null, { status: 429 })

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > SIGNUP_PRESS_MAX_BYTES) return new NextResponse(null, { status: 400 })
    body = JSON.parse(text)
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  const row = signupPressRow((body && typeof body === 'object' ? body : {}) as { button?: unknown; arrival?: unknown; path?: unknown })
  if (!row) return new NextResponse(null, { status: 400 })

  const { error } = await getServiceClient().from('ss_signup_presses').insert(row)
  if (error) {
    console.error('[signup-press] write failed:', error.message)
    return new NextResponse(null, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
