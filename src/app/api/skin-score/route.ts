import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import type { GlassSkinScore, GlassSkinAnalysisResult } from '@/types/database'

export const maxDuration = 60
export const runtime = 'nodejs'

const GLASS_SKIN_SYSTEM_PROMPT = `You are Yuri's Glass Skin Analyst — an expert in evaluating skin quality based on the Korean "glass skin" (유리 피부) standard. You analyze selfie photos to score skin across 5 dimensions.

Analyze the photo and score each dimension from 0-100:

1. **Luminosity** (광채): How radiant and light-reflecting is the skin? Look for natural glow, healthy sheen without excess oil. High: dewy, light-catching. Low: dull, flat.

2. **Smoothness** (매끄러움): How smooth is the skin texture? Look for visible pores, texture irregularities, bumps, rough patches. High: poreless-looking, even texture. Low: rough, visible large pores.

3. **Clarity** (투명도): How clear and blemish-free is the skin? Look for acne, dark spots, PIH/PIE, redness, scarring. High: clear, even-toned. Low: active breakouts, significant discoloration.

4. **Hydration** (수분): How well-hydrated does the skin appear? Look for plumpness, bounce, suppleness. High: plump, bouncy, no flaking. Low: dry, tight-looking, flaky, dehydration lines.

5. **Evenness** (균일): How even is the skin tone? Look for hyperpigmentation, melasma, uneven patches, dark circles. High: uniform tone throughout. Low: patchy, uneven coloring.

Be honest but constructive. Scores should reflect realistic assessment — most people will score 40-75 on each dimension. A score of 90+ means exceptionally glass-like skin in that dimension.

For recommendations, provide 3-5 specific, actionable K-beauty tips targeting the lowest-scoring dimensions. Reference specific product categories or ingredients.

Respond in JSON format ONLY:
{
  "overall_score": number (weighted average: luminosity 25%, smoothness 20%, clarity 20%, hydration 20%, evenness 15%),
  "luminosity_score": number,
  "smoothness_score": number,
  "clarity_score": number,
  "hydration_score": number,
  "evenness_score": number,
  "recommendations": ["string"],
  "analysis_notes": "Brief 2-3 sentence overall assessment"
}`

const analyzeSchema = z.object({
  image: z.string().min(1, 'Image data is required'),
})

// POST /api/skin-score — Analyze a skin photo
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { image } = analyzeSchema.parse(body)

    // Parse base64 data URL
    const match = image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
    if (!match) {
      throw new AppError('Invalid image format. Expected base64 data URL.', 400)
    }
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    const imageBase64 = match[3]

    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 2048,
      system: GLASS_SKIN_SYSTEM_PROMPT,
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
              text: 'Analyze my skin for glass skin quality. Score each dimension and provide K-beauty recommendations.',
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('No analysis result from AI', 500)
    }

    let analysis: GlassSkinAnalysisResult
    try {
      analysis = JSON.parse(textContent.text.trim()) as GlassSkinAnalysisResult
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
      // Return analysis even if save fails
      return NextResponse.json({
        success: true,
        score: analysis,
        saved: false,
      })
    }

    // Fetch previous score for comparison
    const { data: previousScores } = await db
      .from('ss_glass_skin_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(1, 1) // Skip the one we just inserted, get the previous

    const previous = previousScores?.[0] as GlassSkinScore | undefined

    return NextResponse.json({
      success: true,
      score: score as GlassSkinScore,
      saved: true,
      previous: previous || null,
      comparison: previous ? {
        score_change: analysis.overall_score - previous.overall_score,
        improved_dimensions: (['luminosity', 'smoothness', 'clarity', 'hydration', 'evenness'] as const)
          .filter(d => analysis[`${d}_score`] > previous[`${d}_score`]),
        declined_dimensions: (['luminosity', 'smoothness', 'clarity', 'hydration', 'evenness'] as const)
          .filter(d => analysis[`${d}_score`] < previous[`${d}_score`]),
      } : null,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/skin-score — Get user's score history
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

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
