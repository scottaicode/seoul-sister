/**
 * Verify v10.3.7 fixes against Bailey's Phase 2 PM routine.
 * Phase 2 PM has COSRX BHA (Mon/Wed/Fri) which contains Betaine Salicylate
 * and Hyaluronic Acid. The widget should NOT recommend "Salicylic Acid (BHA)"
 * or "Hyaluronic Acid" since the user already has functionally equivalent
 * ingredients via the BHA Blackhead Power Liquid.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

const BAILEY_USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835'
const PHASE_2_PM_ROUTINE_ID = 'fc969697-4b8d-4620-a721-9c39f71b53d0'

async function main() {
  const { getMissingHighValueIngredients } = await import('../src/lib/intelligence/routine-effectiveness.js')
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('=== Bailey, Phase 2 PM routine, skin type: combination ===\n')

  console.log('--- Without userId (pre-fix behavior) ---')
  const without = await getMissingHighValueIngredients(supabase, PHASE_2_PM_ROUTINE_ID, 'combination')
  for (const m of without) {
    console.log(`  ${m.ingredientName} (${m.effectivenessScore}% for ${m.concern})`)
  }

  console.log('\n--- With userId (post-fix behavior) ---')
  const withUid = await getMissingHighValueIngredients(supabase, PHASE_2_PM_ROUTINE_ID, 'combination', BAILEY_USER_ID)
  for (const m of withUid) {
    console.log(`  ${m.ingredientName} (${m.effectivenessScore}% for ${m.concern})`)
  }

  console.log('\n--- Diff ---')
  const filtered = without.filter((w) => !withUid.some((u) => u.ingredientName === w.ingredientName))
  if (filtered.length === 0) {
    console.log('  (no items filtered)')
  } else {
    for (const f of filtered) {
      console.log(`  - ${f.ingredientName} — filtered`)
    }
  }
}

main().catch((err) => {
  console.error('UNCAUGHT:', err)
  process.exit(1)
})
