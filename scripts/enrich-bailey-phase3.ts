/**
 * One-time data repair: enrich Bailey's auto-extracted Phase 3 record.
 *
 * Context (May 31 2026): On May 29, Yuri legitimately completed Phase 2 and
 * created Phase 3 "Brightening/Glow" (verified in conversation 8a950e22 — Yuri
 * said "The chin's done. This is what 'Phase 2 complete'..." and "The brightening
 * active we bring in for Phase 3 (tranexamic acid was the frontrunner)").
 *
 * BUT the auto-extractor wrote a thin record:
 *   - goal: generic "Brightening and glow enhancement"
 *   - protocol: {} (empty)
 *   - watch_for: null  <-- breaks product-curation.ts phase filtering + skin-breakdown rendering
 *   - decisions: a bare STRING (schema/other phases use an array of {date, decision})
 *
 * Four user-facing surfaces read the active phase's goal/protocol/watch_for
 * (product-curation curated browse, skin-breakdown Skin Profile prose,
 * ingredient enrichment "For You" panel, skin-profile timeline). A thin/null
 * record degrades all four for the lighthouse user.
 *
 * This repair backfills Phase 3 to match the depth of Phases 1-2, grounded
 * STRICTLY in what Yuri actually said in the May 29 conversations
 * (8a950e22 "Morning Lighting" + 64afe65e "Trouble Spot Progress"). No invention.
 *
 * Same pattern as the v10.6.0 Bailey phase backfill (scripts/backfill-bailey-phases.ts).
 *
 * Usage:
 *   Dry run:  npx tsx --tsconfig tsconfig.json scripts/enrich-bailey-phase3.ts
 *   Execute:  npx tsx --tsconfig tsconfig.json scripts/enrich-bailey-phase3.ts --execute
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BAILEY_ID = '551569d3-aed0-4feb-a340-47bfb146a835'
const PHASE_3_ID = '51d9d4a5-036b-44d2-a826-84623eb460ea'
const EXECUTE = process.argv.includes('--execute')

// All values below are grounded in Yuri's actual May 29 statements.
const goal =
  'Fade post-inflammatory hyperpigmentation and even out tone now that Phase 2 ' +
  'cleared the chin/jaw congestion. Introduce a brightening active (tranexamic ' +
  'acid is the frontrunner) while dropping BHA to maintenance cadence. Hold the ' +
  'barrier and sun-protection gains from Phases 1-2. Phase is contingent on chin ' +
  'clearance holding — if new comedones return, pause brightening and step BHA back up.'

const protocol = {
  notes:
    'Climate context: humid Austin. Brightening on Fitzpatrick 3 means PIH ' +
    'prevention discipline (daily SPF non-negotiable). Tranexamic acid chosen as ' +
    'the brightening frontrunner; it can also be patted gently under the eye for ' +
    'the pigmented portion of the under-eye darkness.',
  bha_cadence: '1-2x/week maintenance (down from Phase 2 MWF) — only if chin stays clear',
  brightening_active: 'Tranexamic acid (frontrunner) — introduce slowly, AM or PM',
  am_routine: [
    'Gentle cleanse',
    'Hydrating toner',
    'Goodal Green Tangerine Vita C Dark Spot Serum (continue — early PIH prevention)',
    'Ceramide/centella moisturizer',
    'SPF (non-negotiable for brightening on Fitz 3)',
  ],
  pm_routine: [
    'Oil cleanse / low-pH water cleanse',
    'Tranexamic acid brightening active (introduce slowly)',
    'BHA only on maintenance nights (1-2x/week), chin/jaw only, if congestion signals return',
    'Illiyoon ceramide moisturizer',
    'LED: red light for barrier/recovery; blue light only if congestion flares',
  ],
  eye_care_note:
    'Medicube eye serum is a peptide/PDRN serum (firmness), NOT a pigment-fighter. ' +
    'Do not repurchase it FOR the under-eye darkness — it will not move melanin. ' +
    'The pigmented portion responds to the brightening active; the structural ' +
    '(tear-trough shadow) portion is anatomy and will not respond to topicals.',
}

// Structured array to match Phases 1-2 (the auto-extractor wrote a bare string).
const decisions = [
  {
    date: '2026-05-29',
    decision:
      'Phase 2 complete — chin/jaw closed comedones essentially cleared by MWF BHA. Transition to Phase 3 (brightening).',
  },
  {
    date: '2026-05-29',
    decision:
      'Drop BHA to 1-2x/week maintenance. Phase 3 contingent on chin clearance holding; if new comedones return, pause brightening and step BHA back up.',
  },
  {
    date: '2026-05-29',
    decision:
      'Tranexamic acid is the brightening-active frontrunner for Phase 3 (PIH + early hyperpigmentation).',
  },
  {
    date: '2026-05-29',
    decision:
      'Under-eye darkness is pigmented + structural. Do NOT repurchase Medicube eye serum for the darkness (it is PDRN/peptide, not a pigment-fighter). Treat the pigmented portion with the brightening active; the structural portion will not respond to topicals.',
  },
]

const watch_for = [
  'PIH/PIE marks lingering or worsening on chin/jaw (Fitzpatrick 3 is the PIH danger zone) — the whole point of Phase 3 is to fade these, so track them',
  'New closed comedones returning despite maintenance BHA — signal to pause brightening and step BHA back up to MWF (Phase 3 is contingent on chin staying clear)',
  'Brightening active stinging or irritation past the first 7 days — step back the frequency',
  'Vascular flush across cheeks/nose is normal Fitz-3 vasculature, NOT a breakout or barrier damage — do not treat it as congestion',
]

async function main() {
  console.log(`=== Enrich Bailey Phase 3 (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===\n`)

  // Verify the current state first
  const { data: current, error: readErr } = await supabase
    .from('ss_treatment_phases')
    .select('id, phase_number, name, goal, status, protocol, decisions, watch_for')
    .eq('id', PHASE_3_ID)
    .eq('user_id', BAILEY_ID)
    .single()
  if (readErr) throw readErr
  if (!current) throw new Error('Phase 3 record not found — aborting (will not create).')
  if (current.status !== 'active') {
    throw new Error(`SAFETY ABORT: Phase 3 status is "${current.status}", expected "active".`)
  }

  console.log('BEFORE:')
  console.log('  goal:', current.goal)
  console.log('  protocol keys:', Object.keys(current.protocol ?? {}).length)
  console.log('  decisions type:', Array.isArray(current.decisions) ? 'array' : typeof current.decisions)
  console.log('  watch_for:', current.watch_for === null ? 'NULL' : `${(current.watch_for as unknown[]).length} items`)

  console.log('\nAFTER (proposed):')
  console.log('  goal: [enriched, grounded in May 29 conversations]')
  console.log('  protocol keys:', Object.keys(protocol).length)
  console.log('  decisions:', decisions.length, 'structured entries')
  console.log('  watch_for:', watch_for.length, 'items')

  if (!EXECUTE) {
    console.log('\nDry run complete. Re-run with --execute to apply.')
    return
  }

  const { error: updErr } = await supabase
    .from('ss_treatment_phases')
    .update({
      goal,
      protocol,
      decisions,
      watch_for,
      last_yuri_update_at: new Date().toISOString(),
    })
    .eq('id', PHASE_3_ID)
    .eq('user_id', BAILEY_ID)
  if (updErr) throw updErr

  console.log('\nPhase 3 enriched successfully.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
