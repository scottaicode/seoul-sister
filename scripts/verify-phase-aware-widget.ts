/**
 * Verify the v10.3.6 phase-aware widget fix by running
 * getMissingHighValueIngredients against Bailey's active Phase 2 AM
 * routine, with and without the userId parameter.
 *
 * Expected: without userId, the function returns ingredients including
 * ones Yuri explicitly excluded (tranexamic acid, retinol, hyaluronic acid).
 * With userId, those should be filtered out.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/verify-phase-aware-widget.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
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
} catch {
  console.error('Failed to read .env.local')
  process.exit(1)
}

const BAILEY_USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835'
const PHASE_2_AM_ROUTINE_ID = 'fa5925fa-580c-4a62-87b2-c4e20f19e6a9'

async function main() {
  const { getMissingHighValueIngredients } = await import('../src/lib/intelligence/routine-effectiveness.js')
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('=== Bailey, Phase 2 AM routine, skin type: combination ===\n')

  console.log('--- Without userId (pre-fix behavior) ---')
  const without = await getMissingHighValueIngredients(supabase, PHASE_2_AM_ROUTINE_ID, 'combination')
  for (const m of without) {
    console.log(`  ${m.ingredientName} (${m.effectivenessScore}% for ${m.concern})`)
  }

  console.log('\n--- With userId (post-fix behavior) ---')
  const withUid = await getMissingHighValueIngredients(supabase, PHASE_2_AM_ROUTINE_ID, 'combination', BAILEY_USER_ID)
  for (const m of withUid) {
    console.log(`  ${m.ingredientName} (${m.effectivenessScore}% for ${m.concern})`)
  }

  console.log('\n--- Diff ---')
  const filtered = without.filter((w) => !withUid.some((u) => u.ingredientName === w.ingredientName))
  if (filtered.length === 0) {
    console.log('  (no items filtered)')
  } else {
    console.log('  Filtered out:')
    for (const f of filtered) {
      console.log(`    - ${f.ingredientName} — Yuri excluded this in current phase`)
    }
  }
}

main().catch((err) => {
  console.error('UNCAUGHT:', err)
  process.exit(1)
})
