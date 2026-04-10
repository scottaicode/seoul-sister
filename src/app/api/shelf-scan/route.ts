import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { getServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { hasActiveSubscription } from '@/lib/subscription'
import type { ShelfScanProduct, ShelfScanCollectionAnalysis, RoutineGradeLevel } from '@/types/database'

export const maxDuration = 60
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// User profile types (same pattern as skin-score)
// ---------------------------------------------------------------------------

interface UserProfileData {
  skin_type: string | null
  skin_concerns: string[] | null
  climate: string | null
  location_text: string | null
  age_range: string | null
  allergies: string[] | null
  fitzpatrick_scale: number | null
}

interface EffectivenessRow {
  ingredientName: string
  concern: string
  effectivenessScore: number
  sampleSize: number
}

// ---------------------------------------------------------------------------
// Load user profile + ingredient effectiveness
// ---------------------------------------------------------------------------

async function loadUserProfileAndEffectiveness(
  userId: string
): Promise<{
  profile: UserProfileData | null
  effectiveness: EffectivenessRow[]
}> {
  const db = getServiceClient()

  let profile: UserProfileData | null = null
  try {
    const { data } = await db
      .from('ss_user_profiles')
      .select(
        'skin_type, skin_concerns, climate, location_text, age_range, allergies, fitzpatrick_scale'
      )
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      profile = data as UserProfileData
    }
  } catch {
    // Non-critical — continue without profile
  }

  let effectiveness: EffectivenessRow[] = []
  if (profile?.skin_type) {
    try {
      const { data } = await db
        .from('ss_ingredient_effectiveness')
        .select(
          `effectiveness_score, sample_size, concern,
           ingredient:ss_ingredients(name_en, name_inci)`
        )
        .or(
          `skin_type.eq.${profile.skin_type},skin_type.eq.__all__`
        )
        .gte('sample_size', 5)
        .order('effectiveness_score', { ascending: false })
        .limit(10)

      effectiveness = (data || []).map(
        (row: Record<string, unknown>) => {
          const ing = row.ingredient as Record<string, unknown> | null
          return {
            ingredientName:
              (ing?.name_en as string) ||
              (ing?.name_inci as string) ||
              'Unknown',
            concern: (row.concern as string) || '',
            effectivenessScore: row.effectiveness_score as number,
            sampleSize: row.sample_size as number,
          }
        }
      )
    } catch {
      // Non-critical
    }
  }

  return { profile, effectiveness }
}

