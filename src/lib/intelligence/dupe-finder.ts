// ---------------------------------------------------------------------------
// Dupe finder — shared core
// ---------------------------------------------------------------------------
// Given a target product, finds same-category products with the most ingredient
// overlap (weighted toward actives + key functional ingredients), optionally
// re-scored by the user's skin-type effectiveness data. Returns the ingredient-
// overlap FACTS (shared/unique ingredients, match %, price savings). It does NOT
// say "you should buy this" — that judgment is Yuri's (Yuri Sole Authority).
//
// Used by:
//   - GET /api/dupes (the standalone dupe-finder page)
//   - Yuri's find_product_dupes tool (so she can find dupes conversationally)
// ---------------------------------------------------------------------------
import { getServiceClient } from '@/lib/supabase'

interface IngredientInfo {
  id: string
  name_en: string
  name_inci: string
  is_active: boolean
  is_fragrance: boolean
  function: string
  safety_rating: number
  comedogenic_rating: number
}

interface EffectivenessInsight {
  ingredientName: string
  concern: string
  score: number
}

export interface DupeResult {
  product: {
    id: string
    name_en: string
    name_ko: string
    brand_en: string
    category: string
    price_usd: number | null
    price_krw: number | null
    image_url: string | null
    rating_avg: number | null
    review_count: number
    volume_display: string | null
  }
  match_score: number
  shared_ingredients: string[]
  unique_to_original: string[]
  unique_to_dupe: string[]
  price_savings_pct: number
  effectiveness_insight: EffectivenessInsight | null
}

export interface FindDupesResult {
  original: DupeResult['product'] | null
  dupes: DupeResult[]
  error?: string
}

/** Check if an ingredient function is "key functional" (not just filler) */
function isKeyFunctional(fn: string): boolean {
  const lower = (fn || '').toLowerCase()
  const keyFunctions = [
    'humectant', 'emollient', 'antioxidant', 'exfoliant', 'brightening',
    'anti-aging', 'soothing', 'barrier repair', 'moisturizing', 'hydrating',
    'uv filter', 'sunscreen', 'retinoid', 'vitamin', 'acid', 'peptide',
    'niacinamide', 'ceramide', 'hyaluronic',
  ]
  return keyFunctions.some(kf => lower.includes(kf))
}

