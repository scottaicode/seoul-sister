import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Ingredient Overlap Detection (Feature 16.1)
//
// Detects when the same active ingredient appears across multiple products in
// a user's routine + inventory. Bailey's gap (May 8 2026): she had to ASK Yuri
// whether stacking niacinamide across 5 products was wasteful. She wanted Yuri
// to spot it without being asked.
//
// Design principles:
// - AI-First: this module returns raw structured data only. Yuri reasons about
//   tone, advice, and whether the user should care. No canned phrases, no
//   narrative generation, no "you should drop X" prescriptions baked in.
// - Active-ingredient gate (is_active=true): water, glycerin, butylene glycol,
//   1,2-hexanediol, and other humectants/solvents/preservative boosters are
//   IGNORED. Stacking them is normal and unworthy of Yuri's attention.
// - Two severity tiers only: 'worth_noting' (2 products) and 'likely_excessive'
//   (3+ products). An 'informational' tier would just create noise.
// - Phase-blind: overlap is a fact about the routine, not a recommendation.
//   Yuri decides whether to mention it given the user's treatment phase. The
//   detection layer doesn't filter on decision_memory.
// ---------------------------------------------------------------------------

export type OverlapSeverity = 'worth_noting' | 'likely_excessive'

export interface IngredientOverlapEntry {
  ingredientId: string
  ingredientName: string
  /** The ss_ingredients.function field. May be null. Used by Yuri to understand
   * what the ingredient does so she can give a useful response. */
  ingredientFunction: string | null
  /** Names of products that contain this ingredient. Each entry is a "Brand
   * Name" string ready for display. Length always >= 2. */
  productDisplays: string[]
  productCount: number
  severity: OverlapSeverity
}

export interface IngredientOverlapResult {
  entries: IngredientOverlapEntry[]
  /** Total active ingredients counted across the user's routine + inventory.
   * Useful for Yuri to know "this user has 47 active ingredients across 8
   * products" vs "they have 12 across 3 products" — different conversations. */
  totalActiveIngredients: number
  /** Total distinct products considered (routine + inventory, deduplicated). */
  totalProducts: number
}

const EMPTY_RESULT: IngredientOverlapResult = {
  entries: [],
  totalActiveIngredients: 0,
  totalProducts: 0,
}

// ---------------------------------------------------------------------------
// detectRoutineOverlap
// ---------------------------------------------------------------------------

/**
 * Builds the user's full product set (active routines ∪ active inventory) and
 * finds every active ingredient that appears in 2+ products. Returns the
 * structured overlap data so Yuri can reason about it.
 *
 * Returns EMPTY_RESULT when:
 * - User has fewer than 2 products with linked ingredients (no overlap possible)
 * - No overlapping active ingredients found
 * - Any database error occurs (non-critical — never break Yuri's context load)
 */
