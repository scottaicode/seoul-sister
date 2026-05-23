/**
 * v10.8.5 verification — confirms v10.8.4 + v10.8.5 voice/UI fixes didn't
 * change Layer 1/1.5 filter behavior, AND specifically probes the suspect
 * "fits" products from Bailey's May 23 screenshot #2:
 *
 *   1. Beplain Clean & Glow Green Barley LHA Gel Cleanser
 *      — contains LHA (capryloyl salicylic acid). Bailey's Phase 2 protocol
 *        has "no acid stacking" + "BHA already at protocol cadence" exclusions.
 *        Question: is LHA caught by the BHA class membership? Class members
 *        are 'salicylic acid' + 'betaine salicylate' only. If LHA flows
 *        through as a fit, that's a coverage gap worth shipping in v10.8.6.
 *
 *   2. Innisfree Daily UV Protection Cream SPF35 PA++
 *      — Bailey already has Beauty of Joseon Relief Sun in her routine.
 *        A second sunscreen as a "fit" might be expected (different
 *        occasions) or might be category-duplication. Not a bug per se,
 *        just want to surface the verdict + matched_items for awareness.
 *
 * Plus a sweep across the other suspect fits from screenshot #2 to confirm
 * they're genuinely barrier-safe rather than hiding category drift.
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/verify-curation-v10-8-5.ts
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

async function main() {
  const { buildCurationContext, applyPhaseFilter } = await import('../src/lib/intelligence/product-curation')
  const { getServiceClient } = await import('../src/lib/supabase')
  const db = getServiceClient()

  console.log('=== v10.8.5 verification — Bailey post-fix screenshot review ===\n')

  const context = await buildCurationContext(BAILEY_USER_ID)
  if (!context) {
    console.error('No profile found for Bailey')
    process.exit(1)
  }

  console.log('## Context summary')
  console.log(`Skin type: ${context.skinType}`)
  console.log(`Allergies: ${context.allergies.join(', ') || '(none)'}`)
  console.log(`Active phase: ${context.activePhase ? `Phase ${context.activePhase.phaseNumber} — ${context.activePhase.name}` : '(none)'}`)
  console.log(`Excluded substances: ${context.excludedSubstances.length}`)
  for (const s of context.excludedSubstances) console.log(`  - ${s}`)
  console.log(`Excluded categories (Layer 1.5): ${context.excludedCategories.length}`)
  for (const ec of context.excludedCategories) {
    if (ec.category) console.log(`  - [category] ${ec.category} ← "${ec.sourceText}"`)
    if (ec.ingredientClass) console.log(`  - [class] ${ec.ingredientClass} ← "${ec.sourceText}"`)
  }
  console.log()

  // -------------------------------------------------------------------------
  // Regression check: products that v10.8.2 verified as correct skips/fits
  // should still produce the same verdicts after v10.8.4 + v10.8.5
  // -------------------------------------------------------------------------
  console.log('## Regression check — v10.8.2 spot check products\n')

  const regressionProducts = [
    // Should SKIP
    { search: 'Aloe BHA Skin Toner', expected: 'skip', note: 'BHA stacking' },
    { search: 'Theracne 365 Spot Treatment', expected: 'skip', note: 'no new active products this phase' },
    { search: 'Invisible Peeling Booster', expected: 'skip', note: 'no new active products this phase' },
    { search: 'Mugener Ampule', expected: 'skip', note: 'no new active products this phase' },
    // Should FIT
    { search: 'Red Blemish Cica S.O.S Recovery Cream', expected: 'fits', note: 'barrier-safe' },
    { search: 'Aqua Soothing Gel Cream', expected: 'fits', note: 'barrier-safe' },
    { search: 'Heartleaf Pore Control Cleansing Oil', expected: 'fits', note: "Bailey's own choice" },
  ]

  let regressionPass = 0
  let regressionFail = 0
  for (const tp of regressionProducts) {
    const result = await checkProduct(db, tp.search, context, applyPhaseFilter)
    if (!result) {
      console.log(`  [not found] ${tp.search}`)
      continue
    }
    const matched = result.verdict === tp.expected
    const tag = result.verdict === 'skip' ? '🚫 SKIP  ' : result.verdict === 'fits' ? '✅ FITS  ' : '⚪ neutral'
    const status = matched ? '✓' : '✗ EXPECTED ' + tp.expected.toUpperCase()
    console.log(`  ${tag} ${status}  ${result.brand} ${result.name} (${result.category}) — ${tp.note}`)
    if (result.matchedItems.length > 0) {
      for (const m of result.matchedItems) {
        console.log(`         [${m.type}] ${m.item} → ${m.matchedIngredient}`)
      }
    }
    if (matched) regressionPass++
    else regressionFail++
  }
  console.log(`\n  Regression: ${regressionPass} pass, ${regressionFail} fail\n`)

  // -------------------------------------------------------------------------
  // Suspect fits from screenshot #2 — drill in
  // -------------------------------------------------------------------------
  console.log('## Suspect fits from screenshot #2\n')

  const suspectProducts = [
    {
      search: 'Clean & Glow Green Barley LHA Gel Cleanser',
      flag: 'CONTAINS LHA (capryloyl salicylic acid) — BHA family. Is it caught?',
    },
    {
      search: 'Daily UV Protection Cream SPF35',
      flag: 'Second sunscreen — Bailey already has BoJ Relief Sun. Duplication?',
    },
    {
      search: 'Dual-Balance Waterlock Lotion',
      flag: 'CNP moisturizer — barrier-safe expected, but worth checking INCI',
    },
    {
      search: 'Full Fit Propolis Synergy Toner',
      flag: 'COSRX propolis toner — verify no acids slipped through',
    },
    {
      search: '6 Peptide Complex Serum',
      flag: 'Mary&May peptide serum — is "no new actives this phase" triggering?',
    },
    {
      search: 'Comfy Water Sun Block SPF50',
      flag: 'Third sunscreen surfaced — sunscreen-duplication pattern?',
    },
  ]

  let suspectIssues: string[] = []
  for (const sp of suspectProducts) {
    console.log(`  → ${sp.search}`)
    console.log(`    Concern: ${sp.flag}`)
    const result = await checkProduct(db, sp.search, context, applyPhaseFilter)
    if (!result) {
      console.log(`    [not found in DB]\n`)
      continue
    }
    const tag = result.verdict === 'skip' ? '🚫 SKIP' : result.verdict === 'fits' ? '✅ FITS' : '⚪ neutral'
    console.log(`    ${tag}  ${result.brand} ${result.name} (${result.category})`)
    if (result.matchedItems.length > 0) {
      for (const m of result.matchedItems) {
        console.log(`           [${m.type}] ${m.item} → ${m.matchedIngredient}`)
      }
    }

    // For the LHA case, dig into the ingredient list to confirm what's actually present
    if (sp.search.includes('LHA')) {
      const acidsFound = result.ingredients.filter((n) =>
        /salicylic|salicylate|lipohydroxy|lha|capryloyl|glycolic|lactic|mandelic|gluconolactone|lactobionic/i.test(n)
      )
      console.log(`    Acid-family ingredients on this product: ${acidsFound.length > 0 ? acidsFound.join(', ') : '(none detected)'}`)
      if (acidsFound.length > 0 && result.verdict === 'fits') {
        suspectIssues.push(`Beplain LHA — contains ${acidsFound.join('+')} but verdict is FITS. BHA class coverage gap.`)
      }
    }

    // For sunscreens, check the user's current routine sunscreens
    if (/sun|spf/i.test(sp.search)) {
      const routineSunscreens = await getUserRoutineSunscreens(db, BAILEY_USER_ID)
      console.log(`    User's current routine sunscreens: ${routineSunscreens.join(' | ') || '(none)'}`)
    }

    console.log()
  }

  if (suspectIssues.length > 0) {
    console.log('## ⚠️  Issues surfaced:\n')
    for (const issue of suspectIssues) console.log(`  - ${issue}`)
    console.log()
  } else {
    console.log('## ✅ No coverage gaps surfaced in suspect fits.\n')
  }

  // -------------------------------------------------------------------------
  // BHA class membership audit — what's IN the class vs what's in K-beauty?
  // -------------------------------------------------------------------------
  console.log('## BHA class membership audit\n')

  // Find every product in the catalog whose ingredients contain a salicylic
  // acid derivative, to see what's slipping through.
  const { data: bhaProducts } = await db
    .from('ss_product_ingredients')
    .select('product_id, ingredient:ss_ingredients(name_en, name_inci)')
    .or('ingredient.name_inci.ilike.%salicylic%,ingredient.name_inci.ilike.%salicylate%,ingredient.name_en.ilike.%lha%,ingredient.name_en.ilike.%lipohydroxy%')

  type IngLink = { product_id: string; ingredient: { name_en: string | null; name_inci: string | null } | Array<{ name_en: string | null; name_inci: string | null }> | null }
  const uniqueBhaIngredients = new Set<string>()
  for (const link of (bhaProducts || []) as IngLink[]) {
    const ing = Array.isArray(link.ingredient) ? link.ingredient[0] : link.ingredient
    if (!ing) continue
    if (ing.name_inci) uniqueBhaIngredients.add(ing.name_inci.toLowerCase())
    if (ing.name_en && ing.name_en !== ing.name_inci) uniqueBhaIngredients.add(ing.name_en.toLowerCase())
  }
  console.log('  Unique salicylic-family ingredients in catalog:')
  for (const ing of Array.from(uniqueBhaIngredients).sort()) {
    console.log(`    - ${ing}`)
  }
  console.log()

  console.log('=== Done ===')
}

async function checkProduct(
  db: ReturnType<typeof import('../src/lib/supabase').getServiceClient>,
  searchName: string,
  context: Awaited<ReturnType<typeof import('../src/lib/intelligence/product-curation').buildCurationContext>>,
  applyPhaseFilter: typeof import('../src/lib/intelligence/product-curation').applyPhaseFilter,
): Promise<{
  id: string
  name: string
  brand: string
  category: string
  ingredients: string[]
  verdict: 'fits' | 'skip' | 'neutral'
  matchedItems: Array<{ type: string; item: string; matchedIngredient: string }>
} | null> {
  if (!context) return null
  const { data: prods } = await db
    .from('ss_products')
    .select('id, name_en, brand_en, category')
    .ilike('name_en', `%${searchName}%`)
    .limit(1)
  if (!prods?.length) return null
  const p = prods[0] as { id: string; name_en: string; brand_en: string; category: string | null }

  const { data: links } = await db
    .from('ss_product_ingredients')
    .select('ingredient:ss_ingredients(name_en, name_inci)')
    .eq('product_id', p.id)

  type Link = { ingredient: { name_en: string | null; name_inci: string | null } | Array<{ name_en: string | null; name_inci: string | null }> | null }
  const ingredientNames: string[] = []
  for (const link of (links || []) as Link[]) {
    const rawIng = link.ingredient
    const ing = Array.isArray(rawIng) ? rawIng[0] : rawIng
    if (!ing) continue
    if (ing.name_en) ingredientNames.push(ing.name_en)
    if (ing.name_inci && ing.name_inci !== ing.name_en) ingredientNames.push(ing.name_inci)
  }

  const ingMap = new Map([[p.id, ingredientNames]])
  const catMap = new Map<string, string>()
  const nameMap = new Map<string, string>()
  if (p.category) catMap.set(p.id, p.category)
  if (p.name_en) nameMap.set(p.id, p.name_en)

  const verdicts = applyPhaseFilter([p.id], ingMap, context, catMap, nameMap)
  const v = verdicts[0]
  return {
    id: p.id,
    name: p.name_en,
    brand: p.brand_en,
    category: p.category || '?',
    ingredients: ingredientNames,
    verdict: v.verdict,
    matchedItems: v.matchedItems,
  }
}

async function getUserRoutineSunscreens(
  db: ReturnType<typeof import('../src/lib/supabase').getServiceClient>,
  userId: string,
): Promise<string[]> {
  const { data: routines } = await db
    .from('ss_user_routines')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
  const routineIds = (routines || []).map((r) => r.id as string)
  if (routineIds.length === 0) return []

  const { data: routineProducts } = await db
    .from('ss_routine_products')
    .select('product_id, product:ss_products(brand_en, name_en, category)')
    .in('routine_id', routineIds)
    .not('product_id', 'is', null)

  type RP = { product_id: string; product: { brand_en: string; name_en: string; category: string } | Array<{ brand_en: string; name_en: string; category: string }> | null }
  const sunscreens: string[] = []
  for (const rp of (routineProducts || []) as RP[]) {
    const prod = Array.isArray(rp.product) ? rp.product[0] : rp.product
    if (!prod) continue
    if (prod.category === 'sunscreen') {
      sunscreens.push(`${prod.brand_en} ${prod.name_en}`)
    }
  }
  return sunscreens
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
