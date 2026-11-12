import type { SupabaseClient } from '@supabase/supabase-js'
import { budgetedTranscript } from '@/lib/utils/text-slice'

/**
 * Carry a visitor's free-preview conversation into their onboarding.
 *
 * The preview's limit card says signing up keeps the conversation and "we pick
 * up here instead of starting over". Until Oct 17 2026 nothing did: onboarding,
 * memory, the paid chat and Stripe never read ss_widget_*, so a visitor who paid
 * on that promise was greeted as a stranger. This loads the preview transcript
 * (same browser: the visitor id lives in localStorage) and hands it to
 * onboarding Yuri as a fact.
 *
 * Consent and ownership. The onboarding page sends a visitor id ONLY after the
 * person answers "Yes, that was me" to CarryoverPrompt (a browser can be
 * shared). Server side, a preview already linked to a DIFFERENT account never
 * loads. 'email' = the preview email is this account's; 'browser' = they said
 * yes but the emails differ or none was given (the one subscriber who ever
 * converted from the preview signed up under a different address than the one
 * she gave; only 1 of 22 captured preview emails matches an account email).
 *
 * It is context for Yuri ONLY: never extracted into the profile, because
 * extraction finalizes onboarding as soon as skin_type exists, which marked
 * onboarding complete before Yuri had spoken (review, Oct 17 2026).
 */

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/**
 * Fits every preview on record in full (longest of 124 visitors: 42,439 chars,
 * Oct 17 2026). A first budget of 16K dropped the OLDEST messages, which are
 * where the visitor states their routine, climate and history. ~12K tokens,
 * cached once per onboarding (~$0.06), then read at the cache rate each turn.
 */
export const CARRYOVER_CHAR_BUDGET = 48000

export interface CarryoverVisitor {
  captured_email: string | null
  converted_user_id: string | null
  /** The first account that confirmed this preview as theirs (set once). */
  registered_user_id?: string | null
}

export type CarryoverMatch = 'email' | 'browser'

/** Whether this visitor's preview may be shown to this account, and how sure we are. */
export function carryoverMatch(
  visitor: CarryoverVisitor | null,
  user: { id: string; email?: string | null }
): CarryoverMatch | null {
  if (!visitor) return null
  if (visitor.converted_user_id && visitor.converted_user_id !== user.id) return null
  // Claimed by another account already (Nov 11 2026). The recap email's account
  // link can be forwarded, and a browser can be shared: whoever comes second
  // does not get the first person's conversation, whatever they answer.
  // The cost, accepted: if the wrong person answers "yes" first, the real
  // owner is refused afterwards, even with a matching address. A matching
  // address is not proof here (sign-up does not confirm the email), so it
  // cannot be allowed to override the first claim.
  if (visitor.registered_user_id && visitor.registered_user_id !== user.id) return null
  const captured = visitor.captured_email?.trim().toLowerCase()
  if (captured && captured === (user.email ?? '').trim().toLowerCase()) return 'email'
  return 'browser'
}

