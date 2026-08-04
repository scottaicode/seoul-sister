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
  // These two queries gate EARLY `return { safe: true }` statements, so they
  // are the same silent-failure class as the .in() below — and they run FIRST.
  // The July 30 fix instrumented the .in() call and left these, which meant a
  // dead query here still produced an all-clear before the guarded line was
  // ever reached. An empty result is a legitimate "nothing to compare"; an
  // ERROR is not, and must never be reported as safe.
  const { data: newProductIngredients, error: newProductIngredientsError } = await supabase
    .from('ss_product_ingredients')
    .select('ingredient_id')
    .eq('product_id', newProductId)

  if (newProductIngredientsError) {
    console.error('[conflict-detector] new-product ingredient lookup failed:', newProductIngredientsError.message)
    throw new Error(`Conflict check could not run: ${newProductIngredientsError.message}`)
  }

  if (!newProductIngredients?.length) {
    return { safe: true, conflicts: [] }
  }

  const newIds = newProductIngredients.map((i) => i.ingredient_id)

  // Get all ingredient IDs from existing routine products
  const { data: routineProducts, error: routineProductsError } = await supabase
    .from('ss_routine_products')
    .select('product_id')
    .eq('routine_id', routineId)

  if (routineProductsError) {
    console.error('[conflict-detector] routine-product lookup failed:', routineProductsError.message)
    throw new Error(`Conflict check could not run: ${routineProductsError.message}`)
  }

  if (!routineProducts?.length) {
    return { safe: true, conflicts: [] }
  }

  // Custom steps carry product_id = NULL. Passing a null through .in() on a uuid
  // column makes PostgREST reject the WHOLE query with 22P02 ("invalid input
  // syntax for type uuid"), and because only `data` was destructured, the error
  // was invisible: allIngredients came back empty and the function returned
  // safe:true. One custom step therefore disabled conflict checking for EVERY
  // catalog product in the routine — measured on Bailey's Phase 3 PM routine,
  // where filtering nulls recovers 189 ingredient rows that were being skipped
  // while the UI showed no warning (July 30 2026).
  const existingProductIds = routineProducts
    .map((rp) => rp.product_id)
    .filter((id): id is string => id !== null)

  const { data: existingIngredients, error: existingIngredientsError } = await supabase
    .from('ss_product_ingredients')
    .select('ingredient_id')
    .in('product_id', existingProductIds)

  // A FAILED query is not an all-clear. Surfacing the error keeps a broken read
  // from being indistinguishable from "nothing conflicts" — the silent-failure
  // class this repo keeps relearning.
  if (existingIngredientsError) {
    console.error('[conflict-detector] existing-ingredient lookup failed:', existingIngredientsError.message)
    throw new Error(`Conflict check could not run: ${existingIngredientsError.message}`)
  }

  if (!existingIngredients?.length) {
    return { safe: true, conflicts: [] }
  }

  const existingIds = [...new Set(existingIngredients.map((i) => i.ingredient_id))]

  // Fetch rules touching either side, then pair them in memory. The previous
  // version built newIds × existingIds `or` clauses — ~11,600 for a real
  // routine, in ONE unbatched URL — which is the same O(n²) blowup fixed in
  // checkAllRoutineConflicts below. ss_ingredient_conflicts is a small curated
  // rule table, so two .in() filters answer this in a single cheap request.
  if (!newIds.length) {
    return { safe: true, conflicts: [] }
  }

  const newIdSet = new Set(newIds)
  const existingIdSet = new Set(existingIds)
  const bothSides = [...new Set([...newIds, ...existingIds])]

  const { data: candidateRules, error: candidateRulesError } = await supabase
    .from('ss_ingredient_conflicts')
    .select('ingredient_a_id, ingredient_b_id, severity, description, recommendation')
    .in('ingredient_a_id', bothSides)
    .in('ingredient_b_id', bothSides)

  if (candidateRulesError) {
    console.error('[conflict-detector] conflict rule lookup failed:', candidateRulesError.message)
    throw new Error(`Conflict check could not run: ${candidateRulesError.message}`)
  }

  // A rule applies only if it spans the NEW product and the EXISTING routine —
  // in either column order. Two ingredients both already in the routine are not
  // a conflict introduced by this addition.
  const foundConflicts = (candidateRules || []).filter(
    (c) =>
      (newIdSet.has(c.ingredient_a_id) && existingIdSet.has(c.ingredient_b_id)) ||
      (newIdSet.has(c.ingredient_b_id) && existingIdSet.has(c.ingredient_a_id))
  )

  if (!foundConflicts.length) {
    return { safe: true, conflicts: [] }
  }

  // Map IDs to names
  const allIds = [...new Set([...newIds, ...existingIds])]
  // NOT a throw: this runs AFTER conflicts are found and only maps ids to
  // display names, so a failure degrades a real warning to "Unknown conflicts
  // with Unknown" rather than hiding it. Log it so the degradation is visible.
  const { data: allNames, error: allNamesError } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci')
    .in('id', allIds)

  if (allNamesError) {
    console.error('[conflict-detector] ingredient-name lookup failed:', allNamesError.message)
  }

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
  // Same class as checkRoutineConflicts above: this gates an early
  // `return { safe: true }`, so a dead query would report a whole routine as
  // conflict-free. This is the read path that renders an EXISTING routine, so
  // a false all-clear here is what a subscriber sees every time they open it.
  const { data: routineProducts, error: routineProductsError } = await supabase
    .from('ss_routine_products')
    .select('product_id')
    .eq('routine_id', routineId)

  if (routineProductsError) {
    console.error('[conflict-detector] routine-product lookup failed:', routineProductsError.message)
    throw new Error(`Conflict check could not run: ${routineProductsError.message}`)
  }

  if (!routineProducts || routineProducts.length < 2) {
    return { safe: true, conflicts: [] }
  }

  // See the note on the null filter above — a single custom step used to kill
  // this entire query with 22P02 and return a false all-clear.
  const productIds = routineProducts
    .map((rp) => rp.product_id)
    .filter((id): id is string => id !== null)

  const { data: allIngredients, error: allIngredientsError } = await supabase
    .from('ss_product_ingredients')
    .select('product_id, ingredient_id')
    .in('product_id', productIds)

  if (allIngredientsError) {
    console.error('[conflict-detector] routine ingredient lookup failed:', allIngredientsError.message)
    throw new Error(`Conflict check could not run: ${allIngredientsError.message}`)
  }

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

  // Fetch the conflict rules that touch ANY ingredient in this routine, then
  // pair them up in memory.
  //
  // This used to enumerate every unordered ingredient pair into PostgREST `or`
  // filters, batched 200 at a time. That is O(n²) in ingredient count: a real
  // 5-product routine has ~145 unique ingredients → 20,880 filter clauses →
  // 105 sequential HTTP round-trips, which would hang the routine page. It was
  // never hit in production only because the null-uuid bug above made the query
  // fail before reaching here. Fixing the silent failure exposed the latent
  // blowup, so both are fixed together.
  //
  // Two `.in()` filters return the same rules in ONE request. ss_ingredient_conflicts
  // is a small curated rule table, so this stays cheap as the catalog grows.
  const allIngredientIds = [...new Set(allIngredients.map((i) => i.ingredient_id))]

  if (allIngredientIds.length < 2) {
    return { safe: true, conflicts: [] }
  }

  const ingredientIdSet = new Set(allIngredientIds)

  const { data: candidateRules, error: rulesError } = await supabase
    .from('ss_ingredient_conflicts')
    .select('ingredient_a_id, ingredient_b_id, severity, description, recommendation')
    .in('ingredient_a_id', allIngredientIds)
    .in('ingredient_b_id', allIngredientIds)

  if (rulesError) {
    console.error('[conflict-detector] conflict rule lookup failed:', rulesError.message)
    throw new Error(`Conflict check could not run: ${rulesError.message}`)
  }

  // Both endpoints must be present in the routine for the rule to apply. The
  // .in() pair already guarantees this, but re-check so the invariant is local
  // and survives a future query change.
  const allConflicts = (candidateRules || []).filter(
    (c) => ingredientIdSet.has(c.ingredient_a_id) && ingredientIdSet.has(c.ingredient_b_id)
  )

  if (allConflicts.length === 0) {
    return { safe: true, conflicts: [] }
  }

  // NOT a throw: this runs AFTER conflicts are found and only maps ids to
  // display names, so a failure degrades a real warning to "Unknown conflicts
  // with Unknown" rather than hiding it. Log it so the degradation is visible.
  const { data: allNames, error: allNamesError } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci')
    .in('id', allIngredientIds)

  if (allNamesError) {
    console.error('[conflict-detector] ingredient-name lookup failed:', allNamesError.message)
  }

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
