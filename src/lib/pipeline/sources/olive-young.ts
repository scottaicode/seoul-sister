import type { CheerioAPI, Cheerio } from 'cheerio'
import type { AnyNode } from 'domhandler'
import { ScraperBase } from '../scraper-base'
import type {
  RawProductData,
  CategoryMapping,
  ScrapedProductListing,
  ScrapedProductDetail,
  PipelineStats,
} from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

const BASE_URL = 'https://global.oliveyoung.com'
const CDN_URL = 'https://cdn-image.oliveyoung.com'

/**
 * Olive Young Global category mappings.
 * ctgrNo values come from global.oliveyoung.com URL structure.
 * Skincare subcategories map to Seoul Sister product categories.
 */
const CATEGORY_MAP: CategoryMapping[] = [
  // Skincare subcategories
  { olive_young_id: '1000000009', olive_young_name: 'Moisturizers', seoul_sister_category: 'moisturizer' },
  { olive_young_id: '1000000010', olive_young_name: 'Cleansers', seoul_sister_category: 'cleanser' },
  { olive_young_id: '1000000261', olive_young_name: 'Acne & Blemish Treatments', seoul_sister_category: 'spot_treatment' },
  // Skincare parent (contains toners, essences, serums, ampoules, etc.)
  { olive_young_id: '1000000008', olive_young_name: 'Skincare', seoul_sister_category: 'serum' },
  // Suncare
  { olive_young_id: '1000000011', olive_young_name: 'Suncare', seoul_sister_category: 'sunscreen' },
  // Face Masks
  { olive_young_id: '1000000003', olive_young_name: 'Face Masks', seoul_sister_category: 'mask' },
]

/**
 * Default headers for Olive Young Global requests.
 * The site is a Vue.js SPA; the internal API returns JSON
 * while the product detail pages return server-rendered HTML with Vue hydration.
 */
const OY_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': `${BASE_URL}/`,
}

/**
 * Scrape products from Olive Young Global (global.oliveyoung.com).
 *
 * Strategy:
 * 1. For each category, scrape the HTML listing page to extract embedded Vue data
 * 2. Parse product cards from the rendered HTML or fall back to the internal API
 * 3. For each product, fetch the detail page to get full description + ingredients
 * 4. Store raw data in ss_product_staging for AI processing (Phase 9.2)
 */
export class OliveYoungScraper {
  private scraper: ScraperBase
  private stats: PipelineStats = { scraped: 0, new: 0, duplicates: 0, failed: 0, errors: [] }

  constructor(options?: { delayMs?: number; maxConcurrency?: number }) {
    this.scraper = new ScraperBase({
      delayMs: options?.delayMs ?? 2000,
      maxConcurrency: options?.maxConcurrency ?? 2,
      maxRetries: 3,
    })
  }

  /**
   * Scrape product listings from a category page.
   * Olive Young uses server-rendered HTML with Vue.js hydration.
   * Products appear as structured elements in the page with product data attributes.
   */
  async scrapeProductList(
    categoryId: string,
    page: number = 1
  ): Promise<ScrapedProductListing[]> {
    const url = `${BASE_URL}/display/category?ctgrNo=${categoryId}&pageNo=${page}&rowsPerPage=48`
    const $ = await this.scraper.fetchAndParse(url, { headers: OY_HEADERS })

    const products: ScrapedProductListing[] = []

    // Olive Young renders product cards in list items within the category grid.
    // Primary selector: product card elements with data attributes or hidden inputs.
    $('li[data-prdt-no], li.product-item, .prd-item').each((_i, el) => {
      const $el = $(el)
      const product = this.parseProductCard($, $el)
      if (product) {
        products.push(product)
      }
    })

    // Fallback: look for hidden input fields that store product data
    // (Olive Young uses hidden inputs for tracking: prdtNo, prdtName, etc.)
    if (products.length === 0) {
      const prdtInputs = $('input[name="prdtNo"]')
      prdtInputs.each((_i, el) => {
        const $input = $(el)
        const $container = $input.closest('li, .item, .product-card')
        const sourceId = $input.val()?.toString()
        if (!sourceId) return

        const nameInput = $container.find('input[name="prdtName"]')
        const name = nameInput.val()?.toString() ?? ''
        if (!name) return

        products.push({
          source_id: sourceId,
          source_url: `${BASE_URL}/product/detail?prdtNo=${sourceId}`,
          name_en: name.trim(),
          name_ko: null,
          brand_en: $container.find('.brand, .brand-name, input[name="brandName"]').first().text()?.trim()
            || $container.find('input[name="korBrandName"]').val()?.toString() || '',
          price_usd: this.extractPrice($container.find('.price, .sale-price, .prd-price').first().text()),
          price_krw: null,
          image_url: this.extractImageUrl($container.find('img').first().attr('src')),
          rating_avg: null,
          review_count: null,
        })
      })
    }

    // Fallback: extract from script tags containing product arrays
    if (products.length === 0) {
      const scriptProducts = this.extractFromScripts($)
      products.push(...scriptProducts)
    }

    return products
  }

