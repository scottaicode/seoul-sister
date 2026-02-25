import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { hasActiveSubscription } from '@/lib/subscription'
import type {
  GlassSkinScore,
  GlassSkinAnalysisResult,
  GlassSkinProductSuggestion,
} from '@/types/database'

export const maxDuration = 60
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Build personalized system prompt
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

interface TreatmentPlanContext {
  activePlan: string | null      // e.g. "3-phase barrier repair"
  currentPhase: string | null    // e.g. "Phase 1: Barrier repair only"
  avoidIngredients: string[]     // Ingredients the plan says to avoid right now
  summarySnippet: string | null  // Relevant excerpt from latest Yuri conversation
}

function buildSystemPrompt(
  profile: UserProfileData | null,
  effectiveness: EffectivenessRow[],
  treatmentPlan?: TreatmentPlanContext
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
      lines.push(`- Allergies/sensitivities: ${profile.allergies.join(', ')}`)
    if (profile.fitzpatrick_scale)
      lines.push(`- Fitzpatrick scale: ${profile.fitzpatrick_scale}`)

    if (lines.length > 0) {
      userContextSection += `\n\n## User Context (Personalize Your Analysis)\n${lines.join('\n')}`
    }

    if (effectiveness.length > 0) {
      const ingredientLines = effectiveness
        .slice(0, 10)
        .map(
          (e) =>
            `- ${e.ingredientName}: ${Math.round(e.effectivenessScore * 100)}% effective for ${e.concern} (${e.sampleSize} reports)`
        )
      userContextSection += `\n\n## Top Effective Ingredients for This User's Skin Type\n${ingredientLines.join('\n')}`
    }

    if (lines.length > 0) {
      userContextSection += `\n\nWhen recommending products or ingredients, prioritize those proven effective for this specific skin type and concerns. Avoid recommending ingredients in their allergy list. Reference specific Seoul Sister product categories (serum, toner, moisturizer, essence, ampoule, sunscreen, cleanser, mask, exfoliator, etc.) when suggesting improvements.`
    }
  }

  // Inject active treatment plan from Yuri's conversations
  if (treatmentPlan?.activePlan) {
    userContextSection += `\n\n## IMPORTANT: Active Treatment Plan from Yuri (AI Advisor)
This user is following a treatment plan that Yuri (their AI skincare advisor) designed for them:
- **Active plan**: ${treatmentPlan.activePlan}`
    if (treatmentPlan.currentPhase) {
      userContextSection += `\n- **Current phase**: ${treatmentPlan.currentPhase}`
    }
    if (treatmentPlan.summarySnippet) {
      userContextSection += `\n- **Context**: ${treatmentPlan.summarySnippet}`
    }
    if (treatmentPlan.avoidIngredients.length > 0) {
      userContextSection += `\n- **Ingredients to AVOID recommending right now**: ${treatmentPlan.avoidIngredients.join(', ')}`
    }
    userContextSection += `\n\n**Your recommendations MUST be compatible with their current treatment phase.** If they are in a barrier repair phase, do NOT recommend strong actives (retinol, AHA, BHA, high-concentration vitamin C). Instead, recommend gentle hydrating and barrier-supporting ingredients (ceramides, centella, panthenol, hyaluronic acid). Mention that their advisor has them on a phased plan and your recommendations align with it.`
  }

  return `You are Yuri's Glass Skin Analyst — an expert in evaluating skin quality based on the Korean "glass skin" (유리 피부) standard. You analyze selfie photos to score skin across 5 dimensions.

Analyze the photo and score each dimension from 0-100:

1. **Luminosity** (광채): How radiant and light-reflecting is the skin? Look for natural glow, healthy sheen without excess oil. High: dewy, light-catching. Low: dull, flat.

2. **Smoothness** (매끄러움): How smooth is the skin texture? Look for visible pores, texture irregularities, bumps, rough patches. High: poreless-looking, even texture. Low: rough, visible large pores.

3. **Clarity** (투명도): How clear and blemish-free is the skin? Look for acne, dark spots, PIH/PIE, redness, scarring. High: clear, even-toned. Low: active breakouts, significant discoloration.

4. **Hydration** (수분): How well-hydrated does the skin appear? Look for plumpness, bounce, suppleness. High: plump, bouncy, no flaking. Low: dry, tight-looking, flaky, dehydration lines.

5. **Evenness** (균일): How even is the skin tone? Look for hyperpigmentation, melasma, uneven patches, dark circles. High: uniform tone throughout. Low: patchy, uneven coloring.

Be honest but constructive. Scores should reflect realistic assessment — most people will score 40-75 on each dimension. A score of 90+ means exceptionally glass-like skin in that dimension.

For recommendations, provide 3-5 specific, actionable K-beauty tips targeting the lowest-scoring dimensions. Reference specific product categories or ingredients.${userContextSection}

Respond in JSON format ONLY:
{
  "overall_score": number (weighted average: luminosity 25%, smoothness 20%, clarity 20%, hydration 20%, evenness 15%),
  "luminosity_score": number,
  "smoothness_score": number,
  "clarity_score": number,
  "hydration_score": number,
  "evenness_score": number,
  "recommendations": ["string"],
  "analysis_notes": "Brief 2-3 sentence overall assessment personalized to the user's skin type and concerns",
  "recommended_ingredients": ["ingredient name"],
  "recommended_categories": ["product category"]
}`
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

  // Load profile
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

  // Load ingredient effectiveness for user's skin type
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
// Load active treatment plan from Yuri's decision memory + summaries
// ---------------------------------------------------------------------------

