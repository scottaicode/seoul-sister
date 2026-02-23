import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'

/**
 * GET /api/community/insights?product_ids=id1,id2,...
 *
 * Returns two datasets:
 * 1. topIngredients — top 3 effective ingredients for user's skin type
 * 2. productEffectiveness — map of product_id -> { ingredientName, score }
 *    for products whose ingredients are highly effective (>=70%) for user's skin
 *
 * Soft auth: returns empty data for unauthenticated users.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Soft auth
    let userId: string | null = null
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token)
        userId = user?.id ?? null
      } catch {
        // Non-critical
      }
    }

    if (!userId) {
      return NextResponse.json({
        topIngredients: [],
        productEffectiveness: {},
      })
    }

    // Load profile
    const { data: profile } = await supabase
      .from('ss_user_profiles')
      .select('skin_type')
      .eq('user_id', userId)
      .maybeSingle()

    const skinType = profile?.skin_type ?? null

    if (!skinType) {
      return NextResponse.json({
        topIngredients: [],
        productEffectiveness: {},
      })
    }

    // Parse product_ids from query params
    const productIdsParam = request.nextUrl.searchParams.get('product_ids')
    const productIds = productIdsParam
      ? productIdsParam.split(',').filter(Boolean)
      : []

    // Fetch top ingredients and product effectiveness in parallel
    const [effResult, productEffMap] = await Promise.all([
      // 1. Top 3 effective ingredients for skin type
      supabase
        .from('ss_ingredient_effectiveness')
        .select('ingredient_id, concern, effectiveness_score, sample_size')
        .eq('skin_type', skinType)
        .gte('sample_size', 5)
        .gte('effectiveness_score', 0.7)
        .order('effectiveness_score', { ascending: false })
        .limit(3),

      // 2. Product effectiveness map
      buildProductEffectivenessMap(supabase, productIds, skinType),
    ])

    // Resolve ingredient names for top effectiveness rows
    const effRows = effResult.data ?? []
    let topIngredients: Array<{
      ingredientName: string
      concern: string
      effectivenessScore: number
      sampleSize: number
    }> = []

    if (effRows.length > 0) {
      const ingredientIds = effRows.map(
        (r: { ingredient_id: string }) => r.ingredient_id,
      )
      const { data: ingredients } = await supabase
        .from('ss_ingredients')
        .select('id, name_en, name_inci')
        .in('id', ingredientIds)

      const nameMap = new Map(
        (ingredients ?? []).map((i: { id: string; name_en: string | null; name_inci: string }) => [
          i.id,
          i.name_en || i.name_inci,
        ]),
      )

      topIngredients = effRows.map(
        (r: {
          ingredient_id: string
          concern: string
          effectiveness_score: number
          sample_size: number
        }) => ({
          ingredientName: nameMap.get(r.ingredient_id) || 'Unknown',
          concern: r.concern,
          effectivenessScore: Math.round(r.effectiveness_score * 100),
          sampleSize: r.sample_size,
        }),
      )
    }

    return NextResponse.json({
      topIngredients,
      productEffectiveness: productEffMap,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * For each product_id, find the single most effective ingredient (>=70%)
 * for the given skin type. Returns a map of product_id -> best match.
 */
async function buildProductEffectivenessMap(
  supabase: SupabaseClient,
  productIds: string[],
  skinType: string,
): Promise<Record<string, { ingredientName: string; score: number }>> {
  if (productIds.length === 0) return {}

  // Get all high-effectiveness ingredients for this skin type
  const { data: effRows } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, effectiveness_score')
    .eq('skin_type', skinType)
    .gte('sample_size', 5)
    .gte('effectiveness_score', 0.7)

  if (!effRows?.length) return {}

  const effectiveIngredientIds = effRows.map(
    (r: { ingredient_id: string }) => r.ingredient_id,
  )
  const effScoreMap = new Map(
    effRows.map((r: { ingredient_id: string; effectiveness_score: number }) => [
      r.ingredient_id,
      r.effectiveness_score,
    ]),
  )

  // Find which of these products contain effective ingredients
  const { data: links } = await supabase
    .from('ss_product_ingredients')
    .select('product_id, ingredient_id')
    .in('product_id', productIds)
    .in('ingredient_id', effectiveIngredientIds)

  if (!links?.length) return {}

  // Get ingredient names
  const linkedIngIds = [...new Set(links.map(
    (l: { ingredient_id: string }) => l.ingredient_id,
  ))]
  const { data: ingredients } = await supabase
    .from('ss_ingredients')
    .select('id, name_en, name_inci')
    .in('id', linkedIngIds)

  const nameMap = new Map(
    (ingredients ?? []).map((i: { id: string; name_en: string | null; name_inci: string }) => [
      i.id,
      i.name_en || i.name_inci,
    ]),
  )

  // For each product, pick the ingredient with the highest effectiveness
  const result: Record<string, { ingredientName: string; score: number }> = {}
  for (const link of links as Array<{ product_id: string; ingredient_id: string }>) {
    const score = effScoreMap.get(link.ingredient_id) ?? 0
    const existing = result[link.product_id]
    if (!existing || score > existing.score) {
      result[link.product_id] = {
        ingredientName: nameMap.get(link.ingredient_id) || 'Unknown',
        score: Math.round(score * 100),
      }
    }
  }

  return result
}
