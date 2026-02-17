import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// POST /api/cron/refresh-prices
// Weekly: Check retailer prices for tracked products, update ss_price_history
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getServiceClient()
    let pricesRecorded = 0

    // Get all current product prices from retailers
    const { data: currentPrices } = await db
      .from('ss_product_prices')
      .select(
        `
        product_id,
        retailer_id,
        price_usd,
        ss_retailers(name)
      `
      )
      .eq('in_stock', true)

    if (!currentPrices || currentPrices.length === 0) {
      return NextResponse.json({
        success: true,
        prices_recorded: 0,
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

    // Batch insert
    const { error } = await db
      .from('ss_price_history')
      .insert(historyRecords)

    if (error) {
      console.error('Price history insert error:', error)
    } else {
      pricesRecorded = historyRecords.length
    }

    // Detect significant price changes and create trend signals
    for (const price of currentPrices) {
      // Get previous price record for comparison
      const { data: previousPrice } = await db
        .from('ss_price_history')
        .select('price')
        .eq('product_id', price.product_id)
        .eq(
          'retailer',
          (price.ss_retailers as unknown as Record<string, string>)?.name ||
            price.retailer_id
        )
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      if (previousPrice) {
        const priceDiff = price.price_usd - (previousPrice.price as number)
        const pctChange =
          Math.abs(priceDiff) / (previousPrice.price as number)

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
              old_price: previousPrice.price,
              new_price: price.price_usd,
              pct_change: -pctChange,
            },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      prices_recorded: pricesRecorded,
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
