import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

/**
 * POST /api/cron/refresh-prices
 *
 * Runs every 6 hours (via vercel.json).
 * Two responsibilities:
 * 1. Snapshot all current prices into ss_price_history for trend analysis
 * 2. Detect significant price drops and create trend signals
 *
 * Note: Actual price SCRAPING from retailers is too slow for a cron job
 * (Vercel has a 60s timeout for cron). Heavy scraping is done via:
 * - POST /api/admin/pipeline/prices (admin API)
 * - npx tsx scripts/run-prices.ts (CLI)
 *
 * Secured with CRON_SECRET header.
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    let pricesRecorded = 0
    let trendSignals = 0

    // Get all current product prices from retailers
    const { data: currentPrices } = await db
      .from('ss_product_prices')
      .select(`
        product_id,
        retailer_id,
        price_usd,
        ss_retailers(name)
      `)
      .eq('in_stock', true)

    if (!currentPrices || currentPrices.length === 0) {
      return NextResponse.json({
        success: true,
        prices_recorded: 0,
        trend_signals: 0,
        message: 'No prices to record',
      })
    }

    // Record each current price as a historical data point
    const historyRecords = currentPrices.map((price) => ({
      product_id: price.product_id,
      retailer:
        (price.ss_retailers as unknown as Record<string, string>)?.name ||
        price.retailer_id,
      price: price.price_usd,
      currency: 'USD',
      recorded_at: new Date().toISOString(),
    }))

    // Batch insert in chunks of 500 to avoid payload size limits
    for (let i = 0; i < historyRecords.length; i += 500) {
      const chunk = historyRecords.slice(i, i + 500)
      const { error } = await db.from('ss_price_history').insert(chunk)
      if (error) {
        console.error(`Price history insert error (chunk ${i}):`, error)
      } else {
        pricesRecorded += chunk.length
      }
    }

    // Detect significant price changes and create trend signals
    // Only check a sample (100 max) to stay within cron timeout
    const sampled = currentPrices.slice(0, 100)

    for (const price of sampled) {
      const retailerName =
        (price.ss_retailers as unknown as Record<string, string>)?.name ||
        price.retailer_id

      // Get the previous price (second-to-last) for comparison
      const { data: previousPrices } = await db
        .from('ss_price_history')
        .select('price')
        .eq('product_id', price.product_id)
        .eq('retailer', retailerName)
        .order('recorded_at', { ascending: false })
        .limit(2)

      // Need at least 2 records (current snapshot + previous)
      if (!previousPrices || previousPrices.length < 2) continue

      const previousPrice = previousPrices[1].price as number
      if (!previousPrice || previousPrice <= 0) continue

      const priceDiff = Number(price.price_usd) - previousPrice
      const pctChange = Math.abs(priceDiff) / previousPrice

      // Flag significant price drops (>10%) as trend signals
      if (priceDiff < 0 && pctChange > 0.1) {
        await db.from('ss_trend_signals').insert({
          source: 'price_tracker',
          keyword: `price_drop_${price.product_id}`,
          trend_name: `Price Drop: ${Math.round(pctChange * 100)}% off`,
          trend_type: 'product_category',
          signal_strength: Math.round(pctChange * 100),
          status: 'emerging',
          data: {
            product_id: price.product_id,
            retailer: retailerName,
            old_price: previousPrice,
            new_price: price.price_usd,
            pct_change: -pctChange,
          },
        })
        trendSignals++
      }
    }

    // Report stale prices (not checked in 7+ days) for monitoring
    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: stalePrices } = await db
      .from('ss_product_prices')
      .select('*', { count: 'exact', head: true })
      .lt('last_checked', staleThreshold)

    return NextResponse.json({
      success: true,
      prices_recorded: pricesRecorded,
      trend_signals: trendSignals,
      stale_prices: stalePrices ?? 0,
      refreshed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Refresh prices error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh prices' },
      { status: 500 }
    )
  }
}
