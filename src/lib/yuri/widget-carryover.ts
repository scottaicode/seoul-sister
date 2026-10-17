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
}

export type CarryoverMatch = 'email' | 'browser'

/** Whether this visitor's preview may be shown to this account, and how sure we are. */
export function carryoverMatch(
  visitor: CarryoverVisitor | null,
  user: { id: string; email?: string | null }
): CarryoverMatch | null {
  if (!visitor) return null
  if (visitor.converted_user_id && visitor.converted_user_id !== user.id) return null
  const captured = visitor.captured_email?.trim().toLowerCase()
  if (captured && captured === (user.email ?? '').trim().toLowerCase()) return 'email'
  return 'browser'
}

export interface Carryover {
  match: CarryoverMatch
  lastAt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

/** The fact block onboarding Yuri reads. Facts only; what to do with them is hers. */
export function carryoverBlock(c: Carryover): string {
  const lines = c.messages.map((m) => `${m.role === 'user' ? 'Them' : 'You'}: ${m.content}`)
  const whose =
    c.match === 'email'
      ? 'the email they gave there is the one on this account'
      : 'they confirmed when they signed up that it was theirs'
  const lead = `This person already talked with you in the free preview on Seoul Sister's landing page before creating their account; ${whose}. The last preview message was on ${c.lastAt.slice(0, 10)}. You are not meeting them for the first time. None of it was copied into their profile: what they confirm with you here is what gets saved, so confirm what still holds rather than asking from scratch, since things may have changed.`
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
      .select('captured_email, converted_user_id')
      .eq('visitor_id', visitorId)
      .maybeSingle()
    if (vErr) {
      console.error('[widget-carryover] visitor read failed:', vErr.message)
      return null
    }
    const match = carryoverMatch(visitor as CarryoverVisitor | null, user)
    if (!match) return null

    const { data: rows, error: mErr } = await db
      .from('ss_widget_messages')
      .select('role, content, created_at')
      .eq('visitor_id', visitorId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(200)
    if (mErr) {
      console.error('[widget-carryover] messages read failed:', mErr.message)
      return null
    }
    const messages = (rows ?? [])
      .filter((r) => typeof r.content === 'string' && r.content.trim() !== '')
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as string }))
    if (!messages.length) return null
    return { match, lastAt: (rows ?? [])[(rows ?? []).length - 1].created_at as string, messages }
  } catch (e) {
    console.error('[widget-carryover] load failed:', e instanceof Error ? e.message : String(e))
    return null
  }
}
