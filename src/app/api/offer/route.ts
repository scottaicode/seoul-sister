import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { resolveOffer } from '@/lib/offers-server'
import { offerResponse } from '@/lib/offers'

/**
 * GET /api/offer?code=BAILEY
 *
 * What the membership page may say about a creator code, straight from Stripe
 * (src/lib/offers-server.ts). It never says how many spots are left.
 *
 *   active  -> { state, code, percent_off, line, saved_line }
 *   ended   -> { state, code, line }   (the cap was reached or the code is off)
 *   unknown -> { state }               (no such code: the page shows nothing)
 * 503 when Stripe cannot be asked: the page then makes no claim either way.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const limit = await checkRateLimit(`offer-lookup:${ip}`, 30, 60 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const offer = await resolveOffer(request.nextUrl.searchParams.get('code'))
    return NextResponse.json(offerResponse(offer))
  } catch (err) {
    console.error('[offer] lookup failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
