/**
 * Phase 9.3 — Ingredient Linker
 *
 * Orchestrates the full ingredient auto-linking pipeline:
 * 1. Find products with ingredients_raw but no ss_product_ingredients links
 * 2. Parse each product's INCI string into individual ingredients
 * 3. Match or create each ingredient in ss_ingredients
 * 4. Batch insert links into ss_product_ingredients
 *
 * Designed for batch execution: processes N products per call,
 * callable repeatedly until all products are linked.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseInciString } from './ingredient-parser'
import { matchOrCreateIngredient, IngredientCache } from './ingredient-matcher'
import { CostTracker } from './cost-tracker'

export interface LinkBatchResult {
  products_linked: number
  products_skipped: number
  products_failed: number
  ingredients_created: number
  ingredients_matched: number
  remaining: number
  cost: {
    calls: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
  }
  errors: string[]
}

/**
 * Link ingredients for a batch of products that have ingredients_raw
 * but no existing ss_product_ingredients rows.
 */
export async function linkBatch(
  supabase: SupabaseClient,
  batchSize: number = 50
): Promise<LinkBatchResult> {
  const costTracker = new CostTracker()
  const cache = new IngredientCache()
  const errors: string[] = []

  let linked = 0
  let skipped = 0
  let failed = 0
  let ingredientsCreated = 0
  let ingredientsMatched = 0

  // Load ingredient cache from DB
  await cache.load(supabase)
  const cacheStartSize = cache.size

  // Find products with ingredients_raw but no existing links
  const products = await findUnlinkedProducts(supabase, batchSize)

  if (products.length === 0) {
    const remaining = await countUnlinked(supabase)
    return {
      products_linked: 0,
      products_skipped: 0,
      products_failed: 0,
      ingredients_created: 0,
      ingredients_matched: 0,
      remaining,
      cost: costTracker.summary,
      errors: [],
    }
  }

  // Process each product sequentially to avoid overwhelming Sonnet API
  for (const product of products) {
    try {
      const result = await linkSingleProduct(
        supabase,
        product.id,
        product.ingredients_raw,
        cache,
        costTracker
      )

      if (result.linked === 0) {
        skipped++
      } else {
        linked++
        ingredientsCreated += result.created
        ingredientsMatched += result.matched
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Product ${product.id}: ${msg}`)
    }
  }

  // Count new ingredients created during this batch
  const totalCreated = cache.size - cacheStartSize

  const remaining = await countUnlinked(supabase)

  return {
    products_linked: linked,
    products_skipped: skipped,
    products_failed: failed,
    ingredients_created: totalCreated,
    ingredients_matched: ingredientsMatched,
    remaining,
    cost: costTracker.summary,
    errors,
  }
}

/**
 * Link ingredients for a single product by its ID.
 * Useful for linking after a scan or manual product addition.
 */
export async function linkSingleProduct(
  supabase: SupabaseClient,
  productId: string,
  ingredientsRaw: string,
  cache: IngredientCache,
  costTracker: CostTracker
): Promise<{ linked: number; created: number; matched: number }> {
  // Parse INCI string
  const parsed = parseInciString(ingredientsRaw)
  if (parsed.length === 0) {
    return { linked: 0, created: 0, matched: 0 }
  }

  // Check if product already has links (idempotency guard)
  const { count: existingCount } = await supabase
    .from('ss_product_ingredients')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId)

  if (existingCount && existingCount > 0) {
    return { linked: 0, created: 0, matched: 0 }
  }

  let created = 0
  let matched = 0

  // Match or create each ingredient
  const links: Array<{
    product_id: string
    ingredient_id: string
    position: number
  }> = []

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
      product_id: productId,
      ingredient_id: result.ingredient_id,
      position: ingredient.position,
    })
  }

  // Deduplicate links by ingredient_id (same ingredient appearing twice in INCI)
  const seen = new Set<string>()
  const uniqueLinks = links.filter((link) => {
    if (seen.has(link.ingredient_id)) return false
    seen.add(link.ingredient_id)
    return true
  })

  // Batch insert into ss_product_ingredients
  if (uniqueLinks.length > 0) {
    const { error } = await supabase
      .from('ss_product_ingredients')
      .insert(uniqueLinks)

    if (error) {
      // If we get a unique constraint error, some links may already exist
      // from a concurrent run — not a critical failure
      if (error.code !== '23505') {
        throw new Error(`Failed to insert ingredient links for product ${productId}: ${error.message}`)
      }
    }
  }

  return { linked: uniqueLinks.length, created, matched }
}

/**
 * Find products that have ingredients_raw but no ss_product_ingredients rows.
 *
 * Uses a SQL query with LEFT JOIN to efficiently find unlinked products in a
 * single round-trip, instead of paginating through all 100K+ ingredient links.
 */
async function findUnlinkedProducts(
  supabase: SupabaseClient,
  limit: number
): Promise<Array<{ id: string; ingredients_raw: string }>> {
  // Use raw SQL via rpc to do an efficient LEFT JOIN query
  const { data, error } = await supabase.rpc('find_unlinked_products', {
    batch_limit: limit,
  })

  if (error) {
    // Fallback: if RPC doesn't exist, use the slower paginated approach
    console.log('  RPC not available, using fallback approach...')
    return findUnlinkedProductsFallback(supabase, limit)
  }

  if (!data || data.length === 0) return []

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    ingredients_raw: row.ingredients_raw as string,
  }))
}

/**
 * Fallback for finding unlinked products when RPC is not available.
 * Uses DISTINCT product_id query (much faster than fetching all rows).
 */
async function findUnlinkedProductsFallback(
  supabase: SupabaseClient,
  limit: number
): Promise<Array<{ id: string; ingredients_raw: string }>> {
  // Get distinct linked product IDs efficiently
  const linkedSet = new Set<string>()
  let offset = 0
  const pageSize = 1000

  // Query distinct product_ids — much smaller result set than all rows
  while (true) {
    const { data, error } = await supabase
      .from('ss_product_ingredients')
      .select('product_id')
      .range(offset, offset + pageSize - 1)

    if (error || !data || data.length === 0) break

    for (const row of data) {
      linkedSet.add(row.product_id as string)
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  // Fetch unlinked products
  const pageSize2 = 200
  let offset2 = 0
  const results: Array<{ id: string; ingredients_raw: string }> = []

  while (results.length < limit) {
    const { data: candidates, error } = await supabase
      .from('ss_products')
      .select('id, ingredients_raw')
      .not('ingredients_raw', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset2, offset2 + pageSize2 - 1)

    if (error) throw new Error(`Failed to fetch products: ${error.message}`)
    if (!candidates || candidates.length === 0) break

    for (const p of candidates) {
      if (!linkedSet.has(p.id) && p.ingredients_raw) {
        results.push({ id: p.id as string, ingredients_raw: p.ingredients_raw as string })
        if (results.length >= limit) break
      }
    }

    offset2 += pageSize2
    if (offset2 > 10000) break
  }

  return results
}

/**
 * Count products that still need ingredient linking.
 * Uses efficient SQL query instead of paginating all ingredient rows.
 */
async function countUnlinked(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('count_unlinked_products')

  if (!error && data !== null && data !== undefined) {
    return typeof data === 'number' ? data : Number(data)
  }

  // Fallback: count via two separate queries
  const { count: totalWithRaw } = await supabase
    .from('ss_products')
    .select('*', { count: 'exact', head: true })
    .not('ingredients_raw', 'is', null)

  const { count: totalLinked } = await supabase
    .from('ss_product_ingredients')
    .select('product_id', { count: 'exact', head: true })

  // This overcounts since totalLinked counts rows not distinct products,
  // but the RPC approach handles it properly
  if (totalWithRaw === null) return 0

  // Use a distinct count query
  const linkedSet = new Set<string>()
  let offset = 0
  while (true) {
    const { data: rows } = await supabase
      .from('ss_product_ingredients')
      .select('product_id')
      .range(offset, offset + 999)
    if (!rows || rows.length === 0) break
    for (const r of rows) linkedSet.add(r.product_id as string)
    if (rows.length < 1000) break
    offset += 1000
  }

  return totalWithRaw - linkedSet.size
}
