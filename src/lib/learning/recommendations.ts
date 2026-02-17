import { getServiceClient } from '@/lib/supabase'
import type {
  SkinProfile,
  PersonalizedRecommendation,
  LearningInsight,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Personalized recommendations powered by the learning engine
// Queries learning patterns matched to the user's skin profile
// ---------------------------------------------------------------------------

const MIN_SAMPLE_SIZE = 3

/**
 * Get personalized product recommendations based on skin profile + learning data.
 * This is the core value of the learning engine: recommending products that
 * work for people with similar skin profiles.
 */
export async function getPersonalizedRecommendations(
  userId: string
): Promise<PersonalizedRecommendation[]> {
  const db = getServiceClient()

  // Load user's skin profile
  const { data: profile } = await db
    .from('ss_user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!profile) return []

  const skinProfile = profile as unknown as SkinProfile
  const skinType = skinProfile.skin_type
  const concerns = skinProfile.skin_concerns || []

  // 1. Get products with high effectiveness for this skin type
  const { data: effectiveProducts } = await db
    .from('ss_product_effectiveness')
    .select(
      `
      product_id,
      effectiveness_score,
      sample_size,
      product:ss_products(id, name_en, brand_en, category, image_url, price_usd, rating_avg)
    `
    )
    .or(`skin_type.eq.${skinType},skin_type.eq.__all__`)
    .gte('sample_size', MIN_SAMPLE_SIZE)
    .gte('effectiveness_score', 0.6)
    .order('effectiveness_score', { ascending: false })
    .limit(30)

  if (!effectiveProducts || effectiveProducts.length === 0) {
    return getFallbackRecommendations(skinType, concerns)
  }

  // 2. Get user's existing products to avoid recommending what they have
  const { data: routineProducts } = await db
    .from('ss_routine_products')
    .select('product_id')
    .in(
      'routine_id',
      (
        await db
          .from('ss_user_routines')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true)
      ).data?.map((r: { id: string }) => r.id) || []
    )

  const ownedProductIds = new Set(
    (routineProducts || []).map((rp: { product_id: string }) => rp.product_id)
  )

  // 3. Get ingredient effectiveness for user's concerns
  const ingredientBoosts = new Map<string, number>()
  if (concerns.length > 0) {
    const { data: effectiveIngredients } = await db
      .from('ss_ingredient_effectiveness')
      .select('ingredient_id, effectiveness_score, sample_size')
      .or(`skin_type.eq.${skinType},skin_type.eq.__all__`)
      .in('concern', [...concerns, '__all__'])
      .gte('sample_size', MIN_SAMPLE_SIZE)
      .gte('effectiveness_score', 0.7)

    for (const ei of effectiveIngredients || []) {
      ingredientBoosts.set(
        ei.ingredient_id,
        ei.effectiveness_score as number
      )
    }
  }

  // 4. Score and rank products
  const recommendations: PersonalizedRecommendation[] = []

  for (const ep of effectiveProducts) {
    const product = ep.product as unknown as Record<string, unknown>
    if (!product) continue
    if (ownedProductIds.has(product.id as string)) continue

    // Base score from product effectiveness
    let matchScore = (ep.effectiveness_score as number) * 100

    // Boost products that contain effective ingredients for user's concerns
    if (ingredientBoosts.size > 0) {
      const { data: productIngredients } = await db
        .from('ss_product_ingredients')
        .select('ingredient_id')
        .eq('product_id', product.id as string)
        .lte('position', 10)

      let ingredientBoost = 0
      for (const pi of productIngredients || []) {
        const boost = ingredientBoosts.get(pi.ingredient_id)
        if (boost) ingredientBoost += boost * 10
      }
      matchScore += Math.min(ingredientBoost, 20)
    }

    const reasons: string[] = []
    if (ep.effectiveness_score >= 0.8) {
      reasons.push(
        `Highly effective for ${skinType} skin (${Math.round((ep.effectiveness_score as number) * 100)}% positive)`
      )
    }
    if (ep.sample_size >= 10) {
      reasons.push(`Based on ${ep.sample_size} user reports`)
    }

    recommendations.push({
      product_id: product.id as string,
      product_name: product.name_en as string,
      brand: product.brand_en as string,
      category: product.category as string,
      match_score: Math.min(Math.round(matchScore), 99),
      reasons,
      effectiveness_data: {
        score: ep.effectiveness_score as number,
        sample_size: ep.sample_size as number,
      },
    })
  }

  // Sort by match score, return top 10
  recommendations.sort((a, b) => b.match_score - a.match_score)
  return recommendations.slice(0, 10)
}

/**
 * Get learning insights personalized for a user.
 * Used by the dashboard "Yuri's Insights" widget.
 */
export async function getLearningInsights(
  userId: string
): Promise<LearningInsight[]> {
  const db = getServiceClient()
  const insights: LearningInsight[] = []

  // Load user profile
  const { data: profile } = await db
    .from('ss_user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!profile) {
    return [
      {
        title: 'Complete your skin profile',
        description:
          'Get personalized insights by completing your skin profile through a conversation with Yuri.',
        confidence: 1,
        sample_size: 0,
        type: 'routine',
      },
    ]
  }

  const skinProfile = profile as unknown as SkinProfile

  // 1. Top effective ingredients for their skin type
  const { data: topIngredients } = await db
    .from('ss_ingredient_effectiveness')
    .select(
      `
      effectiveness_score,
      sample_size,
      concern,
      ingredient:ss_ingredients(name_en, function)
    `
    )
    .or(
      `skin_type.eq.${skinProfile.skin_type},skin_type.eq.__all__`
    )
    .gte('sample_size', MIN_SAMPLE_SIZE)
    .order('effectiveness_score', { ascending: false })
    .limit(5)

  for (const ti of topIngredients || []) {
    const ingredient = ti.ingredient as unknown as Record<string, string>
    if (!ingredient) continue

    const pct = Math.round((ti.effectiveness_score as number) * 100)
    insights.push({
      title: `${ingredient.name_en} works for you`,
      description: `Based on ${ti.sample_size} users with ${skinProfile.skin_type} skin, ${ingredient.name_en} (${ingredient.function}) has a ${pct}% effectiveness rate${ti.concern && ti.concern !== '__all__' ? ` for ${ti.concern}` : ''}.`,
      confidence: ti.effectiveness_score as number,
      sample_size: ti.sample_size as number,
      type: 'ingredient',
    })
  }

  // 2. Trending items relevant to their concerns
  const { data: trendSignals } = await db
    .from('ss_trend_signals')
    .select('*')
    .in('status', ['emerging', 'trending'])
    .order('signal_strength', { ascending: false })
    .limit(3)

  for (const trend of trendSignals || []) {
    insights.push({
      title: `Trending: ${trend.trend_name || trend.keyword}`,
      description: `${trend.trend_name || trend.keyword} is ${trend.status} in the K-beauty space (signal strength: ${trend.signal_strength}).`,
      confidence: Math.min((trend.signal_strength as number) / 100, 1),
      sample_size: trend.signal_strength as number,
      type: 'trend',
    })
  }

  // 3. Learning patterns matching their profile
  const { data: patterns } = await db
    .from('ss_learning_patterns')
    .select('*')
    .or(
      `skin_type.eq.${skinProfile.skin_type},skin_type.is.null`
    )
    .gte('confidence_score', 0.6)
    .gte('sample_size', MIN_SAMPLE_SIZE)
    .order('confidence_score', { ascending: false })
    .limit(3)

  for (const pattern of patterns || []) {
    if (pattern.pattern_description) {
      insights.push({
        title: 'Community insight',
        description: pattern.pattern_description as string,
        confidence: pattern.confidence_score as number,
        sample_size: pattern.sample_size as number,
        type: 'routine',
      })
    }
  }

  return insights.slice(0, 6)
}

/**
 * Fallback recommendations when we don't have enough learning data.
 * Uses product ratings and community data instead.
 */
async function getFallbackRecommendations(
  skinType: string,
  concerns: string[]
): Promise<PersonalizedRecommendation[]> {
  const db = getServiceClient()

  // Get top-rated products
  const { data: products } = await db
    .from('ss_products')
    .select('id, name_en, brand_en, category, rating_avg, review_count')
    .gte('rating_avg', 4.0)
    .gte('review_count', 1)
    .order('rating_avg', { ascending: false })
    .limit(10)

  return (products || []).map((p) => ({
    product_id: p.id,
    product_name: p.name_en,
    brand: p.brand_en,
    category: p.category,
    match_score: Math.round(((p.rating_avg || 4) / 5) * 80),
    reasons: [
      `Top-rated product (${p.rating_avg}/5 from ${p.review_count} reviews)`,
      concerns.length > 0
        ? `Try this for your ${skinType} skin`
        : 'Popular in the K-beauty community',
    ],
    effectiveness_data: null,
  }))
}
