import { NextResponse } from 'next/server'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
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

    // For each climate zone, generate seasonal skincare patterns
    for (const [climate, season] of Object.entries(climateSeasons)) {
      // Always regenerate seasonal patterns on the monthly run.
      // The Sonnet call is cheap (~$0.01 per climate zone) and seasonal
      // data should reflect the current month, not stale patterns.
      // Previously had a 25-day freshness check that caused the monthly
      // cron to skip — the check window was shorter than the cron interval.

      // Use Sonnet to generate seasonal adjustment recommendations
      const response = await client.messages.create({
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

      const block = response.content[0]
      if (block.type !== 'text') {
        console.error(`[seasonal] ${climate}: Sonnet returned non-text block type: ${block.type}`)
        continue
      }

      try {
        const text = block.text.trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.error(`[seasonal] ${climate}: No JSON found in Sonnet response: ${text.substring(0, 200)}`)
          continue
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
          console.error(`[seasonal] ${climate}: Select error: ${selectError.message}`)
          continue
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
            console.error(`[seasonal] ${climate}: Update error: ${updateError.message}`)
            continue
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
            console.error(`[seasonal] ${climate}: Insert error: ${insertError.message}`)
            continue
          }
        }

        patternsGenerated++
        console.log(`[seasonal] ${climate}/${season}: pattern generated`)
      } catch (err) {
        console.error(`[seasonal] Failed to process ${climate}: ${err instanceof Error ? err.message : String(err)}`)
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
