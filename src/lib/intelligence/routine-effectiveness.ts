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
 * Phrases that indicate Yuri has explicitly excluded an ingredient from the
 * user's current treatment phase. If a decision/preference/correction text
 * matches one of these PLUS mentions the ingredient, the recommendation is
 * filtered out so the widget doesn't tell the user to add what their
 * AI advisor told them to skip.
 */
const PHASE_EXCLUSION_MARKERS = [
  'skip',
  'defer',
  'phase 2',
  'phase 3',
  'phase 4',
  'phase ii',
  'phase iii',
  'pause',
  'wait',
  'later',
  'not yet',
  'until',
  'revisit',
  'avoid for now',
  'stop using',
  'discontinue',
  "don't add",
  'do not add',
  'no need',
  'no otc',
  'put on hold',
  'on hold',
]

interface DecisionMemoryShape {
  decisions?: Array<{ topic?: string; decision?: string }>
  preferences?: Array<{ topic?: string; preference?: string }>
  corrections?: Array<{ topic?: string; yuri_said?: string; truth?: string }>
}

/**
 * Returns the set of ingredient name tokens (lowercased) the user has been
 * told to currently exclude from their routine. Pulled from decision_memory
 * across the user's 3 most recent conversations with non-empty memory.
 *
 * Implementation: text-search-only, no AI call. The keyword matcher catches
 * Yuri's standard phrasing ("skip tranexamic acid for now", "no OTC retinol
 * needed", "revisit in Phase 3"). False negatives are acceptable — the cost
 * of missing one is showing a recommendation Yuri didn't endorse, which is
 * exactly the pre-fix state. False positives (over-filtering) are worse,
 * so the marker list is intentionally conservative.
 */
async function loadCurrentlyExcludedIngredients(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('ss_yuri_conversations')
    .select('decision_memory')
    .eq('user_id', userId)
    .not('decision_memory', 'eq', '{}')
    // Order by created_at, not updated_at: backfill scripts (decision memory
    // backfill, date repair) touch updated_at on historical rows. With
    // updated_at, those mass-touches can evict recent decisions from this
    // 5-row window. created_at is immutable, so the most recent conversation
    // is always the most recent.
    .order('created_at', { ascending: false })
    .limit(5)

  if (!data?.length) return []

  const excludedTokens = new Set<string>()

  for (const row of data) {
    const dm = row.decision_memory as DecisionMemoryShape | null
    if (!dm) continue

    const candidateTexts: string[] = []
    for (const d of dm.decisions || []) {
      candidateTexts.push(`${d.topic || ''} ${d.decision || ''}`.toLowerCase())
    }
    for (const p of dm.preferences || []) {
      candidateTexts.push(`${p.topic || ''} ${p.preference || ''}`.toLowerCase())
    }
    for (const c of dm.corrections || []) {
      candidateTexts.push(`${c.topic || ''} ${c.yuri_said || ''} ${c.truth || ''}`.toLowerCase())
    }

    for (const text of candidateTexts) {
      const hasMarker = PHASE_EXCLUSION_MARKERS.some((m) => text.includes(m))
      if (!hasMarker) continue
      // Tokenize the text — every "word" 3+ chars long becomes a candidate
      // exclusion token. Filter out the markers themselves and common stop
      // words so we don't accidentally treat "skip" or "phase" as ingredients.
      const STOP = new Set([
        'skip', 'defer', 'phase', 'pause', 'wait', 'later', 'until', 'revisit',
        'stop', 'using', 'discontinue', 'add', 'need', 'needed', 'now', 'hold',
        'with', 'from', 'this', 'that', 'will', 'have', 'when', 'into', 'your',
        'their', 'them', 'they', 'been', 'were', 'just', 'over', 'after',
        'avoid', 'around', 'before', 'next', 'first', 'second', 'third',
        'still', 'would', 'should', 'could', 'might', 'about', 'because',
        'while', 'once', 'each', 'some', 'these', 'those', 'most', 'such',
        'same', 'than', 'then', 'only', 'also', 'other', 'phase_2', 'phase_3',
        'phase_4', 'aren', 'don', 'doesn', 'isn', 'won',
      ])
      const words = text.split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w))
      for (const w of words) excludedTokens.add(w)
    }
  }

  return Array.from(excludedTokens)
}

/**
 * Finds ingredients with effectiveness_score > 0.70 for the user's skin type
 * that are NOT present in any product in the given routine AND that have
 * NOT been explicitly excluded by the user's active treatment plan
 * (read from decision_memory).
 *
 * Returns top 3 missing ingredients.
 *
 * Without the decision_memory filter, this widget recommends ingredients
 * Yuri has explicitly told the user to skip during the current phase
 * (e.g., tranexamic acid before Phase 3 barrier repair completes). v10.3.6
 * fixed this; same class of issue as v8.5.0 Glass Skin phase-awareness.
 *
 * @param userId — required for decision_memory filtering. If null/undefined,
 *   no filtering is applied (backward-compatible fallback).
 */
