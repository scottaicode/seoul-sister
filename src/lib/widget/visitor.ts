/**
 * Persistent anonymous visitor identity management.
 * Adapted from LGAAS's getOrCreateProspect() pattern.
 */

import { getServiceClient } from '@/lib/supabase'

export interface WidgetVisitor {
  id: string
  visitor_id: string
  total_messages: number
  total_sessions: number
  total_tool_calls: number
  ai_memory: Record<string, unknown> | null
  /** Optional — present once the email-capture migration is applied (v10.12.0). */
  captured_email?: string | null
}

/**
 * Lifetime free preview messages per visitor (July 19 2026: 20 → 12).
 * Measured: in 54 all-time sessions no visitor ever reached 20 — real
 * consultations complete by message ~12-15, so the cap never functioned as a
 * conversion moment. 12 still fits a full qualify-then-solve conversation.
 * Exported so the chat route can surface honest usage facts to Yuri.
 */
export const MAX_FREE_MESSAGES = 12

/** Columns selected for a visitor record. captured_email is included but tolerated-absent pre-migration. */
const VISITOR_SELECT = 'id, visitor_id, total_messages, total_sessions, total_tool_calls, ai_memory, captured_email'
const VISITOR_SELECT_FALLBACK = 'id, visitor_id, total_messages, total_sessions, total_tool_calls, ai_memory'

/**
 * Get or create a persistent visitor record.
 * Uses UPSERT for atomicity — safe under concurrent requests.
 */
export async function getOrCreateVisitor(
  visitorId: string,
  ipHash: string,
  uaHash: string
): Promise<WidgetVisitor> {
  const supabase = getServiceClient()

  // Try upsert — creates on first visit, updates last_seen on return.
  // Select the full column set including captured_email; if that column doesn't
  // exist yet (migration not applied), retry with the fallback select.
  let { data, error } = await supabase
    .from('ss_widget_visitors')
    .upsert(
      {
        visitor_id: visitorId,
        ip_hash: ipHash,
        user_agent_hash: uaHash,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'visitor_id', ignoreDuplicates: false }
    )
    .select(VISITOR_SELECT)
    .single()

  if (error && /captured_email/.test(error.message || '')) {
    ;({ data, error } = await supabase
      .from('ss_widget_visitors')
      .upsert(
        {
          visitor_id: visitorId,
          ip_hash: ipHash,
          user_agent_hash: uaHash,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'visitor_id', ignoreDuplicates: false }
      )
      .select(VISITOR_SELECT_FALLBACK)
      .single())
  }

  if (error || !data) {
    // Fallback: try to read existing record (upsert may fail on RLS edge cases)
    const { data: existing } = await supabase
      .from('ss_widget_visitors')
      .select(VISITOR_SELECT_FALLBACK)
      .eq('visitor_id', visitorId)
      .single()

    if (existing) return existing as WidgetVisitor

    throw new Error(`Failed to get or create visitor: ${error?.message}`)
  }

  return data as WidgetVisitor
}

/**
 * Record a captured email for a visitor (first one wins — does not overwrite).
 * Resilient to the email-capture columns not existing yet (no-op pre-migration).
 * Returns true if a NEW email was recorded this call.
 */
export async function recordCapturedEmail(
  visitorId: string,
  email: string
): Promise<boolean> {
  const supabase = getServiceClient()

  try {
    // Only set if not already captured (first email wins).
    const { data, error } = await supabase
      .from('ss_widget_visitors')
      .update({ captured_email: email, email_captured_at: new Date().toISOString() })
      .eq('visitor_id', visitorId)
      .is('captured_email', null)
      .select('visitor_id')

    if (error) {
      // Column-missing (pre-migration) or other error — log and no-op.
      if (!/captured_email/.test(error.message || '')) {
        console.error('[Widget] recordCapturedEmail failed:', error.message)
      }
      return false
    }
    return Array.isArray(data) && data.length > 0
  } catch (err) {
    console.error('[Widget] recordCapturedEmail threw:', err)
    return false
  }
}

/**
 * Increment visitor counters after a message exchange.
 * Uses read-then-write pattern (acceptable for widget traffic levels).
 */
