/**
 * Resend delivery webhook — lead recap email observability (v11.5.0).
 *
 * Turns the recap email's fate into a persisted fact. When Resend delivers,
 * bounces, or gets a spam complaint on a Yuri lead recap, this route matches
 * the event to the visitor by Resend message id and updates recap_status. That
 * makes a bounce to a hot lead VISIBLE (a one-line query) instead of silently
 * invisible — the gap the July 15 2026 audit surfaced.
 *
 * Deterministic transport/observability only — no AI judgment. We translate a
 * provider event type into a status column value; that's it.
 *
 * MANUAL SETUP (Scott-only, not automatable):
 *   1. resend.com → Webhooks → Add endpoint:
 *        https://seoulsister.com/api/webhooks/resend
 *      Subscribe to: email.delivered, email.bounced, email.complained.
 *   2. Copy the endpoint's Signing Secret (starts with "whsec_") and set
 *        RESEND_WEBHOOK_SECRET   in Vercel (Production).
 *   Until the secret is set, this route rejects everything 401 (fail-closed) —
 *   an unverified body must never mutate lead data. The rest of the system is
 *   unaffected: sends still record 'sent', we just don't get delivery events.
 *
 * Svix signing (Resend uses Svix): the signed content is
 *   `${svix-id}.${svix-timestamp}.${rawBody}`
 * HMAC-SHA256 with the base64-decoded secret (minus the "whsec_" prefix),
 * base64-encoded, compared (constant-time) against each `v1,<sig>` token in
 * the space-delimited `svix-signature` header. Implemented with Node crypto to
 * stay dependency-free (same raw philosophy as lib/email/send.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  updateRecapStatusByProviderId,
  type RecapStatus,
} from '@/lib/widget/visitor'

// Resend event type → our recap_status. Only delivery-outcome events matter;
// anything else (email.sent, email.opened, email.clicked) is acknowledged and
// ignored — we already record 'sent' at send time and don't track engagement.
const EVENT_STATUS: Record<string, RecapStatus> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

/** Reject replayed events older than this (Svix best practice). */
const MAX_SKEW_SECONDS = 5 * 60

function verifySvixSignature(
  secret: string,
  headers: { id: string; timestamp: string; signature: string },
  rawBody: string
): boolean {
  // Timestamp skew guard against replay.
  const ts = Number(headers.timestamp)
  if (!Number.isFinite(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) return false

  // Secret is "whsec_<base64key>"; the HMAC key is the decoded base64.
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`
  const expected = crypto
    .createHmac('sha256', key)
    .update(signedContent)
    .digest('base64')

  // Header may carry multiple space-delimited "v1,<sig>" values.
  for (const part of headers.signature.split(' ')) {
    const sig = part.startsWith('v1,') ? part.slice(3) : part
    if (!sig) continue
    try {
      const a = Buffer.from(sig)
      const b = Buffer.from(expected)
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true
    } catch {
      // Malformed token — try the next one.
    }
  }
  return false
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Fail-closed: never mutate lead data from an unverifiable request.
    console.warn(
      '[webhooks/resend] RESEND_WEBHOOK_SECRET unset — rejecting webhook. ' +
        'Set it in Vercel to enable delivery/bounce tracking.'
    )
    return NextResponse.json({ error: 'not_configured' }, { status: 401 })
  }

  const rawBody = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  }

  if (
    !verifySvixSignature(
      secret,
      { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      rawBody
    )
  ) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: { type?: string; data?: { email_id?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const status = event.type ? EVENT_STATUS[event.type] : undefined
  // Not a delivery-outcome event we track — acknowledge so Resend stops retrying.
  if (!status) {
    return NextResponse.json({ received: true, ignored: event.type ?? 'unknown' })
  }

  const providerId = event.data?.email_id
  if (!providerId) {
    return NextResponse.json({ received: true, matched: false, reason: 'no_email_id' })
  }

  const { matched } = await updateRecapStatusByProviderId(providerId, status)
  if (!matched) {
    // Delivery event for a non-lead email (or a send that predates provider-id
    // tracking) — expected, not an error. Acknowledge.
    console.warn(
      `[webhooks/resend] ${event.type} for unmatched message ${providerId} — ` +
        'not a tracked lead recap (or predates provider-id tracking).'
    )
  }

  return NextResponse.json({ received: true, matched, status })
}
