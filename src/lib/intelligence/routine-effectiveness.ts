import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConcernEffectiveness {
  concern: string
  averageScore: number
  sampleSize: number
}

export interface MissingIngredient {
  ingredientName: string
  concern: string
  effectivenessScore: number
}

export interface RoutineEffectivenessResult {
  concerns: ConcernEffectiveness[]
  missingIngredients: MissingIngredient[]
}

// ---------------------------------------------------------------------------
// calculateRoutineEffectiveness
// ---------------------------------------------------------------------------

/**
 * Loads all ingredients across every product in a routine, cross-references
 * them against ss_ingredient_effectiveness for the user's skin type, and
 * returns a per-concern effectiveness breakdown.
 */
export async function calculateRoutineEffectiveness(
  supabase: SupabaseClient,
  routineId: string,
  skinType: string | null,
  skinConcerns: string[]
): Promise<ConcernEffectiveness[]> {
  if (!skinType) return []

  // 1. Get all product IDs in the routine
  const { data: routineProducts } = await supabase
    .from('ss_routine_products')
    .select('product_id')
    .eq('routine_id', routineId)

  if (!routineProducts?.length) return []

  const productIds = routineProducts.map((rp) => rp.product_id)

  // 2. Get all ingredient IDs for those products
  const { data: links } = await supabase
    .from('ss_product_ingredients')
    .select('ingredient_id')
    .in('product_id', productIds)

  if (!links?.length) return []

  const ingredientIds = [...new Set(links.map((l) => l.ingredient_id))]

  // 3. Get effectiveness data for those ingredients and user's skin type
  const { data: effectiveness } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, concern, effectiveness_score, sample_size')
    .eq('skin_type', skinType)
    .in('ingredient_id', ingredientIds)
    .gte('sample_size', 5)

  if (!effectiveness?.length) return []

  // 4. Aggregate by concern — average effectiveness score weighted by sample size
  const concernMap = new Map<string, { totalScore: number; count: number; totalSamples: number }>()

  for (const row of effectiveness) {
    const existing = concernMap.get(row.concern)
    if (existing) {
      existing.totalScore += row.effectiveness_score
      existing.count += 1
      existing.totalSamples += row.sample_size
    } else {
      concernMap.set(row.concern, {
        totalScore: row.effectiveness_score,
        count: 1,
        totalSamples: row.sample_size,
      })
    }
  }

  // Build result, prioritising concerns the user actually cares about
  const userConcernsLower = new Set(skinConcerns.map((c) => c.toLowerCase()))
  const results: ConcernEffectiveness[] = []

  for (const [concern, data] of concernMap) {
    results.push({
      concern,
      averageScore: Math.round((data.totalScore / data.count) * 100),
      sampleSize: data.totalSamples,
    })
  }

  // Sort: user concerns first, then by score descending
  results.sort((a, b) => {
    const aRelevant = userConcernsLower.has(a.concern.toLowerCase()) ? 1 : 0
    const bRelevant = userConcernsLower.has(b.concern.toLowerCase()) ? 1 : 0
    if (aRelevant !== bRelevant) return bRelevant - aRelevant
    return b.averageScore - a.averageScore
  })

  return results
}

// ---------------------------------------------------------------------------
// getMissingHighValueIngredients
// ---------------------------------------------------------------------------

/**
 * Finds ingredients with effectiveness_score > 0.70 for the user's skin type
 * that are NOT present in any product in the given routine.
 * Returns top 3 missing ingredients.
 */
export async function getMissingHighValueIngredients(
  supabase: SupabaseClient,
  routineId: string,
  skinType: string | null
): Promise<MissingIngredient[]> {
  if (!skinType) return []

  // 1. Get all product IDs in the routine
  const { data: routineProducts } = await supabase
    .from('ss_routine_products')
    .select('product_id')
    .eq('routine_id', routineId)

  const productIds = routineProducts?.map((rp) => rp.product_id) ?? []

  // 2. Get ingredient IDs already in the routine
  let routineIngredientIds: string[] = []
  if (productIds.length > 0) {
    const { data: links } = await supabase
      .from('ss_product_ingredients')
      .select('ingredient_id')
      .in('product_id', productIds)

    routineIngredientIds = [...new Set((links ?? []).map((l) => l.ingredient_id))]
  }

  // 3. Get high-value ingredients for user's skin type
  const { data: highValue } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, concern, effectiveness_score')
    .eq('skin_type', skinType)
    .gte('effectiveness_score', 0.70)
    .gte('sample_size', 5)
    .order('effectiveness_score', { ascending: false })
    .limit(20)

  if (!highValue?.length) return []

  // 4. Filter out ingredients already in the routine
  const routineIngSet = new Set(routineIngredientIds)
  const missing = highValue.filter((h) => !routineIngSet.has(h.ingredient_id))

  if (missing.length === 0) return []

  // 5. Resolve ingredient names
  const missingIds = missing.slice(0, 3).map((m) => m.ingredient_id)
  const { data: ingredients } = await supabase
    .from('ss_ingredients')
    .select('id, name_en')
    .in('id', missingIds)

  const nameMap = new Map((ingredients ?? []).map((i) => [i.id, i.name_en]))

  return missing.slice(0, 3).map((m) => ({
    ingredientName: nameMap.get(m.ingredient_id) ?? 'Unknown ingredient',
    concern: m.concern,
    effectivenessScore: Math.round(m.effectiveness_score * 100),
  }))
}
