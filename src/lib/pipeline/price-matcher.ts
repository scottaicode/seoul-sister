import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScrapedPrice, PriceMatch, PriceRetailer } from './types'

/** Cached product data for matching */
interface ProductRecord {
  id: string
  name_en: string
  brand_en: string
  category: string
  name_normalized: string
  brand_normalized: string
}

/** Retailer ID cache (name -> UUID) */
const retailerIdCache = new Map<string, string>()

/** Retailer name -> ss_retailers.name mapping */
const RETAILER_DB_NAMES: Record<PriceRetailer, string> = {
  olive_young: 'Olive Young',
  yesstyle: 'YesStyle',
  soko_glam: 'Soko Glam',
  amazon: 'Amazon',
  stylekorean: 'StyleKorean',
  iherb: 'iHerb',
  stylevana: 'Stylevana',
}

/**
 * Normalize a string for comparison: lowercase, remove special chars, collapse spaces.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')   // remove parentheticals
    .replace(/[^a-z0-9\s]/g, ' ')        // keep only alphanumeric + space
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compute a simple token-overlap similarity between two normalized strings.
 * Returns 0-1 where 1 = perfect match.
 */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(t => t.length > 1))
  const tokensB = new Set(b.split(' ').filter(t => t.length > 1))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let overlap = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++
  }

  // Jaccard-like: overlap / union
  const union = new Set([...tokensA, ...tokensB]).size
  return overlap / union
}

/**
 * Check if brand strings match (normalized).
 * Handles common variations like "COSRX" vs "Cosrx", "Dr. Jart+" vs "Dr Jart".
 */
function brandsMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  // Check if one contains the other (handles "The Face Shop" vs "face shop")
  if (na.includes(nb) || nb.includes(na)) return true
  return false
}

/**
 * Price matcher that finds the best matching Seoul Sister product
 * for a scraped retailer price using fuzzy matching.
 */
export class PriceMatcher {
  private products: ProductRecord[] = []
  private productsByBrand: Map<string, ProductRecord[]> = new Map()
  private loaded = false

  /**
   * Load all products from the database into memory for matching.
   * Should be called once before a batch of matches.
   */
  async loadProducts(supabase: SupabaseClient): Promise<number> {
    this.products = []
    this.productsByBrand = new Map()

    // Paginate through all products (5500+)
    const PAGE_SIZE = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category')
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw new Error(`Failed to load products: ${error.message}`)
      if (!data || data.length === 0) break

      for (const row of data) {
        const record: ProductRecord = {
          id: row.id,
          name_en: row.name_en,
          brand_en: row.brand_en,
          category: row.category,
          name_normalized: normalize(row.name_en),
          brand_normalized: normalize(row.brand_en),
        }
        this.products.push(record)

        const brandKey = record.brand_normalized
        if (!this.productsByBrand.has(brandKey)) {
          this.productsByBrand.set(brandKey, [])
        }
        this.productsByBrand.get(brandKey)!.push(record)
      }

      offset += data.length
      hasMore = data.length === PAGE_SIZE
    }

