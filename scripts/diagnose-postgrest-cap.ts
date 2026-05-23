/**
 * Probe the exact PostgREST row-limit boundary on the ss_product_ingredients
 * batch-fetch path. We expect the default cap to be 1000 rows. Confirm by:
 *
 *   (a) Run the SAME 400-candidate fetch the API does, with batch=200.
 *       Count total link rows returned vs the sum of per-product link counts.
 *
 *   (b) Repeat with batch=50. Should see no truncation if 50 × avg-40 < 1000.
 *
 *   (c) Repeat with batch=200 + explicit .limit(50000). Should see no
 *       truncation if PostgREST honors explicit limit overrides.
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

async function main() {
  const { getServiceClient } = await import('../src/lib/supabase')
  const db = getServiceClient()

  // Step 1: get 400 verified product IDs (same as API)
  const { data: candidates } = await db
    .from('ss_products')
    .select('id')
    .eq('is_verified', true)
    .limit(400)
  const candidateIds = (candidates || []).map((r) => (r as { id: string }).id)
  console.log(`Candidates: ${candidateIds.length}`)

  // Step 2: get the TRUE per-product link count via exact count head queries
  // (slow but authoritative — counts can't be truncated)
  console.log('\n## Computing authoritative per-product link totals via head:exact')
  let trueTotal = 0
  let productsWithLinks = 0
  // Sample: use head:exact counts in batches to be efficient
  // Actually counting individually is fine, just batched by 50 to be quick
  const COUNT_BATCH = 50
  for (let i = 0; i < candidateIds.length; i += COUNT_BATCH) {
    const slice = candidateIds.slice(i, i + COUNT_BATCH)
    const { count } = await db
      .from('ss_product_ingredients')
      .select('*', { count: 'exact', head: true })
      .in('product_id', slice)
    if (count !== null) {
      trueTotal += count
    }
    if (i % 200 === 0) process.stdout.write('.')
  }
  console.log(`\n  True total link rows across 400 products: ${trueTotal}`)

  // Get products-with-at-least-one-link separately
  const { count: trueProductsWithLinks } = await db
    .from('ss_product_ingredients')
    .select('product_id', { count: 'exact', head: true })
    .in('product_id', candidateIds)
  productsWithLinks = trueProductsWithLinks ?? 0
  console.log(`  (head:exact across all 400 in one shot: ${productsWithLinks} rows)`)

  // Step 3: Probe batch=200 (current API behavior)
  console.log('\n## Probe A — batch=200 (current API behavior)')
  const BATCH_A = 200
  let returnedA = 0
  const productsSeenA = new Set<string>()
  for (let i = 0; i < candidateIds.length; i += BATCH_A) {
    const slice = candidateIds.slice(i, i + BATCH_A)
    const { data: links } = await db
      .from('ss_product_ingredients')
      .select('product_id')
      .in('product_id', slice)
    const got = links?.length ?? 0
    returnedA += got
    for (const link of links || []) {
      productsSeenA.add((link as { product_id: string }).product_id)
    }
    console.log(`  batch ${i}-${i + BATCH_A}: requested ${slice.length} product_ids, got ${got} link rows, ${new Set(links?.map((l) => (l as { product_id: string }).product_id)).size} unique products in this batch`)
  }
  console.log(`  Total: ${returnedA} link rows returned, ${productsSeenA.size} unique products with at least one link`)

  // Step 4: Probe batch=50 (smaller batches)
  console.log('\n## Probe B — batch=50')
  const BATCH_B = 50
  let returnedB = 0
  const productsSeenB = new Set<string>()
  for (let i = 0; i < candidateIds.length; i += BATCH_B) {
    const slice = candidateIds.slice(i, i + BATCH_B)
    const { data: links } = await db
      .from('ss_product_ingredients')
      .select('product_id')
      .in('product_id', slice)
    returnedB += links?.length ?? 0
    for (const link of links || []) {
      productsSeenB.add((link as { product_id: string }).product_id)
    }
  }
  console.log(`  Total: ${returnedB} link rows returned, ${productsSeenB.size} unique products with at least one link`)

  // Step 5: Probe batch=200 + .limit(50000) (explicit limit override)
  console.log('\n## Probe C — batch=200 + explicit .limit(50000)')
  const BATCH_C = 200
  let returnedC = 0
  const productsSeenC = new Set<string>()
  for (let i = 0; i < candidateIds.length; i += BATCH_C) {
    const slice = candidateIds.slice(i, i + BATCH_C)
    const { data: links } = await db
      .from('ss_product_ingredients')
      .select('product_id')
      .in('product_id', slice)
      .limit(50000)
    returnedC += links?.length ?? 0
    for (const link of links || []) {
      productsSeenC.add((link as { product_id: string }).product_id)
    }
  }
  console.log(`  Total: ${returnedC} link rows returned, ${productsSeenC.size} unique products with at least one link`)

  console.log('\n## Summary')
  console.log(`  True total link rows: ${trueTotal}`)
  console.log(`  Probe A (batch=200 default): ${returnedA} link rows  ${returnedA < trueTotal ? '⚠️  TRUNCATED' : '✓ complete'}`)
  console.log(`  Probe B (batch=50):           ${returnedB} link rows  ${returnedB < trueTotal ? '⚠️  TRUNCATED' : '✓ complete'}`)
  console.log(`  Probe C (batch=200 +limit):   ${returnedC} link rows  ${returnedC < trueTotal ? '⚠️  TRUNCATED' : '✓ complete'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
