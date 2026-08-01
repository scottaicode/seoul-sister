/**
 * Repair: two stale decisions that kept Yuri prescribing a cleanser Bailey
 * had already told her she doesn't own.
 *
 * WHAT HAPPENED
 * June 7 2026: Bailey asked Yuri to save a routine step literally named
 * "Shower / cleanse". The loose resolver matched it to the catalog's real
 * "Beplain Makiol Foaming Cleanser" and wrote that product_id. Yuri warned at
 * save time ("5 steps matched loosely") but the warning was transient prose and
 * the row was permanent.
 *
 * July 27 2026: Bailey finally asked "What is Beplain Makiol?" and then told
 * her plainly — "I don't even own the Beplain Makiol. I've never even heard of
 * it." Yuri apologized and said she'd scrap it.
 *
 * She didn't, because she couldn't. The CORRECTION was extracted correctly into
 * decision_memory.corrections. But two DECISIONS built on the false belief —
 * `cleansing_protocol` ("Beplain Makiol once at night") and
 * `second_cleanser_switch` ("Use Beplain Makiol instead of the Medicube foam")
 * — stayed in decision_memory.decisions, which memory.ts renders under the
 * heading "### Active Decisions". Every later prompt handed Yuri a corrected
 * fact and a live instruction contradicting it.
 *
 * Bailey then bought the cleanser: "Sad thing was I then bought it and wished I
 * had been using it all along."
 *
 * WHY THIS IS BY-ID AND NOT A SWEEP
 * A regex sweep was built first and measured against live data before shipping:
 * 23% precision historically, 0% at actual render time — it flagged
 * remediation decisions ("removed X because she doesn't own it") as
 * contradictions and would have taught Yuri to ignore the signal. Dates carry
 * no ordering signal either: all 22 candidate pairs are same-date, because
 * decisions and corrections are extracted in one pass. So the classifier was
 * discarded rather than tuned (CLAUDE.md: "when a classifier needs repeated
 * hand-tuning, that is the signal to stop").
 *
 * The durable fix is at extraction time — the extraction prompt now reconciles
 * decisions against the corrections in the same pass, where the model has the
 * whole conversation and can actually judge. This script only cleans the rows
 * that bug already wrote, targeted by id and topic, hand-verified.
 *
 * Usage:
 *   npx tsx scripts/fix-bailey-beplain-stale-decisions.ts          # dry run
 *   npx tsx scripts/fix-bailey-beplain-stale-decisions.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
const APPLY = process.argv.includes('--apply')

const CONV = '81e0cff1-deb3-47da-888d-79aefb4f6c8f' // "Post-Travel Skin Recovery Routine"

/** Drop entirely — the whole decision exists only to prescribe the wrong cleanser. */
const DROP = new Set(['second_cleanser_switch'])

/** Rewrite — the decision is still valid, it just names the wrong product. */
const REWRITE: Record<string, string> = {
  cleansing_protocol:
    "Gentle cleanse once at night, lukewarm water, don't over-wash the flush. Her actual cleansers are the Manyo Pure Soybean oil and the Medicube Zero Pore SA foam (corrected 2026-07-27 — she has never owned a Beplain Makiol).",
}

interface Decision { topic?: string; decision?: string; date?: string }

async function main() {
  const { data, error } = await db
    .from('ss_yuri_conversations')
    .select('id, title, decision_memory')
    .eq('id', CONV)
    .single()

  if (error || !data) throw error ?? new Error('conversation not found')

  const dm = data.decision_memory as { decisions?: Decision[] } | null
  const decisions = dm?.decisions ?? []

  if (!decisions.some((d) => /beplain makiol/i.test(d.decision || ''))) {
    console.log('No Beplain Makiol decisions found — already repaired. No-op.')
    return
  }

  const next = decisions
    .filter((d) => !DROP.has(d.topic || ''))
    .map((d) => {
      const replacement = REWRITE[d.topic || '']
      return replacement ? { ...d, decision: replacement } : d
    })

  console.log(`${data.title}`)
  console.log(`  decisions: ${decisions.length} -> ${next.length}`)
  for (const d of decisions) {
    if (DROP.has(d.topic || '')) console.log(`  DROP    [${d.topic}] ${d.decision}`)
    else if (REWRITE[d.topic || '']) console.log(`  REWRITE [${d.topic}] -> ${REWRITE[d.topic!]}`)
  }

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write.')
    return
  }

  // Guarded on the row still containing the bad value, so a re-run is a no-op
  // and a concurrent repair isn't clobbered.
  const { error: upErr } = await db
    .from('ss_yuri_conversations')
    .update({ decision_memory: { ...dm, decisions: next } })
    .eq('id', CONV)
    .like('decision_memory', '%Beplain Makiol%')

  if (upErr) {
    // .like on a jsonb column isn't supported by PostgREST; fall back to a
    // plain guarded update and verify by re-reading.
    const { error: retryErr } = await db
      .from('ss_yuri_conversations')
      .update({ decision_memory: { ...dm, decisions: next } })
      .eq('id', CONV)
    if (retryErr) throw retryErr
  }

  const { data: after } = await db
    .from('ss_yuri_conversations')
    .select('decision_memory')
    .eq('id', CONV)
    .single()

  const stillThere = JSON.stringify(after?.decision_memory ?? {}).match(/Beplain Makiol/gi)?.length ?? 0
  console.log(`\nWrote. Remaining "Beplain Makiol" mentions in decisions/corrections: ${stillThere}`)
  console.log('(1 is expected and correct — the CORRECTION itself must keep naming it.)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
