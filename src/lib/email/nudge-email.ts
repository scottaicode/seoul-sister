/**
 * Proactive nudge — email delivery adapter (v11.23.0).
 *
 * THE GAP THIS CLOSES
 *
 * The nudge engine has been writing good, well-timed messages and delivering
 * none of them. A nudge only rendered on the dashboard, so it waited for the
 * user to return in order to deliver a message whose entire purpose is getting
 * them to return. On Aug 3 2026 two paying subscribers each had an unsent nudge
 * (Kim, Jul 28; Caroline, Aug 3) while neither had signed in for days. Bailey's
 * own two acted-on nudges took 6 and 16 days to surface, because she eventually
 * logged in anyway.
 *
 * PROACTIVE-NUDGE-BLUEPRINT.md:191 designed for this: "the cron + ledger are
 * channel-agnostic; push is a later delivery adapter on the same ss_user_nudges
 * rows." This is that adapter.
 *
 * WHAT THIS FILE IS AND IS NOT
 *
 * Deterministic transport + chrome ONLY. The message body is already Opus-
 * generated in Yuri's voice by the cron (deliberately Opus, not Sonnet — see
 * blueprint:59, this is Yuri speaking to a paying subscriber). This module wraps
 * it, never rewrites it, never appends advice of its own. No skincare judgment
 * happens here; the CTA routes back to Yuri with the prefilled ?ask= so the
 * recommendation happens in conversation with full context (Yuri Sole Authority).
 *
 * The email does NOT flip ss_user_nudges.status. Channel state lives on the
 * email_* columns so the dashboard card can still surface the same row
 * independently — the two channels complement, they don't cannibalize.
 */

import { getServiceClient } from '@/lib/supabase'
import { sendEmail, wrapEmailHtml } from './send'
import { escapeHtml } from './html'

const SITE = 'https://www.seoulsister.com'

/**
 * Delivery outcome vocabulary. Mirrors RecapStatus (lib/widget/visitor.ts) so
 * the two delivery ledgers read the same way, and matches the CHECK constraint
 * in 20260803000001_nudge_email_delivery.sql.
 */
export type NudgeEmailStatus =
  | 'sent'
  | 'send_failed'
  /** RESEND_API_KEY unset — a graceful no-op, not a failure. */
  | 'no_provider'
  /** Could not resolve the subscriber's address from auth.users. */
  | 'no_address'
  /** User opted out of nudge emails. */
  | 'suppressed'
  | 'delivered'
  | 'bounced'
  | 'complained'

export interface NudgeEmailInput {
  nudgeId: string
  /** Opus-generated body, in Yuri's voice. Used verbatim. */
  message: string
  /** e.g. `/yuri?ask=...` — the prefilled conversation entry point. */
  deepLink: string | null
  nudgeType: string
  /** 1-based position in the escalation ladder. */
  nudgeSequence: number
  unsubscribeToken: string | null
}

/**
 * Subject lines. Deliberately quiet and non-marketing: this is Yuri continuing
 * care, not a campaign. No urgency, no FOMO, no "you haven't been here in a
 * while" (the guilt the blueprint's no-guilt rule forbids). Keyed by nudge type
 * so the subject matches what's actually inside.
 *
 * These are transport chrome, not Yuri's voice — same rule as wrapEmailHtml.
 * The voice is the generated body.
 */
const SUBJECTS: Record<string, string> = {
  open_loop: 'Picking back up where we left off',
  phase_routine_mismatch: 'Your routine is a step behind your skin',
  cycle_timed_brightening: 'Good week for this, if you want to',
  glass_skin_cadence: 'Worth a fresh look at your progress',
}

const FALLBACK_SUBJECT = 'A quick check-in on your skin'

export function buildNudgeSubject(nudgeType: string, nudgeSequence: number): string {
  const base = SUBJECTS[nudgeType] ?? FALLBACK_SUBJECT
  // The final nudge in the ladder says its own goodbye in the body; keep the
  // subject from implying an ongoing series.
  if (nudgeSequence >= 3) return 'Last note from me on this'
  return base
}

/**
 * Render the email body around Yuri's generated message.
 *
 * The message arrives as plain text (the Opus prompt forbids markdown, greetings
 * and sign-offs), so paragraph breaks are the only structure to preserve. It is
 * ESCAPED, never interpolated raw — a model-generated string reaching an HTML
 * document unescaped is an injection surface even when the model is ours.
 */
export function buildNudgeEmailHtml(input: NudgeEmailInput): string {
  const paragraphs = input.message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
    )
    .join('\n')

  const href = input.deepLink
    ? `${SITE}${input.deepLink}${input.deepLink.includes('?') ? '&' : '?'}from=nudge_email`
    : `${SITE}/yuri?from=nudge_email`

  const cta = `<p style="margin:22px 0 0;"><a href="${href}" style="display:inline-block;background:#C9A55C;color:#111;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">Pick this up with Yuri</a></p>`

  const footer = buildNudgeFooter(input.unsubscribeToken)

  return wrapEmailHtml(`<p style="margin:0 0 14px;">Hi, it's Yuri.</p>\n${paragraphs}\n${cta}`, footer)
}

