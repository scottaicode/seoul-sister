import { NextResponse } from 'next/server'
import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

export const maxDuration = 60

// POST /api/cron/seasonal-adjustments
// Monthly: Adjust routine recommendations for seasonal skin changes
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const client = getAnthropicClient()
    let patternsGenerated = 0

    // Determine current season per climate zone
    const now = new Date()
    const month = now.getMonth() + 1
    const climateSeasons: Record<string, string> = {
      humid: getSeasonForMonth(month, 'humid'),
      dry: getSeasonForMonth(month, 'dry'),
      temperate: getSeasonForMonth(month, 'temperate'),
      tropical: getSeasonForMonth(month, 'tropical'),
      cold: getSeasonForMonth(month, 'cold'),
    }

    // Run 5 climate zones sequentially to avoid Anthropic rate-limit
    // rejections. Each Sonnet call takes ~8-10s; sequential = ~50s total,
    // within the 60s Vercel timeout. callAnthropicWithRetry handles 429s.
    const errors: string[] = []

    for (const [climate, season] of Object.entries(climateSeasons)) {
      try {
        const response = await callAnthropicWithRetry(() =>
          client.messages.create({
            model: MODELS.background,
            max_tokens: 500,
            messages: [
              {
                role: 'user',
                content: `Generate K-beauty seasonal skincare adjustment recommendations for:
- Climate: ${climate}
- Current season: ${season}
- Month: ${month}

Return JSON with these fields:
{
  "season": "${season}",
  "climate": "${climate}",
  "texture_advice": "lighter/heavier textures recommendation",
  "ingredients_to_emphasize": ["ingredient1", "ingredient2"],
  "ingredients_to_reduce": ["ingredient1"],
  "routine_adjustments": ["adjustment1", "adjustment2"],
  "spf_advice": "seasonal SPF guidance",
  "hydration_advice": "seasonal hydration tips"
}

Return ONLY valid JSON.`,
              },
            ],
          })
        )

        const block = response.content[0]
        if (block.type !== 'text') {
          throw new Error(`Sonnet returned non-text block type: ${block.type}`)
        }

        const text = block.text.trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error(`No JSON found in Sonnet response: ${text.substring(0, 200)}`)
        }
        const seasonalData = JSON.parse(jsonMatch[0])

        // Upsert seasonal pattern — use maybeSingle to avoid throwing on 0 rows
        const { data: existing, error: selectError } = await db
          .from('ss_learning_patterns')
          .select('id')
          .eq('pattern_type', 'seasonal')
          .eq('skin_type', climate)
          .maybeSingle()

        if (selectError) {
          throw new Error(`Select error: ${selectError.message}`)
        }

        if (existing) {
          const { error: updateError } = await db
            .from('ss_learning_patterns')
            .update({
              data: seasonalData,
              pattern_description: `${season} skincare adjustments for ${climate} climates`,
              confidence_score: 0.85,
              sample_size: 1,
            })
            .eq('id', existing.id)
          if (updateError) {
            throw new Error(`Update error: ${updateError.message}`)
          }
        } else {
          const { error: insertError } = await db.from('ss_learning_patterns').insert({
            pattern_type: 'seasonal',
            skin_type: climate,
            skin_concerns: [],
            concern_filter: null,
            pattern_description: `${season} skincare adjustments for ${climate} climates`,
            data: seasonalData,
            confidence_score: 0.85,
            sample_size: 1,
          })
          if (insertError) {
            throw new Error(`Insert error: ${insertError.message}`)
          }
        }

        patternsGenerated++
        console.log(`[seasonal] ${climate}/${season}: pattern generated`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${climate}: ${msg}`)
        console.error(`[seasonal] Failed to process ${climate}: ${msg}`)
      }
    }

    return NextResponse.json({
      success: true,
      patterns_generated: patternsGenerated,
      seasons: climateSeasons,
      processed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Seasonal adjustments error:', error)
    return NextResponse.json(
      { error: 'Failed to generate seasonal adjustments' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeasonForMonth(
  month: number,
  climate: string
): string {
  // Northern hemisphere seasons (where most K-beauty consumers are)
  if (climate === 'tropical') return 'tropical' // No seasons in tropical

  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

// Vercel cron jobs send GET requests
export { POST as GET }
