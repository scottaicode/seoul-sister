import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceRetailer, PricePipelineStats, PriceScrapeOptions, ScrapedPrice } from './types'
import { PriceMatcher } from './price-matcher'
import { YesStyleScraper } from './sources/yesstyle'
import { SokoGlamScraper } from './sources/soko-glam'
import { AmazonScraper } from './sources/amazon'
import { StyleKoreanScraper } from './sources/stylekorean'

/** Product row for price search */
interface ProductForPricing {
  id: string
  name_en: string
  brand_en: string
  category: string
}

/**
 * Orchestrates multi-retailer price scraping.
 *
 * For each product in the batch:
 * 1. Searches the target retailer for the product (by brand + name)
 * 2. Uses PriceMatcher to fuzzy-match results to our product database
 * 3. Upserts matched prices into ss_product_prices + ss_price_history
 *
 * Handles all 4 retailer scrapers: YesStyle, Soko Glam, Amazon, StyleKorean.
 */
export class PricePipeline {
  private matcher: PriceMatcher
  private yesstyle: YesStyleScraper | null = null
  private sokoGlam: SokoGlamScraper | null = null
  private amazon: AmazonScraper | null = null
  private stylekorean: StyleKoreanScraper | null = null

  constructor() {
    this.matcher = new PriceMatcher()
  }

  /**
   * Run the price pipeline for a specific retailer.
   * Fetches products needing prices and scrapes the retailer for each.
   */
  async run(
    supabase: SupabaseClient,
    options: PriceScrapeOptions
  ): Promise<PricePipelineStats> {
    const stats: PricePipelineStats = {
      retailer: options.retailer,
      products_searched: 0,
      prices_found: 0,
      prices_matched: 0,
      prices_updated: 0,
      prices_new: 0,
      errors: [],
    }

    console.log(`[price-pipeline] Starting ${options.retailer} price scrape`)

    // Load product catalog for matching
    await this.matcher.loadProducts(supabase)

    // Get retailer UUID
    const retailerId = await this.matcher.getRetailerId(supabase, options.retailer)
    if (!retailerId) {
      stats.errors.push(`Retailer ${options.retailer} not found in ss_retailers`)
      return stats
    }

    // Fetch products to search for
    const products = await this.getProductsForPricing(supabase, options, retailerId)
    console.log(`[price-pipeline] ${products.length} products to search on ${options.retailer}`)

    // Initialize the scraper for this retailer
    const scraper = this.getScraper(options.retailer)

    // Process products in sequence (respecting rate limits)
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      stats.products_searched++

      try {
        // Search the retailer
        const scrapedPrices = await scraper.searchProduct(product.brand_en, product.name_en)

        if (scrapedPrices.length === 0) {
          continue
        }

        stats.prices_found += scrapedPrices.length

        // Try to match the best result to our product
        const bestMatch = this.findBestMatch(scrapedPrices, product)
        if (!bestMatch) continue

        stats.prices_matched++

        // Set the retailer_id before upserting
        bestMatch.retailer_id = retailerId

        // Upsert into database
        const result = await this.matcher.upsertPrice(supabase, bestMatch)
        if (result.action === 'insert') stats.prices_new++
        if (result.action === 'update') stats.prices_updated++

      } catch (error) {
        const msg = `Product ${product.name_en}: ${error instanceof Error ? error.message : error}`
        stats.errors.push(msg)
        console.error(`[price-pipeline] ${msg}`)
      }

      // Log progress every 25 products
      if ((i + 1) % 25 === 0 || i === products.length - 1) {
        console.log(
          `[price-pipeline] ${options.retailer} progress: ${i + 1}/${products.length} searched, ` +
          `${stats.prices_matched} matched, ${stats.prices_new} new, ${stats.prices_updated} updated`
        )
      }
    }

    // Cleanup browser instances
    await this.cleanup()