// ---------------------------------------------------------------------------
// Build personalized system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  profile: UserProfileData | null,
  effectiveness: EffectivenessRow[]
): string {
  let userContextSection = ''

  if (profile) {
    const lines: string[] = []
    if (profile.skin_type) lines.push(`- Skin type: ${profile.skin_type}`)
    if (profile.skin_concerns?.length)
      lines.push(`- Primary concerns: ${profile.skin_concerns.join(', ')}`)
    if (profile.climate)
      lines.push(
        `- Climate: ${profile.climate}${profile.location_text ? ` (${profile.location_text})` : ''}`
      )
    if (profile.age_range) lines.push(`- Age range: ${profile.age_range}`)
    if (profile.allergies?.length)
      lines.push(`- Known allergies/sensitivities: ${profile.allergies.join(', ')}`)
    if (profile.fitzpatrick_scale)
      lines.push(`- Fitzpatrick scale: ${profile.fitzpatrick_scale}`)

    if (lines.length > 0) {
      userContextSection += `\n\n## User Skin Profile (Personalize Your Analysis)\n${lines.join('\n')}`

      userContextSection += `\n\nWhen analyzing this collection:
- Flag any products likely containing ingredients the user is allergic to
- Assess whether the collection addresses the user's stated skin concerns
- Recommend missing product categories based on their skin type and climate
- Factor personal relevance into the routine grade — a collection that doesn't address their primary concerns should score lower, even if it covers all categories
- For missing categories, suggest what would specifically help THIS user (e.g., "Your oily skin would benefit from a BHA exfoliator" rather than just "missing exfoliator")`
    }

    if (effectiveness.length > 0) {
      const ingredientLines = effectiveness
        .slice(0, 10)
        .map(
          (e) =>
            `- ${e.ingredientName}: ${Math.round(e.effectivenessScore * 100)}% effective for ${e.concern} (${e.sampleSize} reports)`
        )
      userContextSection += `\n\n## Top Effective Ingredients for This User's Skin Type\n${ingredientLines.join('\n')}\n\nWhen recommending products to add, prioritize those containing ingredients proven effective for this user's skin type.`
    }
  }

  return `You are Yuri's Shelf Scan specialist. You analyze photos of skincare product shelves and collections.

Your task:
1. Identify each visually distinct Korean beauty / skincare product in the photo
2. For each product, determine: brand, product name, category, and your confidence level
3. Analyze the collection as a whole

DEDUPLICATION RULE (critical):
- Only list each distinct product ONCE, even if you see it from multiple angles or if multiple bottles of the same product are visible
- If a product might be a duplicate or variant of one you already listed, DO NOT include it a second time
- Never include the phrase "duplicate", "variant", "or similar", or "(duplicate" in a product name
- If unsure whether two items are the same product or different variants, pick the one you're most confident about and skip the other

For each product, determine the category from this list:
cleanser, toner, essence, serum, ampoule, moisturizer, sunscreen, mask, eye_care, lip_care, exfoliator, oil, mist, spot_treatment

Respond in JSON format:
{
  "products_identified": [
    {
      "name": "product name in English (NO parenthetical duplicate notes)",
      "brand": "brand name in English",
      "category": "one of the categories above",
      "confidence": 0.0 to 1.0,
      "position_in_image": "brief description like 'front left' or 'back row center'"
    }
  ],
  "collection_analysis": {
    "total_estimated_value": estimated total USD value of all visible products,
    "ingredient_overlap_warnings": ["products that likely overlap significantly in function"],
    "missing_categories": ["categories missing for a complete routine, e.g. 'sunscreen', 'cleanser'"],
    "redundant_products": ["products that are redundant, e.g. 'Two hyaluronic acid serums'"],
    "overall_routine_grade": "A" or "B" or "C" or "D" or "F",
    "grade_rationale": "one sentence explaining the grade",
    "recommendations": ["actionable suggestions to improve the collection"]
  }
}

Grading criteria:
- A: Covers all essential categories (cleanser, toner/essence, serum, moisturizer, sunscreen), good variety, minimal redundancy
- B: Covers most categories, minor gaps or slight redundancy
- C: Missing 1-2 key categories or notable redundancy
- D: Missing several categories or heavy redundancy with no clear routine structure
- F: Very incomplete or entirely redundant with no skincare structure

Be generous but honest in your grading. If you cannot identify a product with confidence, still include it with a lower confidence score and your best guess — but only list each distinct product once.${userContextSection}`
}

// ---------------------------------------------------------------------------
// Post-match allergen cross-reference
// ---------------------------------------------------------------------------

async function checkAllergens(
  productId: string,
  allergies: string[]
): Promise<string[]> {
  if (!allergies.length) return []

  const db = getServiceClient()
  const warnings: string[] = []

  try {
    const { data: ingredients } = await db
      .from('ss_product_ingredients')
      .select('ingredient:ss_ingredients(name_inci, name_en)')
      .eq('product_id', productId)

    if (!ingredients?.length) return []

    for (const row of ingredients) {
      const ing = row.ingredient as unknown as Record<string, unknown> | null
      if (!ing) continue
      const ingName = (ing.name_en as string) || (ing.name_inci as string) || ''
      const ingNameLower = ingName.toLowerCase()

      for (const allergy of allergies) {
        const allergyLower = allergy.toLowerCase()
        if (ingNameLower.includes(allergyLower) || allergyLower.includes(ingNameLower)) {
          warnings.push(`Contains ${ingName} — you listed "${allergy}" as an allergy`)
        }
      }
    }
  } catch {
    // Non-critical — return empty
  }

  return [...new Set(warnings)]
}