  /**
   * Scrape full product detail from a product page.
   * Extracts description, full ingredient list, volume, and all metadata.
   */
  async scrapeProductDetail(
    sourceId: string,
    categoryRaw: string = ''
  ): Promise<ScrapedProductDetail | null> {
    const url = `${BASE_URL}/product/detail?prdtNo=${sourceId}`

    try {
      const $ = await this.scraper.fetchAndParse(url, { headers: OY_HEADERS })

      // Product name — multiple possible selectors
      const nameEn = this.firstNonEmpty([
        $('.prd-name, .product-name, .prd-info__name, h1.name').first().text(),
        $('meta[property="og:title"]').attr('content'),
        $('title').text().split('|')[0],
      ]).trim()

      if (!nameEn) return null

      // Brand name
      const brandEn = this.firstNonEmpty([
        $('.brand-name, .prd-brand, .brand a').first().text(),
        $('meta[property="product:brand"]').attr('content'),
      ]).trim()

      // Korean name (often in a subtitle or secondary heading)
      const nameKo = this.firstNonEmpty([
        $('.prd-sub-name, .kor-name, .product-name-kor').first().text(),
      ]).trim() || null

      // Prices
      const priceUsdText = this.firstNonEmpty([
        $('.sale-price, .final-price, .price-sale, .prd-price .num').first().text(),
        $('meta[property="product:price:amount"]').attr('content'),
      ])
      const priceUsd = this.extractPrice(priceUsdText)

      const priceKrwText = $('.original-price, .origin-price, .price-origin').first().text()
      const priceKrw = this.extractPrice(priceKrwText)

      // Description
      const descriptionRaw = this.firstNonEmpty([
        $('.product-description, .prd-detail-desc, .desc-wrap, .product-detail-info').first().text(),
        $('meta[property="og:description"]').attr('content'),
        $('meta[name="description"]').attr('content'),
      ]).trim()

      // Ingredients — often in an expandable section or tab
      const ingredientsRaw = this.extractIngredients($)

      // Volume/size
      const volumeDisplay = this.firstNonEmpty([
        $('.prd-option, .product-size, .volume, .prd-info__volume').first().text(),
        $('select option:first-child, .option-name').first().text(),
      ]).trim() || null

      // Image
      const imageUrl = this.extractImageUrl(
        $('meta[property="og:image"]').attr('content')
        ?? $('.prd-img img, .product-image img, .thumb-img img').first().attr('src')
      )

      // Rating and review count from the product page
      const ratingText = $('.star-score, .rating-score, .review-score').first().text()
      const ratingAvg = this.extractRating(ratingText)

      const reviewCountText = $('.review-count, .count-review, .review-num').first().text()
      const reviewCount = this.extractNumber(reviewCountText)

      return {
        source_id: sourceId,
        source_url: url,
        name_en: nameEn,
        name_ko: nameKo,
        brand_en: brandEn,
        brand_ko: null,
        category_raw: categoryRaw,
        price_usd: priceUsd,
        price_krw: priceKrw,
        description_raw: descriptionRaw,
        ingredients_raw: ingredientsRaw,
        volume_display: volumeDisplay,
        image_url: imageUrl,
        rating_avg: ratingAvg,
        review_count: reviewCount,
      }
    } catch (error) {
      console.error(`[olive-young] Failed to scrape product ${sourceId}:`, error)
      return null
    }
  }

