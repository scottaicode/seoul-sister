/**
 * Repair: Bailey's PM routine step 9 is a Dr.ppae Honey HEEL Patch — a FOOT
 * product — because add_to_routine fuzzy-matched "patch" to the nearest catalog
 * neighbor and wrote its product_id. Yuri's own note on the row says what she
 * actually meant: "On surfacing bumps as needed (custom entry, not in product DB)."
 *
 * The tool bug is fixed (add_to_routine/remove_from_routine now use the STRICT
 * resolver and refuse near-misses), but the bad row it already wrote is still
 * live in her routine. Convert it to what it should have been: a custom step
 * (product_id = NULL) whose display label is the real intent. The routine page
 * renders `notes` as the label for null-product steps, so this shows correctly.
 *
 * Usage:
 *   npx tsx scripts/fix-bailey-heel-patch-step.ts          # dry run
 *   npx tsx scripts/fix-bailey-heel-patch-step.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
const APPLY = process.argv.includes('--apply')
const BAILEY = '551569d3-aed0-4feb-a340-47bfb146a835'

async function main() {
  const { data: rows, error } = await db
    .from('ss_routine_products')
    .select('id, step_order, product_id, notes, routine_id, ss_user_routines!inner(user_id, routine_type, is_active), ss_products(brand_en, name_en)')
    .eq('ss_user_routines.user_id', BAILEY)
    .eq('ss_user_routines.is_active', true)
  if (error) throw error

  // Only the mis-matched foot-care row. Identify by the wrong product, not by
  // step number — step numbers shift.
  const bad = (rows || []).filter((r: any) =>
    r.ss_products && /heel/i.test(`${r.ss_products.brand_en} ${r.ss_products.name_en}`)
  )

  if (!bad.length) {
    console.log('No heel-patch row found — nothing to repair.')
    return
  }

  for (const r of bad as any[]) {
    console.log(`Found: step ${r.step_order} → "${r.ss_products.brand_en} ${r.ss_products.name_en}" (a FOOT product)`)
    console.log(`  notes: ${r.notes}`)
    console.log(`  fix:   product_id -> NULL, label -> custom pimple-patch step`)
    if (!APPLY) continue
    const { error: e } = await db
      .from('ss_routine_products')
      .update({
        product_id: null,
        notes: 'Pimple patch — on surfacing bumps as needed (custom entry, not in product DB)',
      })
      .eq('id', r.id)
    if (e) throw e
    console.log('  ✅ repaired')
  }

  if (!APPLY) console.log('\nDRY RUN — nothing written. Re-run with --apply.')
}

main().catch((e) => { console.error(e); process.exit(1) })
