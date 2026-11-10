import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { liveTrialState } from '@/lib/stripe'
import { trialFacts, networkKey } from '@/lib/trial'

/**
 * GET /api/me/trial
 *
 * The facts the paywall and the in-app trial notice may state. All of the logic
 * is `trialFacts` in src/lib/trial.ts, which applies the same rules as the
 * checkout route (so a button can never promise a trial the checkout would
 * refuse) and is executed by tests. Stripe is asked only for an account that is
 * on a trial.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const facts = await trialFacts(getServiceClient(), user, { liveState: liveTrialState, ipHash: networkKey(ip) })
    return NextResponse.json(facts)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const unauthorized = /unauthor|token|authenticated/i.test(message)
    if (!unauthorized) console.error('[me/trial] failed:', message)
    return NextResponse.json({ error: unauthorized ? 'Unauthorized' : 'unavailable' }, { status: unauthorized ? 401 : 500 })
  }
}