// ---------------------------------------------------------------------------
// POST /api/shelf-scan — Analyze a shelf/collection photo
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Check active subscription
    const isSubscribed = await hasActiveSubscription(user.id)
    if (!isSubscribed) {
      throw new AppError('Active subscription required.', 403)
    }

    const body = await request.json()
    if (!body.image) {
      throw new AppError('Missing image data', 400)
    }

    const match = body.image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
    if (!match) {
      throw new AppError('Invalid image format. Expected base64 data URL.', 400)
    }
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    const imageBase64 = match[3]

    // Load user profile + ingredient effectiveness for personalized prompt
    const { profile, effectiveness } =
      await loadUserProfileAndEffectiveness(user.id)

    const systemPrompt = buildSystemPrompt(profile, effectiveness)

    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Analyze this skincare shelf/collection photo. Identify every product and provide a full collection analysis.',
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('No analysis result from AI', 500)
    }

    let analysis: { products_identified: ShelfScanProduct[]; collection_analysis: ShelfScanCollectionAnalysis }
    try {
      analysis = JSON.parse(textContent.text.trim())
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new AppError('Failed to parse analysis result', 500)
      }
      analysis = JSON.parse(jsonMatch[0])
    }

    // Validate grade
    const validGrades: RoutineGradeLevel[] = ['A', 'B', 'C', 'D', 'F']
    if (!validGrades.includes(analysis.collection_analysis?.overall_routine_grade)) {
      analysis.collection_analysis.overall_routine_grade = 'C'
    }

    // Post-process: filter out Claude-flagged duplicates and dedupe by brand+name.
    // Even with the DEDUPLICATION RULE in the prompt, Claude occasionally embeds
    // "(duplicate or similar variant)" in names. Belt and suspenders.
    const DUP_PATTERN = /\b(duplicate|similar variant|or variant|appears twice|same as)\b/i
    const seenKeys = new Set<string>()
    analysis.products_identified = (analysis.products_identified ?? []).filter((p) => {
      if (!p?.name) return false
      if (DUP_PATTERN.test(p.name)) return false
      // Dedupe by normalized brand + first 3 meaningful tokens of name
      const key = `${(p.brand || '').toLowerCase().trim()}|${p.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join(' ')}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    // Try to match identified products against our database
    const supabase = getServiceClient()
    const userAllergies = profile?.allergies || []

    const matchedProducts: ShelfScanProduct[] = []
    for (const product of analysis.products_identified) {
      try {
        const searchTerm = product.name || product.brand
        if (!searchTerm) {
          matchedProducts.push({ ...product, allergen_warnings: [] })
          continue
        }

        const { data } = await supabase
          .from('ss_products')
          .select('id, name_en, brand_en, category, price_usd')
          .or(`name_en.ilike.%${searchTerm}%,brand_en.ilike.%${searchTerm}%`)
          .limit(1)

        if (data && data.length > 0) {
          // Post-match allergen cross-reference
          const allergenWarnings = await checkAllergens(
            data[0].id,
            userAllergies
          )

          matchedProducts.push({
            ...product,
            matched_product_id: data[0].id,
            name: data[0].name_en || product.name,
            brand: data[0].brand_en || product.brand,
            category: data[0].category || product.category,
            allergen_warnings: allergenWarnings,
          })
        } else {
          matchedProducts.push({ ...product, allergen_warnings: [] })
        }
      } catch {
        matchedProducts.push({ ...product, allergen_warnings: [] })
      }
    }

    // Cross-reference with user's product inventory
    const matchedDbIds = matchedProducts
      .map((p) => p.matched_product_id)
      .filter(Boolean) as string[]

    let inventoryProductIds = new Set<string>()
    if (matchedDbIds.length > 0) {
      try {
        const { data: inventoryRows } = await supabase
          .from('ss_user_products')
          .select('product_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('product_id', matchedDbIds)

        inventoryProductIds = new Set(
          (inventoryRows ?? []).map((r) => r.product_id).filter(Boolean) as string[]
        )
      } catch {
        // Non-critical
      }
    }

    // Tag each product with ownership status
    for (const product of matchedProducts) {
      if (product.matched_product_id && inventoryProductIds.has(product.matched_product_id)) {
        product.already_in_inventory = true
      }
    }

    // Refine estimated value using DB prices where matched
    let refinedValue = 0
    let unmatchedEstimate = 0
    let matchedCount = 0

    for (const product of matchedProducts) {
      if (product.matched_product_id) {
        try {
          const { data: prices } = await supabase
            .from('ss_product_prices')
            .select('price_usd')
            .eq('product_id', product.matched_product_id)
            .order('price_usd', { ascending: true })
            .limit(1)

          if (prices && prices.length > 0) {
            refinedValue += prices[0].price_usd
            matchedCount++
            continue
          }
        } catch {
          // Fall through
        }
      }
      // Estimate per-product from AI total / count
      const productCount = matchedProducts.length || 1
      unmatchedEstimate += (analysis.collection_analysis.total_estimated_value || 0) / productCount
    }

    const totalValue = matchedCount > 0
      ? refinedValue + unmatchedEstimate
      : analysis.collection_analysis.total_estimated_value || 0

    return NextResponse.json({
      success: true,
      products_identified: matchedProducts,
      collection_analysis: {
        ...analysis.collection_analysis,
        total_estimated_value: Math.round(totalValue * 100) / 100,
      },
      products_count: matchedProducts.length,
      matched_count: matchedProducts.filter(p => p.matched_product_id).length,
      already_owned_count: matchedProducts.filter(p => p.already_in_inventory).length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
