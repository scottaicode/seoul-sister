import { timingSafeEqual } from 'crypto'

/**
 * Constant-time comparison for shared-secret checks (API keys, cron secrets).
 * A plain === short-circuits on the first differing character, which leaks
 * prefix-match timing to an attacker probing the secret byte by byte.
 */
export function secureCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
