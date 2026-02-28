import type { SupabaseClient } from '@supabase/supabase-js'
import { launchBrowser, type Browser } from '../browser'

const BASE_URL = 'https://global.oliveyoung.com'
const BESTSELLER_URL = `${BASE_URL}/display/page/best-seller`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BestsellerProduct {
  rank: number
  source_id: string
  name: string
  brand: string
  price_usd: number | null
  image_url: string | null
  source_url: string
}

export interface BestsellerScrapeResult {
  products: BestsellerProduct[]
  scrape_date: string
  source_url: string
  errors: string[]
}

export interface BestsellerMatchResult {
  bestseller: BestsellerProduct
  matched_product_id: string | null
  matched_category: string | null
  match_confidence: number
  match_method: 'exact' | 'brand_name' | 'fuzzy' | 'none'
}

// ---------------------------------------------------------------------------
// Product matching helpers (adapted from price-matcher.ts)
// ---------------------------------------------------------------------------

interface ProductRecord {
  id: string
  name_en: string
  brand_en: string
  category: string | null
  name_normalized: string
  brand_normalized: string
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(t => t.length > 1))
  const tokensB = new Set(b.split(' ').filter(t => t.length > 1))
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let overlap = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++
  }
  const union = new Set([...tokensA, ...tokensB]).size
  return overlap / union
}

function brandsMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  return false
}

// ---------------------------------------------------------------------------
// Non-skincare product filter
// ---------------------------------------------------------------------------

// Seoul Sister is a skincare intelligence platform. The Olive Young bestseller
// page includes supplements, hair tools, devices, and makeup that don't belong
// in our trending feed. Products matched in our DB with a valid skincare
// category always pass through. Unmatched products are filtered by keywords.

/** Product name patterns that indicate non-skincare items */
const NON_SKINCARE_NAME_PATTERNS = [
  // Supplements & ingestibles
  /\bjelly\b.*\bstick/i,
  /\bprotein\s+shake/i,
  /\bprobiotics?\b/i,
  /\bday[\s-]*supply\b/i,
  /\bcollagen\b.*\bstick/i,
  /\binner\s+dot\b/i,
  /\binner\s+beauty\b/i,
  /\bdietary\s+supplement/i,
  // Hair care & styling tools
  /\bhair\s+(styler|dryer|curler|iron|straightener|roller|clip)\b/i,
  /\bshampoo\b/i,
  /\bhair\s+(treatment|oil|ampoule|tonic|serum|essence)\b/i,
  /\bscalp\b/i,
  /\broot\s+enhancer/i,
  /\bdamage\s+(repair|treatment)\b/i,
  // Beauty devices / tools
  /\bems\b/i,
  /\bmassager\b/i,
  /\bbooster\s+pro\b/i,
  /\bleg[\s-]*scene\b/i,
  /\bnmode\s+pro\b/i,
  /\bleeds\s+line\b/i,
  /\bhigh\s+focus\s+shot\b/i,
  /\bage-r\b.*\b(pro|plus)\b/i,
]

/** Brands that are entirely non-skincare on Olive Young */
const NON_SKINCARE_BRANDS = new Set([
  'foodology',
  'flimeal',
  'lacto-fit',
  'lactofit',
  'bb lab',
  'vodana',
  'hugrab',
  'beaund',       // EMS beauty devices only
  'labo-h',       // Scalp/hair care only
])

/** Our skincare categories — products matched in DB with these always pass */
const SKINCARE_CATEGORIES = new Set([
  'cleanser', 'toner', 'essence', 'serum', 'ampoule', 'moisturizer',
  'sunscreen', 'mask', 'exfoliator', 'lip_care', 'eye_care', 'oil',
  'mist', 'spot_treatment',
])

/**
 * Check if a bestseller product is skincare-relevant.
 * Products matched in our DB with a valid category always pass.
 * Unmatched products are filtered by brand + name patterns.
 */
export function isSkincareProduct(
  name: string,
  brand: string,
  matchedCategory: string | null
): boolean {
  // If matched in our DB with a skincare category, always include
  if (matchedCategory && SKINCARE_CATEGORIES.has(matchedCategory)) {
    return true
  }

  // Filter out known non-skincare brands
  if (NON_SKINCARE_BRANDS.has(brand.toLowerCase().trim())) {
    return false
  }

  // Filter out products matching non-skincare name patterns
  for (const pattern of NON_SKINCARE_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return false
    }
  }

  // Default: include (could be skincare we don't have in DB yet)
  return true
}

