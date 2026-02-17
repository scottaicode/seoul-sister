import { NextResponse } from 'next/server'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { getServiceClient } from '@/lib/supabase'

// POST /api/cron/seasonal-adjustments
// Monthly: Adjust routine recommendations for seasonal skin changes
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      // Get current effective ingredients for this climate
      const { data: patterns } = await db
        .from('ss_learning_patterns')
        .select('*')
        .eq('pattern_type', 'seasonal')
        .eq('skin_type', climate)
        .order('updated_at', { ascending: false })
        .limit(1)

      // Only regenerate if no recent pattern (within 25 days)
      if (
        patterns &&
        patterns.length > 0 &&
        new Date(patterns[0].updated_at).getTime() >
          Date.now() - 25 * 24 * 60 * 60 * 1000
      ) {
        continue
      }

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
      if (block.type !== 'text') continue

      try {
        const text = block.text.trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue
        const seasonalData = JSON.parse(jsonMatch[0])

        // Upsert seasonal pattern
        const { data: existing } = await db
          .from('ss_learning_patterns')
          .select('id')
          .eq('pattern_type', 'seasonal')
          .eq('skin_type', climate)
          .single()

        if (existing) {
          await db
            .from('ss_learning_patterns')
            .update({
              data: seasonalData,
              pattern_description: `${season} skincare adjustments for ${climate} climates`,
              confidence_score: 0.85,
              sample_size: 1,
            })
            .eq('id', existing.id)
        } else {
          await db.from('ss_learning_patterns').insert({
            pattern_type: 'seasonal',
            skin_type: climate,
            skin_concerns: [],
            concern_filter: null,
            pattern_description: `${season} skincare adjustments for ${climate} climates`,
            data: seasonalData,
            confidence_score: 0.85,
            sample_size: 1,
          })
        }

        patternsGenerated++
      } catch {
        console.error(`Failed to parse seasonal data for ${climate}`)
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
