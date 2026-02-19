import type { SupabaseClient } from '@supabase/supabase-js'

export interface ConflictResult {
  safe: boolean
  conflicts: Array<{
    ingredient_a: string
    ingredient_b: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    recommendation: string
  }>
}

/**
 * Check if adding a product to a routine creates ingredient conflicts
 * with any existing routine products.
 */
export async function checkRoutineConflicts(
  supabase: SupabaseClient,
  routineId: string,
  newProductId: string
): Promise<ConflictResult> {
  // Get ingredients for the new product
  const { data: newProductIngredients } = await supabase
    .from('ss_product_ingredients')
    .select('ingredient_id')
    .eq('product_id', newProductId)

  if (!newProductIngredients?.length) {
    return { safe: true, conflicts: [] }
  }

  const newIds = newProductIngredients.map((i) => i.ingredient_id)

  // Get all ingredient IDs from existing routine products
  const { data: routineProducts } = await supabase
    .from('ss_routine_products')
    .select('product_id')
    .eq('routine_id', routineId)

  if (!routineProducts?.length) {
    return { safe: true, conflicts: [] }
  }

  const existingProductIds = routineProducts.map((rp) => rp.product_id)

  const { data: existingIngredients } = await supabase
    .from('ss_product_ingredients')
    .select('ingredient_id')
    .in('product_id', existingProductIds)

  if (!existingIngredients?.length) {
    return { safe: true, conflicts: [] }
  }

  const existingIds = [...new Set(existingIngredients.map((i) => i.ingredient_id))]

  // Build bidirectional conflict query filters
  const orFilters: string[] = []
  for (const nid of newIds) {
    for (const eid of existingIds) {
      orFilters.push(
        `and(ingredient_a_id.eq.${nid},ingredient_b_id.eq.${eid})`,
        `and(ingredient_a_id.eq.${eid},ingredient_b_id.eq.${nid})`
      )
    }
  }

  if (orFilters.length === 0) {
    return { safe: true, conflicts: [] }
  }

  const { data: foundConflicts } = await supabase
    .from('ss_ingredient_conflicts')
    .select('ingredient_a_id, ingredient_b_id, severity, description, recommendation')
    .or(orFilters.join(','))

  if (!foundConflicts?.length) {
    return { safe: true, conflicts: [] }
  }

  // Map IDs to names
  const allIds = [...new Set([...newIds, ...existingIds])]
  const { data: allNames } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci')
    .in('id', allIds)

  const nameMap = new Map(allNames?.map((n) => [n.id, n.name_inci]) ?? [])

  const conflicts = foundConflicts.map((c) => ({
    ingredient_a: nameMap.get(c.ingredient_a_id) ?? 'Unknown',
    ingredient_b: nameMap.get(c.ingredient_b_id) ?? 'Unknown',
    severity: c.severity as 'low' | 'medium' | 'high' | 'critical',
    description: c.description,
    recommendation: c.recommendation ?? '',
  }))

  return { safe: conflicts.length === 0, conflicts }
}

/**
 * Check conflicts across all products in a routine (full cross-check).
 * Used when displaying an existing routine to surface any issues.
 */
export async function checkAllRoutineConflicts(
  supabase: SupabaseClient,
  routineId: string
): Promise<ConflictResult> {
  const { data: routineProducts } = await supabase
    .from('ss_routine_products')
    .select('product_id')
    .eq('routine_id', routineId)

  if (!routineProducts || routineProducts.length < 2) {
    return { safe: true, conflicts: [] }
  }

  const productIds = routineProducts.map((rp) => rp.product_id)

  const { data: allIngredients } = await supabase
    .from('ss_product_ingredients')
    .select('product_id, ingredient_id')
    .in('product_id', productIds)

  if (!allIngredients?.length) {
    return { safe: true, conflicts: [] }
  }

  // Build product-to-ingredient map
  const productIngredientMap = new Map<string, Set<string>>()
  for (const pi of allIngredients) {
    if (!productIngredientMap.has(pi.product_id)) {
      productIngredientMap.set(pi.product_id, new Set())
    }
    productIngredientMap.get(pi.product_id)!.add(pi.ingredient_id)
  }

  // Cross-check all pairs of products
  const allIngredientIds = [...new Set(allIngredients.map((i) => i.ingredient_id))]
  const orFilters: string[] = []

  for (let i = 0; i < allIngredientIds.length; i++) {
    for (let j = i + 1; j < allIngredientIds.length; j++) {
      orFilters.push(
        `and(ingredient_a_id.eq.${allIngredientIds[i]},ingredient_b_id.eq.${allIngredientIds[j]})`,
        `and(ingredient_a_id.eq.${allIngredientIds[j]},ingredient_b_id.eq.${allIngredientIds[i]})`
      )
    }
  }

  if (orFilters.length === 0) {
    return { safe: true, conflicts: [] }
  }

  // Supabase OR filter has a practical limit; batch if needed
  const batchSize = 200
  const allConflicts: Array<{
    ingredient_a_id: string
    ingredient_b_id: string
    severity: string
    description: string
    recommendation: string
  }> = []

  for (let i = 0; i < orFilters.length; i += batchSize) {
    const batch = orFilters.slice(i, i + batchSize)
    const { data } = await supabase
      .from('ss_ingredient_conflicts')
      .select('ingredient_a_id, ingredient_b_id, severity, description, recommendation')
      .or(batch.join(','))

    if (data) allConflicts.push(...data)
  }

  if (allConflicts.length === 0) {
    return { safe: true, conflicts: [] }
  }

  const { data: allNames } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci')
    .in('id', allIngredientIds)

  const nameMap = new Map(allNames?.map((n) => [n.id, n.name_inci]) ?? [])

  const conflicts = allConflicts.map((c) => ({
    ingredient_a: nameMap.get(c.ingredient_a_id) ?? 'Unknown',
    ingredient_b: nameMap.get(c.ingredient_b_id) ?? 'Unknown',
    severity: c.severity as 'low' | 'medium' | 'high' | 'critical',
    description: c.description,
    recommendation: c.recommendation ?? '',
  }))

  // Deduplicate
  const seen = new Set<string>()
  const unique = conflicts.filter((c) => {
    const key = [c.ingredient_a, c.ingredient_b].sort().join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { safe: unique.length === 0, conflicts: unique }
}