    console.log(`[price-pipeline] ${options.retailer} complete:`, JSON.stringify(stats, null, 2))
    return stats
  }

  /**
   * Run price scraping across ALL retailers for a batch of products.
   */
  async runAll(
    supabase: SupabaseClient,
    options: Omit<PriceScrapeOptions, 'retailer'>
  ): Promise<PricePipelineStats[]> {
    const retailers: PriceRetailer[] = ['yesstyle', 'soko_glam', 'stylekorean', 'amazon']
    const allStats: PricePipelineStats[] = []

    for (const retailer of retailers) {
      try {
        const stats = await this.run(supabase, { ...options, retailer })
        allStats.push(stats)
      } catch (error) {
        console.error(`[price-pipeline] Retailer ${retailer} failed:`, error instanceof Error ? error.message : error)
        allStats.push({
          retailer,
          products_searched: 0,
          prices_found: 0,
          prices_matched: 0,
          prices_updated: 0,
          prices_new: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        })
      }
    }

    return allStats
  }

  /** Clean up browser instances */
  async cleanup(): Promise<void> {
    await this.yesstyle?.close()
    await this.amazon?.close()
    await this.stylekorean?.close()
    this.yesstyle = null
    this.sokoGlam = null
    this.amazon = null
    this.stylekorean = null
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Get or create the scraper for a retailer.
   * Returns an object with a searchProduct(brand, name) method.
   */
  private getScraper(retailer: PriceRetailer): { searchProduct(brand: string, name: string): Promise<ScrapedPrice[]> } {
    switch (retailer) {
      case 'yesstyle':
        if (!this.yesstyle) this.yesstyle = new YesStyleScraper()
        return this.yesstyle
      case 'soko_glam':
        if (!this.sokoGlam) this.sokoGlam = new SokoGlamScraper()
        return this.sokoGlam
      case 'amazon':
        if (!this.amazon) this.amazon = new AmazonScraper()
        return this.amazon
      case 'stylekorean':
        if (!this.stylekorean) this.stylekorean = new StyleKoreanScraper()
        return this.stylekorean
      default:
        throw new Error(`Unsupported retailer for price scraping: ${retailer}`)
    }
  }

  /**
   * Find the best matching scraped price for a given product.
   * Uses the PriceMatcher for fuzzy matching, with a preference for
   * results that match brand AND name.
   */
  private findBestMatch(
    scrapedPrices: ScrapedPrice[],
    product: ProductForPricing
  ): import('./types').PriceMatch | null {
    let best: import('./types').PriceMatch | null = null

    for (const scraped of scrapedPrices) {
      const match = this.matcher.matchProduct(scraped, 0.4)
      if (!match) continue

      // Prefer matches that match our specific product ID
      if (match.product_id === product.id) {
        return match // Exact product match, use immediately
      }

      // Otherwise track the best overall match
      if (!best || match.confidence > best.confidence) {
        best = match
      }
    }

    // Only return if the best match is for our target product
    // (avoids assigning prices to wrong products)
    if (best && best.product_id === product.id) {
      return best
    }

    // Fallback: if the best match has high confidence, create a match
    // with our product ID (the search was for this specific product)
    if (best && best.confidence >= 0.6 && scrapedPrices.length > 0) {
      // Use the first scraped price directly for this product
      const topScraped = scrapedPrices[0]
      if (topScraped.price_usd && topScraped.price_usd > 0) {
        return {
          product_id: product.id,
          product_name: product.name_en,
          product_brand: product.brand_en,
          retailer: topScraped.retailer as PriceRetailer,
          retailer_id: '', // Set by caller
          price_usd: topScraped.price_usd,
          price_krw: topScraped.price_krw,
          url: topScraped.url,
          in_stock: topScraped.in_stock,
          confidence: best.confidence,
          match_method: best.match_method,
        }
      }
    }

    return null
  }

  /**
   * Fetch products that need prices from a specific retailer.
   */
  private async getProductsForPricing(
    supabase: SupabaseClient,
    options: PriceScrapeOptions,
    retailerId: string
  ): Promise<ProductForPricing[]> {
    const batchSize = options.batch_size ?? 100
    const staleHours = options.stale_hours ?? 24

    // If specific product IDs provided, use those
    if (options.product_ids && options.product_ids.length > 0) {
      const { data } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category')
        .in('id', options.product_ids)

      return data ?? []
    }

    // If specific brands provided, filter by those
    if (options.brands && options.brands.length > 0) {
      const { data } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category')
        .in('brand_en', options.brands)
        .limit(batchSize)

      return data ?? []
    }

    // Default: find products that DON'T have a recent price from this retailer
    // This is a two-step query since Supabase doesn't support complex NOT EXISTS easily

    // Step 1: Get products that have a recent price from this retailer
    const staleThreshold = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString()
    const { data: recentlyPriced } = await supabase
      .from('ss_product_prices')
      .select('product_id')
      .eq('retailer_id', retailerId)
      .gte('last_checked', staleThreshold)

    const recentIds = new Set((recentlyPriced ?? []).map(r => r.product_id))

    // Step 2: Get products not in that set
    // Prioritize: popular brands, products with ratings, products already having some prices
    const { data: products } = await supabase
      .from('ss_products')
      .select('id, name_en, brand_en, category')
      .not('price_usd', 'is', null)
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(batchSize * 2) // Fetch more to filter down after excluding recent

    if (!products) return []

    // Filter out recently priced and limit
    return products
      .filter(p => !recentIds.has(p.id))
      .slice(0, batchSize)
  }
}
