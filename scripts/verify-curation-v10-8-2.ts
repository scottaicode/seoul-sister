/**
 * v10.8.2 verification — confirms the new Layer 1.5 category-level filter
 * correctly catches BHA-on-BHA, acid stacking, additional-vitamin-C, and
 * "no new actives this phase" conflicts against Bailey's real data.
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/verify-curation-v10-8-2.ts
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

  console.log('=== v10.8.2 Layer 1.5 Category Filter Verification (Bailey) ===\n')

  const context = await buildCurationContext(BAILEY_USER_ID)
  if (!context) {
    console.error('No profile found for Bailey')
    process.exit(1)
  }

  console.log(`Excluded substances (Layer 1): ${context.excludedSubstances.length}`)
  for (const s of context.excludedSubstances) console.log(`  - ${s}`)
  console.log()

  console.log(`Excluded categories (Layer 1.5 NEW): ${context.excludedCategories.length}`)
  for (const ec of context.excludedCategories) {
    if (ec.category) console.log(`  - [category] ${ec.category} ← ${ec.sourceText}`)
    if (ec.ingredientClass) console.log(`  - [class] ${ec.ingredientClass} ← ${ec.sourceText}`)
  }
  console.log()

  console.log('=== Spot check against products that should now be SKIP ===\n')

  const db = getServiceClient()
  const testProducts = [
    // BHA-on-BHA — should now skip
    'Aloe BHA Skin Toner',
    'AHA/BHA Clarifying Treatment Toner',
    // Active spot treatment / exfoliator during Phase 2 — should now skip
    'Theracne 365 Spot Treatment',
    'Invisible Peeling Booster',
    // Vitamin C — should now skip (she has Goodal Vita C)
    'Mugener Ampule',
    // Sleeping mask — rejected from Glass Skin recs — should skip if category=mask
    // Barrier-safe — should still FIT
    'Red Blemish Cica S.O.S Recovery Cream',
    'Aqua Soothing Gel Cream',
    // Cleanser — should still FIT
    'Heartleaf Pore Control Cleansing Oil',
  ]

  let skipCount = 0
  let fitsCount = 0
  let neutralCount = 0

  for (const name of testProducts) {
    const { data: prods } = await db
      .from('ss_products')
      .select('id, name_en, brand_en, category')
      .ilike('name_en', `%${name}%`)
      .limit(1)
    if (!prods?.length) {
      console.log(`  [not found] ${name}`)
      continue
    }
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

    const tag = v.verdict === 'skip' ? '🚫 SKIP' : v.verdict === 'fits' ? '✅ FITS' : '⚪ neutral'
    console.log(`  ${tag}  ${p.brand_en} ${p.name_en} (${p.category || '?'})`)
    if (v.matchedItems.length > 0) {
      for (const m of v.matchedItems) {
        console.log(`         [${m.type}] ${m.item} → ${m.matchedIngredient}`)
      }
    }

    if (v.verdict === 'skip') skipCount++
    else if (v.verdict === 'fits') fitsCount++
    else neutralCount++
  }

  console.log()
  console.log(`Results: ${skipCount} skip, ${fitsCount} fits, ${neutralCount} neutral`)
  console.log()
  console.log('Expected: BHA toners + active spot/exfoliator + extra vit C ampule → skip')
  console.log('Expected: Cica cream, Aqua Soothing, Heartleaf Oil cleanser → fits')

  console.log('\n=== Done ===')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
