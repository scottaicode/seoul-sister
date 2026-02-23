import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'

/**
 * GET /api/sunscreen/picks?skin_type=oily
 *
 * Returns Yuri's top 3 sunscreen picks matched to the user's skin type.
 * Cross-references ss_ingredient_effectiveness for sunscreen-relevant
 * ingredients effective for the given skin type.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const skinType = searchParams.get('skin_type')

    if (!skinType) {
      return NextResponse.json({ picks: [], reasoning: [] })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 1. Find sunscreen-relevant ingredients that are effective for this skin type
    const { data: effectiveness } = await supabase
      .from('ss_ingredient_effectiveness')
      .select('ingredient_id, concern, effectiveness_score, sample_size')
      .eq('skin_type', skinType)
      .gte('effectiveness_score', 0.65)
      .gte('sample_size', 5)
      .order('effectiveness_score', { ascending: false })
      .limit(20)

    const effectiveIngredientIds = effectiveness?.map(e => e.ingredient_id) ?? []

    // 2. Fetch top-rated sunscreens
    const { data: sunscreens } = await supabase
      .from('ss_products')
      .select('*')
      .eq('category', 'sunscreen')
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(50)

    if (!sunscreens?.length) {
      return NextResponse.json({ picks: [], reasoning: [] })
    }

    // 3. If we have effectiveness data, score sunscreens by ingredient match
    if (effectiveIngredientIds.length > 0) {
      // Fetch ingredient links for these sunscreens
      const sunscreenIds = sunscreens.map(s => s.id)
      const { data: ingredientLinks } = await supabase
        .from('ss_product_ingredients')
        .select('product_id, ingredient_id')
        .in('product_id', sunscreenIds)
        .in('ingredient_id', effectiveIngredientIds)

      // Score each sunscreen by how many effective ingredients it contains
      const effectivenessMap = new Map(
        (effectiveness ?? []).map(e => [e.ingredient_id, e])
      )

      const scored = sunscreens.map(product => {
        const matchedLinks = (ingredientLinks ?? []).filter(
          l => l.product_id === product.id
        )
        let matchScore = 0
        const matchedIngredients: Array<{
          ingredientId: string
          concern: string
          score: number
        }> = []

        for (const link of matchedLinks) {
          const eff = effectivenessMap.get(link.ingredient_id)
          if (eff) {
            matchScore += eff.effectiveness_score
            matchedIngredients.push({
              ingredientId: eff.ingredient_id,
              concern: eff.concern,
              score: eff.effectiveness_score,
            })
          }
        }

        // Also boost by rating
        const ratingBoost = (product.rating_avg ?? 0) / 5

        return {
          product,
          matchScore: matchScore + ratingBoost,
          matchedIngredients,
        }
      })

      scored.sort((a, b) => b.matchScore - a.matchScore)
      const top3 = scored.slice(0, 3)

      // Resolve ingredient names for the reasoning text
      const allIngredientIds = new Set<string>()
      for (const item of top3) {
        for (const mi of item.matchedIngredients) {
          allIngredientIds.add(mi.ingredientId)
        }
      }

      let ingredientNames = new Map<string, string>()
      if (allIngredientIds.size > 0) {
        const { data: ingredients } = await supabase
          .from('ss_ingredients')
          .select('id, name_en')
          .in('id', Array.from(allIngredientIds))

        ingredientNames = new Map(
          (ingredients ?? []).map(i => [i.id, i.name_en])
        )
      }

      const picks = top3.map(item => ({
        product: item.product,
        reasoning: buildReasoning(
          item.matchedIngredients,
          ingredientNames,
          skinType
        ),
      }))

      return NextResponse.json({ picks })
    }

    // Fallback: no effectiveness data, return top 3 by rating
    const top3 = sunscreens.slice(0, 3)
    const picks = top3.map(product => ({
      product,
      reasoning: `Top-rated sunscreen for all skin types.`,
    }))

    return NextResponse.json({ picks })
  } catch (error) {
    return handleApiError(error)
  }
}

function buildReasoning(
  matchedIngredients: Array<{ ingredientId: string; concern: string; score: number }>,
  ingredientNames: Map<string, string>,
  skinType: string
): string {
  if (matchedIngredients.length === 0) {
    return `Well-rated sunscreen suitable for ${skinType} skin.`
  }

  const parts: string[] = []
  // Show top 2 effective ingredients
  const topMatches = matchedIngredients
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  for (const m of topMatches) {
    const name = ingredientNames.get(m.ingredientId) ?? 'Key ingredient'
    parts.push(
      `${name} (${Math.round(m.score * 100)}% effective for ${m.concern})`
    )
  }

  return `Contains ${parts.join(', ')} — proven for ${skinType} skin.`
}
