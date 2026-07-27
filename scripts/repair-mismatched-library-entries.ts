/**
 * Repair mis-joined product-library entries (July 27 2026).
 *
 * WHY: `resolveProductByName` had no identity floor, so routine STEP names and
 * device names were fuzzy-matched to real catalog products and written into
 * ss_user_products as products the user OWNS. memory.ts then rendered them to
 * Yuri under "These are products the user currently owns and uses", with no
 * provenance marker — so Yuri told Bailey that "Beplain Makiol Foaming
 * Cleanser" (matched from a step literally named "Shower / cleanse") was "your
 * nightly cleanser, the one I keep telling you to reach for."
 *
 * WHAT THIS DOES: it does NOT delete anything. For each mis-joined row it sets
 * `product_id = NULL` and `learned_from = 'conversation_inferred'`, preserving
 * `custom_name`, notes, status and history. That degrades the row to an honest
 * custom entry — exactly what today's `matched_loose` guard would produce — so
 * the user keeps their own words and Yuri stops inheriting a false join.
 *
 * SAFETY: dry-run by default. Pass `--apply` to write. Every row is listed with
 * its before/after so the diff is reviewable before and after execution.
 *
 * Usage:
 *   npx tsx scripts/repair-mismatched-library-entries.ts           # dry run
 *   npx tsx scripts/repair-mismatched-library-entries.ts --apply   # execute
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

/**
 * Rows verified BY HAND as wrong. This is deliberately an explicit allow-list
 * rather than a heuristic sweep: nulling a product_id is destructive to the
 * join, and a heuristic that misfires would strip a CORRECT link. Each entry
 * records what the user wrote vs what the matcher chose.
 *
 * Deliberately EXCLUDED (defensible matches, left alone):
 *   - "Pimple patches" -> COSRX Acne Pimple Master Patch  (right category, plausible)
 *   - "Acwell Licorice pH Balancing Toner" -> Acwell Licorice pH Balancing Cleansing Toner
 *   - "Illiyoon Ceramide Ato Concentration Cream" -> ...Concentrate Cream (spelling)
 *   - "Ma:nyo Pure Cleansing Oil" -> ma:nyo Pure Cleansing Oil (case only)
 */
const MISMATCHED: { id: string; wrote: string; matchedTo: string }[] = [
  { id: '4c9a7a22-38a8-4247-bf1f-12abd9cdd818', wrote: 'Colorescience Sunforgettable ... SPF 50', matchedTo: 'Anua Slowpure Glow Up Fluid Sun Serum' },
  { id: '0c7c1d81-2b45-4a27-b0b1-dc1425ea23cc', wrote: 'Cool water rinse (INSTRUCTION)', matchedTo: 'Makeprem Hyal Water-Fit Sun Cream' },
  { id: 'cc0e4461-ead4-4ffd-a1bb-4003f7c3b840', wrote: 'Hero Mighty Patch', matchedTo: 'Dr.ppae Honey HEEL Patch' },
  { id: 'e0bddd0e-7946-4936-a944-90d7ea6f14c1', wrote: 'Ice roller (DEVICE)', matchedTo: 'VT Cryo Ice Mask' },
  { id: '715abaee-08e5-4047-bb88-976055dd84b0', wrote: 'LED mask — Blue/Red schedule (DEVICE)', matchedTo: 'BanoBagi Skin Booster Mask' },
  { id: 'ed028714-17d2-4361-8235-8285d8490d53', wrote: 'Medicube PDRN Pink Peptide EYE CREAM', matchedTo: 'DPPR Hyalcube Essence Sun Cream' },
  { id: 'a4398556-59e6-4985-8826-b496ceffa256', wrote: 'Shower / cleanse (INSTRUCTION)', matchedTo: 'Beplain Makiol Foaming Cleanser' },
  { id: '30a5d0ac-248b-4be4-bd7b-fe64d7c11067', wrote: 'Anua Heartleaf 77% Soothing Toner', matchedTo: "I'm From Rice Toner" },
  { id: 'd56f7265-f468-4e5a-9d76-576a40936958', wrote: 'LED Mask (DEVICE)', matchedTo: 'Laneige Water Sleeping Mask' },
  { id: '2383efa6-454d-44a4-96e9-73c0aad39436', wrote: 'Moisturizer (TBD) (PLACEHOLDER)', matchedTo: 'Jumiso AWE Sun SPF50+' },
  { id: 'a0f960c2-0e5e-4784-b161-d62a767b247f', wrote: 'Round Lab Dokdo Cleanser', matchedTo: 'CNP Laboratory Propolis Energy Ampule' },
  // Found during post-repair verification: a Bailey duplicate of the Anua/I'm From
  // mis-join that the first pass caught only on the other account.
  { id: 'c86b77e8-43ab-40db-a552-3062b1d4a4ba', wrote: 'Anua Heartleaf 70% Rice Ceramide', matchedTo: "I'm From Rice Toner" },
]

async function main() {
  const apply = process.argv.includes('--apply')
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)

  console.log(apply ? '=== APPLYING REPAIR ===' : '=== DRY RUN (pass --apply to write) ===')

  let changed = 0
  for (const row of MISMATCHED) {
    const { data: before, error } = await db
      .from('ss_user_products')
      .select('id, user_id, custom_name, product_id, learned_from, status')
      .eq('id', row.id)
      .maybeSingle()

    if (error) {
      console.error(`  ERROR reading ${row.id}: ${error.message}`)
      continue
    }
    if (!before) {
      console.log(`  SKIP ${row.id} — row not found (already cleaned?)`)
      continue
    }
    if (!before.product_id) {
      console.log(`  SKIP "${before.custom_name}" — product_id already NULL`)
      continue
    }

    console.log(`\n  "${before.custom_name}"`)
    console.log(`    was joined to : ${row.matchedTo}`)
    console.log(`    after repair  : product_id=NULL, learned_from='conversation_inferred'`)
    console.log(`    preserved     : custom_name, notes, status='${before.status}'`)

    if (apply) {
      const { error: upErr } = await db
        .from('ss_user_products')
        .update({ product_id: null, learned_from: 'conversation_inferred' })
        .eq('id', row.id)
      if (upErr) {
        console.error(`    FAILED: ${upErr.message}`)
        continue
      }
      console.log('    ✓ repaired')
    }
    changed++
  }

  console.log(`\n${apply ? 'Repaired' : 'Would repair'} ${changed} row(s).`)
  if (!apply) console.log('Re-run with --apply to execute.')
}

main()