export async function detectRoutineOverlap(
  supabase: SupabaseClient,
  userId: string
): Promise<IngredientOverlapResult> {
  try {
    // 1. Collect product IDs from routines + inventory
    const productIds = await collectUserProductIds(supabase, userId)
    if (productIds.length < 2) return EMPTY_RESULT

    // 2. Load every product-ingredient link for these products, joining the
    //    ingredient row so we can filter on is_active and grab the function
    //    text in one query.
    const { data: links, error: linksError } = await supabase
      .from('ss_product_ingredients')
      .select(`
        product_id,
        ingredient:ss_ingredients!inner (
          id,
          name_en,
          name_inci,
          function,
          is_active,
          is_fragrance
        )
      `)
      .in('product_id', productIds)

    if (linksError || !links?.length) return EMPTY_RESULT

    // 3. Load product display data (brand + name) for the products we found.
    const { data: products } = await supabase
      .from('ss_products')
      .select('id, name_en, brand_en')
      .in('id', productIds)

    const productDisplayMap = new Map<string, string>()
    for (const p of products ?? []) {
      const display = p.brand_en ? `${p.brand_en} ${p.name_en}` : p.name_en
      productDisplayMap.set(p.id, display)
    }

    // 4. Group active-only ingredients by ingredient_id, collecting which
    //    products contain each. Skip non-active and fragrance ingredients —
    //    they're not what Yuri needs to flag.
    interface Acc {
      ingredientId: string
      ingredientName: string
      ingredientFunction: string | null
      productIdSet: Set<string>
    }
    const groups = new Map<string, Acc>()
    let activeIngredientHits = 0

    for (const link of links) {
      const ing = link.ingredient as unknown as {
        id: string
        name_en: string | null
        name_inci: string | null
        function: string | null
        is_active: boolean | null
        is_fragrance: boolean | null
      } | null

      if (!ing || !ing.is_active || ing.is_fragrance) continue
      activeIngredientHits++

      const productId = link.product_id as string
      const ingredientId = ing.id

      const existing = groups.get(ingredientId)
      if (existing) {
        existing.productIdSet.add(productId)
      } else {
        groups.set(ingredientId, {
          ingredientId,
          ingredientName: ing.name_en || ing.name_inci || 'Unknown ingredient',
          ingredientFunction: ing.function,
          productIdSet: new Set([productId]),
        })
      }
    }

    // 5. Filter to ingredients that overlap (>=2 products), tag severity, and
    //    sort by product count descending so the worst offenders surface first.
    const entries: IngredientOverlapEntry[] = []
    for (const acc of groups.values()) {
      if (acc.productIdSet.size < 2) continue
      const productDisplays: string[] = []
      for (const pid of acc.productIdSet) {
        const display = productDisplayMap.get(pid)
        if (display) productDisplays.push(display)
      }
      if (productDisplays.length < 2) continue // defensive — shouldn't happen
      entries.push({
        ingredientId: acc.ingredientId,
        ingredientName: acc.ingredientName,
        ingredientFunction: acc.ingredientFunction,
        productDisplays: productDisplays.sort(),
        productCount: productDisplays.length,
        severity: productDisplays.length >= 3 ? 'likely_excessive' : 'worth_noting',
      })
    }

    entries.sort((a, b) => {
      if (a.productCount !== b.productCount) return b.productCount - a.productCount
      return a.ingredientName.localeCompare(b.ingredientName)
    })

    return {
      entries,
      totalActiveIngredients: activeIngredientHits,
      totalProducts: productIds.length,
    }
  } catch {
    // Overlap detection is non-critical context. Failing silently is the right
    // behavior — Yuri's other context loads and her conversation continue.
    return EMPTY_RESULT
  }
}

// ---------------------------------------------------------------------------
// detectScanOverlap
// ---------------------------------------------------------------------------

/**
 * Given a list of ingredient IDs from a freshly-scanned product, finds which
 * of those ingredients already exist as actives in the user's routine +
 * inventory. Returns the same shape as detectRoutineOverlap so the scan UI
 * can render it consistently.
 *
 * The product being scanned is INTENTIONALLY excluded from the user's product
 * set — even if the user happens to already own it, we want to show "this
 * product overlaps with your existing routine" not "this product overlaps
 * with itself."
 */
