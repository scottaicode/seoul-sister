import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { hasActiveSubscription } from '@/lib/subscription'
import type { GlassSkinScore, GlassSkinAnalysisResult } from '@/types/database'

export const maxDuration = 60
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// What this route does, and what it deliberately does not (Nov 14 2026)
//
// It SCORES a photo across five dimensions, says how far the photo can be
// trusted, and describes what it sees. It gives no advice.
//
// It used to also write 3-5 "actionable K-beauty tips", pick ingredients and
// product categories, match those to catalog products, and put advice in the
// written assessment ("Boosting hydration and barrier support is the priority
// here", a stored row from Nov 13 2026). The tips panel was removed from the
// page in v10.7.1 after it told a member on a barrier-repair phase to add
// acids, but the assessment went on carrying advice and the rest was still
// generated and returned unrendered. All of it was made from one photo and the
// profile, without what Yuri and the member have worked out. What to do about
// a score is Yuri's to say (Yuri Sole Authority, CLAUDE.md); the page links to her.
// tests/glass-skin-scores-only.test.mjs pins this prompt and the fields read.
// ---------------------------------------------------------------------------

const GLASS_SKIN_SCORER_VERSION = 2

const GLASS_SKIN_SYSTEM_PROMPT = `You score a selfie against the Korean "glass skin" (유리 피부) standard. You score and describe what is visible. You say nothing about what the person should do, use, change or expect, and nothing about what would help or what comes first: someone who knows their history does that separately. This is a photo of someone's face, so describe it the way a careful, kind observer would.

Score each dimension from 0-100:

1. **Luminosity** (광채): How radiant and light-reflecting is the skin? Look for natural glow, healthy sheen without excess oil. High: dewy, light-catching. Low: dull, flat.

2. **Smoothness** (매끄러움): How smooth is the skin texture? Look for visible pores, texture irregularities, bumps, rough patches. High: poreless-looking, even texture. Low: rough, visible large pores.

3. **Clarity** (투명도): How clear and blemish-free is the skin? Look for acne, dark spots, PIH/PIE, redness, scarring. High: clear, even-toned. Low: active breakouts, significant discoloration.

4. **Hydration** (수분): How well-hydrated does the skin appear? Look for plumpness, bounce, suppleness. High: plump, bouncy, no flaking. Low: dry, tight-looking, flaky, dehydration lines.

5. **Evenness** (균일): How even is the skin tone? Look for hyperpigmentation, melasma, uneven patches, dark circles. High: uniform tone throughout. Low: patchy, uneven coloring.

Be honest. Scores should reflect a realistic assessment: most people will score 40-75 on each dimension. A score of 90+ means exceptionally glass-like skin in that dimension.

## Photo Quality Assessment
Before scoring, assess the photo conditions. Suboptimal lighting and skin states distort scores: bathroom lighting reads pinker, a hot shower flushes vascular tone, harsh shadows hide texture, makeup and filters mask the true picture. Flag what you observe so the person knows whether to trust this score or retake.

- **lighting_quality**: "natural" (window/daylight, even), "artificial" (lamp/overhead indoor), "mixed", or "uncertain"
- **conditions**: array of observations that affect score reliability. Examples: "bathroom lighting", "post-shower vascular flush", "yellow indoor lighting", "harsh shadow on one side", "appears to have residual makeup", "phone flash", "filter detected". Empty array if photo conditions look clean.
- **confidence_modifier**: 0.85-1.00 for good photos, 0.70-0.84 if conditions noticeably affect reliability, 0.50-0.69 if scoring is largely guesswork. Score the dimensions honestly anyway; this signals how much weight to put on the result.

Respond in JSON format ONLY:
{
  "overall_score": number (weighted average: luminosity 25%, smoothness 20%, clarity 20%, hydration 20%, evenness 15%),
  "luminosity_score": number,
  "smoothness_score": number,
  "clarity_score": number,
  "hydration_score": number,
  "evenness_score": number,
  "photo_quality": {
    "lighting_quality": "natural" | "artificial" | "mixed" | "uncertain",
    "conditions": ["string"],
    "confidence_modifier": number
  },
  "analysis_notes": "2-3 sentences about the photo, not addressed to the person: which dimensions read strongest and weakest, and what is visible that makes them so."
}`

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
              text: 'Score this photo for glass skin quality.',
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

    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(textContent.text.trim()) as Record<string, unknown>
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new AppError('Failed to parse analysis result', 500)
      }
      raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    }

    // Only these fields are read from what the model returns. Anything else it
    // adds (tips, ingredients, products to buy) stops here.
    // A score that is missing or not a number fails the request. It is never
    // turned into 0: a made-up 0 would be saved as a real measurement, in the
    // table the check-in outcome grader reads.
    const num = (v: unknown): number => {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        throw new AppError('The photo could not be scored. Please try again.', 502)
      }
      return n
    }
    const analysis: GlassSkinAnalysisResult = {
      overall_score: num(raw.overall_score),
      luminosity_score: num(raw.luminosity_score),
      smoothness_score: num(raw.smoothness_score),
      clarity_score: num(raw.clarity_score),
      hydration_score: num(raw.hydration_score),
      evenness_score: num(raw.evenness_score),
      recommendations: [],
      analysis_notes: typeof raw.analysis_notes === 'string' ? raw.analysis_notes : '',
      photo_quality: (raw.photo_quality && typeof raw.photo_quality === 'object'
        ? raw.photo_quality
        : undefined) as GlassSkinAnalysisResult['photo_quality'],
    }

    // Validate scores are within range
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
    analysis.overall_score = clamp(analysis.overall_score)
    analysis.luminosity_score = clamp(analysis.luminosity_score)
    analysis.smoothness_score = clamp(analysis.smoothness_score)
    analysis.clarity_score = clamp(analysis.clarity_score)
    analysis.hydration_score = clamp(analysis.hydration_score)
    analysis.evenness_score = clamp(analysis.evenness_score)

    // Save to database. Phase 13.D: also tag with active treatment phase
    // and persist photo to private storage bucket for the Phase Photo Gallery.
    const db = getServiceClient()

    // Look up the user's active phase (nullable — most users won't have one yet)
    let activePhaseId: string | null = null
    try {
      const { data: activePhase } = await db
        .from('ss_treatment_phases')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      activePhaseId = activePhase?.id ?? null
    } catch {
      // Non-critical: no active phase = photo isn't tagged, gallery shows
      // under "All photos" but not under any specific phase tab
    }

    // Generate a UUID for the score so the photo can use it as its path.
    // Bucket policy excludes gif, so we don't persist gifs (rare for selfies).
    const scoreId = crypto.randomUUID()
    let storedPhotoPath: string | null = null
    if (mediaType !== 'image/gif') {
      const photoExt = mediaType === 'image/png' ? 'png' : mediaType === 'image/webp' ? 'webp' : 'jpg'
      const photoPath = `${user.id}/${scoreId}.${photoExt}`
      try {
        const photoBuffer = Buffer.from(imageBase64, 'base64')
        const { error: uploadErr } = await db.storage
          .from('glass-skin-photos')
          .upload(photoPath, photoBuffer, {
            contentType: mediaType,
            upsert: false,
          })
        if (!uploadErr) storedPhotoPath = photoPath
        else console.error('Glass skin photo upload failed:', uploadErr.message)
      } catch (err) {
        console.error('Glass skin photo upload threw:', err)
      }
    }

    const { data: score, error: insertError } = await db
      .from('ss_glass_skin_scores')
      .insert({
        id: scoreId,
        user_id: user.id,
        overall_score: analysis.overall_score,
        luminosity_score: analysis.luminosity_score,
        smoothness_score: analysis.smoothness_score,
        clarity_score: analysis.clarity_score,
        hydration_score: analysis.hydration_score,
        evenness_score: analysis.evenness_score,
        // The column stays; nothing is written to it any more.
        recommendations: [],
        analysis_notes: analysis.analysis_notes || null,
        // Photo quality assessment from Vision (lighting, conditions,
        // confidence_modifier). Defaults to {} when older clients send no
        // photo_quality block (backward compatible).
        // scorer_version 2 = scored from the photo alone, description only
        // (Nov 14 2026). Earlier rows were scored with the profile in the prompt
        // and their notes carry advice, so the two are not like for like.
        photo_quality: { ...(analysis.photo_quality || {}), scorer_version: GLASS_SKIN_SCORER_VERSION },
        // Phase 13.D
        treatment_phase_id: activePhaseId,
        photo_url: storedPhotoPath,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Failed to save glass skin score:', insertError)
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
