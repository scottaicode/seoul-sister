import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/utils/rate-limiter'

/**
 * POST /api/attribution/touch — one row per browser's FIRST touch on the site
 * (Oct 9 2026). The "landed" denominator for grading a traffic source or a
 * single video by outcome (chat → email → paid → day-10), not by views.
 *
 * Fired once by captureAttribution() (src/lib/attribution.ts) when it records a
 * first touch that has a UTM or an external referrer. Idempotent per visitor_id
 * (unique), IP rate-limited so a script cannot mint visits. A failure returns a
 * non-2xx and logs; the client ignores it (measurement must never break a page).
 */
const slug = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim().slice(0, max) : null))

const touchSchema = z.object({
  visitor_id: z.string().min(8).max(100),
  utm_source: slug(100),
  utm_medium: slug(100),
  utm_campaign: slug(150),
  utm_content: slug(150),
  referrer_host: slug(120),
  // A path we can't vouch for is dropped, not allowed to reject the whole touch.
  landing_path: z
    .string()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => (v && /^\/[A-Za-z0-9\-._~/%]*$/.test(v) ? v.slice(0, 200) : null)),
})

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const rate = await checkRateLimit(`touch:${ip}`, 20, 24 * 60 * 60 * 1000)
  if (!rate.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const parsed = touchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const t = parsed.data
  // Nothing to attribute: abstain rather than write a row of nulls.
  if (!t.utm_source && !t.referrer_host) return NextResponse.json({ recorded: false })

  const { error } = await getServiceClient()
    .from('ss_campaign_touches')
    .upsert(
      { ...t, ip_hash: createHash('sha256').update(ip).digest('hex').slice(0, 16) },
      { onConflict: 'visitor_id', ignoreDuplicates: true }
    )
  if (error) {
    console.error('[attribution/touch] insert failed:', error.message)
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
  }
  return NextResponse.json({ recorded: true })
}
