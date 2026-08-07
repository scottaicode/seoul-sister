/**
 * Two data repairs from Bailey's Aug 7 2026 report, both the same shape:
 * a fact the system genuinely captured, sitting somewhere no consumer reads.
 *
 * ---------------------------------------------------------------------------
 * REPAIR 1 — a stated Fitzpatrick that had nowhere to land
 *
 * Bailey: "Hmm why can she do everything except that scale"
 *
 * On Aug 7 she gave Yuri a COMPLETE burn+tan answer ("burns first, then tans,
 * peels on bad burns") and Yuri replied "Locked in as Fitzpatrick III on my end
 * 🔒 ... every future acid, retinoid, and TXA call I make for you now assumes
 * III". /profile still rendered "—".
 *
 * Yuri was half right. She has NO profile-write tool (verified: all 19
 * authenticated tools only READ ss_user_profiles), so "I can't write to that
 * field" was honest. But "captured for every future call" was FALSE — the
 * v11.18.0 false-write class. The decision row is real, in conversation
 * cbbdef6c decision_memory.decisions[topic=fitzpatrick_type], but:
 *   - loadDecisionMemory reads only the 3 MOST RECENT conversations
 *     (memory.ts:1802-1811), and
 *   - the durable store rescues `corrections` ONLY, never `decisions`
 *     (durable-memory.ts:101-106, memory.ts:625-630).
 *
 * Measured at the time of writing: fitzpatrick_type was in slot 2 of 3, and
 * she had 6 conversations in ~100 minutes. Two more and the fact was gone for
 * good while fitzpatrick_scale stayed NULL — at which point memory.ts:787 tells
 * Yuri she was NEVER told, so she re-asks a question Bailey already answered and
 * Yuri already called locked.
 *
 * WHY source='stated' AND NOT 'estimated': the v11.10.0 rule requires BOTH
 * halves of the burn/tan response. "Burns first, then tans, peels on bad burns"
 * is both halves plus the peel detail, so this is a stated value, not a derived
 * one. We are persisting what the user actually said — not defaulting a clinical
 * field, which remains forbidden.
 *
 * ---------------------------------------------------------------------------
 * REPAIR 2 — notes destroyed by the act of being read
 *
 * Bailey: "Also my note went away, what happened to that??"
 *
 * YuriNudgeCard renders under the heading "A note from Yuri" and POSTs
 * status:'surfaced' on first render (YuriNudgeCard.tsx:59-62). GET /api/me/nudge
 * returns ONLY status='pending' (route.ts:23). Nothing anywhere reads
 * 'surfaced' — grepped the tree; the only readers are 'pending' (dashboard +
 * send-pending-nudge-emails.ts:125) and 'acted' (nudge-outcome-grader.ts:181).
 * So it is a terminal state with no reader: looking at the note once consumes it.
 *
 * She never dismissed or acted on it (dismissed_at / acted_at both NULL) and the
 * email was DELIVERED, so she saw it twice and went looking for it.
 *
 * The route fix (return pending OR undismissed-surfaced) ships alongside this.
 * This script restores the stranded rows the bug already ate — shipping the
 * guard does not clean what the bug wrote.
 *
 * SAFETY: every update is guarded on the row still holding the bad value, so
 * re-running is a no-op and a row someone has since dismissed/acted on is never
 * resurrected. Targets explicit ids, never a broad predicate.
 *
 * Dry run:  npx tsx scripts/fix-bailey-fitzpatrick-and-stranded-nudges.ts
 * Apply:    npx tsx scripts/fix-bailey-fitzpatrick-and-stranded-nudges.ts --apply
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

/** Bailey — the stated-Fitzpatrick case. */
const BAILEY_USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835'
/** The conversation whose decision_memory holds the complete burn+tan answer. */
const FITZ_SOURCE_CONVERSATION = 'cbbdef6c-e0ba-47bb-bed5-4f59cd933896'
const FITZ_VALUE = 3