/**
 * Footer. Names WHY they're getting this (they're a subscriber, mid-plan) and
 * offers the off switch. A nudge about a subscriber's own treatment plan is
 * defensibly transactional, but the off switch exists on principle: the
 * escalation ladder literally promises "I won't keep bringing it up," and that
 * should be true on the user's terms, not only ours.
 */
export function buildNudgeFooter(unsubscribeToken: string | null): string {
  const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken)
  const optOut = unsubscribeUrl
    ? ` <a href="${unsubscribeUrl}" style="color:#999;">Turn off check-in emails</a> and I'll keep them to the app instead.`
    : ''
  return `<p style="font-size:12px;color:#999;margin:0;">Seoul Sister, your K-beauty intelligence advisor. You're getting this because you're a subscriber and we have an open thread on your skin.${optOut}</p>`
}

export function buildUnsubscribeUrl(token: string | null): string | undefined {
  if (!token) return undefined
  return `${SITE}/api/email/unsubscribe?nudge_token=${encodeURIComponent(token)}`
}

/**
 * Persist the delivery outcome onto the nudge row.
 *
 * Best-effort and never throws — delivery bookkeeping must not break the cron
 * loop. Tolerates the email_* columns being absent pre-migration (the same
 * defensive pattern as recordRecapStatus / captured_email), so this code is safe
 * to deploy before the migration is applied.
 */
export async function recordNudgeEmailStatus(
  nudgeId: string,
  status: NudgeEmailStatus,
  options: { providerId?: string; sentAt?: string } = {}
): Promise<void> {
  const db = getServiceClient()
  const nowIso = new Date().toISOString()

  const patch: Record<string, string> = {
    email_status: status,
    email_status_updated_at: nowIso,
  }
  if (status === 'sent') patch.email_sent_at = options.sentAt || nowIso
  if (options.providerId) patch.email_provider_id = options.providerId

  try {
    const { error } = await db.from('ss_user_nudges').update(patch).eq('id', nudgeId)
    if (error && !/email_status|email_sent_at|email_provider_id/.test(error.message || '')) {
      console.error('[nudge-email] recordNudgeEmailStatus failed:', error.message)
    }
  } catch (err) {
    console.error('[nudge-email] recordNudgeEmailStatus threw:', err)
  }
}

/**
 * Update a nudge's delivery status from a Resend webhook event, matched by
 * message id. Best-effort; never throws.
 *
 * A late `delivered` never overwrites a terminal negative (bounced/complained) —
 * provider events can arrive out of order, and a bounce is the fact that matters.
 */
export async function updateNudgeEmailStatusByProviderId(
  providerId: string,
  status: NudgeEmailStatus
): Promise<{ matched: boolean }> {
  const db = getServiceClient()
  try {
    let query = db
      .from('ss_user_nudges')
      .update({ email_status: status, email_status_updated_at: new Date().toISOString() })
      .eq('email_provider_id', providerId)

    if (status === 'delivered') {
      query = query.not('email_status', 'in', '(bounced,complained)')
    }

    const { data, error } = await query.select('id')

    if (error) {
      if (!/email_status|email_provider_id/.test(error.message || '')) {
        console.error('[nudge-email] updateNudgeEmailStatusByProviderId failed:', error.message)
      }
      return { matched: false }
    }
    return { matched: Array.isArray(data) && data.length > 0 }
  } catch (err) {
    console.error('[nudge-email] updateNudgeEmailStatusByProviderId threw:', err)
    return { matched: false }
  }
}

/**
 * Send one nudge email and record the outcome.
 *
 * Returns the status written, so the caller can count it. Never throws: a send
 * failure must not abort the cron's remaining subscribers, and it must never be
 * silent either (v10.3.4 lesson — every outcome is persisted AND logged).
 */
export async function sendNudgeEmail(
  toEmail: string | null,
  optedOut: boolean,
  input: NudgeEmailInput
): Promise<NudgeEmailStatus> {
  if (optedOut) {
    await recordNudgeEmailStatus(input.nudgeId, 'suppressed')
    return 'suppressed'
  }

  if (!toEmail) {
    // The nudge still exists and will surface in-app; we just can't email it.
    console.warn(`[nudge-email] no address for nudge ${input.nudgeId} — in-app only`)
    await recordNudgeEmailStatus(input.nudgeId, 'no_address')
    return 'no_address'
  }

  const subject = buildNudgeSubject(input.nudgeType, input.nudgeSequence)
  const html = buildNudgeEmailHtml(input)

  const result = await sendEmail(toEmail, subject, html, {
    unsubscribeUrl: buildUnsubscribeUrl(input.unsubscribeToken),
  })

  if (result.sent) {
    await recordNudgeEmailStatus(input.nudgeId, 'sent', { providerId: result.providerId })
    return 'sent'
  }

  const status: NudgeEmailStatus =
    result.reason === 'no_provider' ? 'no_provider' : 'send_failed'
  if (status === 'send_failed') {
    console.error(
      `[nudge-email] send failed for nudge ${input.nudgeId}: ${result.error ?? 'unknown'}`
    )
  }
  await recordNudgeEmailStatus(input.nudgeId, status)
  return status
}
