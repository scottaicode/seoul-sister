import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Verify cron job authentication using timing-safe comparison.
 * Also validates that CRON_SECRET is configured.
 * Returns a NextResponse error if unauthorized, or null if OK.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const provided = request.headers.get('x-cron-secret') ?? ''
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
