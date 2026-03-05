import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { PricePipeline } from '@/lib/pipeline/price-pipeline'

/**
 * POST /api/cron/refresh-prices-yesstyle
 *
 * Runs daily at 6 PM UTC (via vercel.json).
 * Dedicated to YesStyle (Playwright browser scraping).
 *
 * 300s budget (Vercel Pro) for YesStyle:
 * - ~10s Playwright cold start
 * - 80 products × ~3s ≈ 240s scraping
 * - Remaining time: snapshot prices to history + detect price drops
 *
 * Soko Glam has its own cron at 6 AM UTC (refresh-prices).
 * Amazon, StyleKorean are CLI-only (CAPTCHA/AJAX issues).
 *
 * Secured with CRON_SECRET header.
 */

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const startedAt = Date.now()
    const timeoutGuardMs = 280000

    let pricesRecorded = 0
    let trendSignals = 0
    const scrapeResults: Array<{ retailer: string; searched: number; matched: number; errors: number }> = []

    // ---------------------------------------------------------------
    // Phase 1: YesStyle (Playwright — full budget)
    // ---------------------------------------------------------------
    const pipeline = new PricePipeline()
    try {
      const ysStats = await pipeline.run(db, {
        retailer: 'yesstyle',
        batch_size: 80,
        stale_hours: 24,
      })
      scrapeResults.push({
        retailer: 'yesstyle',
        searched: ysStats.products_searched,
        matched: ysStats.prices_matched,
        errors: ysStats.errors.length,
      })
    } catch (error) {
      console.error('[cron:refresh-prices-yesstyle] YesStyle scrape failed:', error instanceof Error ? error.message : error)
      scrapeResults.push({ retailer: 'yesstyle', searched: 0, matched: 0, errors: 1 })
    } finally {
      await pipeline.cleanup()
    }

    // ---------------------------------------------------------------
    // Phase 2: Snapshot all prices to history
    // ---------------------------------------------------------------
    const elapsedAfterScrape = Date.now() - startedAt
    if (elapsedAfterScrape < timeoutGuardMs) {
      const { data: currentPrices } = await db
        .from('ss_product_prices')
        .select(`
          product_id,
          retailer_id,
          price_usd,
          ss_retailers(name)
        `)
        .eq('in_stock', true)

      if (currentPrices && currentPrices.length > 0) {
        const historyRecords = currentPrices.map((price) => ({
          product_id: price.product_id,
          retailer:
            (price.ss_retailers as unknown as Record<string, string>)?.name ||
            price.retailer_id,
          price: price.price_usd,
          currency: 'USD',
          recorded_at: new Date().toISOString(),
        }))

        for (let i = 0; i < historyRecords.length; i += 500) {
          if (Date.now() - startedAt > timeoutGuardMs) break
          const chunk = historyRecords.slice(i, i + 500)
          const { error } = await db.from('ss_price_history').insert(chunk)
          if (error) {
            console.error(`Price history insert error (chunk ${i}):`, error)
          } else {
            pricesRecorded += chunk.length
          }
        }

        // ---------------------------------------------------------------
        // Phase 3: Detect price drops
        // ---------------------------------------------------------------
        const elapsedAfterSnapshot = Date.now() - startedAt
        if (elapsedAfterSnapshot < timeoutGuardMs) {
          const sampled = currentPrices.slice(0, 20)

          for (const price of sampled) {
            if (Date.now() - startedAt > timeoutGuardMs) break

            const retailerName =
              (price.ss_retailers as unknown as Record<string, string>)?.name ||
              price.retailer_id

            const { data: previousPrices } = await db
              .from('ss_price_history')
              .select('price')
              .eq('product_id', price.product_id)
              .eq('retailer', retailerName)
              .order('recorded_at', { ascending: false })
              .limit(2)

            if (!previousPrices || previousPrices.length < 2) continue

            const previousPrice = previousPrices[1].price as number
            if (!previousPrice || previousPrice <= 0) continue

            const priceDiff = Number(price.price_usd) - previousPrice
            const pctChange = Math.abs(priceDiff) / previousPrice

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
        }
      }
    }

    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: stalePrices } = await db
      .from('ss_product_prices')
      .select('*', { count: 'exact', head: true })
      .lt('last_checked', staleThreshold)

    return NextResponse.json({
      success: true,
      scrape_results: scrapeResults,
      prices_recorded: pricesRecorded,
      trend_signals: trendSignals,
      stale_prices: stalePrices ?? 0,
      duration_ms: Date.now() - startedAt,
      refreshed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Refresh YesStyle prices error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh YesStyle prices' },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
