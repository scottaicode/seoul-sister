/**
 * Fast ingredient linker — optimized version that avoids the
 * getAllLinkedProductIds bottleneck (118K+ row pagination per batch).
 *
 * Strategy:
 * 1. Fetch ALL product IDs that have ingredients_raw (4,107 products = 5 pages)
 * 2. Fetch ALL DISTINCT linked product IDs from ss_product_ingredients
 *    — done via paginated query but only through distinct product_ids, not all rows
 * 3. Compute unlinked set in JS
 * 4. Load ingredient cache ONCE
 * 5. Process all unlinked products sequentially, reusing cache across all products
 *
 * Run with: npx tsx --tsconfig tsconfig.json scripts/fast-link.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local
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

// Dynamic imports for pipeline modules
async function main() {
  const { parseInciString } = await import('../src/lib/pipeline/ingredient-parser')
  const { matchOrCreateIngredient, IngredientCache } = await import('../src/lib/pipeline/ingredient-matcher')
  const { CostTracker } = await import('../src/lib/pipeline/cost-tracker')

  console.log('=== FAST INGREDIENT LINKER ===\n')

  // Step 1: Get all products with ingredients_raw
  console.log('Step 1: Fetching products with ingredients_raw...')
  const productsWithRaw = new Map<string, string>() // id -> ingredients_raw
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('ss_products')
      .select('id, ingredients_raw')
      .not('ingredients_raw', 'is', null)
      .range(offset, offset + 999)

    if (error) { console.error('Error fetching products:', error.message); break }
    if (!data || data.length === 0) break

    for (const p of data) {
      productsWithRaw.set(p.id, p.ingredients_raw)
    }
    if (data.length < 1000) break
    offset += 1000
  }
  console.log(`  Found ${productsWithRaw.size} products with ingredients_raw`)

  // Step 2: Get all linked product IDs (distinct)
  // Instead of fetching all 118K+ rows from ss_product_ingredients,
  // we fetch product_id with a grouped approach
  console.log('Step 2: Fetching linked product IDs...')
  const linkedIds = new Set<string>()

  // Fetch in pages — each page returns up to 1000 rows
  // Since we only need distinct product_ids, and there are ~3,075 distinct ones,
  // this will take ~120 pages through the 118K rows
  // OPTIMIZATION: Use a count query per product from our products list instead
  // Actually — let's just check which of our candidate products have links
  // This is O(N) where N = unlinked candidates, much better than scanning all rows

  // First, quickly identify WHICH products have at least 1 link
  // We'll check in batches of the product IDs we care about
  const productIds = Array.from(productsWithRaw.keys())
  const BATCH_CHECK_SIZE = 100

  for (let i = 0; i < productIds.length; i += BATCH_CHECK_SIZE) {
    const batch = productIds.slice(i, i + BATCH_CHECK_SIZE)
    const { data, error } = await supabase
      .from('ss_product_ingredients')
      .select('product_id')
      .in('product_id', batch)
      .limit(1000)

    if (error) { console.error('Error checking links:', error.message); continue }
    if (data) {
      for (const row of data) {
        linkedIds.add(row.product_id)
      }
    }
  }
  console.log(`  Found ${linkedIds.size} already-linked products`)

  // Step 3: Compute unlinked products
  const unlinkedProducts: Array<{ id: string; ingredients_raw: string }> = []
  for (const [id, raw] of productsWithRaw) {
    if (!linkedIds.has(id)) {
      unlinkedProducts.push({ id, ingredients_raw: raw })
    }
  }
  console.log(`  ${unlinkedProducts.length} products need ingredient linking\n`)

  if (unlinkedProducts.length === 0) {
    console.log('All products already linked! Nothing to do.')
    return
  }

  // Step 4: Load ingredient cache ONCE
  console.log('Step 3: Loading ingredient cache...')
  const cache = new IngredientCache()
  await cache.load(supabase)
  console.log(`  Loaded ${cache.size} ingredients into cache\n`)

  // Step 5: Process all unlinked products
  const costTracker = new CostTracker()
  let linked = 0
  let skipped = 0
  let failed = 0
  let totalCreated = 0
  let totalMatched = 0
  const startTime = Date.now()
  const errors: string[] = []

  for (let i = 0; i < unlinkedProducts.length; i++) {
    const product = unlinkedProducts[i]

    try {
      // Parse INCI string
      const parsed = parseInciString(product.ingredients_raw)
      if (parsed.length === 0) {
        skipped++
        continue
      }

      // Match or create each ingredient
      const links: Array<{
        product_id: string
        ingredient_id: string
        position: number
      }> = []

      let created = 0
      let matched = 0

      for (const ingredient of parsed) {
        const result = await matchOrCreateIngredient(
          supabase,
          ingredient.name_inci,
          cache,
          costTracker
        )

        if (result.match_type === 'created') {
          created++
        } else {
          matched++
        }

        links.push({
          product_id: product.id,
          ingredient_id: result.ingredient_id,
          position: ingredient.position,
        })
      }

      // Deduplicate links
      const seen = new Set<string>()
      const uniqueLinks = links.filter((link) => {
        if (seen.has(link.ingredient_id)) return false
        seen.add(link.ingredient_id)
        return true
      })

      // Batch insert
      if (uniqueLinks.length > 0) {
        const { error } = await supabase
          .from('ss_product_ingredients')
          .insert(uniqueLinks)

        if (error && error.code !== '23505') {
          throw new Error(`Insert failed: ${error.message}`)
        }
      }

      linked++
      totalCreated += created
      totalMatched += matched

      // Progress update every 10 products
      if ((i + 1) % 10 === 0 || i === unlinkedProducts.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
        const rate = (linked / ((Date.now() - startTime) / 1000)).toFixed(1)
        const remaining = unlinkedProducts.length - i - 1
        const eta = rate !== '0.0' ? (remaining / parseFloat(rate) / 60).toFixed(1) : '?'
        console.log(
          `  [${i + 1}/${unlinkedProducts.length}] ${linked} linked, ${skipped} skipped, ${failed} failed | ` +
          `${rate}/s | ETA ${eta}min | $${costTracker.summary.estimated_cost_usd.toFixed(4)} | ${elapsed}s elapsed`
        )
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Product ${product.id}: ${msg}`)
      if (errors.length <= 5) {
        console.error(`  ERR: ${msg.substring(0, 100)}`)
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  const cacheGrowth = cache.size - 7330 // approximate starting cache size

  console.log(`\n=== FAST LINKING COMPLETE ===`)
  console.log(`Products linked:     ${linked}`)
  console.log(`Products skipped:    ${skipped}`)
  console.log(`Products failed:     ${failed}`)
  console.log(`New ingredients:     ${cacheGrowth}`)
  console.log(`Total matches:       ${totalMatched}`)
  console.log(`Total cost:          $${costTracker.summary.estimated_cost_usd.toFixed(2)}`)
  console.log(`Total time:          ${totalTime} minutes`)
  if (errors.length > 0) {
    console.log(`\nLast 5 errors:`)
    errors.slice(-5).forEach(e => console.log(`  - ${e.substring(0, 120)}`))
  }
}

main().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