export async function detectScanOverlap(
  supabase: SupabaseClient,
  userId: string,
  scannedIngredientIds: string[],
  excludeProductId?: string | null
): Promise<IngredientOverlapResult> {
  try {
    if (!scannedIngredientIds.length) return EMPTY_RESULT

    // 1. User's existing product set (excluding the scanned product if owned)
    let productIds = await collectUserProductIds(supabase, userId)
    if (excludeProductId) {
      productIds = productIds.filter((id) => id !== excludeProductId)
    }
    if (!productIds.length) return EMPTY_RESULT

    // 2. Find which of the scanned ingredients already appear as actives in
    //    the user's existing products.
    const { data: links } = await supabase
      .from('ss_product_ingredients')
      .select(`
        product_id,
        ingredient:ss_ingredients!inner (
          id,
          name_en,
          name_inci,
          function,
          is_active,
          is_fragrance
        )
      `)
      .in('product_id', productIds)
      .in('ingredient_id', scannedIngredientIds)

    if (!links?.length) return EMPTY_RESULT

    // 3. Load product display strings
    const { data: products } = await supabase
      .from('ss_products')
      .select('id, name_en, brand_en')
      .in('id', productIds)

    const productDisplayMap = new Map<string, string>()
    for (const p of products ?? []) {
      const display = p.brand_en ? `${p.brand_en} ${p.name_en}` : p.name_en
      productDisplayMap.set(p.id, display)
    }

    // 4. Group by ingredient — same shape as detectRoutineOverlap
    interface Acc {
      ingredientId: string
      ingredientName: string
      ingredientFunction: string | null
      productIdSet: Set<string>
    }
    const groups = new Map<string, Acc>()

    for (const link of links) {
      const ing = link.ingredient as unknown as {
        id: string
        name_en: string | null
        name_inci: string | null
        function: string | null
        is_active: boolean | null
        is_fragrance: boolean | null
      } | null

      if (!ing || !ing.is_active || ing.is_fragrance) continue
      const productId = link.product_id as string

      const existing = groups.get(ing.id)
      if (existing) {
        existing.productIdSet.add(productId)
      } else {
        groups.set(ing.id, {
          ingredientId: ing.id,
          ingredientName: ing.name_en || ing.name_inci || 'Unknown ingredient',
          ingredientFunction: ing.function,
          productIdSet: new Set([productId]),
        })
      }
    }

    // 5. For SCAN overlap, even 1 existing product counts (the scanned product
    //    itself is the "second" one). Severity tier reflects total count
    //    INCLUDING the scanned product, so 1 existing = worth_noting (2 total),
    //    2 existing = likely_excessive (3 total).
    const entries: IngredientOverlapEntry[] = []
    for (const acc of groups.values()) {
      if (acc.productIdSet.size < 1) continue
      const productDisplays: string[] = []
      for (const pid of acc.productIdSet) {
        const display = productDisplayMap.get(pid)
        if (display) productDisplays.push(display)
      }
      if (productDisplays.length < 1) continue
      const totalIncludingScan = productDisplays.length + 1
      entries.push({
        ingredientId: acc.ingredientId,
        ingredientName: acc.ingredientName,
        ingredientFunction: acc.ingredientFunction,
        productDisplays: productDisplays.sort(),
        productCount: totalIncludingScan,
        severity: totalIncludingScan >= 3 ? 'likely_excessive' : 'worth_noting',
      })
    }

    entries.sort((a, b) => {
      if (a.productCount !== b.productCount) return b.productCount - a.productCount
      return a.ingredientName.localeCompare(b.ingredientName)
    })

    return {
      entries,
      totalActiveIngredients: entries.length,
      totalProducts: productIds.length,
    }
  } catch {
    return EMPTY_RESULT
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the deduplicated set of product IDs across the user's active
 * routines and active inventory. Inventory rows with NULL product_id (custom
 * entries the user typed in but didn't link to the catalog) are skipped — we
 * can't analyze ingredients we don't have linked.
 */
async function collectUserProductIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const ids = new Set<string>()

  // Routine products
  const { data: routines } = await supabase
    .from('ss_user_routines')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)

  const routineIds = (routines ?? []).map((r) => r.id as string)
  if (routineIds.length > 0) {
    const { data: routineProducts } = await supabase
      .from('ss_routine_products')
      .select('product_id')
      .in('routine_id', routineIds)

    for (const rp of routineProducts ?? []) {
      const pid = rp.product_id as string | null
      if (pid) ids.add(pid)
    }
  }

  // Inventory products
  const { data: inventory } = await supabase
    .from('ss_user_products')
    .select('product_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  for (const row of inventory ?? []) {
    const pid = row.product_id as string | null
    if (pid) ids.add(pid)
  }

  return Array.from(ids)
}
