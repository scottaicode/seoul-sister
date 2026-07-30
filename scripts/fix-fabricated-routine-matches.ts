/**
 * Undo routine steps where a GENERIC step phrase was silently written to a REAL
 * product the user does not own.
 *
 * Bailey, July 27 2026: "I don't even own the Beplain Makiol. Idk where that came
 * from I've never even heard of it."
 *
 * She was right, and it was not a hallucination. On June 7 she asked Yuri to save
 * a Phase 3 routine whose step 1 was the phrase "Shower / cleanse" — an action,
 * not a product. The resolver's loose fallback matched that to a real catalog row
 * (Beplain Makiol Foaming Cleanser) and wrote its product_id into her routine.
 * Yuri warned her at the time ("5 steps matched loosely…") and she fixed the
 * obviously-wrong ones; step 1 read as a plausible cleanser so it survived, and
 * became a durable fact. Seven weeks later Yuri read it back and built a whole
 * calm-down-week plan around a product Bailey has never owned.
 *
 * The CODE is already fixed — the identity floor in src/lib/yuri/tools.ts
 * (July 27) demotes category/step-only queries to match_quality='partial' and
 * every write path refuses 'partial'; 'shower', 'rinse' and 'cleanse' are all in
 * GENERIC_PRODUCT_WORDS. But that floor shipped ~7 weeks AFTER these rows were
 * written and nothing swept what the bug had already stored. This is that sweep.
 *
 * WHY NULL RATHER THAN DELETE: the step is real — she does shower and cleanse.
 * ss_routine_products.product_id is nullable for exactly this case (devices,
 * actions), and the routine page renders null-product steps from `notes`, its own
 * comment citing "actions like shower/cleanse".
 *
 * SAFETY: targets explicit row ids, and every update is additionally guarded on
 * the row still pointing at the fabricated product — so it can never touch a user
 * who genuinely owns this cleanser, and re-running is a no-op.
 *
 * Dry run:  npx tsx scripts/fix-fabricated-routine-matches.ts
 * Apply:    npx tsx scripts/fix-fabricated-routine-matches.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const db = createClient(url, key)

const APPLY = process.argv.includes('--apply')

/** The product the resolver wrongly attached. */
const FABRICATED_PRODUCT_ID = '834d255d-ac5b-4019-8472-7ec29129c8cf'

/**
 * The exact rows to repair, and the step name each should carry instead.
 *
 * The PM row already has a good human note ("Cleanse to bare skin") that Bailey
 * or Yuri wrote deliberately, so it is PRESERVED rather than overwritten — the
 * bug was the fabricated product link, not the note. Only the AM row (notes=null)
 * needs a name supplied, and it gets the phrase from the original save.
 */
const TARGETS: Array<{ id: string; label: string; notes?: string }> = [
  { id: '875c0074-7039-4f13-8a07-53621eb157ff', label: 'Phase 3 PM Routine · step 1' },
  { id: 'd3038497-8557-4edc-93fc-f492a887c637', label: 'Phase 3 AM · step 1', notes: 'Shower / cleanse' },
]

async function main() {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (pass --apply to write) ===\n')

  // Blast-radius check FIRST: has anything else picked up this link since?
  const { data: allLinked, error: scanErr } = await db
    .from('ss_routine_products')
    .select('id, routine_id, step_order, ss_user_routines(name, user_id)')
    .eq('product_id', FABRICATED_PRODUCT_ID)
  if (scanErr) {
    console.error('Scan failed:', scanErr.message)
    process.exit(1)
  }

  console.log(`Rows currently linked to the fabricated product: ${allLinked?.length ?? 0}`)
  for (const r of allLinked ?? []) {
    const routine = r.ss_user_routines as unknown as { name?: string; user_id?: string } | null
    const known = TARGETS.some((t) => t.id === r.id)
    console.log(
      `  ${known ? '·' : '⚠ UNEXPECTED'} ${r.id}  step ${r.step_order}  ` +
        `"${routine?.name ?? '?'}"  user=${routine?.user_id ?? '?'}`
    )
  }
  const unexpected = (allLinked ?? []).filter((r) => !TARGETS.some((t) => t.id === r.id))
  if (unexpected.length) {
    console.log(
      '\n⚠ Rows exist beyond the two this script was written for. Those are NOT touched.\n' +
        '  Re-verify before extending the target list — someone may genuinely own this product.'
    )
  }
  console.log()

  for (const t of TARGETS) {
    const { data: before, error: readErr } = await db
      .from('ss_routine_products')
      .select('id, product_id, notes, step_order')
      .eq('id', t.id)
      .maybeSingle()

    if (readErr) {
      console.error(`${t.label}: read failed — ${readErr.message}`)
      continue
    }
    if (!before) {
      console.log(`${t.label}: row not found (already removed?) — skipping`)
      continue
    }
    if (before.product_id !== FABRICATED_PRODUCT_ID) {
      console.log(
        `${t.label}: already repaired (product_id=${before.product_id ?? 'null'}) — skipping`
      )
      continue
    }

    // Preserve a note the user/Yuri already wrote; only supply one when absent.
    const nextNotes = t.notes ?? before.notes
    console.log(`${t.label}`)
    console.log(`  before: product_id=${before.product_id}  notes=${JSON.stringify(before.notes)}`)
    console.log(`  after:  product_id=null  notes=${JSON.stringify(nextNotes)}`)

    if (!APPLY) continue

    const { error: updErr } = await db
      .from('ss_routine_products')
      .update({ product_id: null, notes: nextNotes })
      .eq('id', t.id)
      // Guard: only act while the row still points at the fabricated product.
      .eq('product_id', FABRICATED_PRODUCT_ID)

    if (updErr) {
      console.error(`  ✗ update failed — ${updErr.message}`)
      continue
    }

    const { data: after } = await db
      .from('ss_routine_products')
      .select('product_id, notes')
      .eq('id', t.id)
      .maybeSingle()
    const ok = after && after.product_id === null && after.notes === nextNotes
    console.log(ok ? '  ✓ repaired' : `  ✗ verify failed — ${JSON.stringify(after)}`)
  }

  // Final confirmation.
  const { count } = await db
    .from('ss_routine_products')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', FABRICATED_PRODUCT_ID)
  console.log(`\nRows still linked to the fabricated product: ${count ?? 0}`)
  if (!APPLY) console.log('(dry run — nothing was written)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
