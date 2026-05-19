import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { hasActiveSubscription } from '@/lib/subscription'

/**
 * GET /api/me/subscription
 *
 * Returns whether the authenticated user has an active subscription. Uses the
 * canonical `hasActiveSubscription` helper (service-role read, bypasses RLS,
 * checks both ss_subscriptions AND ss_user_profiles.plan).
 *
 * v10.7.0 Phase F: Replaces the unreliable client-side anon-key query in
 * ProductIntelligenceSection. Bailey hit a false-negative on that path — her
 * plan is 'pro_monthly' in the DB but the client query was returning null
 * (likely a session-timing issue on the public /products/[id] route), causing
 * her to see the gated subscribe-to-unlock teasers despite being a paying
 * subscriber. Routing through a server endpoint with proper auth header makes
 * this deterministic.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const active = await hasActiveSubscription(user.id)
    return NextResponse.json({ active })
  } catch {
    // Not authenticated, or token invalid — treat as non-subscriber.
    // Don't throw a 401; the caller treats this as informational ("are you a paying user?").
    return NextResponse.json({ active: false })
  }
}
