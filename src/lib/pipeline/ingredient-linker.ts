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
 */
async function findUnlinkedProducts(
  supabase: SupabaseClient,
  limit: number
): Promise<Array<{ id: string; ingredients_raw: string }>> {
  // Use a raw query via RPC or a subquery approach:
  // Select products WHERE ingredients_raw IS NOT NULL
  // AND id NOT IN (SELECT DISTINCT product_id FROM ss_product_ingredients)
  //
  // Supabase JS doesn't support NOT IN subqueries directly,
  // so we fetch products with ingredients_raw, then filter out those with links.

  // First get products with ingredients_raw
  const { data: candidates, error } = await supabase
    .from('ss_products')
    .select('id, ingredients_raw')
    .not('ingredients_raw', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit * 2) // Over-fetch since some may already have links

  if (error) throw new Error(`Failed to fetch unlinked products: ${error.message}`)
  if (!candidates || candidates.length === 0) return []

  // Check which of these already have ingredient links
  const candidateIds = candidates.map((p) => p.id as string)
  const { data: linkedIds, error: linkedError } = await supabase
    .from('ss_product_ingredients')
    .select('product_id')
    .in('product_id', candidateIds)

  if (linkedError) throw new Error(`Failed to check linked products: ${linkedError.message}`)

  const linkedSet = new Set((linkedIds ?? []).map((r) => r.product_id as string))

  return candidates
    .filter((p) => !linkedSet.has(p.id) && p.ingredients_raw)
    .slice(0, limit)
    .map((p) => ({
      id: p.id as string,
      ingredients_raw: p.ingredients_raw as string,
    }))
}

/**
 * Count products that still need ingredient linking.
 * Uses the same two-step approach as findUnlinkedProducts for accuracy.
 */
async function countUnlinked(supabase: SupabaseClient): Promise<number> {
  // Get IDs of all products with ingredients_raw
  const { data: withRaw, error: rawError } = await supabase
    .from('ss_products')
    .select('id')
    .not('ingredients_raw', 'is', null)

  if (rawError || !withRaw) return 0

  if (withRaw.length === 0) return 0

  // Check which have links already
  const ids = withRaw.map((p) => p.id as string)
  const { data: linked } = await supabase
    .from('ss_product_ingredients')
    .select('product_id')
    .in('product_id', ids)

  const linkedSet = new Set((linked ?? []).map((r) => r.product_id as string))
  return ids.filter((id) => !linkedSet.has(id)).length
}