export interface Carryover {
  match: CarryoverMatch
  lastAt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

/**
 * How long ago the preview chat ended, as one sentence for setup Yuri's
 * per-turn state (Nov 11 2026). The block below is cached and names only a
 * date, so she could not tell minutes from months: in both of the first real
 * sign-ups she opened with "Welcome back. Last time..." and asked whether the
 * visitor had tried her advice yet, about a chat that had ended minutes
 * earlier. Null when the time is unusable. Pure.
 */
export function previewAgeFact(lastAt: string | null | undefined, nowMs: number): string | null {
  const then = lastAt ? Date.parse(lastAt) : NaN
  if (Number.isNaN(then)) return null
  const minutes = Math.max(0, Math.round((nowMs - then) / 60000))
  const span =
    minutes < 1
      ? 'less than a minute'
      : minutes < 90
        ? `about ${minutes} minute${minutes === 1 ? '' : 's'}`
        : minutes < 48 * 60
          ? `about ${Math.round(minutes / 60)} hours`
          : `${Math.round(minutes / (60 * 24))} days`
  return `Their free preview chat on the landing page ended ${span} before now.`
}

/** The fact block onboarding Yuri reads. Facts only; what to do with them is hers. */
export function carryoverBlock(c: Carryover): string {
  const lines = c.messages.map((m) => `${m.role === 'user' ? 'Them' : 'You'}: ${m.content}`)
  const whose =
    c.match === 'email'
      ? 'the email they gave there is the one on this account'
      : 'they confirmed when they signed up that it was theirs'
  const lead = `This person already talked with you in the free preview on Seoul Sister's landing page before creating their account; ${whose}. The last preview message was on ${c.lastAt.slice(0, 10)} (UTC date); how long ago that is from each message is stated in Current State. You are not meeting them for the first time. None of it was copied into their profile: what they confirm with you here is what gets saved, so confirm what they told you there rather than asking from scratch. A name you used in the preview is not one they gave unless they typed it.`
  return `## Before they signed up

${lead} Advice you gave there is something you said, not something they have done.

${budgetedTranscript(lines, CARRYOVER_CHAR_BUDGET)}`
}

/** Load the carryover for this account, or null. Never throws: a failure means no carryover, logged. */
export async function loadWidgetCarryover(
  db: SupabaseClient,
  visitorId: string | null | undefined,
  user: { id: string; email?: string | null }
): Promise<Carryover | null> {
  if (!visitorId || !VISITOR_ID.test(visitorId)) return null
  try {
    const { data: visitor, error: vErr } = await db
      .from('ss_widget_visitors')
      .select('captured_email, converted_user_id, registered_user_id')
      .eq('visitor_id', visitorId)
      .maybeSingle()
    if (vErr) {
      console.error('[widget-carryover] visitor read failed:', vErr.message)
      return null
    }
    const match = carryoverMatch(visitor as CarryoverVisitor | null, user)
    if (!match) return null

    // A conversation ended with "Start over" is not carried: that button exists
    // so the next person at a shared device is not handed the last one's chat.
    const { data: ended, error: eErr } = await db
      .from('ss_widget_sessions')
      .select('id')
      .eq('visitor_id', visitorId)
      .eq('ended_naturally', true)
    if (eErr) {
      console.error('[widget-carryover] ended-session read failed:', eErr.message)
      return null
    }
    const endedIds = new Set((ended ?? []).map((s) => s.id as string))

    const { data: all, error: mErr } = await db
      .from('ss_widget_messages')
      .select('role, content, created_at, session_id')
      .eq('visitor_id', visitorId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(200)
    if (mErr) {
      console.error('[widget-carryover] messages read failed:', mErr.message)
      return null
    }
    const rows = (all ?? []).filter((r) => !endedIds.has(r.session_id as string))
    const messages = rows
      .filter((r) => typeof r.content === 'string' && r.content.trim() !== '')
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as string }))
    if (!messages.length) return null

    // Nov 10 2026: record which account claimed this preview. Set-once (the
    // IS NULL filter), so the first account that confirmed it stays on record
    // and repeat loads on later turns write nothing. This is "registered", not
    // "paid": converted_user_id keeps meaning a payment. A failed stamp is
    // logged and never costs the carryover itself.
    if (!(visitor as { registered_user_id?: string | null } | null)?.registered_user_id) try {
      const { error: linkErr } = await db
        .from('ss_widget_visitors')
        .update({ registered_user_id: user.id, registered_at: new Date().toISOString() })
        .eq('visitor_id', visitorId)
        .is('registered_user_id', null)
      if (linkErr) console.error('[widget-carryover] registered stamp failed:', linkErr.message)
    } catch (e) {
      console.error('[widget-carryover] registered stamp threw:', e instanceof Error ? e.message : String(e))
    }

    return { match, lastAt: rows[rows.length - 1].created_at as string, messages }
  } catch (e) {
    console.error('[widget-carryover] load failed:', e instanceof Error ? e.message : String(e))
    return null
  }
}
