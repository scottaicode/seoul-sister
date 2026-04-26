/**
 * One-off fix: COSRX Advanced Snail 96 Mucin Power Essence INCI
 *
 * Phase 15.1 production validation revealed ss_product_ingredients had wrong
 * INCI for product 09dabfa8-b373-4006-9bbc-2393fb2743db. Listed 5 ingredients
 * with beta-glucan at position 5; actual INCI per COSRX official, Soko Glam,
 * and Incidecoder has 12 ingredients with betaine at position 2 (no beta-glucan).
 *
 * This script:
 *   1. Creates 1,2-Hexanediol master ingredient if missing
 *   2. Replaces all link rows with the verified 12-ingredient INCI
 *   3. Populates ss_products.ingredients_raw with the verified comma-delimited list
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/fix-cosrx-snail96-inci.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually (no dotenv dependency)
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const k = trimmed.slice(0, eqIdx).trim()
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  // .env.local not found — assume env is already loaded
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const PRODUCT_ID = '09dabfa8-b373-4006-9bbc-2393fb2743db'

// Verified 12-ingredient INCI list, in concentration order, sources:
//   - cosrx.com official product page
//   - sokoglam.com product page (authorized retailer)
//   - incidecoder.com
const INCI: string[] = [
  'Snail Secretion Filtrate',
  'Betaine',
  'Butylene Glycol',
  '1,2-Hexanediol',
  'Sodium Polyacrylate',
  'Phenoxyethanol',
  'Sodium Hyaluronate',
  'Allantoin',
  'Ethyl Hexanediol',
  'Carbomer',
  'Panthenol',
  'Arginine',
]

async function main() {
  const supabase = createClient(url!, key!)

  console.log('=== COSRX Snail 96 INCI Fix (Phase 15.1 follow-up) ===\n')

  // Step 1: Ensure 1,2-Hexanediol exists
  console.log('Step 1: Checking for 1,2-Hexanediol master ingredient...')
  const { data: existing } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci')
    .eq('name_inci', '1,2-Hexanediol')
    .maybeSingle()

  if (!existing) {
    const { error: insErr } = await supabase
      .from('ss_ingredients')
      .insert({
        name_inci: '1,2-Hexanediol',
        name_en: '1,2-Hexanediol',
        function:
          'Humectant and preservative booster. Common in K-beauty as a multifunctional alternative to traditional preservatives.',
        safety_rating: 4,
        comedogenic_rating: 0,
        is_active: false,
        is_fragrance: false,
      })
    if (insErr) throw new Error(`Failed to insert 1,2-Hexanediol: ${insErr.message}`)
    console.log('  Created 1,2-Hexanediol master ingredient.')
  } else {
    console.log(`  Found existing: ${existing.id}`)
  }

  // Step 2: Resolve all 12 ingredient IDs
  console.log('\nStep 2: Resolving ingredient IDs for all 12 INCI entries...')
  const { data: ingredients, error: fetchErr } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci')
    .in('name_inci', INCI)

  if (fetchErr) throw new Error(`Failed to fetch ingredients: ${fetchErr.message}`)

  const idByName = new Map<string, string>(
    (ingredients || []).map((r) => [r.name_inci, r.id])
  )

  const missing = INCI.filter((n) => !idByName.has(n))
  if (missing.length > 0) {
    throw new Error(`Missing master ingredient rows for: ${missing.join(', ')}`)
  }
  console.log(`  Resolved all 12 ingredient IDs.`)

  // Step 3: Wipe existing links
  console.log('\nStep 3: Deleting existing link rows for COSRX Snail 96...')
  const { error: delErr, count } = await supabase
    .from('ss_product_ingredients')
    .delete({ count: 'exact' })
    .eq('product_id', PRODUCT_ID)

  if (delErr) throw new Error(`Delete failed: ${delErr.message}`)
  console.log(`  Deleted ${count ?? '?'} stale rows.`)

  // Step 4: Insert verified 12-ingredient INCI
  console.log('\nStep 4: Inserting verified 12-ingredient INCI...')
  const linkRows = INCI.map((name, idx) => ({
    product_id: PRODUCT_ID,
    ingredient_id: idByName.get(name)!,
    position: idx + 1,
  }))

  const { error: insLinksErr } = await supabase
    .from('ss_product_ingredients')
    .insert(linkRows)

  if (insLinksErr) throw new Error(`Insert links failed: ${insLinksErr.message}`)
  console.log(`  Inserted 12 link rows in INCI concentration order.`)

  // Step 5: Populate ingredients_raw on the product
  console.log('\nStep 5: Populating ss_products.ingredients_raw...')
  const rawString = INCI.join(', ')
  const { error: updErr } = await supabase
    .from('ss_products')
    .update({
      ingredients_raw: rawString,
      updated_at: new Date().toISOString(),
    })
    .eq('id', PRODUCT_ID)

  if (updErr) throw new Error(`Product update failed: ${updErr.message}`)
  console.log(`  Set ingredients_raw (${rawString.length} chars).`)

  // Step 6: Verify
  console.log('\nStep 6: Verifying...')
  const { data: verify } = await supabase
    .from('ss_product_ingredients')
    .select('position, ss_ingredients(name_inci)')
    .eq('product_id', PRODUCT_ID)
    .order('position')

  console.log('  Final INCI on COSRX Snail 96:')
  for (const row of (verify || []) as unknown as Array<{
    position: number
    ss_ingredients: { name_inci: string } | null
  }>) {
    console.log(`    ${row.position}. ${row.ss_ingredients?.name_inci || '?'}`)
  }

  console.log('\n=== Done. ===')
}

main().catch((err) => {
  console.error('FAILED:', err.message)
  process.exit(1)
})
