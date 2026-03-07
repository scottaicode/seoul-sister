import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const contextSchema = z.object({
  pain_points: z.array(z.string()).optional(),
  skin_types: z.array(z.string()).optional(),
  ingredient_names: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).optional().default(10),
})

/**
 * Pain point → ingredient function/concern mapping.
 * Used to find relevant ingredients when LGAAS provides pain points
 * from Reddit posts or blog topics.
 */
const PAIN_POINT_MAP: Record<string, string[]> = {
  acne: ['exfoliant', 'antibacterial', 'sebum', 'bha', 'salicylic', 'benzoyl', 'acne'],
  breakout: ['exfoliant', 'antibacterial', 'sebum', 'bha', 'salicylic', 'acne'],
  oily: ['sebum', 'mattifying', 'oil control', 'niacinamide', 'oily'],
  dry: ['humectant', 'emollient', 'moisturizing', 'hyaluronic', 'ceramide', 'dry'],
  dehydrated: ['humectant', 'hyaluronic', 'hydrating', 'moisture barrier'],
  wrinkles: ['anti-aging', 'retinol', 'peptide', 'collagen', 'firming', 'wrinkle'],
  'anti-aging': ['anti-aging', 'retinol', 'peptide', 'collagen', 'firming'],
  hyperpigmentation: ['brightening', 'whitening', 'vitamin c', 'arbutin', 'niacinamide', 'tranexamic'],
  'dark spots': ['brightening', 'whitening', 'vitamin c', 'arbutin', 'niacinamide'],
  redness: ['soothing', 'calming', 'centella', 'cica', 'anti-inflammatory', 'sensitive'],
  sensitive: ['soothing', 'calming', 'centella', 'cica', 'gentle', 'sensitive'],
  'sun protection': ['uv filter', 'sunscreen', 'spf', 'antioxidant'],
  pores: ['pore', 'bha', 'niacinamide', 'astringent', 'sebum'],
  barrier: ['ceramide', 'barrier', 'moisturizing', 'cholesterol', 'fatty acid'],
  dull: ['brightening', 'exfoliant', 'aha', 'vitamin c', 'glow'],
  texture: ['exfoliant', 'aha', 'bha', 'retinol', 'smoothing'],
}

/**
 * POST /api/admin/ingredients/context
 *
 * Returns condensed ingredient knowledge for LGAAS content generation.
 * Auth via X-LGAAS-API-Key header (same shared secret as content ingest).
 *
 * Query modes:
 * - By pain_points: maps concerns to ingredient functions/concerns
 * - By skin_types: returns ingredients with good effectiveness for that type
 * - By ingredient_names: direct lookup
 * All modes can be combined. Results are deduplicated and limited.
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    const body = await request.json()
    const params = contextSchema.parse(body)
    const { pain_points, skin_types, ingredient_names, limit } = params

    if (!pain_points?.length && !skin_types?.length && !ingredient_names?.length) {
      throw new AppError('At least one of pain_points, skin_types, or ingredient_names is required', 400)
    }

    const supabase = getServiceClient()
    const seen = new Set<number>()
    const results: IngredientContext[] = []

    // 1. Direct name lookup
    if (ingredient_names?.length) {
      for (const name of ingredient_names.slice(0, 10)) {
        const { data } = await supabase
          .from('ss_ingredients')
          .select('id, name_inci, name_en, function, description, common_concerns, safety_rating, comedogenic_rating, is_active, rich_content')
          .eq('is_active', true)
          .not('rich_content', 'is', null)
          .or(`name_inci.ilike.%${name.trim()}%,name_en.ilike.%${name.trim()}%`)
          .limit(1)

        if (data?.[0] && !seen.has(data[0].id)) {
          seen.add(data[0].id)
          results.push(toContext(data[0]))
        }
      }
    }

    // 2. Pain point mapping
    if (pain_points?.length && results.length < limit) {
      const searchTerms: string[] = []
      for (const point of pain_points) {
        const mapped = PAIN_POINT_MAP[point.toLowerCase()]
        if (mapped) searchTerms.push(...mapped)
        else searchTerms.push(point.toLowerCase())
      }

      // Search by function and common_concerns fields
      const uniqueTerms = [...new Set(searchTerms)].slice(0, 8)
      for (const term of uniqueTerms) {
        if (results.length >= limit) break
        const { data } = await supabase
          .from('ss_ingredients')
          .select('id, name_inci, name_en, function, description, common_concerns, safety_rating, comedogenic_rating, is_active, rich_content')
          .eq('is_active', true)
          .not('rich_content', 'is', null)
          .or(`function.ilike.%${term}%,common_concerns.cs.{${term}}`)
          .limit(3)

        for (const ing of data || []) {
          if (results.length >= limit) break
          if (!seen.has(ing.id)) {
            seen.add(ing.id)
            results.push(toContext(ing))
          }
        }
      }
    }

    // 3. Skin type effectiveness lookup
    if (skin_types?.length && results.length < limit) {
      for (const skinType of skin_types.slice(0, 3)) {
        if (results.length >= limit) break
        const { data } = await supabase
          .from('ss_ingredient_effectiveness')
          .select('ingredient_id, effectiveness_score, concern, ingredient:ss_ingredients!ingredient_id(id, name_inci, name_en, function, description, common_concerns, safety_rating, comedogenic_rating, is_active, rich_content)')
          .eq('skin_type', skinType.toLowerCase())
          .gte('effectiveness_score', 70)
          .not('ingredient.rich_content', 'is', null)
          .order('effectiveness_score', { ascending: false })
          .limit(5)

        for (const row of data || []) {
          if (results.length >= limit) break
          const ing = row.ingredient as unknown as Record<string, unknown> | null
          if (!ing || seen.has(ing.id as number)) continue
          seen.add(ing.id as number)
          results.push(toContext(ing))
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      ingredients: results,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface IngredientContext {
  name: string
  inci_name: string
  function: string | null
  overview: string | null
  how_it_works: string | null
  skin_types: unknown
  usage_tips: unknown
  safety_rating: string | null
  comedogenic_rating: number | null
}

function toContext(ing: Record<string, unknown>): IngredientContext {
  const rc = ing.rich_content as Record<string, unknown> | null

  return {
    name: (ing.name_en as string) || (ing.name_inci as string),
    inci_name: ing.name_inci as string,
    function: ing.function as string | null,
    overview: rc?.overview ? truncate(rc.overview as string, 300) : null,
    how_it_works: rc?.how_it_works ? truncate(rc.how_it_works as string, 250) : null,
    skin_types: rc?.skin_types || null,
    usage_tips: rc?.usage_tips || null,
    safety_rating: ing.safety_rating as string | null,
    comedogenic_rating: ing.comedogenic_rating as number | null,
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return cut.slice(0, lastSpace > 0 ? lastSpace : max) + '...'
}
