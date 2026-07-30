/**
 * Undo routine steps where an LED light-therapy DEVICE was silently written to a
 * real catalog MASK product the user does not own.
 *
 * Same defect as the Beplain Makiol sweep (scripts/fix-fabricated-routine-matches.ts,
 * July 27 2026), on a different word. Bailey owns an LED mask — a device, correctly
 * stored in her library as a custom entry with no product_id. But when Yuri saved
 * routines containing an "LED mask" step, the resolver's loose fallback matched the
 * word "mask" to real catalog products and wrote their product_id into the routine:
 *
 *   "10 min on bare clean skin BEFORE any products. Blue = hormonal/breakout days,
 *    Red = barrier + collagen"        -> BanoBagi Skin Booster Mask   (a sheet mask)
 *   "On clean skin, before any products"  -> VT Cryo Ice Mask          (a sheet mask)
 *   "10 min on bare clean skin. Blue 3x for jawline P. acnes..."
 *                                     -> Innisfree Super Volcanic Pore Clay Mask 2X
 *
 * The notes describe blue/red light sessions. None of these products are in her
 * library. A clay mask standing in for a light-therapy step is not a near-miss —
 * it is a different act of skincare, and Yuri reads these rows back as fact.
 *
 * WHY NULL RATHER THAN DELETE: the step is real — she does use an LED mask nightly.
 * ss_routine_products.product_id is nullable for exactly this case (devices,
 * actions), the routine page renders null-product steps from `notes`, and as of
 * July 30 those rows are finally deletable/reorderable by row id. Nulling keeps the
 * step and its schedule while removing the false product identity.
 *
 * The note already carries the step's identity for the two rows whose text starts
 * with the schedule rather than a name, so we prepend "LED mask — " where the note
 * does not already name it. That matches how save_routine writes custom steps and
 * how every reader (routine page, memory.ts, get_routine_context) displays them.
 *
 * SAFETY: targets explicit row ids; every update is additionally guarded on the row
 * STILL pointing at the specific wrong product, so it can never touch a user who
 * genuinely owns one of these masks, and re-running is a no-op.
 *
 * Dry run:  npx tsx scripts/fix-led-mask-routine-matches.ts
 * Apply:    npx tsx scripts/fix-led-mask-routine-matches.ts --apply
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

/**
 * Rows to fix, identified by an audit of every catalog-linked routine step whose
 * product is absent from the owning user's library. Each entry pins one exact row.
 * The guard against touching the wrong thing is read from the LIVE row at run time
 * (it must still point at a mask-category product), not hardcoded here — so if a
 * row has since been corrected or re-pointed, this script leaves it alone.
 */
const TARGETS: Array<{ stepId: string; label: string }> = [
  {
    stepId: '1ed2717c-ec69-4856-b68e-89dd127affe2',
    label: 'Phase 3 PM Routine step 2 -> BanoBagi Skin Booster Mask',
  },
  {
    stepId: '73c9f382-a077-492e-ba11-69df6f7a0a55',
    label: 'Phase 3 AM step 2 -> VT Cryo Ice Mask',
  },
  {
    stepId: 'a916ce3c-75f2-49cc-8124-04f644c301b1',
    label: 'Phase 1 Final Week PM step 3 -> Innisfree Super Volcanic Pore Clay Mask 2X (inactive routine)',
  },
  {
    stepId: 'a4d35e40-ba3d-413e-8df9-93ceebe0806e',
    label: 'Phase 3 AM step 2 -> VT Cryo Ice Mask (inactive routine)',
  },
  {
    stepId: '95005f68-8809-4157-87b8-bffaba643fd3',
    label: 'Phase 3 AM step 2 -> VT Cryo Ice Mask (inactive routine, no note)',
  },
]

/** Prefix the note with the step's real identity when it does not already name it. */
function ledLabelledNote(notes: string | null): string {
  const trimmed = (notes || '').trim()
  if (!trimmed) return 'LED mask'
  if (/^led mask/i.test(trimmed)) return trimmed
  return `LED mask — ${trimmed}`
}

async function main() {
  console.log(APPLY ? '=== APPLY MODE ===\n' : '=== DRY RUN (pass --apply to write) ===\n')

  let wouldChange = 0
  let changed = 0
  let skipped = 0

  for (const t of TARGETS) {
    const { data: row } = await db
      .from('ss_routine_products')
      .select('id, product_id, notes, step_order, routine_id')
      .eq('id', t.stepId)
      .maybeSingle()

    if (!row) {
      console.log(`SKIP  ${t.label}\n      row no longer exists`)
      skipped++
      continue
    }

    if (row.product_id === null) {
      console.log(`SKIP  ${t.label}\n      already nulled (re-run is a no-op)`)
      skipped++
      continue
    }

    const { data: prod } = await db
      .from('ss_products')
      .select('name_en, brand_en, category')
      .eq('id', row.product_id)
      .maybeSingle()

    // Refuse anything that is not a mask-category product — if the row has since
    // been re-pointed at something else, a blind null would destroy real data.
    if (prod?.category !== 'mask') {
      console.log(
        `SKIP  ${t.label}\n      row now points at ${prod?.brand_en} ${prod?.name_en} (${prod?.category}) — not the expected mask; leaving alone`
      )
      skipped++
      continue
    }

    const newNotes = ledLabelledNote(row.notes)
    console.log(`FIX   ${t.label}`)
    console.log(`      product_id ${row.product_id} (${prod.brand_en} ${prod.name_en}) -> NULL`)
    if (newNotes !== (row.notes || '').trim()) {
      console.log(`      notes: ${JSON.stringify(row.notes)} -> ${JSON.stringify(newNotes)}`)
    }

    if (APPLY) {
      const { error } = await db
        .from('ss_routine_products')
        .update({ product_id: null, notes: newNotes })
        .eq('id', row.id)
        .eq('product_id', row.product_id) // guard: only if still the wrong product
      if (error) {
        console.log(`      ERROR: ${error.message}`)
      } else {
        changed++
      }
    } else {
      wouldChange++
    }
  }

  console.log(
    `\n${APPLY ? `updated ${changed}` : `would update ${wouldChange}`} row(s), skipped ${skipped}`
  )

  if (APPLY && changed > 0) {
    const { data: left } = await db
      .from('ss_routine_products')
      .select('id')
      .in('id', TARGETS.map((t) => t.stepId))
      .not('product_id', 'is', null)
    console.log(`verification: ${left?.length ?? 0} target row(s) still linked to a product (expect 0)`)
  }
}

main()
