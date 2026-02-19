import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dupeFinderSchema } from '@/lib/utils/validation'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

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

interface IngredientLink {
  product_id: string
  ingredient_id: string
  position: number
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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = dupeFinderSchema.parse({
      product_id: searchParams.get('product_id') || undefined,
      max_dupes: searchParams.get('max_dupes') ? Number(searchParams.get('max_dupes')) : undefined,
      min_match_score: searchParams.get('min_match_score') ? Number(searchParams.get('min_match_score')) : undefined,
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Step 1: Fetch the target product
    const { data: targetProduct, error: productError } = await supabase
      .from('ss_products')
      .select('id, name_en, name_ko, brand_en, category, price_usd, price_krw, image_url, rating_avg, review_count, volume_display')
      .eq('id', params.product_id)
      .single()

    if (productError || !targetProduct) {
      throw new AppError('Product not found', 404)
    }

    // Step 2: Fetch all candidate products in the same category (excluding target)
    const { data: candidates, error: candError } = await supabase
      .from('ss_products')
      .select('id, name_en, name_ko, brand_en, category, price_usd, price_krw, image_url, rating_avg, review_count, volume_display')
      .eq('category', targetProduct.category)
      .neq('id', params.product_id)

    if (candError) throw candError
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ original: targetProduct, dupes: [] })
    }

    // Step 3: Fetch all ingredient links for target + candidates
    const allProductIds = [params.product_id, ...candidates.map(c => c.id)]
    const { data: allLinks, error: linksError } = await supabase
      .from('ss_product_ingredients')
      .select('product_id, ingredient_id, position')
      .in('product_id', allProductIds)

    if (linksError) throw linksError

    // Step 4: Fetch ingredient details
    const ingredientIds = [...new Set((allLinks ?? []).map((l: IngredientLink) => l.ingredient_id))]
    if (ingredientIds.length === 0) {
      return NextResponse.json({ original: targetProduct, dupes: [] })
    }

    const { data: ingredients, error: ingError } = await supabase
      .from('ss_ingredients')
      .select('id, name_en, name_inci, is_active, is_fragrance, function, safety_rating, comedogenic_rating')
      .in('id', ingredientIds)

    if (ingError) throw ingError

    const ingredientMap = new Map<string, IngredientInfo>()
    for (const ing of ingredients ?? []) {
      ingredientMap.set(ing.id, ing)
    }

    // Step 5: Build product -> ingredient maps
    const productIngredients = new Map<string, Array<{ info: IngredientInfo; position: number }>>()
    for (const link of allLinks ?? []) {
      const ing = ingredientMap.get(link.ingredient_id)
      if (!ing) continue
      if (!productIngredients.has(link.product_id)) {
        productIngredients.set(link.product_id, [])
      }
      productIngredients.get(link.product_id)!.push({ info: ing, position: link.position })
    }

    // Step 6: Get target's key ingredients (actives + functional, not just fillers)
    const targetIngs = productIngredients.get(params.product_id) ?? []
    const targetKeyIngredientIds = new Set(
      targetIngs
        .filter(i => i.info.is_active || isKeyFunctional(i.info.function))
        .map(i => i.info.id)
    )
    const targetAllIngredientIds = new Set(targetIngs.map(i => i.info.id))

    if (targetKeyIngredientIds.size === 0) {
      // Fall back to all ingredients if no actives found
      for (const i of targetIngs) {
        targetKeyIngredientIds.add(i.info.id)
      }
    }

    // Step 7: Calculate match scores for each candidate
    const dupeResults: DupeResult[] = []

    for (const candidate of candidates) {
      const candIngs = productIngredients.get(candidate.id) ?? []
      if (candIngs.length === 0) continue

      const candKeyIngredientIds = new Set(
        candIngs
          .filter(i => i.info.is_active || isKeyFunctional(i.info.function))
          .map(i => i.info.id)
      )
      const candAllIngredientIds = new Set(candIngs.map(i => i.info.id))

      // Fall back to all ingredients
      if (candKeyIngredientIds.size === 0) {
        for (const i of candIngs) {
          candKeyIngredientIds.add(i.info.id)
        }
      }

      // Calculate overlap on key actives
      const sharedKeyIds = [...targetKeyIngredientIds].filter(id => candKeyIngredientIds.has(id))
      const unionSize = new Set([...targetKeyIngredientIds, ...candKeyIngredientIds]).size
      const matchScore = unionSize > 0 ? sharedKeyIds.length / unionSize : 0

      if (matchScore < params.min_match_score) continue

      // Position bonus: shared actives in similar positions score higher
      let positionBonus = 0
      for (const sharedId of sharedKeyIds) {
        const targetPos = targetIngs.find(i => i.info.id === sharedId)?.position ?? 99
        const candPos = candIngs.find(i => i.info.id === sharedId)?.position ?? 99
        if (Math.abs(targetPos - candPos) <= 3) {
          positionBonus += 0.02 // Small bonus for similar positioning
        }
      }

      const finalScore = Math.min(1, matchScore + positionBonus)

      // Shared ingredient names (all ingredients, not just key)
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

      // Price savings
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
      })
    }

    // Sort by match score descending, then by savings
    dupeResults.sort((a, b) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score
      return b.price_savings_pct - a.price_savings_pct
    })

    return NextResponse.json({
      original: targetProduct,
      dupes: dupeResults.slice(0, params.max_dupes),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Check if an ingredient function is "key functional" (not just filler) */
function isKeyFunctional(fn: string): boolean {
  const lower = fn.toLowerCase()
  const keyFunctions = [
    'humectant', 'emollient', 'antioxidant', 'exfoliant', 'brightening',
    'anti-aging', 'soothing', 'barrier repair', 'moisturizing', 'hydrating',
    'uv filter', 'sunscreen', 'retinoid', 'vitamin', 'acid', 'peptide',
    'niacinamide', 'ceramide', 'hyaluronic',
  ]
  return keyFunctions.some(kf => lower.includes(kf))
}
