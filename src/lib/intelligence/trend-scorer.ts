/**
 * Trend Gap Scorer
 *
 * Calculates gap scores for products that are trending in Korean sales
 * (Olive Young bestsellers) but have low awareness in English-language
 * communities (Reddit mentions). The gap score identifies "about to trend
 * in the US" products — Seoul Sister's unique intelligence.
 *
 * Gap score 0-100:
 *   0   = equally known in Korea and the US
 *   100 = trending in Korea, completely unknown in the US
 *
 * Designed to run as a cron job after both Olive Young and Reddit scans.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GapScoreResult {
  updated: number
  emerging_count: number  // products with gap_score > 50
  overlap_count: number   // products appearing in both sources
  errors: string[]
}

interface OliveYoungRow {
  id: string
  product_id: string | null
  source_product_name: string | null
  source_product_brand: string | null
  rank_position: number | null
  trend_score: number
}

interface RedditRow {
  product_id: string
  mention_count: number
  trend_score: number
}

// ---------------------------------------------------------------------------
// Gap score calculation
// ---------------------------------------------------------------------------

/**
 * Calculate gap score for a single Olive Young trending product.
 *
 * High Korea rank + low Reddit mentions = high gap score.
 * Formula: koreanTrendScore × (1 - min(redditMentionCount / SATURATION, 1))
 *
 * SATURATION controls how many Reddit mentions it takes to consider a product
 * "well known" in the US. At 100+ mentions, gap is effectively 0.
 */
const REDDIT_SATURATION = 50

export function calculateGapScore(
  koreanTrendScore: number,
  redditMentionCount: number
): number {
  const awarenessRatio = Math.min(redditMentionCount / REDDIT_SATURATION, 1)
  const raw = koreanTrendScore * (1 - awarenessRatio)
  return Math.min(100, Math.max(0, Math.round(raw)))
}

// ---------------------------------------------------------------------------
// Batch gap score calculation
// ---------------------------------------------------------------------------

/**
 * Calculate and update gap scores for all Olive Young trending products.
 *
 * Cross-references each Olive Young bestseller against Reddit mention data.
 * Products with no Reddit presence get the highest gap scores (= most emerging).
 * Products well-known on Reddit get gap_score near 0.
 */
export async function calculateGapScores(
  supabase: SupabaseClient
): Promise<GapScoreResult> {
  const result: GapScoreResult = {
    updated: 0,
    emerging_count: 0,
    overlap_count: 0,
    errors: [],
  }

  // 1. Fetch all Olive Young trending entries
  const { data: oliveYoungRows, error: oyError } = await supabase
    .from('ss_trending_products')
    .select('id, product_id, source_product_name, source_product_brand, rank_position, trend_score')
    .eq('source', 'olive_young')
    .order('rank_position', { ascending: true })

  if (oyError) {
    result.errors.push(`Failed to fetch Olive Young trends: ${oyError.message}`)
    return result
  }

  if (!oliveYoungRows || oliveYoungRows.length === 0) {
    return result
  }

  // 2. Fetch all Reddit trending entries (indexed by product_id)
  const { data: redditRows, error: rError } = await supabase
    .from('ss_trending_products')
    .select('product_id, mention_count, trend_score')
    .eq('source', 'reddit')

  if (rError) {
    result.errors.push(`Failed to fetch Reddit trends: ${rError.message}`)
    return result
  }

  const redditByProductId = new Map<string, RedditRow>()
  for (const row of (redditRows ?? []) as RedditRow[]) {
    if (row.product_id) {
      redditByProductId.set(row.product_id, row)
    }
  }

  // 3. Also build a brand-name lookup for Olive Young entries without product_id
  // (unmatched products). Check if any Reddit entry shares the same brand+name.
  const redditByName = new Map<string, RedditRow>()
  // We don't have source_product_name on Reddit rows in the same way,
  // so brand-name matching is only possible via product_id overlap.

  // 4. Calculate gap scores for each Olive Young row
  for (const oy of oliveYoungRows as OliveYoungRow[]) {
    let redditMentions = 0

    if (oy.product_id) {
      const redditMatch = redditByProductId.get(oy.product_id)
      if (redditMatch) {
        redditMentions = redditMatch.mention_count
        result.overlap_count++
      }
    }
    // Products without product_id (not in our DB) have 0 Reddit mentions by definition

    const gapScore = calculateGapScore(oy.trend_score, redditMentions)

    // Update the row
    const { error: updateError } = await supabase
      .from('ss_trending_products')
      .update({ gap_score: gapScore })
      .eq('id', oy.id)

    if (updateError) {
      result.errors.push(
        `Failed to update gap_score for ${oy.source_product_name}: ${updateError.message}`
      )
    } else {
      result.updated++
      if (gapScore > 50) {
        result.emerging_count++
      }
    }
  }

  console.log(
    `[trend-scorer] Gap scores updated: ${result.updated} products, ` +
    `${result.emerging_count} emerging (gap>50), ` +
    `${result.overlap_count} overlap with Reddit`
  )

  return result
}
