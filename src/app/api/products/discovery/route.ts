import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

/**
 * GET /api/products/discovery
 *
 * Returns two datasets in one call:
 * 1. trendingMap — product_id → trending info for badge overlays
 * 2. lovedProducts — top 8 products loved by user's skin type (via ingredient effectiveness)
 *
 * Soft auth: returns trending data for everyone, lovedProducts only if authenticated.
 */
export async function GET(request: NextRequest) {
  try {
    // Anon client ONLY for auth.getUser token verification. All table reads
    // use the service client to bypass RLS on ss_user_profiles and
    // ss_ingredient_effectiveness. Without this, authenticated users silently
    // get null profile data and the "Loved by your skin type" section returns
    // empty. 6th instance of this recurring pattern (see commits cc7491a,
    // 2f4bec2, 6853f7c, 977348d for prior fixes).
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const supabase = getServiceClient()

    // Soft auth
    let userId: string | null = null
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      try {
        const { data: { user } } = await authClient.auth.getUser(token)
        userId = user?.id ?? null
      } catch {
        // Non-critical
      }
    }

    // Fetch trending products and user profile in parallel
    const [trendingResult, profileResult] = await Promise.all([
      supabase
        .from('ss_trending_products')
        .select('product_id, source, trend_score, gap_score')
        .not('product_id', 'is', null)
        .order('trend_score', { ascending: false })
        .limit(100),
      userId
        ? supabase
            .from('ss_user_profiles')
            .select('skin_type, skin_concerns')
            .eq('user_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    // Build trending map: product_id → { source, trend_score, gap_score }
    type TrendingInfo = { source: string; trend_score: number; gap_score: number }
    const trendingMap: Record<string, TrendingInfo> = {}
    for (const row of trendingResult.data ?? []) {
      if (row.product_id && !trendingMap[row.product_id]) {
        trendingMap[row.product_id] = {
          source: row.source ?? '',
          trend_score: row.trend_score ?? 0,
          gap_score: row.gap_score ?? 0,
        }
      }
    }

    // Build "loved by skin type" products
    interface LovedProduct {
      id: string
      name_en: string
      brand_en: string
      category: string
      rating_avg: number | null
      price_usd: number | null
      image_url: string | null
      volume_display: string | null
      effectiveness_score: number
      concern: string
    }
    let lovedProducts: LovedProduct[] = []

    const skinType = profileResult.data?.skin_type
    if (skinType) {
      // Get top effective ingredients for this skin type
      const { data: effectiveness } = await supabase
        .from('ss_ingredient_effectiveness')
        .select('ingredient_id, concern, effectiveness_score')
        .eq('skin_type', skinType)
        .gte('effectiveness_score', 0.70)
        .gte('sample_size', 5)
        .order('effectiveness_score', { ascending: false })
        .limit(15)

      const effectiveIngredientIds = effectiveness?.map(e => e.ingredient_id) ?? []

      if (effectiveIngredientIds.length > 0) {
        // Find products containing these effective ingredients
        const { data: links } = await supabase
          .from('ss_product_ingredients')
          .select('product_id, ingredient_id')
          .in('ingredient_id', effectiveIngredientIds)
          .limit(2000)

        if (links?.length) {
          // Score products by total effective ingredient match
          const effectivenessMap = new Map(
            (effectiveness ?? []).map(e => [e.ingredient_id, e])
          )

          const productScores = new Map<string, { score: number; topConcern: string }>()
          for (const link of links) {
            const eff = effectivenessMap.get(link.ingredient_id)
            if (!eff) continue
            const existing = productScores.get(link.product_id)
            if (existing) {
              existing.score += eff.effectiveness_score
              if (eff.effectiveness_score > (effectivenessMap.get(link.ingredient_id)?.effectiveness_score ?? 0)) {
                existing.topConcern = eff.concern
              }
            } else {
              productScores.set(link.product_id, {
                score: eff.effectiveness_score,
                topConcern: eff.concern,
              })
            }
          }

          // Sort by score, take top 8
          const topProductIds = [...productScores.entries()]
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 8)
            .map(([id]) => id)

          if (topProductIds.length > 0) {
            const { data: products } = await supabase
              .from('ss_products')
              .select('id, name_en, brand_en, category, rating_avg, price_usd, image_url, volume_display')
              .in('id', topProductIds)

            if (products) {
              // Re-sort to match score order and attach effectiveness info
              const productMap = new Map(products.map(p => [p.id, p]))
              lovedProducts = topProductIds
                .map(id => {
                  const p = productMap.get(id)
                  const info = productScores.get(id)
                  if (!p || !info) return null
                  return {
                    ...p,
                    effectiveness_score: Math.round(info.score * 100) / 100,
                    concern: info.topConcern,
                  }
                })
                .filter((p): p is LovedProduct => p !== null)
            }
          }
        }
      }
    }

    return NextResponse.json({
      trendingMap,
      lovedProducts,
      skinType: skinType ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