export async function incrementVisitorCounters(
  visitorId: string,
  messagesDelta: number,
  toolCallsDelta: number
): Promise<void> {
  const supabase = getServiceClient()

  // Read current values
  const { data: current, error: readError } = await supabase
    .from('ss_widget_visitors')
    .select('total_messages, total_tool_calls')
    .eq('visitor_id', visitorId)
    .single()

  if (readError || !current) {
    console.error('[Widget] Failed to read visitor counters:', readError?.message)
    return
  }

  // Write incremented values
  const { error: writeError } = await supabase
    .from('ss_widget_visitors')
    .update({
      total_messages: current.total_messages + messagesDelta,
      total_tool_calls: current.total_tool_calls + toolCallsDelta,
      last_seen_at: new Date().toISOString(),
    })
    .eq('visitor_id', visitorId)

  if (writeError) {
    console.error('[Widget] Failed to update visitor counters:', writeError.message)
  }
}

/**
 * Check if visitor has reached the lifetime free-message limit.
 */
export function isVisitorAtLimit(visitor: WidgetVisitor): boolean {
  return visitor.total_messages >= MAX_FREE_MESSAGES
}

/**
 * Clear a poisoned capture slot (v10.13.4). When Yuri judges a captured
 * address is NOT the visitor's own (third-party address mentioned
 * incidentally), the slot must reopen so the visitor's REAL email can be
 * captured later — and the lead list stays free of non-consenting addresses.
 * Deterministic execution of the model's ownership verdict (v10.7.0
 * corrections-drive-cleanup pattern). The email match guard ensures we only
 * clear the address Yuri actually judged, never a newer capture.
 */
export async function clearCapturedEmail(
  visitorId: string,
  email: string
): Promise<void> {
  const supabase = getServiceClient()
  try {
    const { error } = await supabase
      .from('ss_widget_visitors')
      .update({ captured_email: null, email_captured_at: null })
      .eq('visitor_id', visitorId)
      .ilike('captured_email', email)

    if (error) {
      if (!/captured_email/.test(error.message || '')) {
        console.error('[Widget] clearCapturedEmail failed:', error.message)
      }
    }
  } catch (err) {
    console.error('[Widget] clearCapturedEmail threw:', err)
  }
}

/**
 * Lead recap email lifecycle status (July 15 2026). Transport/observability
 * only — records the RESULT of Yuri's send/ownership judgments, never a
 * judgment itself. See scripts/migrations/add_widget_recap_email_tracking.sql.
 *   suppressed         — Yuri judged no send warranted (should_send=false)
 *   not_their_address  — Yuri judged the address wasn't the visitor's own
 *   sent               — accepted by Resend for delivery
 *   send_failed        — Resend rejected / transport error
 *   delivered          — Resend delivery webhook confirmed
 *   bounced            — Resend bounce webhook
 *   complained         — recipient marked as spam
 */
export type RecapStatus =
  | 'suppressed'
  | 'not_their_address'
  | 'sent'
  | 'send_failed'
  | 'delivered'
  | 'bounced'
  | 'complained'

/**
 * Record the outcome of a lead recap email send (v11.5.0 lead-gen observability).
 *
 * Persists "did this lead actually get their email" so it's a one-line query
 * instead of ss_ai_usage archaeology or a Resend dashboard login. Writes the
 * status, and (on an actual send) the send timestamp + Resend provider id so a
 * later delivery/bounce webhook can be correlated back to this visitor.
 *
 * Best-effort and never throws — recap tracking must never break the stream or
 * the send. Tolerates the recap_* columns being absent pre-migration (same
 * defensive pattern as captured_email): a column-missing error is swallowed.
 */
export async function recordRecapStatus(
  visitorId: string,
  status: RecapStatus,
  options: { providerId?: string; sentAt?: string } = {}
): Promise<void> {
  const supabase = getServiceClient()
  const nowIso = new Date().toISOString()

  const patch: Record<string, string> = {
    recap_status: status,
    recap_status_updated_at: nowIso,
  }
  if (status === 'sent') patch.recap_sent_at = options.sentAt || nowIso
  if (options.providerId) patch.recap_provider_id = options.providerId

  try {
    const { error } = await supabase
      .from('ss_widget_visitors')
      .update(patch)
      .eq('visitor_id', visitorId)

    if (error && !/recap_status|recap_sent_at|recap_provider_id/.test(error.message || '')) {
      console.error('[Widget] recordRecapStatus failed:', error.message)
    }
  } catch (err) {
    console.error('[Widget] recordRecapStatus threw:', err)
  }
}

