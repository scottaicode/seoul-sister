import { NextResponse } from 'next/server'
import { secureCompare } from './secure-compare'

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

  if (!secureCompare(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // Authorized
}
