/**
 * Smoke test for Blueprint 76 ingredient-check.
 *
 * Tests the pure logic (parseInciString, resolveSubstance, checkSubstanceInProduct)
 * against:
 *   1. The u/varm-t case — niacinamide constraint against COSRX BHA + Some By Mi
 *   2. Synonym resolution — "vitamin b3" should resolve to niacinamide
 *   3. Negative case — Anua BHA 2% should NOT match niacinamide constraint
 *
 * Run: npx tsx scripts/smoke-test-bp76.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  checkSubstanceInProduct,
  resolveSubstance,
  parseInciString,
  estimateConcentrationFromPosition,
} from '../src/lib/intelligence/ingredient-match'

// Manual env-load (matches existing scripts/*.ts pattern — no dotenv dep)
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TestResult {
  name: string
  passed: boolean
  detail: string
}

const results: TestResult[] = []

function pass(name: string, detail: string) {
  results.push({ name, passed: true, detail })
  console.log(`✅ ${name}: ${detail}`)
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail })
  console.error(`❌ ${name}: ${detail}`)
}

async function main() {
  console.log('🔬 Blueprint 76 smoke test\n')

  // ===== TEST 1: synonym resolution =====
  console.log('--- Synonym resolution ---')
  const niacinamideR = resolveSubstance('niacinamide')
  if (niacinamideR.canonical === 'niacinamide' && niacinamideR.search_terms.includes('nicotinamide')) {
    pass('resolveSubstance(niacinamide)', `canonical=${niacinamideR.canonical}, search_terms=[${niacinamideR.search_terms.join(', ')}]`)
  } else {
    fail('resolveSubstance(niacinamide)', `unexpected: ${JSON.stringify(niacinamideR)}`)
  }

  const vitB3R = resolveSubstance('vitamin b3')
  if (vitB3R.canonical === 'niacinamide') {
    pass('resolveSubstance(vitamin b3)', `resolves to canonical niacinamide`)
  } else {
    fail('resolveSubstance(vitamin b3)', `expected niacinamide, got ${vitB3R.canonical}`)
  }

  const fragranceR = resolveSubstance('parfum')
  if (fragranceR.canonical === 'fragrance') {
    pass('resolveSubstance(parfum)', `resolves to canonical fragrance`)
  } else {
    fail('resolveSubstance(parfum)', `expected fragrance, got ${fragranceR.canonical}`)
  }

  // ===== TEST 2: parseInciString =====
  console.log('\n--- INCI parsing ---')
  const sampleInci =
    'Salix Alba (Willow) Bark Water, Butylene Glycol, Betaine, Niacinamide, Betaine Salicylate, 1,2-Hexanediol, Sodium Hydroxide, Sodium Hyaluronate, Panthenol, Xanthan Gum, Ethyl Hexanediol'
  const parsed = parseInciString(sampleInci)
  const niacinamideEntry = parsed.find((p) => p.name.toLowerCase() === 'niacinamide')
  if (niacinamideEntry && niacinamideEntry.position === 4) {
    pass('parseInciString position', `Niacinamide at position ${niacinamideEntry.position} (expected 4)`)
  } else {
    fail('parseInciString position', `expected Niacinamide at position 4, got ${JSON.stringify(niacinamideEntry)}`)
  }

  // Parenthetical alt: "Salix Alba (Willow) Bark Water" should yield both forms at position 1
  const salixEntries = parsed.filter((p) => p.position === 1)
  if (salixEntries.length >= 1) {
    pass('parseInciString parenthetical', `position 1 yielded ${salixEntries.length} entries: ${salixEntries.map((e) => e.name).join(' / ')}`)
  } else {
    fail('parseInciString parenthetical', `position 1 yielded no entries`)
  }

  // ===== TEST 3: position → concentration estimate =====
  console.log('\n--- Concentration estimation ---')
  const positions: Array<[number, string]> = [
    [1, '5-15%'],
    [3, '5-15%'],
    [4, '2-5%'],
    [5, '2-5%'],
    [10, '0.5-2%'],
    [25, '<0.5%'],
  ]
  for (const [pos, expected] of positions) {
    const actual = estimateConcentrationFromPosition(pos)
    if (actual === expected) {
      pass(`estimateConcentration(${pos})`, `→ ${actual}`)
    } else {
      fail(`estimateConcentration(${pos})`, `expected ${expected}, got ${actual}`)
    }
  }

  // ===== TEST 4: u/varm-t case end-to-end (against catalog) =====
  console.log('\n--- u/varm-t case (the BP76 trigger incident) ---')

  // Pull COSRX BHA from catalog
  const { data: cosrx } = await supabase
    .from('ss_products')
    .select('name_en, brand_en, ingredients_raw')
    .ilike('name_en', 'BHA Blackhead Power Liquid')
    .eq('brand_en', 'COSRX')
    .maybeSingle()

  if (!cosrx || !cosrx.ingredients_raw) {
    fail('COSRX BHA catalog fetch', 'product not found or has no ingredients_raw')
  } else {
    const match = checkSubstanceInProduct(cosrx.ingredients_raw, 'niacinamide')
    if (match && match.ingredient_inci_position === 4) {
      pass(
        'COSRX BHA conflict detection',
        `MATCH: ${match.ingredient_match} at position ${match.ingredient_inci_position} (~${match.ingredient_concentration_estimate})`
      )
    } else {
      fail('COSRX BHA conflict detection', `expected match at position 4, got ${JSON.stringify(match)}`)
    }
  }

  // Pull Some By Mi toner from catalog
  const { data: someByMi } = await supabase
    .from('ss_products')
    .select('name_en, brand_en, ingredients_raw')
    .ilike('name_en', 'AHA BHA PHA 30 Days Miracle Toner Set')
    .eq('brand_en', 'Some By Mi')
    .maybeSingle()

  if (!someByMi || !someByMi.ingredients_raw) {
    fail('Some By Mi toner catalog fetch', 'product not found or has no ingredients_raw')
  } else {
    const match = checkSubstanceInProduct(someByMi.ingredients_raw, 'niacinamide')
    if (match && match.ingredient_inci_position === 5) {
      pass(
        'Some By Mi toner conflict detection',
        `MATCH: ${match.ingredient_match} at position ${match.ingredient_inci_position} (~${match.ingredient_concentration_estimate})`
      )
    } else {
      fail('Some By Mi toner conflict detection', `expected match at position 5, got ${JSON.stringify(match)}`)
    }
  }

  // ===== TEST 5: negative case — Anua BHA 2% should NOT match niacinamide =====
  console.log('\n--- Negative case (correct recommendation should pass) ---')
  const { data: anua } = await supabase
    .from('ss_products')
    .select('name_en, brand_en, ingredients_raw')
    .ilike('name_en', 'BHA 2% Gentle Exfoliating Toner')
    .eq('brand_en', 'Anua')
    .maybeSingle()

  if (!anua || !anua.ingredients_raw) {
    fail('Anua BHA catalog fetch', 'product not found or has no ingredients_raw')
  } else {
    const match = checkSubstanceInProduct(anua.ingredients_raw, 'niacinamide')
    if (match === null) {
      pass('Anua BHA 2% niacinamide check', 'CORRECT: no niacinamide match (the safe alternative)')
    } else {
      fail('Anua BHA 2% niacinamide check', `expected no match, got ${JSON.stringify(match)}`)
    }
  }

  // ===== TEST 6: synonym resolution end-to-end =====
  console.log('\n--- Synonym resolution end-to-end ---')
  if (cosrx && cosrx.ingredients_raw) {
    const matchByVitB3 = checkSubstanceInProduct(cosrx.ingredients_raw, 'vitamin b3')
    if (matchByVitB3 && matchByVitB3.ingredient_match.toLowerCase().includes('niacinamide')) {
      pass(
        'COSRX BHA via "vitamin b3" synonym',
        `MATCH: ${matchByVitB3.ingredient_match} at position ${matchByVitB3.ingredient_inci_position}`
      )
    } else {
      fail('COSRX BHA via "vitamin b3" synonym', `expected match via synonym, got ${JSON.stringify(matchByVitB3)}`)
    }
  }

  // ===== TEST 7: BHA family synonym (Betaine Salicylate should match "salicylic acid" constraint) =====
  console.log('\n--- BHA family synonym test ---')
  if (cosrx && cosrx.ingredients_raw) {
    const bhaMatch = checkSubstanceInProduct(cosrx.ingredients_raw, 'salicylic acid')
    if (bhaMatch) {
      pass(
        'COSRX BHA via "salicylic acid" → Betaine Salicylate',
        `MATCH: ${bhaMatch.ingredient_match} at position ${bhaMatch.ingredient_inci_position}`
      )
    } else {
      fail('COSRX BHA via "salicylic acid"', 'expected match against Betaine Salicylate via BHA synonym map')
    }
  }

  // ===== Summary =====
  console.log('\n========== Summary ==========')
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`Passed: ${passed}/${results.length}`)
  if (failed > 0) {
    console.error(`Failed: ${failed}`)
    process.exit(1)
  }
  console.log('🎉 All smoke tests passed')
}

main().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
