import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// One-off data correction: repair 5 of Bailey's saved routine steps that the
// old loose-match save bug pointed at the wrong catalog product. For each, null
// the wrong product_id and write the correct product name into notes (the
// routine page renders notes for null-product custom steps). Targeted by exact
// step_id so nothing else is touched.

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const FIXES: { step_id: string; label: string; notes: string }[] = [
  {
    step_id: 'b869e1f5-bdba-45fc-a611-30797b4b4087',
    label: 'AM step 5: I\'m From Rice Toner -> Anua milky toner',
    notes:
      'Anua Rice 70 + Ceramide Glow Milky Toner — Toner-essence hybrid, your real product (not I\'m From Rice Toner)',
  },
  {
    step_id: '9d161165-377f-49af-8361-49bf8d88909b',
    label: 'AM step 6: DPPR Hyalcube Sun Cream -> Medicube eye cream',
    notes: 'Medicube PDRN Pink Peptide Eye Cream',
  },
  {
    step_id: 'f9077b22-e160-492a-ad4f-ef28d65b8234',
    label: 'AM step 7: Anua Slowpure Sun Serum -> Colorescience SPF',
    notes:
      'Colorescience Sunforgettable Total Protection Face Shield Glow SPF 50 — Only SPF for next 10-14 days, BB cream paused for occlusion test. 100% mineral, SPF 50, PA++++',
  },
  {
    step_id: 'f51c8f27-ac72-41ea-a52b-bd914d165abe',
    label: 'PM step 6: I\'m From Rice Toner -> Anua milky toner',
    notes: 'Anua Rice 70 + Ceramide Glow Milky Toner — your real Anua (not I\'m From Rice Toner)',
  },
  {
    step_id: '27e5a87e-ed89-420c-91ce-8523c1894691',
    label: 'PM step 8: DPPR Hyalcube Sun Cream -> Medicube eye cream',
    notes: 'Medicube PDRN Pink Peptide Eye Cream — Ring finger tap',
  },
]

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)

  for (const fix of FIXES) {
    const { error } = await db
      .from('ss_routine_products')
      .update({ product_id: null, notes: fix.notes })
      .eq('id', fix.step_id)
    if (error) {
      console.error(`FAILED ${fix.label}:`, error.message)
    } else {
      console.log(`OK     ${fix.label}`)
    }
  }

  // Verify: re-read the two routines and print each step's resolved name.
  console.log('\n--- VERIFY ---')
  const stepIds = FIXES.map((f) => f.step_id)
  const { data } = await db
    .from('ss_routine_products')
    .select('id, step_order, product_id, notes, routine:routine_id (routine_type)')
    .in('id', stepIds)
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const routine = r.routine as { routine_type?: string } | null
    console.log(
      `${routine?.routine_type?.toUpperCase()} step ${r.step_order}: product_id=${r.product_id ?? 'NULL'} | ${r.notes}`
    )
  }
}

main().then(() => process.exit(0))