async function repairFitzpatrick(db: ReturnType<typeof getServiceClient>) {
  console.log('\n── REPAIR 1: stated Fitzpatrick → profile ───────────────────')

  // Re-verify the decision still exists and says what we think it says. If the
  // eviction already happened we must NOT invent the value from this comment.
  const { data: convo, error: convoError } = await db
    .from('ss_yuri_conversations')
    .select('id, decision_memory')
    .eq('id', FITZ_SOURCE_CONVERSATION)
    .maybeSingle()

  if (convoError) {
    console.error('  ✗ could not read source conversation:', convoError.message)
    return
  }

  const decisions = (convo?.decision_memory as { decisions?: Array<{ topic?: string; decision?: string }> } | null)
    ?.decisions ?? []
  const fitzDecision = decisions.find((d) => d.topic === 'fitzpatrick_type')

  if (!fitzDecision) {
    console.error('  ✗ fitzpatrick_type decision NOT found in', FITZ_SOURCE_CONVERSATION)
    console.error('    Refusing to write a clinical value with no surviving provenance.')
    return
  }
  console.log('  provenance:', fitzDecision.decision)

  const { data: before, error: beforeError } = await db
    .from('ss_user_profiles')
    .select('user_id, fitzpatrick_scale, fitzpatrick_source')
    .eq('user_id', BAILEY_USER_ID)
    .maybeSingle()

  if (beforeError) {
    console.error('  ✗ could not read profile:', beforeError.message)
    return
  }
  console.log('  current: scale=%s source=%s', before?.fitzpatrick_scale, before?.fitzpatrick_source)

  if (before?.fitzpatrick_scale != null) {
    console.log('  ✓ already set — no-op')
    return
  }
  if (!APPLY) {
    console.log('  DRY RUN → would set fitzpatrick_scale=%d, fitzpatrick_source=stated', FITZ_VALUE)
    return
  }

  // Guarded on still-NULL so a concurrent/legit write is never clobbered.
  const { data: updated, error } = await db
    .from('ss_user_profiles')
    .update({
      fitzpatrick_scale: FITZ_VALUE,
      fitzpatrick_source: 'stated',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', BAILEY_USER_ID)
    .is('fitzpatrick_scale', null)
    .select('user_id, fitzpatrick_scale, fitzpatrick_source')

  if (error) {
    console.error('  ✗ update failed:', error.message)
    return
  }
  console.log('  ✓ wrote', JSON.stringify(updated))
}

async function repairStrandedNudges(db: ReturnType<typeof getServiceClient>) {
  console.log('\n── REPAIR 2: notes consumed by being seen ───────────────────')

  // Find every nudge stranded in 'surfaced' that the user never dismissed or
  // acted on. These are precisely the ones no query can ever return again.
  const { data: allStranded, error } = await db
    .from('ss_user_nudges')
    .select('id, user_id, nudge_type, status, message, surfaced_at, dismissed_at, acted_at')
    .eq('status', 'surfaced')
    .is('dismissed_at', null)
    .is('acted_at', null)

  if (error) {
    console.error('  ✗ could not read nudges:', error.message)
    return
  }
  if (!allStranded?.length) {
    console.log('  ✓ none stranded — no-op')
    return
  }

  // Only restore notes that are still TRUE. A nudge is a timed observation about
  // where someone is in their routine; resurfacing a stale one is its own bug.
  // The June 17 open_loop asks about "those stubborn bumps after the adapalene
  // run" — that question was answered weeks ago, and re-asking it would read
  // exactly like the memory callback that Bailey took as a scold (v11.18.0).
  // Restore only notes surfaced within the freshness window; leave older ones
  // consumed, which is the outcome they already have.
  const FRESHNESS_DAYS = 14
  const cutoff = Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000
  const stale = allStranded.filter((n) => new Date(n.surfaced_at as string).getTime() < cutoff)
  const stranded = allStranded.filter((n) => new Date(n.surfaced_at as string).getTime() >= cutoff)

  if (stale.length) {
    console.log('  skipping %d stale note(s) (>%dd old — would resurface a dead question):', stale.length, FRESHNESS_DAYS)
    for (const n of stale) {
      console.log('   · %s  type=%s  surfaced=%s', n.id, n.nudge_type, n.surfaced_at)
    }
  }
  if (!stranded.length) {
    console.log('  ✓ nothing fresh enough to restore — no-op')
    return
  }

  console.log('  found %d stranded note(s):', stranded.length)
  for (const n of stranded) {
    console.log(
      '   - %s  user=%s  type=%s  surfaced=%s',
      n.id, String(n.user_id).slice(0, 8), n.nudge_type, n.surfaced_at
    )
    console.log('     "%s…"', String(n.message).slice(0, 90))
  }

  if (!APPLY) {
    console.log('  DRY RUN → would reset %d row(s) to status=pending', stranded.length)
    return
  }

  for (const n of stranded) {
    // Guarded on the row still being an untouched 'surfaced' row.
    const { error: upErr } = await db
      .from('ss_user_nudges')
      .update({ status: 'pending' })
      .eq('id', n.id)
      .eq('status', 'surfaced')
      .is('dismissed_at', null)
      .is('acted_at', null)

    if (upErr) console.error('   ✗ %s: %s', n.id, upErr.message)
    else console.log('   ✓ %s → pending', n.id)
  }
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE ***' : '*** DRY RUN (pass --apply to write) ***')
  const db = getServiceClient()
  await repairFitzpatrick(db)
  await repairStrandedNudges(db)
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
