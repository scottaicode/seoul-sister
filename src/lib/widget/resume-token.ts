/**
 * Signed "resume this conversation" links for widget emails (Nov 7 2026).
 *
 * WHY. The recap email and nurture email 1 told visitors they could pick the
 * conversation back up, but the link only opened the homepage. The widget can
 * restore a conversation only when the browser still holds its session id, or
 * through findResumableSession (same browser, within one hour). People click
 * the email hours or days later, often on another device, and saw an empty
 * chat. A real visitor came back 31 hours later and retyped her question.
 *
 * The chat route already continues ANY session (no age limit) when the client
 * sends session_id + visitor_id. So the email link carries those two ids,
 * signed so nobody can forge a link into someone else's conversation.
 *
 * Token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
 * Payload: { v: visitor_id (the browser's TEXT id), s: session_id, exp: unix seconds }.
 *
 * No secret configured -> createResumeToken returns null and callers fall back
 * to a plain homepage link, and the email must then not promise continuity.
 * Pure functions: only node:crypto, no I/O.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const RESUME_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

export interface ResumeTokenPayload {
  /** ss_widget_visitors.visitor_id / ss_widget_sessions.visitor_id (TEXT browser id). */
  v: string
  /** ss_widget_sessions.id */
  s: string
  /** Expiry, unix seconds. */
  exp: number
}

function secret(): string | null {
  const s = process.env.WIDGET_RESUME_SECRET
  return s && s.length > 0 ? s : null
}

function sign(payloadB64: string, key: string): Buffer {
  return createHmac('sha256', key).update(payloadB64).digest()
}

export function createResumeToken(
  visitorId: string,
  sessionId: string,
  options: { nowSeconds?: number; ttlSeconds?: number } = {}
): string | null {
  const key = secret()
  if (!key || !visitorId || !sessionId) return null
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const payload: ResumeTokenPayload = {
    v: visitorId,
    s: sessionId,
    exp: now + (options.ttlSeconds ?? RESUME_TOKEN_TTL_SECONDS),
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${payloadB64}.${sign(payloadB64, key).toString('base64url')}`
}

/** The payload if the token is authentic and unexpired, else null. Never throws. */
export function verifyResumeToken(
  token: string | null | undefined,
  options: { nowSeconds?: number } = {}
): ResumeTokenPayload | null {
  const key = secret()
  if (!key || typeof token !== 'string' || token.length > 1000) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [payloadB64, sigB64] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(payloadB64) || !/^[A-Za-z0-9_-]+$/.test(sigB64)) return null

  // Compare the canonical base64url TEXT, not decoded bytes: decoding ignores
  // the spare low bits of the last character, which would let several
  // spellings of one signature verify.
  const expected = Buffer.from(sign(payloadB64, key).toString('base64url'), 'utf8')
  const given = Buffer.from(sigB64, 'utf8')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  try {
    const p = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Partial<ResumeTokenPayload>
    if (typeof p.v !== 'string' || !p.v || typeof p.s !== 'string' || !p.s) return null
    if (typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return null
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
    if (p.exp <= now) return null
    return { v: p.v, s: p.s, exp: p.exp }
  } catch {
    return null
  }
}

const SITE = 'https://www.seoulsister.com'

/**
 * The link an email should carry. With a token it reopens the conversation;
 * without one it is the plain homepage chat. `from` keeps attribution and also
 * stops SignedInRedirect bouncing a signed-in reader to /dashboard.
 */
export function widgetEmailLink(from: string, token: string | null): string {
  const params = new URLSearchParams({ from })
  if (token) params.set('resume', token)
  return `${SITE}/?${params.toString()}`
}
