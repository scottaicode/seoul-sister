/**
 * v10.8.1 verification — run the new extractor against Bailey's real
 * decision_memory and treatment_phases. Confirms the tight extractor
 * produces a clean, meaningful exclusion list (not the 50+ token soup
 * v10.8.0 was producing).
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/verify-curation-v10-8-1.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Manual env-load (matches scripts/smoke-test-bp76.ts pattern — no dotenv dep)
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

// (Imports happen inside main() to delay them until after env-load)

const BAILEY_USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835'

async function main() {
  const { buildCurationContext, applyPhaseFilter } = await import('../src/lib/intelligence/product-curation')
  const { getServiceClient } = await import('../src/lib/supabase')

  console.log('=== v10.8.1 Curation Extractor Verification (Bailey) ===\n')

  const context = await buildCurationContext(BAILEY_USER_ID)
  if (!context) {
    console.error('No profile found for Bailey')
    process.exit(1)
  }

  console.log('Profile:')
  console.log('  Skin type:', context.skinType)
  console.log('  Concerns:', context.skinConcerns.join(', ') || '(none)')
  console.log('  Allergies:', context.allergies.length ? context.allergies.join(', ') : '(none declared)')
  console.log()

  if (context.activePhase) {
    console.log(`Active phase: Phase ${context.activePhase.phaseNumber} — ${context.activePhase.name}`)
    console.log('  Watch_for items:')
    for (const w of context.activePhase.watchFor) {
      console.log(`    - ${w}`)
    }
    console.log(`  Watch_for excluded substances (NEW v10.8.1 — tight extraction):`)
    if (context.activePhase.watchForExcludedSubstances.length === 0) {
      console.log('    (none — watch_for items are observational, not exclusion-imperative)')
    } else {
      for (const s of context.activePhase.watchForExcludedSubstances) {
        console.log(`    - ${s}`)
      }
    }
    console.log()
  }

  console.log(`Excluded substances from decision_memory (NEW v10.8.1 — tight extraction):`)
  console.log(`  Count: ${context.excludedSubstances.length}`)
  if (context.excludedSubstances.length === 0) {
    console.log('  (none extracted)')
  } else {
    for (const s of context.excludedSubstances) {
      console.log(`  - ${s}`)
    }
  }
  console.log()

  // Smoke-test against a few real products from Bailey's prior-bad list
  console.log('=== Spot check against products v10.8.0 incorrectly skipped ===\n')

  const db = getServiceClient()
  const testProducts = [
    'Red Blemish Cica S.O.S Recovery Cream', // had asiatic acid + vitamin e chips
    'Aloe BHA Skin Toner', // had hyaluronic acid + schisandra chips
    'Real Cica Micellar Cleansing Foam', // had gluconolactone + lactobionic chips
    'Aqua Soothing Gel Cream', // barrier-friendly, false skip
    'Theracne 365 Spot Treatment', // wrongly in fits before — has BHA
  ]

  for (const name of testProducts) {
    const { data: prods } = await db
      .from('ss_products')
      .select('id, name_en, brand_en, ingredients_raw')
      .ilike('name_en', `%${name}%`)
      .limit(1)
    if (!prods?.length) {
      console.log(`  [not found] ${name}`)
      continue
    }
    const p = prods[0] as { id: string; name_en: string; brand_en: string; ingredients_raw: string | null }

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

    const verdicts = applyPhaseFilter([p.id], new Map([[p.id, ingredientNames]]), context)
    const v = verdicts[0]
    console.log(`  ${p.brand_en} ${p.name_en}`)
    console.log(`    Verdict: ${v.verdict}`)
    if (v.matchedItems.length > 0) {
      for (const m of v.matchedItems) {
        console.log(`      [${m.type}] ${m.item} → matched: ${m.matchedIngredient}`)
      }
    }
  }

  console.log('\n=== Done ===')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
