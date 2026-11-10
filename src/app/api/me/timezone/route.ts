import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

/**
 * POST /api/me/timezone
 *
 * Records the member's device timezone when none is on file (Nov 10 2026).
 *
 * Weekly check-ins run on the member's LOCAL Sunday, and a member with no
 * timezone is skipped ('no_timezone') rather than guessed at. Until now the
 * only source was geocoding a location stated in the setup chat, and 37 of the
 * 39 most recent profiles had neither a timezone nor coordinates, so "I check
 * in every week" could not be kept for almost anyone new.
 *
 * Set-once, and only into an EMPTY field: a timezone resolved from where they
 * said they live is never overwritten by wherever their phone happens to be.
 * `timezone_source` records where the value came from. A fact, not a judgment.
 */
const Body = z.object({ timezone: z.string().min(3).max(64) })

function isIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const parsed = Body.safeParse(await request.json().catch(() => null))
    if (!parsed.success || !isIanaTimezone(parsed.data.timezone)) {
      return NextResponse.json({ ok: false, error: 'Invalid timezone' }, { status: 400 })
    }
    const { data, error } = await getServiceClient()
      .from('ss_user_profiles')
      .update({ timezone: parsed.data.timezone, timezone_source: 'browser' })
      .eq('user_id', user.id)
      .is('timezone', null)
      .select('user_id')
    if (error) {
      console.error('[me/timezone] write failed:', error.message)
      return NextResponse.json({ ok: false }, { status: 500 })
    }
    return NextResponse.json({ ok: true, recorded: (data ?? []).length > 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const unauthorized = /unauthor|token|authenticated/i.test(message)
    return NextResponse.json({ ok: false, error: unauthorized ? 'Unauthorized' : 'unavailable' }, { status: unauthorized ? 401 : 500 })
  }
}