async function loadTreatmentPlanContext(
  userId: string
): Promise<TreatmentPlanContext> {
  const result: TreatmentPlanContext = {
    activePlan: null,
    currentPhase: null,
    avoidIngredients: [],
    summarySnippet: null,
  }
  const db = getServiceClient()

  try {
    // 1. Check decision memory for active treatment decisions
    const { data: conversations } = await db
      .from('ss_yuri_conversations')
      .select('decision_memory, ai_summary')
      .eq('user_id', userId)
      .not('decision_memory', 'eq', '{}')
      .order('updated_at', { ascending: false })
      .limit(3)

    if (conversations?.length) {
      for (const conv of conversations) {
        const dm = conv.decision_memory as {
          decisions?: Array<{ topic: string; decision: string; date: string }>
        } | null
        if (!dm?.decisions) continue

        for (const d of dm.decisions) {
          const topic = d.topic.toLowerCase()
          // Look for barrier repair, treatment plan, phase-related decisions
          if (
            topic.includes('barrier') ||
            topic.includes('repair') ||
            topic.includes('treatment') ||
            topic.includes('phase') ||
            topic.includes('routine_plan') ||
            topic.includes('actives')
          ) {
            result.activePlan = d.decision
            // Try to extract phase info from the decision text
            const phaseMatch = d.decision.match(/phase\s*(\d)/i)
            if (phaseMatch) {
              result.currentPhase = `Phase ${phaseMatch[1]}`
            }
          }
        }
      }

      // 2. Scan recent summaries for treatment plan context
      for (const conv of conversations) {
        const summary = conv.ai_summary as string | null
        if (!summary) continue

        // Look for phase/barrier/treatment mentions in summaries
        const lines = summary.split('\n')
        for (const line of lines) {
          const lower = line.toLowerCase()
          if (
            lower.includes('phase') ||
            lower.includes('barrier repair') ||
            lower.includes('no actives') ||
            lower.includes('avoid actives') ||
            lower.includes('treatment plan')
          ) {
            result.summarySnippet = line.trim().replace(/^[-•*]\s*/, '')
            break
          }
        }
        if (result.summarySnippet) break
      }
    }

    // 3. Also check conversations without decision memory but with summaries
    if (!result.activePlan) {
      const { data: recentConvs } = await db
        .from('ss_yuri_conversations')
        .select('ai_summary')
        .eq('user_id', userId)
        .not('ai_summary', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (recentConvs) {
        for (const conv of recentConvs) {
          const summary = conv.ai_summary as string | null
          if (!summary) continue

          const lower = summary.toLowerCase()
          // Detect barrier repair / treatment phases in summaries
          if (lower.includes('barrier repair') || lower.includes('phase 1')) {
            if (lower.includes('no actives') || lower.includes('avoid actives') || lower.includes('gentle')) {
              result.activePlan = result.activePlan || 'Barrier repair (from Yuri conversation)'
              result.avoidIngredients = [
                ...result.avoidIngredients,
                'retinol', 'retinoid', 'AHA', 'BHA', 'glycolic acid',
                'salicylic acid', 'vitamin C (L-ascorbic acid)',
                'benzoyl peroxide', 'azelaic acid',
              ]
            }
            // Extract snippet
            const lines = summary.split('\n')
            for (const line of lines) {
              if (line.toLowerCase().includes('phase') || line.toLowerCase().includes('barrier')) {
                result.summarySnippet = result.summarySnippet || line.trim().replace(/^[-•*]\s*/, '')
                break
              }
            }
          }
        }
      }
    }

    // Deduplicate avoidIngredients
    result.avoidIngredients = [...new Set(result.avoidIngredients)]
  } catch {
    // Non-critical — continue without treatment context
  }

  return result
}

// ---------------------------------------------------------------------------
// Link recommendations to real products
// ---------------------------------------------------------------------------

async function findProductSuggestions(
  analysis: GlassSkinAnalysisResult
): Promise<GlassSkinProductSuggestion[]> {
  const db = getServiceClient()
  const suggestions: GlassSkinProductSuggestion[] = []
  const seenProductIds = new Set<string>()

  // Collect search terms from recommended ingredients and categories
  const searchTerms: Array<{ term: string; relevance: string }> = []

  if (analysis.recommended_ingredients?.length) {
    for (const ingredient of analysis.recommended_ingredients.slice(0, 5)) {
      searchTerms.push({ term: ingredient, relevance: ingredient })
    }
  }

  if (analysis.recommended_categories?.length) {
    for (const category of analysis.recommended_categories.slice(0, 3)) {
      searchTerms.push({ term: category, relevance: category })
    }
  }

  // For each search term, find top-rated matching products
  for (const { term, relevance } of searchTerms) {
    if (suggestions.length >= 5) break

    try {
      // Search by category match first
      const normalizedTerm = term.toLowerCase().trim()
      const validCategories = [
        'cleanser', 'toner', 'essence', 'serum', 'ampoule',
        'moisturizer', 'sunscreen', 'mask', 'exfoliator',
        'lip_care', 'eye_care', 'oil', 'mist', 'spot_treatment',
      ]
      const isCategory = validCategories.includes(normalizedTerm)

      let products: Record<string, unknown>[] | null = null

      if (isCategory) {
        const { data } = await db
          .from('ss_products')
          .select('id, name_en, brand_en, category, rating_avg')
          .eq('category', normalizedTerm)
          .not('rating_avg', 'is', null)
          .order('rating_avg', { ascending: false })
          .limit(3)
        products = data as Record<string, unknown>[] | null
      } else {
        // Search by ingredient name in product description or name
        const { data } = await db
          .from('ss_products')
          .select('id, name_en, brand_en, category, rating_avg')
          .or(
            `name_en.ilike.%${normalizedTerm}%,description_en.ilike.%${normalizedTerm}%`
          )
          .not('rating_avg', 'is', null)
          .order('rating_avg', { ascending: false })
          .limit(3)
        products = data as Record<string, unknown>[] | null
      }

      if (!products?.length) continue

      for (const product of products) {
        const productId = product.id as string
        if (seenProductIds.has(productId)) continue
        if (suggestions.length >= 5) break
        seenProductIds.add(productId)

        // Fetch cheapest price for this product
        let priceUsd: number | null = null
        let retailer: string | null = null
        try {
          const { data: priceData } = await db
            .from('ss_product_prices')
            .select(
              'price_usd, retailer:ss_retailers(name)'
            )
            .eq('product_id', productId)
            .eq('in_stock', true)
            .order('price_usd', { ascending: true })
            .limit(1)

          if (priceData?.length) {
            const row = priceData[0] as Record<string, unknown>
            priceUsd = row.price_usd as number
            const r = row.retailer as Record<string, unknown> | null
            retailer = (r?.name as string) || null
          }
        } catch {
          // Price lookup non-critical
        }

        suggestions.push({
          product_id: productId,
          name: product.name_en as string,
          brand: product.brand_en as string,
          category: product.category as string,
          rating_avg: product.rating_avg as number | null,
          price_usd: priceUsd,
          retailer,
          relevance,
        })
      }
    } catch {
      // Non-critical — continue with next search term
    }
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const analyzeSchema = z.object({
  image: z.string().min(1, 'Image data is required'),
})

// ---------------------------------------------------------------------------
// POST /api/skin-score — Analyze a skin photo
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
    const { image } = analyzeSchema.parse(body)

    // Parse base64 data URL
    const match = image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
    if (!match) {
      throw new AppError('Invalid image format. Expected base64 data URL.', 400)
    }
    const mediaType = match[1] as
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp'
      | 'image/gif'
    const imageBase64 = match[3]

    // Load user profile + ingredient effectiveness + treatment plan for personalized prompt
    const [{ profile, effectiveness }, treatmentPlan] = await Promise.all([
      loadUserProfileAndEffectiveness(user.id),
      loadTreatmentPlanContext(user.id),
    ])

    const systemPrompt = buildSystemPrompt(profile, effectiveness, treatmentPlan)

    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 2048,
      temperature: 0,
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
              text: 'Analyze my skin for glass skin quality. Score each dimension and provide personalized K-beauty recommendations.',
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(
      (block) => block.type === 'text'
    )
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('No analysis result from AI', 500)
    }

    let analysis: GlassSkinAnalysisResult
    try {
      analysis = JSON.parse(
        textContent.text.trim()
      ) as GlassSkinAnalysisResult
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new AppError('Failed to parse analysis result', 500)
      }
      analysis = JSON.parse(jsonMatch[0]) as GlassSkinAnalysisResult
    }

    // Validate scores are within range
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
    analysis.overall_score = clamp(analysis.overall_score)
    analysis.luminosity_score = clamp(analysis.luminosity_score)
    analysis.smoothness_score = clamp(analysis.smoothness_score)
    analysis.clarity_score = clamp(analysis.clarity_score)
    analysis.hydration_score = clamp(analysis.hydration_score)
    analysis.evenness_score = clamp(analysis.evenness_score)

    // Link recommendations to real products from the database
    let productSuggestions: GlassSkinProductSuggestion[] = []
    try {
      productSuggestions = await findProductSuggestions(analysis)
    } catch {
      // Non-critical — return analysis without product links
    }

    // Save to database
    const db = getServiceClient()
    const { data: score, error: insertError } = await db
      .from('ss_glass_skin_scores')
      .insert({
        user_id: user.id,
        overall_score: analysis.overall_score,
        luminosity_score: analysis.luminosity_score,
        smoothness_score: analysis.smoothness_score,
        clarity_score: analysis.clarity_score,
        hydration_score: analysis.hydration_score,
        evenness_score: analysis.evenness_score,
        recommendations: analysis.recommendations || [],
        analysis_notes: analysis.analysis_notes || null,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Failed to save glass skin score:', insertError)
      return NextResponse.json({
        success: true,
        score: analysis,
        saved: false,
        product_suggestions: productSuggestions,
      })
    }

    // Fetch previous score for comparison
    const { data: previousScores } = await db
      .from('ss_glass_skin_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(1, 1)

    const previous = previousScores?.[0] as GlassSkinScore | undefined

    return NextResponse.json(
      {
        success: true,
        score: score as GlassSkinScore,
        saved: true,
        previous: previous || null,
        comparison: previous
          ? {
              score_change:
                analysis.overall_score - previous.overall_score,
              improved_dimensions: (
                [
                  'luminosity',
                  'smoothness',
                  'clarity',
                  'hydration',
                  'evenness',
                ] as const
              ).filter(
                (d) =>
                  analysis[`${d}_score`] > previous[`${d}_score`]
              ),
              declined_dimensions: (
                [
                  'luminosity',
                  'smoothness',
                  'clarity',
                  'hydration',
                  'evenness',
                ] as const
              ).filter(
                (d) =>
                  analysis[`${d}_score`] < previous[`${d}_score`]
              ),
            }
          : null,
        product_suggestions: productSuggestions,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/skin-score — Get user's score history
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    const url = new URL(request.url)
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '20'),
      50
    )

    const { data: scores, error } = await db
      .from('ss_glass_skin_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new AppError('Failed to fetch scores', 500)
    }

    const typedScores = (scores || []) as GlassSkinScore[]

    return NextResponse.json({
      success: true,
      scores: typedScores,
      count: typedScores.length,
      latest: typedScores[0] || null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
