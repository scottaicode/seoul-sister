import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'

/**
 * POST /api/me/paywall-reached
 *
 * Records (set-once) that an authenticated free-plan user reached the
 * /subscribe paywall. Turns "registered but bounced at the wall" into a
 * queryable, reachable cohort — distinct from bot signups that never even
 * loaded subscribe — so the visitor→paid drop-off becomes measurable instead
 * of a single inscrutable zero.
 *
 * Deterministic fact recording, no AI judgment. The win-back email to this
 * cohort is intentionally NOT built here — when it comes, it routes through the
 * AI-First lead-email path (Yuri writes + judges consent), per /ai-first-guard.
 *
 * Tolerates the paywall_reached_at column being absent until the migration
 * (scripts/migrations/add_paywall_reached_at.sql) is applied — same defensive
 * pattern as ss_widget_visitors.captured_email.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const admin = getServiceClient()

    // Set-once: only stamp the first time, so the value marks FIRST wall-view.
    const { data: profile } = await admin
      .from('ss_user_profiles')
      .select('paywall_reached_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile && profile.paywall_reached_at == null) {
      await admin
        .from('ss_user_profiles')
        .update({ paywall_reached_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Pre-migration the column may not exist — never break the paywall over a
    // measurement write. Log for visibility (the v10.3.4 silent-failure lesson).
    const msg = err instanceof Error ? err.message : String(err)
    if (/paywall_reached_at/.test(msg)) {
      console.warn('[paywall-reached] column missing — apply add_paywall_reached_at.sql')
    } else {
      console.warn(`[paywall-reached] skipped: ${msg}`)
    }
    return NextResponse.json({ ok: false })
  }
}