  /**
   * Run a full or incremental scrape across all mapped categories.
   * Stores results in ss_product_staging via the provided Supabase client.
   */
  async runScrape(
    supabase: SupabaseClient,
    runId: string,
    options: {
      mode: 'full' | 'incremental'
      categories?: string[]
      maxPagesPerCategory?: number
    }
  ): Promise<PipelineStats> {
    const categories = options.categories
      ? CATEGORY_MAP.filter(c => options.categories!.includes(c.olive_young_id))
      : CATEGORY_MAP

    const maxPages = options.mode === 'incremental'
      ? (options.maxPagesPerCategory ?? 2)
      : (options.maxPagesPerCategory ?? 20)

    for (const category of categories) {
      console.log(`[olive-young] Scraping category: ${category.olive_young_name} (${category.olive_young_id})`)

      try {
        await this.scrapeCategory(supabase, runId, category, maxPages)
      } catch (error) {
        const msg = `Category ${category.olive_young_name} failed: ${error instanceof Error ? error.message : error}`
        console.error(`[olive-young] ${msg}`)
        this.stats.errors.push(msg)
      }

      // Update pipeline run progress after each category
      await supabase
        .from('ss_pipeline_runs')
        .update({
          products_scraped: this.stats.scraped,
          products_duplicates: this.stats.duplicates,
          products_failed: this.stats.failed,
          metadata: {
            categories_completed: categories.indexOf(category) + 1,
            categories_total: categories.length,
            errors: this.stats.errors.slice(-10),
          },
        })
        .eq('id', runId)
    }

    return this.stats
  }

