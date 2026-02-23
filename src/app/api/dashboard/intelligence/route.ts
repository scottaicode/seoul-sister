import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'
import { fetchSeasonalLearning } from '@/lib/intelligence/weather-routine'

/**
 * GET /api/dashboard/intelligence
 *
 * Returns three datasets in one call:
 * 1. topIngredients — top 5 effective ingredients for user's skin type
 * 2. seasonalInsight — current season's advice for user's climate
 * 3. trendingRelevance — trending product IDs flagged as "good for your skin"
 *
 * Soft auth: returns null/empty for unauthenticated users.
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
        seasonalInsight: null,
        relevantTrendingIds: [],
      })
    }

    // Load profile
    const { data: profile } = await supabase
      .from('ss_user_profiles')
      .select('skin_type, skin_concerns, climate')
      .eq('user_id', userId)
      .single()

    const skinType = profile?.skin_type ?? null
    const climate = profile?.climate ?? null

    // Fetch all three datasets in parallel
    const [effectivenessResult, seasonalInsight, trendingResult] = await Promise.all([
      // 1. Top ingredients for skin type
      skinType
        ? supabase
            .from('ss_ingredient_effectiveness')
            .select('ingredient_id, concern, effectiveness_score, sample_size')
            .eq('skin_type', skinType)
            .gte('sample_size', 5)
            .order('effectiveness_score', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: null }),

      // 2. Seasonal insight for climate
      fetchSeasonalLearning(supabase, climate),

      // 3. Trending products (for relevance cross-reference)
      supabase
        .from('ss_trending_products')
        .select('product_id')
        .not('product_id', 'is', null)
        .order('trend_score', { ascending: false })
        .limit(20),
    ])

    // Resolve ingredient names for top effectiveness rows
    interface TopIngredient {
      ingredientName: string
      concern: string
      effectivenessScore: number
      sampleSize: number
    }
    let topIngredients: TopIngredient[] = []

    const effRows = effectivenessResult.data ?? []
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

    // Cross-reference trending products with ingredient effectiveness
    // to find which trending products are "good for your skin"
    let relevantTrendingIds: string[] = []

    const trendingProductIds = (trendingResult.data ?? [])
      .map((r: { product_id: string | null }) => r.product_id)
      .filter((id: string | null): id is string => id !== null)

    if (skinType && trendingProductIds.length > 0 && effRows.length > 0) {
      const effectiveIngredientIds = effRows.map(
        (r: { ingredient_id: string }) => r.ingredient_id,
      )

      // Find which trending products contain effective ingredients
      const { data: links } = await supabase
        .from('ss_product_ingredients')
        .select('product_id, ingredient_id')
        .in('product_id', trendingProductIds)
        .in('ingredient_id', effectiveIngredientIds)

      if (links?.length) {
        const matchedIds = new Set(
          links.map((l: { product_id: string }) => l.product_id),
        )
        relevantTrendingIds = [...matchedIds]
      }
    }

    return NextResponse.json({
      topIngredients,
      seasonalInsight,
      relevantTrendingIds,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