    this.loaded = true
    console.log(`[price-matcher] Loaded ${this.products.length} products, ${this.productsByBrand.size} brands`)
    return this.products.length
  }

  /**
   * Get the retailer UUID from ss_retailers, with caching.
   */
  async getRetailerId(supabase: SupabaseClient, retailer: PriceRetailer): Promise<string | null> {
    const dbName = RETAILER_DB_NAMES[retailer]
    if (!dbName) return null

    if (retailerIdCache.has(dbName)) {
      return retailerIdCache.get(dbName)!
    }

    const { data } = await supabase
      .from('ss_retailers')
      .select('id')
      .eq('name', dbName)
      .single()

    if (data) {
      retailerIdCache.set(dbName, data.id)
      return data.id
    }
    return null
  }

  /**
   * Find the best matching product for a scraped price.
   * Returns null if no match meets the confidence threshold.
   */
  matchProduct(scraped: ScrapedPrice, minConfidence = 0.5): PriceMatch | null {
    if (!this.loaded) throw new Error('Call loadProducts() before matching')
    if (!scraped.price_usd && !scraped.price_krw) return null

    const scrapedNameNorm = normalize(scraped.product_name)
    const scrapedBrandNorm = normalize(scraped.brand)

    let bestMatch: { product: ProductRecord; confidence: number; method: PriceMatch['match_method'] } | null = null

    // Strategy 1: Exact normalized name + brand match
    for (const product of this.products) {
      if (product.brand_normalized === scrapedBrandNorm && product.name_normalized === scrapedNameNorm) {
        bestMatch = { product, confidence: 1.0, method: 'exact' }
        break
      }
    }

    // Strategy 2: Brand match + high name similarity
    if (!bestMatch) {
      // Find candidate products by brand
      const candidates: ProductRecord[] = []
      for (const [brandKey, products] of this.productsByBrand) {
        if (brandsMatch(brandKey, scrapedBrandNorm)) {
          candidates.push(...products)
        }
      }

      for (const product of candidates) {
        const nameSim = tokenSimilarity(product.name_normalized, scrapedNameNorm)
        // Also check if one name contains the other
        const containsScore = (product.name_normalized.includes(scrapedNameNorm) || scrapedNameNorm.includes(product.name_normalized))
          ? Math.max(nameSim, 0.7)
          : nameSim

        const score = containsScore
        if (score > (bestMatch?.confidence ?? 0)) {
          bestMatch = { product, confidence: score, method: 'brand_name' }
        }
      }
    }

    // Strategy 3: Fuzzy across all products (expensive, only if brand didn't match)
    if (!bestMatch || bestMatch.confidence < 0.6) {
      for (const product of this.products) {
        // Combine brand + name for full comparison
        const fullScraped = `${scrapedBrandNorm} ${scrapedNameNorm}`
        const fullProduct = `${product.brand_normalized} ${product.name_normalized}`
        const sim = tokenSimilarity(fullProduct, fullScraped)

        if (sim > (bestMatch?.confidence ?? 0)) {
          bestMatch = { product, confidence: sim, method: 'fuzzy' }
        }
      }
    }

    if (!bestMatch || bestMatch.confidence < minConfidence) return null

    return {
      product_id: bestMatch.product.id,
      product_name: bestMatch.product.name_en,
      product_brand: bestMatch.product.brand_en,
      retailer: scraped.retailer,
      retailer_id: '', // Filled in by caller
      price_usd: scraped.price_usd ?? 0,
      price_krw: scraped.price_krw ?? null,
      url: scraped.url,
      in_stock: scraped.in_stock,
      confidence: bestMatch.confidence,
      match_method: bestMatch.method,
    }
  }

  /**
   * Upsert a matched price into ss_product_prices.
   * Also records a snapshot in ss_price_history.
   */
  async upsertPrice(
    supabase: SupabaseClient,
    match: PriceMatch
  ): Promise<{ action: 'insert' | 'update' | 'skip'; priceChanged: boolean }> {
    // Check if a price record already exists for this product + retailer
    const { data: existing } = await supabase
      .from('ss_product_prices')
      .select('id, price_usd')
      .eq('product_id', match.product_id)
      .eq('retailer_id', match.retailer_id)
      .single()

    const now = new Date().toISOString()

    if (existing) {
      const oldPrice = Number(existing.price_usd)
      const priceChanged = Math.abs(oldPrice - match.price_usd) > 0.01

      // Update existing record
      await supabase
        .from('ss_product_prices')
        .update({
          price_usd: match.price_usd,
          price_krw: match.price_krw,
          url: match.url,
          in_stock: match.in_stock,
          last_checked: now,
        })
        .eq('id', existing.id)

      // Record in price history if price changed
      if (priceChanged) {
        await supabase.from('ss_price_history').insert({
          product_id: match.product_id,
          retailer: RETAILER_DB_NAMES[match.retailer],
          price: match.price_usd,
          currency: 'USD',
          recorded_at: now,
        })
      }

      return { action: 'update', priceChanged }
    }

    // Insert new price record
    const { error } = await supabase.from('ss_product_prices').insert({
      product_id: match.product_id,
      retailer_id: match.retailer_id,
      price_usd: match.price_usd,
      price_krw: match.price_krw,
      url: match.url,
      in_stock: match.in_stock,
      last_checked: now,
    })

    if (error) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505') return { action: 'skip', priceChanged: false }
      throw new Error(`Failed to insert price: ${error.message}`)
    }

    // Record initial price in history
    await supabase.from('ss_price_history').insert({
      product_id: match.product_id,
      retailer: RETAILER_DB_NAMES[match.retailer],
      price: match.price_usd,
      currency: 'USD',
      recorded_at: now,
    })

    return { action: 'insert', priceChanged: false }
  }
}