  /** Get the list of available category mappings */
  static getCategories(): CategoryMapping[] {
    return [...CATEGORY_MAP]
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private async scrapeCategory(
    supabase: SupabaseClient,
    runId: string,
    category: CategoryMapping,
    maxPages: number
  ): Promise<void> {
    const seenIds = new Set<string>()

    for (let page = 1; page <= maxPages; page++) {
      const listings = await this.scrapeProductList(category.olive_young_id, page)

      // No more products on this page — stop paginating
      if (listings.length === 0) {
        console.log(`[olive-young] No products on page ${page} of ${category.olive_young_name}, stopping`)
        break
      }

      console.log(
        `[olive-young] Page ${page}: found ${listings.length} products in ${category.olive_young_name}`
      )

      for (const listing of listings) {
        if (seenIds.has(listing.source_id)) continue
        seenIds.add(listing.source_id)

        // Fetch full detail page for description + ingredients
        const detail = await this.scrapeProductDetail(listing.source_id, category.olive_young_name)

        const rawData: RawProductData = {
          source: 'olive_young',
          source_url: listing.source_url,
          source_id: listing.source_id,
          name_en: detail?.name_en ?? listing.name_en,
          name_ko: detail?.name_ko ?? listing.name_ko,
          brand_en: detail?.brand_en ?? listing.brand_en,
          brand_ko: detail?.brand_ko ?? null,
          category_raw: category.olive_young_name,
          price_krw: detail?.price_krw ?? listing.price_krw,
          price_usd: detail?.price_usd ?? listing.price_usd,
          description_raw: detail?.description_raw ?? '',
          ingredients_raw: detail?.ingredients_raw ?? null,
          image_url: detail?.image_url ?? listing.image_url,
          volume_display: detail?.volume_display ?? null,
          rating_avg: detail?.rating_avg ?? listing.rating_avg,
          review_count: detail?.review_count ?? listing.review_count,
          scraped_at: new Date().toISOString(),
        }

        await this.stageProduct(supabase, rawData)
      }

      // Log progress every 100 products
      if (this.stats.scraped % 100 < listings.length) {
        console.log(`[olive-young] Progress: ${this.stats.scraped} scraped, ${this.stats.new} new, ${this.stats.duplicates} duplicates`)
      }
    }
  }

  /**
   * Insert or skip a raw product into the staging table.
   * Uses UNIQUE(source, source_id) to prevent duplicates.
   */
  private async stageProduct(
    supabase: SupabaseClient,
    rawData: RawProductData
  ): Promise<void> {
    this.stats.scraped++

    const { error } = await supabase
      .from('ss_product_staging')
      .upsert(
        {
          source: rawData.source,
          source_id: rawData.source_id,
          source_url: rawData.source_url,
          raw_data: rawData,
          status: 'pending',
        },
        { onConflict: 'source,source_id', ignoreDuplicates: true }
      )

    if (error) {
      if (error.code === '23505') {
        // Unique violation — already staged
        this.stats.duplicates++
      } else {
        this.stats.failed++
        this.stats.errors.push(`Stage ${rawData.source_id}: ${error.message}`)
      }
    } else {
      this.stats.new++
    }
  }

  /** Parse a product card element from the listing page */
  private parseProductCard(
    $: CheerioAPI,
    $el: Cheerio<AnyNode>
  ): ScrapedProductListing | null {
    const sourceId = $el.attr('data-prdt-no')
      ?? $el.find('input[name="prdtNo"]').val()?.toString()
      ?? $el.attr('data-product-id')

    if (!sourceId) return null

    const name = this.firstNonEmpty([
      $el.find('.prd-name, .name, .product-name, a[title]').first().text(),
      $el.find('a').first().attr('title'),
    ]).trim()

    if (!name) return null

    return {
      source_id: sourceId,
      source_url: `${BASE_URL}/product/detail?prdtNo=${sourceId}`,
      name_en: name,
      name_ko: null,
      brand_en: $el.find('.brand, .brand-name').first().text().trim(),
      price_usd: this.extractPrice($el.find('.price, .sale-price, .prd-price').first().text()),
      price_krw: null,
      image_url: this.extractImageUrl($el.find('img').first().attr('src') ?? $el.find('img').first().attr('data-src')),
      rating_avg: null,
      review_count: null,
    }
  }

  /**
   * Extract product data from embedded script tags.
   * Olive Young sometimes embeds product arrays in Vue data or __INITIAL_STATE__.
   */
  private extractFromScripts($: CheerioAPI): ScrapedProductListing[] {
    const products: ScrapedProductListing[] = []

    $('script').each((_i, el) => {
      const scriptContent = $(el).html()
      if (!scriptContent) return

      // Look for JSON arrays of product objects
      const patterns = [
        /prdtList\s*[:=]\s*(\[[\s\S]*?\])\s*[,;}\n]/,
        /productList\s*[:=]\s*(\[[\s\S]*?\])\s*[,;}\n]/,
        /topOrderList\s*[:=]\s*(\[[\s\S]*?\])\s*[,;}\n]/,
        /korBestPrdtsList\s*[:=]\s*(\[[\s\S]*?\])\s*[,;}\n]/,
      ]

