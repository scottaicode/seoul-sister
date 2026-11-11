import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Facts chat-Yuri could not see (Nov 10 2026), delivered per turn after the
 * conversation so they never sit in the cached prompt.
 *
 * 1. The check-in she sent. A weekly check-in ends with a button that opens a
 *    chat with one line prefilled. The member lands in a conversation where
 *    Yuri had no record of the note she wrote: she asked "how did the week go?"
 *    by email and then met the answer as if it came from nowhere.
 * 2. WHY she sent it (Nov 11 2026, Bailey's idea). The note now names what is
 *    coming in the member's week and leaves the working-out for the chat, so
 *    the chat has to open knowing what that was: her own reason as she recorded
 *    it, and the forecast she had in front of her.
 * 3. The free trial. The advisor prompt says a trial member's dates appear "in
 *    the per-turn facts when known"; nothing ever put them there.
 *
 * Facts only. What she does with them is hers.
 */
export interface MemberTurnFactsInput {
  checkin: {
    created_at: string
    message: string
    /** Her reasoning, recorded with the decision to write. */
    reasoning?: string | null
    /** The exact forecast text the judge was shown. */
    forecastShown?: string | null
  } | null
  trial: { trial_end: string | null } | null
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Her recorded reason is one or two sentences; anything longer is cut. */
export const CHECKIN_REASON_MAX_CHARS = 500

/**
 * The forecast as it was shown to her, with "(today)" and "(tomorrow)" taken
 * off: those labels were true on the day she wrote the note and are replayed
 * for a week. The dates themselves stay.
 */
export function datedForecast(text: string): string {
  return oneLine(text.replace(/\s*\((?:today|tomorrow)\)/gi, ''))
}

/** Pure formatter, exported for tests. Returns '' when there is nothing to say. */
export function formatMemberTurnFacts(input: MemberTurnFactsInput): string {
  const lines: string[] = []
  if (input.checkin) {
    const sent = input.checkin.created_at.slice(0, 10)
    lines.push(
      `Your last weekly check-in to them, sent ${sent} by email and on their dashboard: "${oneLine(input.checkin.message)}". They may be answering it, or writing about something else.`
    )
    if (input.checkin.reasoning && oneLine(input.checkin.reasoning)) {
      const why = oneLine(input.checkin.reasoning)
      lines.push(`Why you wrote it, in your own note from ${sent}: "${why.length > CHECKIN_REASON_MAX_CHARS ? `${why.slice(0, CHECKIN_REASON_MAX_CHARS)}…` : why}"`)
    }
    if (input.checkin.forecastShown && input.checkin.forecastShown.trim()) {
      lines.push(
        `The forecast you had in front of you when you wrote it, as it stood on ${sent} (it is older now; your weather tool has today's): ${datedForecast(input.checkin.forecastShown)}`
      )
    }
  }
  if (input.trial) {
    lines.push(
      `They are on the free trial. The date it ends and whether a card is on file are shown to them at the top of the app and sent to them by email; you cannot see either, so if they ask, point them there.`
    )
  }
  return lines.length ? `\n\n## Member facts this turn (facts, not instructions)\n${lines.map((l) => `- ${l}`).join('\n')}` : ''
}

/** How far back a check-in still counts as "the one they may be answering". */
export const CHECKIN_ANSWER_WINDOW_DAYS = 7

/**
 * Load the facts. A failed read is logged and yields no fact: Yuri then simply
 * does not have it, which is the state before this existed.
 */
export async function loadMemberTurnFacts(db: SupabaseClient, userId: string, now: number = Date.now()): Promise<string> {
  const since = new Date(now - CHECKIN_ANSWER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [nudge, sub] = await Promise.all([
    db
      .from('ss_user_nudges')
      .select('id, created_at, message')
      .eq('user_id', userId)
      .eq('nudge_type', 'yuri_checkin')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1),
    db.from('ss_subscriptions').select('status, trial_end').eq('user_id', userId).limit(1),
  ])
  if (nudge.error) console.error('[turn-facts] check-in read failed:', nudge.error.message)
  if (sub.error) console.error('[turn-facts] subscription read failed:', sub.error.message)
  const sent = ((nudge.data ?? [])[0] as { id: string; created_at: string; message: string } | undefined) ?? null
  let checkin: MemberTurnFactsInput['checkin'] = sent ? { created_at: sent.created_at, message: sent.message } : null
  if (sent) {
    // The decision row that produced this note holds her reason and what she saw.
    const why = await db
      .from('ss_proactive_judgments')
      .select('reasoning, context_facts')
      .eq('nudge_id', sent.id)
      .eq('user_id', userId)
      .limit(1)
    if (why.error) console.error('[turn-facts] check-in reason read failed:', why.error.message)
    const row = (why.data ?? [])[0] as { reasoning?: string | null; context_facts?: Record<string, unknown> | null } | undefined
    const forecast = row?.context_facts?.forecast_shown
    checkin = { ...checkin!, reasoning: row?.reasoning ?? null, forecastShown: typeof forecast === 'string' ? forecast : null }
  }
  const subRow = (sub.data ?? [])[0] as { status?: string; trial_end?: string | null } | undefined
  const onTrial = subRow?.status === 'trialing' && (!subRow.trial_end || new Date(subRow.trial_end).getTime() > now)
  return formatMemberTurnFacts({ checkin, trial: onTrial ? { trial_end: subRow?.trial_end ?? null } : null })
}
