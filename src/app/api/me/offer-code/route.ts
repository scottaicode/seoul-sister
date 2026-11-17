import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { resolveOffer } from '@/lib/offers-server'
import { applyPromotionToFreeWeek, readFreeWeekDiscount } from '@/lib/stripe'
import { applyCodeToFreeWeek } from '@/lib/apply-offer'
import { codeTooManyTriesLine, codeCheckFailedLine } from '@/lib/offers'

/**
 * POST /api/me/offer-code  { code }
 *
 * A member in their free week adds a creator code (src/lib/apply-offer.ts).
 * Always answers with a sentence to show, `line`, and `ok`.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    // Per account: this endpoint says whether a code exists, so guessing is bounded.
    const limit = await checkRateLimit(`offer-apply:${user.id}`, 10, 60 * 60 * 1000)
    if (!limit.allowed) return NextResponse.json({ ok: false, line: codeTooManyTriesLine() }, { status: 429 })
    const body = (await request.json().catch(() => null)) as { code?: unknown } | null
    const result = await applyCodeToFreeWeek(getServiceClient(), user.id, body?.code, { resolve: resolveOffer, readFreeWeek: readFreeWeekDiscount, applyToFreeWeek: applyPromotionToFreeWeek })
    if (result.ok) return NextResponse.json({ ok: true, code: result.code, percent_off: result.percentOff, line: result.line })
    return NextResponse.json({ ok: false, line: result.line }, { status: result.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const unauthorized = /unauthor|token|authenticated/i.test(message)
    if (!unauthorized) console.error('[offer-code]', message)
    return NextResponse.json({ ok: false, line: unauthorized ? 'Please sign in again.' : codeCheckFailedLine() }, { status: unauthorized ? 401 : 500 })
  }
}
