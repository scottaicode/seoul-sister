import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Two facts chat-Yuri could not see (Nov 10 2026), delivered per turn after the
 * conversation so they never sit in the cached prompt.
 *
 * 1. The check-in she sent. A weekly check-in ends with a button that opens a
 *    chat with one line prefilled. The member lands in a conversation where
 *    Yuri had no record of the note she wrote: she asked "how did the week go?"
 *    by email and then met the answer as if it came from nowhere.
 * 2. The free trial. The advisor prompt says a trial member's dates appear "in
 *    the per-turn facts when known"; nothing ever put them there.
 *
 * Facts only. What she does with them is hers.
 */
export interface MemberTurnFactsInput {
  checkin: { created_at: string; message: string } | null
  trial: { trial_end: string | null } | null
}

/** Pure formatter, exported for tests. Returns '' when there is nothing to say. */
export function formatMemberTurnFacts(input: MemberTurnFactsInput): string {
  const lines: string[] = []
  if (input.checkin) {
    lines.push(
      `Your last weekly check-in to them, sent ${input.checkin.created_at.slice(0, 10)} by email and on their dashboard: "${input.checkin.message.replace(/\s+/g, ' ').trim()}". They may be answering it, or writing about something else.`
    )
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
 * Load both facts. A failed read is logged and yields no fact: Yuri then simply
 * does not have it, which is the state before this existed.
 */
export async function loadMemberTurnFacts(db: SupabaseClient, userId: string, now: number = Date.now()): Promise<string> {
  const since = new Date(now - CHECKIN_ANSWER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [nudge, sub] = await Promise.all([
    db
      .from('ss_user_nudges')
      .select('created_at, message')
      .eq('user_id', userId)
      .eq('nudge_type', 'yuri_checkin')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1),
    db.from('ss_subscriptions').select('status, trial_end').eq('user_id', userId).limit(1),
  ])
  if (nudge.error) console.error('[turn-facts] check-in read failed:', nudge.error.message)
  if (sub.error) console.error('[turn-facts] subscription read failed:', sub.error.message)
  const checkin = ((nudge.data ?? [])[0] as { created_at: string; message: string } | undefined) ?? null
  const subRow = (sub.data ?? [])[0] as { status?: string; trial_end?: string | null } | undefined
  const onTrial = subRow?.status === 'trialing' && (!subRow.trial_end || new Date(subRow.trial_end).getTime() > now)
  return formatMemberTurnFacts({ checkin, trial: onTrial ? { trial_end: subRow?.trial_end ?? null } : null })
}
