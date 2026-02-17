import { getServiceClient } from '@/lib/supabase'
import type { IngredientEffectiveness } from '@/types/database'

// ---------------------------------------------------------------------------
// Ingredient and product effectiveness tracking
// Maintains rolling aggregates from reviews and routine outcomes
// ---------------------------------------------------------------------------

type ReactionType = 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'

/**
 * Update ingredient effectiveness from a product reaction.
 * Looks up the product's ingredients and updates each one's score
 * for the given skin type and concern.
 */
export async function updateIngredientEffectiveness(
  productId: string,
  skinType: string | null,
  concern: string | null,
  reaction: ReactionType
): Promise<void> {
  const db = getServiceClient()

  // Get ingredients for this product
  const { data: ingredients } = await db
    .from('ss_product_ingredients')
    .select('ingredient_id, position')
    .eq('product_id', productId)
    .order('position', { ascending: true })

  if (!ingredients || ingredients.length === 0) return

  // Top-positioned ingredients get more weight
  const ratingCategory = getReactionCategory(reaction)

  for (const ing of ingredients) {
    // Weight by position: top ingredients get full weight, lower ones less
    if (ing.position > 10) continue // Skip ingredients past position 10

    const skinFilter = skinType || '__all__'
    const concernFilter = concern || '__all__'

    // Upsert effectiveness record
    const { data: existing } = await db
      .from('ss_ingredient_effectiveness')
      .select('*')
      .eq('ingredient_id', ing.ingredient_id)
      .eq('skin_type', skinFilter)
      .eq('concern', concernFilter)
      .single()

    if (existing) {
      // Update existing record
      const updates: Record<string, unknown> = {
        sample_size: existing.sample_size + 1,
        [`${ratingCategory}_reports`]:
          (existing as Record<string, number>)[`${ratingCategory}_reports`] + 1,
      }

      // Recalculate effectiveness score
      const pos =
        (existing.positive_reports as number) +
        (ratingCategory === 'positive' ? 1 : 0)
      const neg =
        (existing.negative_reports as number) +
        (ratingCategory === 'negative' ? 1 : 0)
      const neu =
        (existing.neutral_reports as number) +
        (ratingCategory === 'neutral' ? 1 : 0)
      const total = pos + neg + neu

      // Weighted score: positive=1.0, neutral=0.5, negative=0.0
      updates.effectiveness_score =
        total > 0
          ? Number(((pos * 1.0 + neu * 0.5) / total).toFixed(3))
          : 0.5

      await db
        .from('ss_ingredient_effectiveness')
        .update(updates)
        .eq('id', existing.id)
    } else {
      // Insert new record
      const pos = ratingCategory === 'positive' ? 1 : 0
      const neg = ratingCategory === 'negative' ? 1 : 0
      const neu = ratingCategory === 'neutral' ? 1 : 0
      const total = pos + neg + neu
      const score = total > 0 ? (pos * 1.0 + neu * 0.5) / total : 0.5

      await db.from('ss_ingredient_effectiveness').insert({
        ingredient_id: ing.ingredient_id,
        skin_type: skinFilter,
        concern: concernFilter,
        effectiveness_score: Number(score.toFixed(3)),
        sample_size: 1,
        positive_reports: pos,
        negative_reports: neg,
        neutral_reports: neu,
      })
    }
  }
}

/**
 * Update product effectiveness from a review or reaction.
 */
export async function updateProductEffectiveness(
  productId: string,
  skinType: string | null,
  rating: number
): Promise<void> {
  const db = getServiceClient()
  const skinFilter = skinType || '__all__'

  const { data: existing } = await db
    .from('ss_product_effectiveness')
    .select('*')
    .eq('product_id', productId)
    .eq('skin_type', skinFilter)
    .single()

  // Normalize rating to 0-1 scale
  const normalizedRating = (rating - 1) / 4

  if (existing) {
    const newSampleSize = existing.sample_size + 1
    // Running average
    const currentScore = existing.effectiveness_score as number
    const newScore =
      (currentScore * existing.sample_size + normalizedRating) / newSampleSize

    await db
      .from('ss_product_effectiveness')
      .update({
        effectiveness_score: Number(newScore.toFixed(3)),
        sample_size: newSampleSize,
      })
      .eq('id', existing.id)
  } else {
    await db.from('ss_product_effectiveness').insert({
      product_id: productId,
      skin_type: skinFilter,
      effectiveness_score: Number(normalizedRating.toFixed(3)),
      sample_size: 1,
    })
  }
}

/**
 * Get ingredient effectiveness for a specific skin type and concern.
 */
