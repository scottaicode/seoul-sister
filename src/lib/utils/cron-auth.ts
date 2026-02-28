import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Verify cron job authentication using timing-safe comparison.
 * Accepts two header formats:
 *   1. Vercel cron: `Authorization: Bearer <CRON_SECRET>` (production)
 *   2. Legacy/manual: `x-cron-secret: <CRON_SECRET>` (CLI, admin API)
 * Returns a NextResponse error if unauthorized, or null if OK.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // Try Vercel's Authorization: Bearer header first, then legacy x-cron-secret
  const authHeader = request.headers.get('authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const provided = bearerToken || request.headers.get('x-cron-secret') || ''

  // DEBUG: Temporary — return debug info in response to diagnose 401 issue
  // REMOVE THIS BLOCK AFTER FIXING
  if (request.headers.get('x-debug-cron') === 'true') {
    return NextResponse.json({
      debug: true,
      provided_length: provided.length,
      secret_length: secret.length,
      provided_first4: provided.slice(0, 4),
      provided_last4: provided.slice(-4),
      secret_first4: secret.slice(0, 4),
      secret_last4: secret.slice(-4),
      lengths_match: provided.length === secret.length,
      auth_header_present: !!request.headers.get('authorization'),
      x_cron_header_present: !!request.headers.get('x-cron-secret'),
    })
  }

  if (provided.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // Authorized
}
