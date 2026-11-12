/**
 * Signed, encrypted "resume this conversation" links for widget emails (Nov 7 2026).
 *
 * WHY. The recap email and nurture email 1 told visitors they could pick the
 * conversation back up, but the link only opened the homepage. The widget can
 * restore a conversation only when the browser still holds its session id, or
 * through findResumableSession (same browser, within one hour). People click
 * the email hours or days later, often on another device, and saw an empty
 * chat. A real visitor came back 31 hours later and retyped her question.
 *
 * The chat route already continues ANY session (no age limit) when the client
 * sends session_id + visitor_id. So the email link carries those two ids.
 *
 * OPAQUE, not just signed (review, Nov 7 2026): visitor_id + session_id are
 * themselves a lifetime credential (GET /api/widget/transcript, POST
 * /api/widget/chat). A readable payload would make the 30-day expiry cosmetic,
 * since anyone holding the link could lift the ids out of it. So the payload is
 * AES-256-GCM encrypted with a key derived (HKDF) from WIDGET_RESUME_SECRET,
 * and only the server ever learns the ids, after the expiry check.
 *
 * Token = base64url(iv[12] || ciphertext || tag[16]).
 * Plaintext: JSON { v: visitor_id (the browser's TEXT id), s: session_id, exp: unix seconds }.
 *
 * Secret unset or shorter than 32 chars -> createResumeToken returns null and
 * callers fall back to a plain homepage link (and the email must then not
 * promise continuity). Pure functions: only node:crypto, no I/O.
 */

import { normalizeOfferCode } from '@/lib/offers'
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

export const RESUME_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
export const MIN_SECRET_LENGTH = 32

const IV_BYTES = 12
const TAG_BYTES = 16
const HKDF_INFO = 'seoulsister-widget-resume-v1'

export interface ResumeTokenPayload {
  /** ss_widget_visitors.visitor_id / ss_widget_sessions.visitor_id (TEXT browser id). */
  v: string
  /** ss_widget_sessions.id */
  s: string
  /** Expiry, unix seconds. */
  exp: number
}

let warnedShortSecret = false

function key(): Buffer | null {
  const s = process.env.WIDGET_RESUME_SECRET
  if (!s) return null
  if (s.length < MIN_SECRET_LENGTH) {
    if (!warnedShortSecret) {
      warnedShortSecret = true
      console.error(
        `[resume-token] WIDGET_RESUME_SECRET is shorter than ${MIN_SECRET_LENGTH} characters; resume links are disabled`
      )
    }
    return null
  }
  return Buffer.from(hkdfSync('sha256', s, Buffer.alloc(0), HKDF_INFO, 32))
}

/** True when email links can reopen a conversation (secret configured and long enough). */
export function resumeLinksEnabled(): boolean {
  return key() !== null
}

export function createResumeToken(
  visitorId: string,
  sessionId: string,
  options: { nowSeconds?: number; ttlSeconds?: number } = {}
): string | null {
  const k = key()
  if (!k || !visitorId || !sessionId) return null
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const payload: ResumeTokenPayload = {
    v: visitorId,
    s: sessionId,
    exp: now + (options.ttlSeconds ?? RESUME_TOKEN_TTL_SECONDS),
  }
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', k, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString('base64url')
}

/** The payload if the token is authentic and unexpired, else null. Never throws. */
export function verifyResumeToken(
  token: string | null | undefined,
  options: { nowSeconds?: number } = {}
): ResumeTokenPayload | null {
  try {
    const k = key()
    if (!k || typeof token !== 'string' || token.length > 1000) return null
    if (!/^[A-Za-z0-9_-]+$/.test(token)) return null
    const raw = Buffer.from(token, 'base64url')
    if (raw.length <= IV_BYTES + TAG_BYTES) return null
    const iv = raw.subarray(0, IV_BYTES)
    const tag = raw.subarray(raw.length - TAG_BYTES)
    const ct = raw.subarray(IV_BYTES, raw.length - TAG_BYTES)
    const decipher = createDecipheriv('aes-256-gcm', k, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    const p = JSON.parse(plain) as Partial<ResumeTokenPayload>
    if (typeof p.v !== 'string' || !p.v || typeof p.s !== 'string' || !p.s) return null
    if (typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return null
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
    if (p.exp <= now) return null
    return { v: p.v, s: p.s, exp: p.exp }
  } catch {
    // Wrong key, tampered bytes (GCM auth failure), or junk: never throws.
    return null
  }
}

const SITE = 'https://www.seoulsister.com'

/**
 * The link an email should carry. With a token it reopens the conversation;
 * without one it is the plain homepage chat. `from` keeps attribution and also
 * stops SignedInRedirect bouncing a signed-in reader to /dashboard.
 *
 * `offerCode` is the creator code the lead arrived with (Nov 12 2026). The
 * code used to live only in the browser that opened the creator's link, so a
 * lead who opened the email anywhere else lost the discount and the creator
 * lost the sign-up. Only a code in the accepted format is added; the page
 * that receives it still asks Stripe what it is worth.
 */
export function widgetEmailLink(from: string, token: string | null, offerCode?: string | null): string {
  const params = new URLSearchParams({ from })
  if (token) params.set('resume', token)
  const code = normalizeOfferCode(offerCode)
  if (code) params.set('code', code)
  return `${SITE}/?${params.toString()}`
}

/** Remove resume tokens from stored copies of an email (rows must not be credentials). */
export function redactResumeTokens(html: string): string {
  return html.replace(/([?&](?:amp;)?resume=)[A-Za-z0-9_-]+/g, '$1REDACTED')
}