export async function getMissingHighValueIngredients(
  supabase: SupabaseClient,
  routineId: string,
  skinType: string | null,
  userId?: string
): Promise<MissingIngredient[]> {
  if (!skinType) return []

  // 1. Get all product IDs in the routine
  const { data: routineProducts } = await supabase
    .from('ss_routine_products')
    .select('product_id')
    .eq('routine_id', routineId)

  const productIds = (routineProducts?.map((rp) => rp.product_id) ?? []).filter(Boolean) as string[]

  // 2. Get ingredient IDs already in the routine
  let routineIngredientIds: string[] = []
  let routineIngredientNames: string[] = []
  if (productIds.length > 0) {
    const { data: links } = await supabase
      .from('ss_product_ingredients')
      .select('ingredient_id, ingredient:ingredient_id (name_en, name_inci)')
      .in('product_id', productIds)

    routineIngredientIds = [...new Set((links ?? []).map((l) => l.ingredient_id))]

    // Collect normalized ingredient name tokens from the routine for alias matching.
    // Bailey's COSRX BHA contains "Betaine Salicylate" — functionally a salicylic
    // acid but stored as a separate ingredient_id from "Salicylic Acid (BHA)" in
    // the effectiveness table. Without this token-level alias check the widget
    // recommends "Salicylic Acid (BHA)" as missing even though the user just
    // added a betaine salicylate product.
    const nameTokens = new Set<string>()
    for (const l of links ?? []) {
      const ing = l.ingredient as unknown as { name_en?: string; name_inci?: string } | null
      const text = `${ing?.name_en || ''} ${ing?.name_inci || ''}`.toLowerCase()
      // Salicylate family — treat as salicylic acid for missing-ingredient detection
      if (text.includes('salicylate') || text.includes('salicylic')) {
        nameTokens.add('salicylic')
      }
      if (text.includes('hyaluronate') || text.includes('hyaluronic')) {
        nameTokens.add('hyaluronic')
      }
      if (text.includes('niacinamide')) {
        nameTokens.add('niacinamide')
      }
      if (text.includes('retinol') || text.includes('retinal') || text.includes('retinyl')) {
        nameTokens.add('retinol')
      }
      if (text.includes('ascorbic') || text.includes('ascorbyl') || text.includes('vitamin c')) {
        nameTokens.add('vitamin_c')
      }
    }
    routineIngredientNames = [...nameTokens]
  }

  // 3. Get high-value ingredients for user's skin type. Over-fetch (40 vs the
  //    old 20) so phase-exclusion filtering still leaves enough to pick top 3.
  const { data: highValue } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, concern, effectiveness_score')
    .eq('skin_type', skinType)
    .gte('effectiveness_score', 0.70)
    .gte('sample_size', 5)
    .order('effectiveness_score', { ascending: false })
    .limit(40)

  if (!highValue?.length) return []

  // 4. Filter out ingredients already in the routine (by ID)
  const routineIngSet = new Set(routineIngredientIds)
  let missing = highValue.filter((h) => !routineIngSet.has(h.ingredient_id))

  if (missing.length === 0) return []

  // 5. Resolve ingredient names — needed for display, phase filtering, AND
  //    alias-matching against routineIngredientNames.
  const missingIds = missing.map((m) => m.ingredient_id)
  const { data: ingredients } = await supabase
    .from('ss_ingredients')
    .select('id, name_en, name_inci')
    .in('id', missingIds)

  const nameMap = new Map((ingredients ?? []).map((i) => [i.id, i.name_en]))

  // 4b. Alias filter: drop high-value candidates that the routine already
  //     covers via a functionally-equivalent ingredient with a different ID.
  //     Bailey's COSRX BHA has "Betaine Salicylate" (ID A); the effectiveness
  //     table recommends "Salicylic Acid (BHA)" (ID B). Both are salicylic-acid-
  //     family BHAs. The user has the chemistry covered.
  if (routineIngredientNames.length > 0) {
    const routineTokens = new Set(routineIngredientNames)
    missing = missing.filter((m) => {
      const ing = (ingredients ?? []).find((i) => i.id === m.ingredient_id)
      const text = `${ing?.name_en || ''} ${ing?.name_inci || ''}`.toLowerCase()
      if ((text.includes('salicylic') || text.includes('salicylate')) && routineTokens.has('salicylic')) return false
      if ((text.includes('hyaluronic') || text.includes('hyaluronate')) && routineTokens.has('hyaluronic')) return false
      if (text.includes('niacinamide') && routineTokens.has('niacinamide')) return false
      if ((text.includes('retinol') || text.includes('retinal') || text.includes('retinyl')) && routineTokens.has('retinol')) return false
      if ((text.includes('ascorbic') || text.includes('ascorbyl') || text.includes('vitamin c')) && routineTokens.has('vitamin_c')) return false
      return true
    })
  }

  if (missing.length === 0) return []

  // 6. Phase-aware filter: drop ingredients Yuri has explicitly excluded in
  //    the user's current treatment plan. Skipped if userId not provided
  //    (backward compat).
  if (userId) {
    const excludedTokens = await loadCurrentlyExcludedIngredients(supabase, userId)
    if (excludedTokens.length > 0) {
      const excludedSet = new Set(excludedTokens)
      missing = missing.filter((m) => {
        const rawName = nameMap.get(m.ingredient_id) || ''
        const name: string = String(rawName).toLowerCase()
        if (!name) return true
        const nameTokens: string[] = name.split(/[^a-z]+/).filter((t: string) => t.length >= 4)
        // Drop if ANY token in the ingredient name appears in the excluded set.
        // "Tranexamic Acid" → tokens [tranexamic, acid]. If decision memory
        // says "skip tranexamic acid for now", tranexamic gets added to
        // excludedTokens and we drop the row.
        return !nameTokens.some((t: string) => excludedSet.has(t))
      })
    }
  }

  if (missing.length === 0) return []

  return missing.slice(0, 3).map((m) => ({
    ingredientName: nameMap.get(m.ingredient_id) ?? 'Unknown ingredient',
    concern: m.concern,
    effectivenessScore: Math.round(m.effectiveness_score * 100),
  }))
}
