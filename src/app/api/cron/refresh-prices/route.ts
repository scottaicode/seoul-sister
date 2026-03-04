import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { PricePipeline } from '@/lib/pipeline/price-pipeline'

/**
 * POST /api/cron/refresh-prices
 *
 * Runs every 6 hours (via vercel.json).
 * Four responsibilities:
 * 1. Actively scrape fresh prices from Soko Glam (Shopify JSON API,
 *    no Playwright, fast and reliable) — 25 products per run
 * 2. If time budget remains (>20s), scrape YesStyle via Playwright
 *    with a small batch (5 products). Playwright cold-start is ~10s
 *    so this only runs when Soko Glam finishes quickly
 * 3. Snapshot all current prices into ss_price_history for trend analysis
 * 4. Detect significant price drops and create trend signals
 *
 * Amazon, StyleKorean are CLI-only (CAPTCHA/AJAX issues).
 *
 * Secured with CRON_SECRET header.
 */

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const startedAt = Date.now()
    const timeoutGuardMs = 52000 // Stop new work at 52s, leave 8s buffer for response

    let pricesRecorded = 0
    let trendSignals = 0
    const scrapeResults: Array<{ retailer: string; searched: number; matched: number; errors: number }> = []

    // ---------------------------------------------------------------
    // Phase 1a: Active price scraping from Soko Glam
    // Budget: ~40s (Shopify JSON API, ~1.5s per product)
    //   batch_size=25 × 1.5s ≈ 37.5s
    // ---------------------------------------------------------------
    const pipeline = new PricePipeline()
    try {
      try {
        const sokoStats = await pipeline.run(db, {
          retailer: 'soko_glam',
          batch_size: 25,
          stale_hours: 6,
        })
        scrapeResults.push({
          retailer: 'soko_glam',
          searched: sokoStats.products_searched,
          matched: sokoStats.prices_matched,
          errors: sokoStats.errors.length,
        })
      } catch (error) {
        console.error('[cron:refresh-prices] Soko Glam scrape failed:', error instanceof Error ? error.message : error)
        scrapeResults.push({ retailer: 'soko_glam', searched: 0, matched: 0, errors: 1 })
      }

      // ---------------------------------------------------------------
      // Phase 1b: YesStyle (Playwright) — time-budget conditional
      // Only runs if Soko Glam finished with >20s remaining.
      // Playwright cold-start ~10s + 5 products × ~2s = ~20s total.
      // This gives ~100 products/day across 4 runs (25 Soko + 5 YesStyle).
      // ---------------------------------------------------------------
      const elapsedAfterSoko = Date.now() - startedAt
      const yesstyleBudgetMs = 20000 // Need at least 20s for Playwright + small batch
      if (elapsedAfterSoko < timeoutGuardMs - yesstyleBudgetMs) {
        try {
          console.log(`[cron:refresh-prices] Soko Glam took ${Math.round(elapsedAfterSoko / 1000)}s — running YesStyle with remaining budget`)
          const yesStats = await pipeline.run(db, {
            retailer: 'yesstyle',
            batch_size: 5,
            stale_hours: 12, // More lenient — YesStyle prices change less frequently
          })
          scrapeResults.push({
            retailer: 'yesstyle',
            searched: yesStats.products_searched,
            matched: yesStats.prices_matched,
            errors: yesStats.errors.length,
          })
        } catch (error) {
          console.error('[cron:refresh-prices] YesStyle scrape failed:', error instanceof Error ? error.message : error)
          scrapeResults.push({ retailer: 'yesstyle', searched: 0, matched: 0, errors: 1 })
        }
      } else {
        console.log(`[cron:refresh-prices] Soko Glam took ${Math.round(elapsedAfterSoko / 1000)}s — skipping YesStyle (insufficient time budget)`)
      }
    } catch (error) {
      console.error('[cron:refresh-prices] Price pipeline error:', error instanceof Error ? error.message : error)
    } finally {
      await pipeline.cleanup()
    }

    // ---------------------------------------------------------------
    // Phase 2: Snapshot prices to history (only if time remains)
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

        // Batch insert in chunks of 500
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
        // Phase 3: Detect price drops (only if time remains)
        // ---------------------------------------------------------------
        const elapsedAfterSnapshot = Date.now() - startedAt
        if (elapsedAfterSnapshot < timeoutGuardMs) {
          // Only check a sample (20 max) to stay within timeout
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

    // Report stale prices (not checked in 7+ days) for monitoring
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
    console.error('Refresh prices error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh prices' },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
