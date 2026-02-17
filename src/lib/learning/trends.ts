import { getServiceClient } from '@/lib/supabase'
import type { TrendSignal } from '@/types/database'

// ---------------------------------------------------------------------------
// Trend detection and analysis
// Identifies emerging K-beauty trends from community activity,
// review volume, and search patterns
// ---------------------------------------------------------------------------

/**
 * Detect emerging trend signals from community activity.
 * Called by the scan-trends cron job daily.
 */
export async function detectTrendSignals(): Promise<{
  new_signals: number
  updated_signals: number
}> {
  const db = getServiceClient()
  let newSignals = 0
  let updatedSignals = 0

  // 1. Detect trends from review volume spikes
  // Products getting significantly more reviews recently than their baseline
  const { data: recentReviews } = await db
    .from('ss_reviews')
    .select('product_id, ss_products(name_en, brand_en, category)')
    .gte(
      'created_at',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    )

  if (recentReviews && recentReviews.length > 0) {
    // Count reviews per product in last 7 days
    const reviewCounts = new Map<string, { count: number; product: Record<string, string> }>()
    for (const r of recentReviews) {
      const existing = reviewCounts.get(r.product_id)
      const product = r.ss_products as unknown as Record<string, string>
      if (existing) {
        existing.count++
      } else {
        reviewCounts.set(r.product_id, { count: 1, product })
      }
    }

    // Products with 3+ reviews in a week are trending signals
    for (const [productId, { count, product }] of reviewCounts) {
      if (count >= 3 && product) {
        const result = await upsertTrendSignal(db, {
          source: 'community',
          keyword: product.name_en || productId,
          trend_name: `${product.name_en} by ${product.brand_en}`,
          trend_type: 'product_category',
          signal_strength: count * 10,
          data: { product_id: productId, review_count_7d: count },
        })
        if (result === 'new') newSignals++
        else if (result === 'updated') updatedSignals++
      }
    }
  }

  // 2. Detect trends from "holy grail" reaction clusters
  const { data: holyGrails } = await db
    .from('ss_reviews')
    .select('product_id, ss_products(name_en, brand_en)')
    .eq('reaction', 'holy_grail')
    .gte(
      'created_at',
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    )

  if (holyGrails && holyGrails.length > 0) {
    const hgCounts = new Map<string, { count: number; product: Record<string, string> }>()
    for (const r of holyGrails) {
      const existing = hgCounts.get(r.product_id)
      const product = r.ss_products as unknown as Record<string, string>
      if (existing) {
        existing.count++
      } else {
        hgCounts.set(r.product_id, { count: 1, product })
      }
    }

    for (const [productId, { count, product }] of hgCounts) {
      if (count >= 2 && product) {
        const result = await upsertTrendSignal(db, {
          source: 'community',
          keyword: `${product.name_en} holy grail`,
          trend_name: `${product.name_en} (Holy Grail)`,
          trend_type: 'product_category',
          signal_strength: count * 15,
          data: { product_id: productId, holy_grail_count_30d: count },
        })
        if (result === 'new') newSignals++
        else if (result === 'updated') updatedSignals++
      }
    }
  }

  // 3. Detect ingredient trends from specialist insights
  const { data: insights } = await db
    .from('ss_specialist_insights')
    .select('data')
    .eq('specialist_type', 'ingredient_analyst')
    .gte(
      'created_at',
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    )

  if (insights && insights.length > 0) {
    const ingredientMentions = new Map<string, number>()
    for (const insight of insights) {
      const data = insight.data as Record<string, unknown>
      const ingredients = (data?.ingredients_discussed as string[]) || []
      for (const ing of ingredients) {
        ingredientMentions.set(
          ing.toLowerCase(),
          (ingredientMentions.get(ing.toLowerCase()) || 0) + 1
        )
      }
    }

    for (const [ingredient, count] of ingredientMentions) {
      if (count >= 3) {
        const result = await upsertTrendSignal(db, {
          source: 'community',
          keyword: ingredient,
          trend_name: ingredient,
          trend_type: 'ingredient',
          signal_strength: count * 8,
          data: { mention_count_14d: count },
        })
        if (result === 'new') newSignals++
        else if (result === 'updated') updatedSignals++
      }
    }
  }

  // 4. Update trend statuses based on signal strength changes
  await updateTrendStatuses(db)

  return { new_signals: newSignals, updated_signals: updatedSignals }
}

/**
 * Get current trending items, optionally filtered by type.
 */
export async function getCurrentTrends(
  trendType?: string,
  limit = 20
): Promise<TrendSignal[]> {
  const db = getServiceClient()

  let query = db
    .from('ss_trend_signals')
    .select('*')
    .in('status', ['emerging', 'trending'])
    .order('signal_strength', { ascending: false })
    .limit(limit)

  if (trendType) {
    query = query.eq('trend_type', trendType)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to get trends: ${error.message}`)
  return (data || []) as TrendSignal[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TrendUpsertData {
  source: string
  keyword: string
  trend_name: string
  trend_type: string
  signal_strength: number
  data: Record<string, unknown>
}

async function upsertTrendSignal(
  db: ReturnType<typeof getServiceClient>,
  signal: TrendUpsertData
): Promise<'new' | 'updated' | 'skipped'> {
  // Check if signal already exists
  const { data: existing } = await db
    .from('ss_trend_signals')
    .select('id, signal_strength')
    .eq('keyword', signal.keyword)
    .eq('source', signal.source)
    .single()

  if (existing) {
    // Update signal strength if it increased
    if (signal.signal_strength > (existing.signal_strength as number)) {
      await db
        .from('ss_trend_signals')
        .update({
          signal_strength: signal.signal_strength,
          trend_name: signal.trend_name,
          trend_type: signal.trend_type,
          data: signal.data,
        })
        .eq('id', existing.id)
      return 'updated'
    }
    return 'skipped'
  }

  // Insert new signal
  await db.from('ss_trend_signals').insert({
    source: signal.source,
    keyword: signal.keyword,
    trend_name: signal.trend_name,
    trend_type: signal.trend_type,
    signal_strength: signal.signal_strength,
    status: 'emerging',
    data: signal.data,
  })
  return 'new'
}

/**
 * Update trend statuses based on signal strength thresholds.
 */
async function updateTrendStatuses(
  db: ReturnType<typeof getServiceClient>
): Promise<void> {
  // Emerging -> Trending: signal strength >= 50
  await db
    .from('ss_trend_signals')
    .update({ status: 'trending' })
    .eq('status', 'emerging')
    .gte('signal_strength', 50)

  // Trending -> Peaked: signal strength >= 100, set peak_at if not set
  const { data: peaking } = await db
    .from('ss_trend_signals')
    .select('id')
    .eq('status', 'trending')
    .gte('signal_strength', 100)
    .is('peak_at', null)

  if (peaking) {
    for (const trend of peaking) {
      await db
        .from('ss_trend_signals')
        .update({ status: 'peaked', peak_at: new Date().toISOString() })
        .eq('id', trend.id)
    }
  }

  // Peaked for 30+ days -> Declining
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString()
  await db
    .from('ss_trend_signals')
    .update({ status: 'declining' })
    .eq('status', 'peaked')
    .lt('peak_at', thirtyDaysAgo)
}
