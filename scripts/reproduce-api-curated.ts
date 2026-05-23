/**
 * Reproduce exactly what the GET /api/products/curated endpoint does for
 * Bailey, then check the verdicts on the 8 products from screenshot #2.
 *
 * The harness in verify-curation-v10-8-5 fetched ingredient names one
 * product at a time. The API fetches in batches of 200. If there's a
 * discrepancy in how ingredient names get assembled, this script will
 * surface it.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dir, '..', '.env.local'), 'utf-8')
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

async function main() {
  const { buildCurationContext, applyPhaseFilter } = await import('../src/lib/intelligence/product-curation')
  const { getServiceClient } = await import('../src/lib/supabase')
  const db = getServiceClient()

  // Replicate the API's exact candidate query (v10.8.7+): verified-only,
  // image-bearing first via image_url ordering, then limit 400. Same as a
  // default /browse load with no query/category.
  const { data: candidates } = await db
    .from('ss_products')
    .select('id, category, name_en, brand_en, image_url')
    .eq('is_verified', true)
    .order('image_url', { ascending: false, nullsFirst: false })
    .limit(400)

  console.log(`Candidates fetched: ${candidates?.length}`)

  // v10.8.7 visual quality check — how many candidates have images?
  const candidatesWithImage = (candidates || []).filter((c) => {
    const url = (c as { image_url: string | null }).image_url
    return url && url.trim().length > 0
  }).length
  console.log(`Candidates with image_url: ${candidatesWithImage} (${candidates?.length ? ((candidatesWithImage / candidates.length) * 100).toFixed(1) : 0}%)`)

  const candidateIds = (candidates || []).map((r) => r.id as string)
  const productCategories = new Map<string, string>()
  const productNames = new Map<string, string>()
  const productBrands = new Map<string, string>()
  for (const c of candidates || []) {
    const row = c as { id: string; category: string | null; name_en: string | null; brand_en: string | null }
    if (row.category) productCategories.set(row.id, row.category)
    if (row.name_en) productNames.set(row.id, row.name_en)
    if (row.brand_en) productBrands.set(row.id, row.brand_en)
  }

  // Batched ingredient fetch — same shape as the API (v10.8.6+ with internal pagination)
  const productIngredients = new Map<string, string[]>()
  const OUTER_BATCH = 50
  const PAGE_SIZE = 1000
  type Link = {
    product_id: string
    ingredient: { name_en: string | null; name_inci: string | null } | Array<{ name_en: string | null; name_inci: string | null }> | null
  }
  for (let i = 0; i < candidateIds.length; i += OUTER_BATCH) {
    const slice = candidateIds.slice(i, i + OUTER_BATCH)
    let pageStart = 0
    while (true) {
      const { data: links } = await db
        .from('ss_product_ingredients')
        .select('product_id, ingredient:ss_ingredients(name_en, name_inci)')
        .in('product_id', slice)
        .range(pageStart, pageStart + PAGE_SIZE - 1)
      const pageRows = links?.length ?? 0
      for (const link of (links || []) as Link[]) {
        const rawIng = link.ingredient
        const ing = Array.isArray(rawIng) ? rawIng[0] : rawIng
        if (!ing) continue
        if (!productIngredients.has(link.product_id)) {
          productIngredients.set(link.product_id, [])
        }
        const arr = productIngredients.get(link.product_id)!
        if (ing.name_en) arr.push(ing.name_en)
        if (ing.name_inci && ing.name_inci !== ing.name_en) arr.push(ing.name_inci)
      }
      if (pageRows < PAGE_SIZE) break
      pageStart += PAGE_SIZE
    }
  }

  const context = await buildCurationContext(BAILEY_USER_ID)
  if (!context) { console.error('no context'); process.exit(1) }

  const verdicts = applyPhaseFilter(
    candidateIds,
    productIngredients,
    context,
    productCategories,
    productNames,
  )

  // Count totals
  const fitsTotal = verdicts.filter((v) => v.verdict === 'fits').length
  const skipTotal = verdicts.filter((v) => v.verdict === 'skip').length
  const neutralTotal = verdicts.filter((v) => v.verdict === 'neutral').length
  console.log(`\nVerdicts: ${fitsTotal} fits, ${skipTotal} skip, ${neutralTotal} neutral`)
  console.log(`API "fits" rendering = ${fitsTotal + neutralTotal} (fits + neutral)`)

  // Drill into the 8 suspect products from screenshot #2
  const screenshotProducts = [
    'Clean & Glow Green Barley LHA Gel Cleanser',
    'Daily UV Protection Cream SPF35',
    'Dual-Balance Waterlock Lotion',
    'Red Blemish Cica S.O.S Recovery Cream',
    '6 Peptide Complex Serum',
    'Aqua Soothing Gel Cream',
    'Full Fit Propolis Synergy Toner',
    'Comfy Water Sun Block SPF50',
  ]

  console.log('\n## Per-product verdicts (replicating API ingredient assembly):\n')
  for (const targetName of screenshotProducts) {
    const matchId = Array.from(productNames.entries()).find(([, name]) => name.includes(targetName))?.[0]
    if (!matchId) {
      console.log(`  [not in candidates] ${targetName}`)
      continue
    }
    const v = verdicts.find((x) => x.productId === matchId)
    if (!v) {
      console.log(`  [no verdict] ${targetName}`)
      continue
    }
    const ingredients = productIngredients.get(matchId) || []
    const tag = v.verdict === 'skip' ? '🚫 SKIP   ' : v.verdict === 'fits' ? '✅ FITS   ' : '⚪ neutral'
    console.log(`  ${tag}${productBrands.get(matchId)} ${productNames.get(matchId)}`)
    console.log(`    Category: ${productCategories.get(matchId)}`)
    console.log(`    Ingredient names assembled: ${ingredients.length}`)
    if (v.matchedItems.length > 0) {
      for (const m of v.matchedItems) {
        console.log(`    [${m.type}] ${m.item} → ${m.matchedIngredient}`)
      }
    }
    // For Beplain specifically, show ingredients matching LHA pattern
    if (targetName.includes('LHA')) {
      const lhaHits = ingredients.filter((n) => /salicyl|lipohyd|lha|capryloyl/i.test(n))
      console.log(`    LHA-family hits in assembled ingredient list: ${lhaHits.length > 0 ? lhaHits.join(', ') : '(NONE)'}`)
    }
    console.log()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