/**
 * Update recap status from a provider (Resend) delivery/bounce webhook event,
 * matched to the visitor by Resend message id (v11.5.0). Best-effort; never
 * throws. A `delivered` event never downgrades an already-terminal negative
 * status (bounced/complained win) — provider events can arrive out of order.
 */
export async function updateRecapStatusByProviderId(
  providerId: string,
  status: RecapStatus
): Promise<{ matched: boolean }> {
  const supabase = getServiceClient()
  try {
    const { data, error } = await supabase
      .from('ss_widget_visitors')
      .update({ recap_status: status, recap_status_updated_at: new Date().toISOString() })
      .eq('recap_provider_id', providerId)
      .select('visitor_id')

    if (error) {
      if (!/recap_status|recap_provider_id/.test(error.message || '')) {
        console.error('[Widget] updateRecapStatusByProviderId failed:', error.message)
      }
      return { matched: false }
    }
    return { matched: Array.isArray(data) && data.length > 0 }
  } catch (err) {
    console.error('[Widget] updateRecapStatusByProviderId threw:', err)
    return { matched: false }
  }
}

/**
 * Cross-visitor duplicate-send guard (v10.13.3): the same human can appear as
 * two visitor rows (cleared cookies, new device). captured_email is first-wins
 * PER VISITOR, so a second row would trigger a second follow-up email to the
 * same address. Deterministic identity dedup — not judgment.
 *
 * Fail-open: on query error we return false (send proceeds). An occasional
 * duplicate email beats silently never sending due to a transient error.
 */
export async function isEmailCapturedByAnotherVisitor(
  email: string,
  visitorId: string
): Promise<boolean> {
  const supabase = getServiceClient()
  try {
    const { data, error } = await supabase
      .from('ss_widget_visitors')
      .select('visitor_id')
      .ilike('captured_email', email)
      .neq('visitor_id', visitorId)
      .limit(1)

    if (error) {
      if (!/captured_email/.test(error.message || '')) {
        console.error('[Widget] isEmailCapturedByAnotherVisitor failed:', error.message)
      }
      return false
    }
    return Array.isArray(data) && data.length > 0
  } catch (err) {
    console.error('[Widget] isEmailCapturedByAnotherVisitor threw:', err)
    return false
  }
}

/**
 * Attribute a paid subscription back to a Yuri widget conversation.
 *
 * Called from the Stripe webhook on conversion. Matches the new subscriber's
 * email against ss_widget_visitors.captured_email and, if a match exists,
 * stamps converted_at + converted_user_id on that visitor row. This is the
 * irreducibly-SS-side link (LGAAS never sees seoulsister.com signups) that
 * turns "0 of 22" into a MEASURED conversion rate (NORTH-STAR.md One Metric).
 *
 * Best-effort: returns the matched lead_source ('widget') or null. Never
 * throws — attribution failure must never break subscription processing.
 * Deterministic identity-matching, not judgment (AI-First note: data linkage).
 */
export async function attributeConversion(
  email: string | null | undefined,
  userId: string
): Promise<'widget' | null> {
  if (!email) return null
  const supabase = getServiceClient()

  try {
    // Match any widget visitor who typed this email and isn't already
    // marked converted. Case-insensitive on email.
    const { data, error } = await supabase
      .from('ss_widget_visitors')
      .update({
        converted_at: new Date().toISOString(),
        converted_user_id: userId,
      })
      .ilike('captured_email', email)
      .is('converted_at', null)
      .select('visitor_id')

    if (error) {
      // Column-missing (pre-migration) or other — log non-schema errors only.
      if (!/converted_at|converted_user_id|captured_email/.test(error.message || '')) {
        console.error('[Widget] attributeConversion failed:', error.message)
      }
      return null
    }
    // A matched-and-stamped row means this paid sub came from the widget.
    return Array.isArray(data) && data.length > 0 ? 'widget' : null
  } catch (err) {
    console.error('[Widget] attributeConversion threw:', err)
    return null
  }
}