      for (const pattern of patterns) {
        const match = scriptContent.match(pattern)
        if (!match) continue

        try {
          const parsed = JSON.parse(match[1]) as Record<string, unknown>[]
          for (const item of parsed) {
            const sourceId = String(item.prdtNo ?? item.productNo ?? '')
            if (!sourceId) continue

            products.push({
              source_id: sourceId,
              source_url: `${BASE_URL}/product/detail?prdtNo=${sourceId}`,
              name_en: String(item.prdtName ?? item.korPrdtName ?? item.productName ?? '').trim(),
              name_ko: item.korPrdtName ? String(item.korPrdtName) : null,
              brand_en: String(item.brandName ?? item.korBrandName ?? '').trim(),
              price_usd: typeof item.saleAmt === 'number' ? item.saleAmt : this.extractPrice(String(item.saleAmt ?? '')),
              price_krw: typeof item.nrmlAmt === 'number' ? item.nrmlAmt : null,
              image_url: item.imgUrl ? this.normalizeImageUrl(String(item.imgUrl)) : null,
              rating_avg: typeof item.starRate === 'number' ? item.starRate : null,
              review_count: typeof item.reviewCount === 'number' ? item.reviewCount : null,
            })
          }
        } catch {
          // JSON parse failed — continue to next pattern
        }
      }
    })

    return products
  }

  /** Extract ingredient list from product detail page */
  private extractIngredients($: CheerioAPI): string | null {
    // Common ingredient section selectors on Olive Young product pages
    const selectors = [
      '.ingredient-list',
      '.ingredients',
      '#ingredients',
      '.product-ingredients',
      '.detail-ingredients',
      '[data-tab="ingredients"]',
      '.tab-ingredients',
    ]

    for (const selector of selectors) {
      const text = $(selector).text().trim()
      if (text && text.length > 20) return text
    }

    // Look for ingredient content in expandable detail sections
    const detailSections = $('.detail-section, .product-info-section, .info-area, .cont-area')
    let ingredientText: string | null = null

    detailSections.each((_i, el) => {
      const $section = $(el)
      const heading = $section.find('h2, h3, h4, .title, .tit').first().text().toLowerCase()
      if (heading.includes('ingredient') || heading.includes('ingredients') || heading.includes('inci')) {
        ingredientText = $section.find('p, .content, .desc, .cont').first().text().trim()
        if (ingredientText && ingredientText.length > 20) return false // break
        ingredientText = null
      }
    })

    if (ingredientText) return ingredientText

    // Last resort: scan all text nodes for INCI-like patterns
    // (comma-separated chemical names containing "acid", "extract", "-one", etc.)
    const bodyText = $('body').text()
    const inciPattern = /(?:Water|Aqua|Butylene Glycol|Glycerin|Niacinamide)[^.]{50,2000}/i
    const match = bodyText.match(inciPattern)
    if (match) return match[0].trim()

    return null
  }

  /** Extract a USD price from text like "US$23.00" or "$23" or "23.00" */
  private extractPrice(text: string | null | undefined): number | null {
    if (!text) return null
    const cleaned = text.replace(/[^0-9.]/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : Math.round(num * 100) / 100
  }

  /** Extract a numeric rating from text */
  private extractRating(text: string | null | undefined): number | null {
    if (!text) return null
    const match = text.match(/(\d+\.?\d*)\s*(?:\/\s*5)?/)
    if (!match) return null
    const num = parseFloat(match[1])
    return isNaN(num) || num > 5 ? null : Math.round(num * 10) / 10
  }

  /** Extract a plain number from text like "(1,234)" or "1234" */
  private extractNumber(text: string | null | undefined): number | null {
    if (!text) return null
    const cleaned = text.replace(/[^0-9]/g, '')
    const num = parseInt(cleaned, 10)
    return isNaN(num) ? null : num
  }

  /** Normalize image URL to full CDN URL */
  private extractImageUrl(src: string | null | undefined): string | null {
    if (!src) return null
    return this.normalizeImageUrl(src)
  }

  /** Ensure image URL is absolute and uses CDN */
  private normalizeImageUrl(src: string): string {
    if (src.startsWith('//')) return `https:${src}`
    if (src.startsWith('/')) return `${CDN_URL}${src}`
    if (src.startsWith('http')) return src
    return `${CDN_URL}/${src}`
  }

  /** Return the first non-empty string from an array of candidates */
  private firstNonEmpty(candidates: (string | null | undefined)[]): string {
    for (const c of candidates) {
      if (c && c.trim().length > 0) return c.trim()
    }
    return ''
  }
}
