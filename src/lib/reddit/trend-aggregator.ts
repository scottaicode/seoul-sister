/**
 * Reddit Trend Aggregator
 *
 * Takes mention scan results from the RedditMentionScanner and upserts
 * them into ss_trending_products with source='reddit'. Handles:
 * - Trend score calculation from mention velocity and sentiment
 * - Rank change tracking (compared to previous scan)
 * - Days-on-list tracking for sustained trends
 * - Operation tracking via ss_trend_data_sources
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MentionAggregate, ScanResult } from './mention-scanner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AggregateResult {
  posts_scanned: number
  mentions_found: number
  products_mentioned: number
  subreddits_scanned: number
  upserted: number
  removed: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Trend score calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a trend score (0-100) for a Reddit-mentioned product.
 *
 * Factors:
 * - Mention count: More mentions = higher score
 * - Upvote weight: High-upvote posts indicate broader awareness
 * - Sentiment: Positive sentiment boosts score
 * - Multi-subreddit: Mentions across subreddits = wider reach
 */
function calculateRedditTrendScore(agg: MentionAggregate): number {
  // Base score from mention count (logarithmic scale)
  // 1 mention = 15, 3 = 30, 5 = 40, 10 = 50, 20 = 65, 50 = 80
  const mentionScore = Math.min(80, Math.round(15 * Math.log2(agg.mention_count + 1)))

  // Upvote bonus: high-engagement posts matter more
  const avgUpvotes = agg.total_upvotes / Math.max(1, agg.mention_count)
  const upvoteBonus = avgUpvotes >= 100 ? 10 : avgUpvotes >= 50 ? 7 : avgUpvotes >= 20 ? 4 : avgUpvotes >= 5 ? 2 : 0

  // Sentiment modifier: positive sentiment boosts, negative dampens
  const sentimentModifier = (agg.avg_sentiment - 0.5) * 10 // -5 to +5

  // Multi-subreddit bonus: appearing across communities = wider reach
  const subredditBonus = Math.min(5, (agg.subreddits.length - 1) * 2.5)

  const score = mentionScore + upvoteBonus + sentimentModifier + subredditBonus
  return Math.min(100, Math.max(0, Math.round(score)))
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

/**
 * Process Reddit mention scan results and write to ss_trending_products.
 *
 * Strategy: Replace all reddit entries each scan (same as Olive Young pattern).
 * This ensures stale mentions naturally expire.
 */
export async function aggregateRedditTrends(
  supabase: SupabaseClient,
  scanResult: ScanResult
): Promise<AggregateResult> {
  const result: AggregateResult = {
    posts_scanned: scanResult.posts_scanned,
    mentions_found: scanResult.mentions_found,
    products_mentioned: scanResult.products_mentioned,
    subreddits_scanned: scanResult.subreddits_scanned,
    upserted: 0,
    removed: 0,
    errors: [...scanResult.errors],
  }

  const today = new Date().toISOString().split('T')[0]

  // 1. Create tracking record
  const { data: trackingRecord } = await supabase
    .from('ss_trend_data_sources')
    .insert({
      source: 'reddit',
      scrape_type: 'mention_scan',
      status: 'running',
    })
    .select('id')
    .single()

  const trackingId = trackingRecord?.id

  try {
    // 2. Get previous Reddit trends for rank change calculation
    const { data: previousTrends } = await supabase
      .from('ss_trending_products')
      .select('product_id, trend_score, mention_count, days_on_list, first_seen_at')
      .eq('source', 'reddit')

    const previousByProductId = new Map<string, {
      trend_score: number
      mention_count: number
      days_on_list: number | null
      first_seen_at: string | null
    }>()
    for (const t of previousTrends ?? []) {
      if (t.product_id) {
        previousByProductId.set(t.product_id, {
          trend_score: t.trend_score,
          mention_count: t.mention_count,
          days_on_list: t.days_on_list,
          first_seen_at: t.first_seen_at,
        })
      }
    }

    const previousCount = previousByProductId.size

    // 3. Delete existing reddit entries (we replace each run)
    const { count: deletedCount } = await supabase
      .from('ss_trending_products')
      .delete({ count: 'exact' })
      .eq('source', 'reddit')

    result.removed = deletedCount ?? 0

    // 4. Filter to meaningful mentions only (at least 1 mention with upvotes)
    const significantMentions = scanResult.aggregates.filter(
      agg => agg.mention_count >= 1 && agg.total_upvotes >= 2
    )

    // 5. Upsert each aggregate
    for (const agg of significantMentions) {
      const trendScore = calculateRedditTrendScore(agg)
      const prev = previousByProductId.get(agg.product_id)
      const daysOnList = prev ? (prev.days_on_list ?? 0) + 1 : 1
      const firstSeenAt = prev?.first_seen_at ?? new Date().toISOString()

      // Calculate mention change for rank tracking
      const previousMentions = prev?.mention_count ?? 0
      const mentionChange = agg.mention_count - previousMentions

      const { error: insertError } = await supabase
        .from('ss_trending_products')
        .insert({
          product_id: agg.product_id,
          source: 'reddit',
          source_product_name: agg.product_name,
          source_product_brand: agg.product_brand,
          source_url: agg.top_post_url,
          trend_score: trendScore,
          mention_count: agg.mention_count,
          sentiment_score: agg.avg_sentiment,
          days_on_list: daysOnList,
          first_seen_at: firstSeenAt,
          rank_change: mentionChange,
          data_date: today,
          raw_data: {
            weighted_mention_count: agg.weighted_mention_count,
            total_upvotes: agg.total_upvotes,
            total_comments: agg.total_comments,
            subreddits: agg.subreddits,
            top_post_title: agg.top_post_title,
            post_count: agg.posts.length,
            top_posts: agg.posts.slice(0, 5).map(p => ({
              subreddit: p.subreddit,
              score: p.score,
              url: p.url,
            })),
          },
          trending_since: firstSeenAt,
        })

      if (insertError) {
        result.errors.push(`Insert error for ${agg.product_brand} ${agg.product_name}: ${insertError.message}`)
      } else {
        result.upserted++
      }
    }

    // 6. Update tracking record
    if (trackingId) {
      await supabase
        .from('ss_trend_data_sources')
        .update({
          status: 'completed',
          items_scraped: scanResult.posts_scanned,
          items_matched: scanResult.mentions_found,
          items_new: result.upserted,
          metadata: {
            products_mentioned: scanResult.products_mentioned,
            subreddits_scanned: scanResult.subreddits_scanned,
            previous_reddit_trends: previousCount,
            significant_mentions: significantMentions.length,
            removed: result.removed,
            errors: result.errors.length,
          },
          completed_at: new Date().toISOString(),
        })
        .eq('id', trackingId)
    }

    console.log(
      `[reddit-aggregator] Complete: ${result.upserted} trends upserted ` +
      `(${result.removed} old removed), ${result.errors.length} errors`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Aggregation error: ${msg}`)
    console.error(`[reddit-aggregator] Error: ${msg}`)

    if (trackingId) {
      try {
        await supabase
          .from('ss_trend_data_sources')
          .update({
            status: 'failed',
            error_message: msg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', trackingId)
      } catch {
        // Non-fatal — tracking record update failure shouldn't mask the real error
      }
    }
  }

  return result
}