// ---------------------------------------------------------------------------
// Bestseller Scraper
// ---------------------------------------------------------------------------

export class OliveYoungBestsellerScraper {
  private browser: Browser | null = null
  private products: ProductRecord[] = []
  private productsByBrand: Map<string, ProductRecord[]> = new Map()
  private productsLoaded = false

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await launchBrowser()
    }
    return this.browser
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * Load all products from DB into memory for fuzzy matching.
   */
  async loadProducts(supabase: SupabaseClient): Promise<number> {
    this.products = []
    this.productsByBrand = new Map()

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
          category: row.category ?? null,
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

    this.productsLoaded = true
    console.log(`[bestsellers] Loaded ${this.products.length} products for matching`)
    return this.products.length
  }

  /**
   * Scrape bestseller rankings from Olive Young Global.
   * Extracts both "Top Orders" and optionally "Top in Korea" tabs.
   */
  async scrapeBestsellers(): Promise<BestsellerScrapeResult> {
    const errors: string[] = []
    const browser = await this.ensureBrowser()
    const page = await browser.newPage()

    try {
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      console.log(`[bestsellers] Navigating to ${BESTSELLER_URL}`)
      await page.goto(BESTSELLER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Wait for Vue.js to render product cards
      await page.waitForSelector('li.prdt-unit input[name="prdtNo"]', { timeout: 15000 })
        .catch(() => {
          console.log('[bestsellers] Waiting for products timed out, trying alternate selector...')
        })
      await page.waitForTimeout(3000)

      // Extract bestseller products from the "Top Orders" section
      const products = await page.evaluate((baseUrl: string) => {
        const items: {
          rank: number
          source_id: string
          name: string
          brand: string
          price_usd: number | null
          image_url: string | null
        }[] = []

        // Try #orderBestProduct first (Top Orders tab), fall back to all prdt-unit
        const container = document.querySelector('#orderBestProduct')
        const productEls = container
          ? container.querySelectorAll('li.prdt-unit')
          : document.querySelectorAll('li.prdt-unit')

        productEls.forEach((li, index) => {
          const prdtNoInput = li.querySelector('input[name="prdtNo"]') as HTMLInputElement | null
          const prdtNameInput = li.querySelector('input[name="prdtName"]') as HTMLInputElement | null
          if (!prdtNoInput?.value || !prdtNameInput?.value) return

          const sourceId = prdtNoInput.value.trim()
          const name = prdtNameInput.value.trim()

          // Brand from brand-info dt or brand badge
          const brandDt = li.querySelector('dl.brand-info > dt, .brand-name, .prd-brand')
          const brand = brandDt ? (brandDt.textContent || '').trim() : ''

          // Price from sale price
          const saleEl = li.querySelector('.price-info strong.point, .sale-price')
          const priceText = saleEl ? (saleEl.textContent || '').replace(/[^0-9.]/g, '') : ''
          const priceUsd = priceText ? parseFloat(priceText) : null

          // Image
          const imgEl = li.querySelector('.unit-thumb img') as HTMLImageElement | null
          let imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || null
          if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl

          items.push({
            rank: index + 1,
            source_id: sourceId,
            name,
            brand,
            price_usd: priceUsd && !isNaN(priceUsd) ? Math.round(priceUsd * 100) / 100 : null,
            image_url: imageUrl,
          })
        })

        return items
      }, BASE_URL)

      const enriched: BestsellerProduct[] = products.map(p => ({
        ...p,
        source_url: `${BASE_URL}/product/detail?prdtNo=${p.source_id}`,
      }))

      console.log(`[bestsellers] Scraped ${enriched.length} bestseller products`)

      return {
        products: enriched,
        scrape_date: new Date().toISOString().split('T')[0],
        source_url: BESTSELLER_URL,
        errors,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[bestsellers] Scrape failed: ${msg}`)
      errors.push(msg)
      return { products: [], scrape_date: new Date().toISOString().split('T')[0], source_url: BESTSELLER_URL, errors }
    } finally {
      await page.close()
    }
  }

  /**
   * Match a bestseller product against the Seoul Sister product database.
   */
  matchProduct(bestseller: BestsellerProduct): BestsellerMatchResult {
    if (!this.productsLoaded) {
      throw new Error('Call loadProducts() before matching')
    }

    const scrapedNameNorm = normalize(bestseller.name)
    const scrapedBrandNorm = normalize(bestseller.brand)

    // Strategy 1: Exact normalized name + brand match
    for (const product of this.products) {
      if (product.brand_normalized === scrapedBrandNorm && product.name_normalized === scrapedNameNorm) {
        return {
          bestseller,
          matched_product_id: product.id,
          matched_category: product.category,
          match_confidence: 1.0,
          match_method: 'exact',
        }
      }
    }

    // Strategy 2: Brand match + high name token similarity
    let bestMatch: { product: ProductRecord; confidence: number } | null = null
    const candidates: ProductRecord[] = []

    for (const [brandKey, brandProducts] of this.productsByBrand) {
      if (brandsMatch(scrapedBrandNorm, brandKey)) {
        candidates.push(...brandProducts)
      }
    }

    for (const product of candidates) {
      const sim = tokenSimilarity(scrapedNameNorm, product.name_normalized)
      if (sim > 0.4 && (!bestMatch || sim > bestMatch.confidence)) {
        bestMatch = { product, confidence: sim }
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      return {
        bestseller,
        matched_product_id: bestMatch.product.id,
        matched_category: bestMatch.product.category,
        match_confidence: bestMatch.confidence,
        match_method: 'brand_name',
      }
    }

    // Strategy 3: Full fuzzy search across all products (slower)
    for (const product of this.products) {
      const sim = tokenSimilarity(scrapedNameNorm, product.name_normalized)
      const brandSim = brandsMatch(scrapedBrandNorm, product.brand_normalized)
      const combined = brandSim ? sim * 1.3 : sim * 0.7
      if (combined > 0.5 && (!bestMatch || combined > bestMatch.confidence)) {
        bestMatch = { product, confidence: combined }
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      return {
        bestseller,
        matched_product_id: bestMatch.product.id,
        matched_category: bestMatch.product.category,
        match_confidence: Math.min(bestMatch.confidence, 1.0),
        match_method: 'fuzzy',
      }
    }

    // No match found
    return {
      bestseller,
      matched_product_id: null,
      matched_category: null,
      match_confidence: 0,
      match_method: 'none',
    }
  }

  /**
   * Full pipeline: scrape bestsellers, match against DB, upsert to ss_trending_products.
   */
  async run(supabase: SupabaseClient): Promise<{
    scraped: number
    matched: number
    unmatched: number
    upserted: number
    filtered: number
    errors: string[]
  }> {
    const result = { scraped: 0, matched: 0, unmatched: 0, upserted: 0, filtered: 0, errors: [] as string[] }

    try {
      // 1. Create scrape tracking record
      const { data: scrapeRecord } = await supabase
        .from('ss_trend_data_sources')
        .insert({
          source: 'olive_young',
          scrape_type: 'bestseller',
          status: 'running',
        })
        .select('id')
        .single()

      const scrapeId = scrapeRecord?.id

      // 2. Load products for matching
      await this.loadProducts(supabase)

      // 3. Scrape bestsellers
      const scrapeResult = await this.scrapeBestsellers()
      result.scraped = scrapeResult.products.length
      result.errors.push(...scrapeResult.errors)

      if (scrapeResult.products.length === 0) {
        if (scrapeId) {
          await supabase
            .from('ss_trend_data_sources')
            .update({
              status: 'failed',
              error_message: 'No products scraped',
              completed_at: new Date().toISOString(),
            })
            .eq('id', scrapeId)
        }
        return result
      }

      const today = scrapeResult.scrape_date

      // 4. Get previous rankings for rank_change calculation
      const { data: previousTrends } = await supabase
        .from('ss_trending_products')
        .select('source_product_name, rank_position, days_on_list, first_seen_at')
        .eq('source', 'olive_young')

      const previousByName = new Map<string, {
        rank_position: number | null
        days_on_list: number | null
        first_seen_at: string | null
      }>()
      for (const t of previousTrends ?? []) {
        if (t.source_product_name) {
          previousByName.set(normalize(t.source_product_name), {
            rank_position: t.rank_position,
            days_on_list: t.days_on_list,
            first_seen_at: t.first_seen_at,
          })
        }
      }

      // 5. Delete old olive_young entries (we replace them each run)
      await supabase
        .from('ss_trending_products')
        .delete()
        .eq('source', 'olive_young')

      // 6. Match, filter, and upsert each bestseller
      for (const bestseller of scrapeResult.products) {
        const match = this.matchProduct(bestseller)

        if (match.matched_product_id) {
          result.matched++
        } else {
          result.unmatched++
        }

        // Filter out non-skincare products (supplements, hair tools, devices, etc.)
        if (!isSkincareProduct(bestseller.name, bestseller.brand, match.matched_category)) {
          result.filtered++
          console.log(`[bestsellers] Filtered non-skincare: ${bestseller.brand} - ${bestseller.name}`)
          continue
        }

        // Calculate rank change and days on list
        const prevKey = normalize(bestseller.name)
        const prev = previousByName.get(prevKey)
        const previousRank = prev?.rank_position ?? null
        const rankChange = previousRank !== null ? previousRank - bestseller.rank : null
        const daysOnList = prev ? (prev.days_on_list ?? 0) + 1 : 1
        const firstSeenAt = prev?.first_seen_at ?? new Date().toISOString()

        // Calculate trend score from rank
        const trendScore = calculateOliveYoungTrendScore(
          bestseller.rank,
          previousRank,
          daysOnList
        )

        const { error: insertError } = await supabase
          .from('ss_trending_products')
          .insert({
            product_id: match.matched_product_id,
            source: 'olive_young',
            source_product_name: bestseller.name,
            source_product_brand: bestseller.brand,
            source_url: bestseller.source_url,
            trend_score: trendScore,
            mention_count: bestseller.rank, // Use rank as "mention" for display
            sentiment_score: 0.9, // Sales data = positive sentiment
            rank_position: bestseller.rank,
            previous_rank_position: previousRank,
            rank_change: rankChange,
            days_on_list: daysOnList,
            first_seen_at: firstSeenAt,
            data_date: today,
            raw_data: {
              source_id: bestseller.source_id,
              price_usd: bestseller.price_usd,
              image_url: bestseller.image_url,
              match_confidence: match.match_confidence,
              match_method: match.match_method,
            },
            trending_since: firstSeenAt,
          })

        if (insertError) {
          result.errors.push(`Insert error for ${bestseller.name}: ${insertError.message}`)
        } else {
          result.upserted++
        }
      }

      // 7. Update scrape tracking record
      if (scrapeId) {
        await supabase
          .from('ss_trend_data_sources')
          .update({
            status: 'completed',
            items_scraped: result.scraped,
            items_matched: result.matched,
            items_new: result.upserted,
            metadata: {
              unmatched: result.unmatched,
              filtered: result.filtered,
              errors: result.errors.length,
              scrape_date: today,
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', scrapeId)
      }

      console.log(`[bestsellers] Complete: ${result.scraped} scraped, ${result.matched} matched, ${result.unmatched} unmatched, ${result.filtered} filtered (non-skincare), ${result.upserted} upserted`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      result.errors.push(msg)
      console.error(`[bestsellers] Pipeline error: ${msg}`)
    } finally {
      await this.closeBrowser()
    }

    return result
  }
}

// ---------------------------------------------------------------------------
// Trend score calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a trend score (0-100) for an Olive Young bestseller based on rank,
 * velocity (rank change), and longevity (days on list).
 */
export function calculateOliveYoungTrendScore(
  rank: number,
  previousRank: number | null,
  daysOnList: number
): number {
  // Base score from rank: #1=100, #2=97, #3=94, ... #34=1, #35+=0
  const baseScore = Math.max(0, 103 - rank * 3)

  // Velocity bonus: climbing 10+ positions = +15
  let velocityBonus = 0
  if (previousRank !== null) {
    const climb = previousRank - rank
    if (climb >= 10) velocityBonus = 15
    else if (climb >= 5) velocityBonus = 8
    else if (climb >= 2) velocityBonus = 3
  }

  // New entry bonus
  const newEntryBonus = daysOnList <= 1 ? 10 : 0

  // Sustained trend modifier: 7+ consecutive days
  const sustainedBonus = daysOnList >= 7 ? 5 : 0

  return Math.min(100, Math.max(0, baseScore + velocityBonus + newEntryBonus + sustainedBonus))
}