export async function findDupes(params: {
  productId: string
  userId?: string | null
  maxDupes?: number
  minMatchScore?: number
}): Promise<FindDupesResult> {
  const maxDupes = params.maxDupes ?? 5
  const minMatchScore = params.minMatchScore ?? 0.3
  const supabase = getServiceClient()

  // Step 1: Fetch the target product
  const { data: targetProduct, error: productError } = await supabase
    .from('ss_products')
    .select('id, name_en, name_ko, brand_en, category, price_usd, price_krw, image_url, rating_avg, review_count, volume_display')
    .eq('id', params.productId)
    .single()

  if (productError || !targetProduct) {
    return { original: null, dupes: [], error: 'Product not found' }
  }

  // Step 2: Candidate products in the same category (excluding target)
  const { data: candidates } = await supabase
    .from('ss_products')
    .select('id, name_en, name_ko, brand_en, category, price_usd, price_krw, image_url, rating_avg, review_count, volume_display')
    .eq('category', targetProduct.category)
    .neq('id', params.productId)

  if (!candidates || candidates.length === 0) {
    return { original: targetProduct, dupes: [] }
  }

  // Step 3: Ingredient links for target + candidates
  const allProductIds = [params.productId, ...candidates.map(c => c.id)]
  const { data: allLinks } = await supabase
    .from('ss_product_ingredients')
    .select('product_id, ingredient_id, position')
    .in('product_id', allProductIds)

  // Step 4: Ingredient details
  const ingredientIds = [...new Set((allLinks ?? []).map(l => l.ingredient_id as string))]
  if (ingredientIds.length === 0) {
    return { original: targetProduct, dupes: [] }
  }

  const { data: ingredients } = await supabase
    .from('ss_ingredients')
    .select('id, name_en, name_inci, is_active, is_fragrance, function, safety_rating, comedogenic_rating')
    .in('id', ingredientIds)

  const ingredientMap = new Map<string, IngredientInfo>()
  for (const ing of ingredients ?? []) ingredientMap.set(ing.id, ing as IngredientInfo)

  // Step 5: product -> ingredient maps
  const productIngredients = new Map<string, Array<{ info: IngredientInfo; position: number }>>()
  for (const link of allLinks ?? []) {
    const ing = ingredientMap.get(link.ingredient_id as string)
    if (!ing) continue
    if (!productIngredients.has(link.product_id as string)) {
      productIngredients.set(link.product_id as string, [])
    }
    productIngredients.get(link.product_id as string)!.push({ info: ing, position: link.position as number })
  }

  // Step 6: target's key ingredients (actives + functional, not fillers)
  const targetIngs = productIngredients.get(params.productId) ?? []
  const targetKeyIngredientIds = new Set(
    targetIngs.filter(i => i.info.is_active || isKeyFunctional(i.info.function)).map(i => i.info.id)
  )
  const targetAllIngredientIds = new Set(targetIngs.map(i => i.info.id))
  if (targetKeyIngredientIds.size === 0) {
    for (const i of targetIngs) targetKeyIngredientIds.add(i.info.id)
  }

  // Step 7: match scores
  const dupeResults: DupeResult[] = []
  for (const candidate of candidates) {
    const candIngs = productIngredients.get(candidate.id) ?? []
    if (candIngs.length === 0) continue

    const candKeyIngredientIds = new Set(
      candIngs.filter(i => i.info.is_active || isKeyFunctional(i.info.function)).map(i => i.info.id)
    )
    const candAllIngredientIds = new Set(candIngs.map(i => i.info.id))
    if (candKeyIngredientIds.size === 0) {
      for (const i of candIngs) candKeyIngredientIds.add(i.info.id)
    }

    const sharedKeyIds = [...targetKeyIngredientIds].filter(id => candKeyIngredientIds.has(id))
    const unionSize = new Set([...targetKeyIngredientIds, ...candKeyIngredientIds]).size
    const matchScore = unionSize > 0 ? sharedKeyIds.length / unionSize : 0
    if (matchScore < minMatchScore) continue

    let positionBonus = 0
    for (const sharedId of sharedKeyIds) {
      const targetPos = targetIngs.find(i => i.info.id === sharedId)?.position ?? 99
      const candPos = candIngs.find(i => i.info.id === sharedId)?.position ?? 99
      if (Math.abs(targetPos - candPos) <= 3) positionBonus += 0.02
    }
    const finalScore = Math.min(1, matchScore + positionBonus)

    const sharedAllIds = [...targetAllIngredientIds].filter(id => candAllIngredientIds.has(id))
    const sharedNames = sharedAllIds
      .map(id => ingredientMap.get(id)?.name_en ?? ingredientMap.get(id)?.name_inci)
      .filter(Boolean) as string[]
    const uniqueToOriginal = [...targetAllIngredientIds]
      .filter(id => !candAllIngredientIds.has(id))
      .map(id => ingredientMap.get(id)?.name_en ?? ingredientMap.get(id)?.name_inci)
      .filter(Boolean) as string[]
    const uniqueToDupe = [...candAllIngredientIds]
      .filter(id => !targetAllIngredientIds.has(id))
      .map(id => ingredientMap.get(id)?.name_en ?? ingredientMap.get(id)?.name_inci)
      .filter(Boolean) as string[]

    const originalPrice = Number(targetProduct.price_usd) || 0
    const dupePrice = Number(candidate.price_usd) || 0
    const savingsPct = originalPrice > 0 && dupePrice > 0 && dupePrice < originalPrice
      ? Math.round(((originalPrice - dupePrice) / originalPrice) * 100)
      : 0

    dupeResults.push({
      product: candidate,
      match_score: Math.round(finalScore * 100) / 100,
      shared_ingredients: sharedNames,
      unique_to_original: uniqueToOriginal,
      unique_to_dupe: uniqueToDupe,
      price_savings_pct: savingsPct,
      effectiveness_insight: null,
    })
  }

  // Effectiveness weighting (authenticated users only)
  let skinType: string | null = null
  if (params.userId) {
    try {
      const { data: profile } = await supabase
        .from('ss_user_profiles')
        .select('skin_type')
        .eq('user_id', params.userId)
        .maybeSingle()
      skinType = (profile?.skin_type as string) ?? null
    } catch {
      // Non-critical
    }
  }

  if (skinType && dupeResults.length > 0) {
    try {
      const { data: effectiveness } = await supabase
        .from('ss_ingredient_effectiveness')
        .select('ingredient_id, concern, effectiveness_score, sample_size')
        .eq('skin_type', skinType)
        .gte('sample_size', 5)
        .gte('effectiveness_score', 0.50)
        .order('effectiveness_score', { ascending: false })
        .limit(30)

      if (effectiveness?.length) {
        const effectivenessMap = new Map(effectiveness.map(e => [e.ingredient_id as string, e]))
        const effectiveIngredientIds = new Set(effectiveness.map(e => e.ingredient_id as string))
        const dupeProductIds = dupeResults.map(d => d.product.id)

        const { data: dupeLinks } = await supabase
          .from('ss_product_ingredients')
          .select('product_id, ingredient_id')
          .in('product_id', dupeProductIds)
          .in('ingredient_id', Array.from(effectiveIngredientIds))
          .limit(5000)

        if (dupeLinks?.length) {
          const dupeEffScores = new Map<string, { totalScore: number; count: number; topIngredient: { id: string; concern: string; score: number } }>()
          for (const link of dupeLinks) {
            const eff = effectivenessMap.get(link.ingredient_id as string)
            if (!eff) continue
            const existing = dupeEffScores.get(link.product_id as string)
            const effScore = eff.effectiveness_score as number
            if (existing) {
              existing.totalScore += effScore
              existing.count++
              if (effScore > existing.topIngredient.score) {
                existing.topIngredient = { id: link.ingredient_id as string, concern: eff.concern as string, score: effScore }
              }
            } else {
              dupeEffScores.set(link.product_id as string, {
                totalScore: effScore,
                count: 1,
                topIngredient: { id: link.ingredient_id as string, concern: eff.concern as string, score: effScore },
              })
            }
          }

          const topIngredientIds = new Set<string>()
          for (const info of dupeEffScores.values()) topIngredientIds.add(info.topIngredient.id)
          const ingredientNameMap = new Map<string, string>()
          if (topIngredientIds.size > 0) {
            const { data: ingNames } = await supabase
              .from('ss_ingredients')
              .select('id, name_en')
              .in('id', Array.from(topIngredientIds))
            for (const ing of ingNames ?? []) ingredientNameMap.set(ing.id, ing.name_en)
          }

          for (const dupe of dupeResults) {
            const effInfo = dupeEffScores.get(dupe.product.id)
            if (effInfo && effInfo.count > 0) {
              const avgEffectiveness = effInfo.totalScore / effInfo.count
              dupe.match_score = Math.round(dupe.match_score * (0.5 + avgEffectiveness * 0.5) * 100) / 100
              const ingredientName = ingredientNameMap.get(effInfo.topIngredient.id) ?? 'Key ingredient'
              dupe.effectiveness_insight = {
                ingredientName,
                concern: effInfo.topIngredient.concern,
                score: Math.round(effInfo.topIngredient.score * 100),
              }
            }
          }
        }
      }
    } catch {
      // Non-critical — fall back to standard scoring
    }
  }

  dupeResults.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score
    return b.price_savings_pct - a.price_savings_pct
  })

  return { original: targetProduct, dupes: dupeResults.slice(0, maxDupes) }
}
