import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceRetailer, PricePipelineStats, PriceScrapeOptions, ScrapedPrice } from './types'
import { PriceMatcher, normalize, tokenSimilarity, brandsMatch } from './price-matcher'
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

    console.warn(`[price-pipeline] Starting ${options.retailer} price scrape`)

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
    console.warn(`[price-pipeline] ${products.length} products to search on ${options.retailer}`)

    // Initialize the scraper for this retailer
    const scraper = this.getScraper(options.retailer)

    // Process products in sequence (respecting rate limits)
    for (let i = 0; i < products.length; i++) {
      // Time-budget guard: stop before exceeding serverless timeout
      if (options.timeout_ms && options.started_at) {
        const elapsed = Date.now() - options.started_at
        if (elapsed > options.timeout_ms) {
          console.warn(`[price-pipeline] Time budget exhausted (${elapsed}ms > ${options.timeout_ms}ms), stopping after ${i} products`)
          break
        }
      }

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
        console.warn(
          `[price-pipeline] ${options.retailer} progress: ${i + 1}/${products.length} searched, ` +
          `${stats.prices_matched} matched, ${stats.prices_new} new, ${stats.prices_updated} updated, ${stats.errors.length} errors`
        )
      }
    }

    // Cleanup browser instances
    await this.cleanup()

    console.warn(`[price-pipeline] ${options.retailer} complete:`, JSON.stringify(stats, null, 2))
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
   *
   * Since we searched by this product's brand + name, scraped results should
   * be for this product. We score each scraped result against the TARGET
   * product directly (not the full 6,225-product catalog) and pick the best.
   */
  private findBestMatch(
    scrapedPrices: ScrapedPrice[],
    product: ProductForPricing
  ): import('./types').PriceMatch | null {
    const productNameNorm = normalize(product.name_en)
    const productBrandNorm = normalize(product.brand_en)

    let bestScraped: ScrapedPrice | null = null
    let bestScore = 0
    let bestMethod: import('./types').PriceMatch['match_method'] = 'fuzzy'

    for (const scraped of scrapedPrices) {
      if (!scraped.price_usd || scraped.price_usd <= 0) continue

      const scrapedNameNorm = normalize(scraped.product_name)
      const scrapedBrandNorm = normalize(scraped.brand)

      // Check brand match first
      const brandOk = brandsMatch(productBrandNorm, scrapedBrandNorm)
      if (!brandOk) continue

      // Score: token similarity between scraped name and our product name
      let score = tokenSimilarity(productNameNorm, scrapedNameNorm)

      // Boost if one name contains the other (handles "Snail Mucin" vs "Advanced Snail 96 Mucin Power Essence")
      if (productNameNorm.includes(scrapedNameNorm) || scrapedNameNorm.includes(productNameNorm)) {
        score = Math.max(score, 0.7)
      }

      // Exact normalized match
      if (productNameNorm === scrapedNameNorm) {
        score = 1.0
      }

      if (score > bestScore) {
        bestScore = score
        bestScraped = scraped
        bestMethod = score >= 0.9 ? 'exact' : score >= 0.5 ? 'brand_name' : 'fuzzy'
      }
    }

    // Require minimum 0.3 similarity — we already know brand matches and we
    // searched for this specific product, so even low token overlap is likely valid
    if (!bestScraped || bestScore < 0.3) return null

    return {
      product_id: product.id,
      product_name: product.name_en,
      product_brand: product.brand_en,
      retailer: bestScraped.retailer as PriceRetailer,
      retailer_id: '', // Set by caller
      price_usd: bestScraped.price_usd!,
      price_krw: bestScraped.price_krw,
      url: bestScraped.url,
      in_stock: bestScraped.in_stock,
      confidence: bestScore,
      match_method: bestMethod,
    }
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
    // Prioritize brands that this retailer is known to carry.

    // Step 1: Get products that have a recent price from this retailer (skip these)
    const staleThreshold = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString()
    const { data: recentlyPriced } = await supabase
      .from('ss_product_prices')
      .select('product_id')
      .eq('retailer_id', retailerId)
      .gte('last_checked', staleThreshold)

    const recentIds = new Set((recentlyPriced ?? []).map(r => r.product_id))

    // Step 2: Get brands this retailer already carries (from existing price records)
    const { data: retailerBrands } = await supabase
      .from('ss_product_prices')
      .select('product:ss_products(brand_en)')
      .eq('retailer_id', retailerId)

    const knownBrands = new Set<string>()
    for (const row of retailerBrands ?? []) {
      const brand = (row.product as unknown as { brand_en: string })?.brand_en
      if (brand) knownBrands.add(brand)
    }

    // Step 3: Fetch products — prioritize known brands, then popular products
    const candidates: ProductForPricing[] = []

    // 3a: Products from brands this retailer carries (highest priority)
    if (knownBrands.size > 0) {
      const { data: brandProducts } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category')
        .in('brand_en', Array.from(knownBrands))
        .order('rating_avg', { ascending: false, nullsFirst: false })
        .limit(batchSize * 3)

      if (brandProducts) candidates.push(...brandProducts)
    }

    // 3b: Fill remaining slots with other highly-rated products
    if (candidates.length < batchSize * 2) {
      const { data: otherProducts } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category')
        .order('rating_avg', { ascending: false, nullsFirst: false })
        .limit(batchSize * 3)

      if (otherProducts) {
        const existingIds = new Set(candidates.map(c => c.id))
        for (const p of otherProducts) {
          if (!existingIds.has(p.id)) candidates.push(p)
        }
      }
    }

    // Step 4: Filter out recently priced and limit
    return candidates
      .filter(p => !recentIds.has(p.id))
      .slice(0, batchSize)
  }
}