export async function getIngredientEffectiveness(
  skinType: string,
  concern: string,
  minSampleSize = 5
): Promise<IngredientEffectiveness[]> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('ss_ingredient_effectiveness')
    .select(
      `
      *,
      ingredient:ss_ingredients(id, name_inci, name_en, function, safety_rating)
    `
    )
    .or(`skin_type.eq.${skinType},skin_type.eq.__all__`)
    .or(`concern.eq.${concern},concern.eq.__all__`)
    .gte('sample_size', minSampleSize)
    .order('effectiveness_score', { ascending: false })
    .limit(20)

  if (error) throw new Error(`Failed to get effectiveness: ${error.message}`)
  return (data || []) as unknown as IngredientEffectiveness[]
}

/**
 * Recalculate all ingredient effectiveness scores from reviews.
 * Called by the update-effectiveness cron job.
 */
export async function recalculateEffectivenessFromReviews(): Promise<{
  ingredients_updated: number
  products_updated: number
}> {
  const db = getServiceClient()
  let ingredientsUpdated = 0
  let productsUpdated = 0

  // Get all reviews with reactions, grouped by product
  const { data: reviews } = await db
    .from('ss_reviews')
    .select('product_id, rating, skin_type, skin_concerns, reaction')
    .not('reaction', 'is', null)
    .limit(1000)

  if (!reviews || reviews.length === 0) {
    return { ingredients_updated: 0, products_updated: 0 }
  }

  // Group reviews by product
  const byProduct = new Map<string, typeof reviews>()
  for (const review of reviews) {
    const existing = byProduct.get(review.product_id) || []
    existing.push(review)
    byProduct.set(review.product_id, existing)
  }

  // Update product effectiveness
  for (const [productId, productReviews] of byProduct) {
    // Group by skin type
    const bySkinType = new Map<string, typeof reviews>()
    for (const r of productReviews) {
      const key = r.skin_type || '__all__'
      const existing = bySkinType.get(key) || []
      existing.push(r)
      bySkinType.set(key, existing)
    }

    for (const [skinType, skinReviews] of bySkinType) {
      const avgRating =
        skinReviews.reduce((sum, r) => sum + r.rating, 0) / skinReviews.length
      const normalizedScore = (avgRating - 1) / 4

      await db
        .from('ss_product_effectiveness')
        .upsert(
          {
            product_id: productId,
            skin_type: skinType,
            effectiveness_score: Number(normalizedScore.toFixed(3)),
            sample_size: skinReviews.length,
          },
          { onConflict: 'product_id,skin_type' }
        )

      productsUpdated++
    }

    // Update ingredient effectiveness for this product
    const { data: ingredients } = await db
      .from('ss_product_ingredients')
      .select('ingredient_id')
      .eq('product_id', productId)
      .lte('position', 10)

    if (ingredients) {
      for (const ing of ingredients) {
        for (const r of productReviews) {
          if (!r.reaction) continue
          const category = getReactionCategory(r.reaction as ReactionType)
          const skinFilter = r.skin_type || '__all__'
          const concerns = (r.skin_concerns as string[]) || []
          const concernFilter = concerns[0] || '__all__'

          // Upsert
          const { data: existing } = await db
            .from('ss_ingredient_effectiveness')
            .select('id, positive_reports, negative_reports, neutral_reports, sample_size')
            .eq('ingredient_id', ing.ingredient_id)
            .eq('skin_type', skinFilter)
            .eq('concern', concernFilter)
            .single()

          if (existing) {
            const pos =
              existing.positive_reports + (category === 'positive' ? 1 : 0)
            const neg =
              existing.negative_reports + (category === 'negative' ? 1 : 0)
            const neu =
              existing.neutral_reports + (category === 'neutral' ? 1 : 0)
            const total = pos + neg + neu

            await db
              .from('ss_ingredient_effectiveness')
              .update({
                positive_reports: pos,
                negative_reports: neg,
                neutral_reports: neu,
                sample_size: total,
                effectiveness_score:
                  total > 0
                    ? Number(((pos * 1.0 + neu * 0.5) / total).toFixed(3))
                    : 0.5,
              })
              .eq('id', existing.id)
          } else {
            const pos = category === 'positive' ? 1 : 0
            const neg = category === 'negative' ? 1 : 0
            const neu = category === 'neutral' ? 1 : 0
            const total = pos + neg + neu

            await db.from('ss_ingredient_effectiveness').insert({
              ingredient_id: ing.ingredient_id,
              skin_type: skinFilter,
              concern: concernFilter,
              effectiveness_score:
                total > 0
                  ? Number(((pos * 1.0 + neu * 0.5) / total).toFixed(3))
                  : 0.5,
              sample_size: total,
              positive_reports: pos,
              negative_reports: neg,
              neutral_reports: neu,
            })
          }

          ingredientsUpdated++
        }
      }
    }
  }

  return { ingredients_updated: ingredientsUpdated, products_updated: productsUpdated }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReactionCategory(
  reaction: ReactionType
): 'positive' | 'negative' | 'neutral' {
  switch (reaction) {
    case 'holy_grail':
    case 'good':
      return 'positive'
    case 'bad':
    case 'broke_me_out':
      return 'negative'
    case 'okay':
    default:
      return 'neutral'
  }
}
