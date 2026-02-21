import type {
  RawProductData,
  CategoryMapping,
  ScrapedProductListing,
  ScrapedProductDetail,
  PipelineStats,
} from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

const BASE_URL = 'https://global.oliveyoung.com'

/**
 * Olive Young Global category mappings.
 * ctgrNo values come from global.oliveyoung.com URL structure.
 */
const CATEGORY_MAP: CategoryMapping[] = [
  { olive_young_id: '1000000009', olive_young_name: 'Moisturizers', seoul_sister_category: 'moisturizer' },
  { olive_young_id: '1000000010', olive_young_name: 'Cleansers', seoul_sister_category: 'cleanser' },
  { olive_young_id: '1000000261', olive_young_name: 'Acne & Blemish Treatments', seoul_sister_category: 'spot_treatment' },
  { olive_young_id: '1000000008', olive_young_name: 'Skincare', seoul_sister_category: 'serum' },
  { olive_young_id: '1000000011', olive_young_name: 'Suncare', seoul_sister_category: 'sunscreen' },
  { olive_young_id: '1000000003', olive_young_name: 'Face Masks', seoul_sister_category: 'mask' },
]

/**
 * Scrape products from Olive Young Global using Playwright (headless Chromium).
 *
 * The site is a Vue.js SPA — product data is loaded client-side via AJAX.
 * Cheerio/fetch cannot access rendered data. Playwright launches a headless
 * browser, waits for Vue to hydrate, then extracts product data from the
 * rendered DOM.
 *
 * Strategy:
 * 1. Launch a shared Chromium instance for the scrape run
 * 2. For each category, navigate to listing pages and extract product cards
 * 3. For each product, navigate to the detail page for ingredients + description
 * 4. Store raw data in ss_product_staging for AI processing (Phase 9.2)
 */
export class OliveYoungScraper {
  private stats: PipelineStats = { scraped: 0, new: 0, duplicates: 0, failed: 0, errors: [] }
  private readonly delayMs: number
  private readonly maxConcurrency: number
  private browser: import('playwright').Browser | null = null

  constructor(options?: { delayMs?: number; maxConcurrency?: number }) {
    this.delayMs = options?.delayMs ?? 2000
    this.maxConcurrency = options?.maxConcurrency ?? 2
  }

  /** Launch Chromium browser instance */
  private async ensureBrowser(): Promise<import('playwright').Browser> {
    if (!this.browser) {
      const { chromium } = await import('playwright')
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    }
    return this.browser
  }

  /** Close browser when done */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /** Create a new page with standard settings */
  private async newPage(): Promise<import('playwright').Page> {
    const browser = await this.ensureBrowser()
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    })
    return page
  }

  /** Rate-limit delay between requests */
  private async delay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delayMs))
  }

  /**
   * Scrape ALL product listings from a category by clicking the "MORE" button.
   *
   * Olive Young's Vue.js SPA uses a "MORE (N/Total)" button for pagination
   * rather than URL-based pageNo. Each click loads 24 more products into the DOM.
   * We click until maxClicks reached or no more pages.
   *
   * Returns all accumulated products from the DOM.
   */
  async scrapeAllListings(
    categoryId: string,
    maxClicks: number = 200
  ): Promise<ScrapedProductListing[]> {
    const url = `${BASE_URL}/display/category?ctgrNo=${categoryId}`
    const browserPage = await this.newPage()

    try {
      await browserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Wait for Vue to render initial product cards
      await browserPage.waitForSelector('li.prdt-unit input[name="prdtNo"]', { timeout: 15000 })
        .catch(() => {})
      await browserPage.waitForTimeout(2000)

      // Click the "MORE" button repeatedly to load all products
      for (let click = 0; click < maxClicks; click++) {
        const moreBtn = await browserPage.$('button.btn-page-more')
        if (!moreBtn) break

        const btnText = await moreBtn.textContent().catch(() => '')
        // Button shows "MORE (N/Total)" — stop if we've reached the end
        const pageMatch = btnText?.match(/(\d+)\/(\d+)/)
        if (pageMatch) {
          const current = parseInt(pageMatch[1], 10)
          const total = parseInt(pageMatch[2], 10)
          if (current >= total) break
        }

        await moreBtn.click()
        await browserPage.waitForTimeout(1500)

        // Log progress periodically
        if ((click + 1) % 10 === 0) {
          const count = await browserPage.evaluate(() =>
            document.querySelectorAll('li.prdt-unit input[name="prdtNo"]').length
          )
          console.log(`[olive-young] ... loaded ${count} products after ${click + 1} MORE clicks`)
        }
      }

      // Extract all products from the accumulated DOM
      const products = await browserPage.evaluate(() => {
        const items: {
          source_id: string
          name_en: string
          brand_en: string
          price_usd: number | null
          price_krw: number | null
          image_url: string | null
          rating_avg: number | null
          review_count: number | null
        }[] = []

        document.querySelectorAll('li.prdt-unit').forEach(li => {
          const prdtNoInput = li.querySelector('input[name="prdtNo"]') as HTMLInputElement | null
          const prdtNameInput = li.querySelector('input[name="prdtName"]') as HTMLInputElement | null
          if (!prdtNoInput?.value || !prdtNameInput?.value) return

          const sourceId = prdtNoInput.value.trim()
          const nameEn = prdtNameInput.value.trim()

          const brandDt = li.querySelector('dl.brand-info > dt')
          const brandEn = brandDt ? (brandDt.textContent || '').trim() : ''

          const saleEl = li.querySelector('.price-info strong.point')
          const priceUsd = saleEl ? parseFloat((saleEl.textContent || '').replace(/[^0-9.]/g, '')) : null

          const ratingEl = li.querySelector('.rating-info > span')
          const ratingText = ratingEl ? (ratingEl.textContent || '').trim() : ''
          const ratingAvg = ratingText ? parseFloat(ratingText) : null

          const imgEl = li.querySelector('.unit-thumb img') as HTMLImageElement | null
          let imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || null
          if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl

          items.push({
            source_id: sourceId,
            name_en: nameEn,
            brand_en: brandEn,
            price_usd: priceUsd && !isNaN(priceUsd) ? Math.round(priceUsd * 100) / 100 : null,
            price_krw: null,
            image_url: imageUrl,
            rating_avg: ratingAvg && !isNaN(ratingAvg) && ratingAvg <= 5 ? Math.round(ratingAvg * 10) / 10 : null,
            review_count: null,
          })
        })

        return items
      })

      return products.map(p => ({
        ...p,
        source_url: `${BASE_URL}/product/detail?prdtNo=${p.source_id}`,
        name_ko: null,
      }))
    } catch (error) {
      console.error(`[olive-young] Error scraping category ${categoryId}:`, error instanceof Error ? error.message : error)
      return []
    } finally {
      await browserPage.close()
    }
  }

  /**
   * Scrape full product detail from a product page.
   * Extracts ingredients from the "Specific Item Info" table,
   * description from og:description, volume from table rows.
   */
  async scrapeProductDetail(
    sourceId: string,
    categoryRaw: string = ''
  ): Promise<ScrapedProductDetail | null> {
    const url = `${BASE_URL}/product/detail?prdtNo=${sourceId}`
    const browserPage = await this.newPage()

    try {
      await browserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await browserPage.waitForTimeout(4000)

      // Click "Specific Item Info" to expand the info table (if collapsed)
      await browserPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'))
        for (const a of links) {
          if ((a.textContent || '').trim() === 'Specific Item Info') {
            a.click()
            break
          }
        }
      })
      await browserPage.waitForTimeout(1500)

      const detail = await browserPage.evaluate((baseUrl: string) => {
        const result = {
          name_en: '',
          name_ko: null as string | null,
          brand_en: '',
          brand_ko: null as string | null,
          price_usd: null as number | null,
          price_krw: null as number | null,
          description_raw: '',
          ingredients_raw: null as string | null,
          volume_display: null as string | null,
          image_url: null as string | null,
          rating_avg: null as number | null,
          review_count: null as number | null,
        }

        // Name from og:title or document.title
        const ogTitle = document.querySelector('meta[property="og:title"]')
        const rawTitle = ogTitle?.getAttribute('content') || document.title || ''
        result.name_en = rawTitle.replace(/\s*\|\s*OLIVE YOUNG.*$/i, '').trim()

        // Brand from .brand-info or breadcrumb
        const brandEl = document.querySelector('dl.brand-info > dt, .prd-brand, .brand-name')
        result.brand_en = brandEl ? (brandEl.textContent || '').trim() : ''

        // Image from og:image
        const ogImage = document.querySelector('meta[property="og:image"]')
        result.image_url = ogImage?.getAttribute('content') || null

        // Price from .price-info on the detail page
        const priceArea = document.querySelector('.price-info')
        if (priceArea) {
          const saleEl = priceArea.querySelector('strong.point, .sale-price')
          const saleText = saleEl ? (saleEl.textContent || '').replace(/[^0-9.]/g, '') : ''
          result.price_usd = saleText ? parseFloat(saleText) : null
          if (result.price_usd && isNaN(result.price_usd)) result.price_usd = null
          if (result.price_usd) result.price_usd = Math.round(result.price_usd * 100) / 100
        }

        // Description from og:description
        const ogDesc = document.querySelector('meta[property="og:description"]')
        result.description_raw = ogDesc?.getAttribute('content') || ''

        // Extract table rows from "Specific Item Info" section
        const tableRows = Array.from(document.querySelectorAll('tr'))
        for (const tr of tableRows) {
          const text = (tr.textContent || '').trim()

          // Ingredients
          if (text.startsWith('Ingredients') || text.toLowerCase().includes('ingredients ')) {
            // Get the cell content after "Ingredients" label
            const cells = tr.querySelectorAll('td, th')
            if (cells.length >= 2) {
              result.ingredients_raw = (cells[cells.length - 1].textContent || '').trim()
            } else {
              // Single cell — remove "Ingredients" prefix
              result.ingredients_raw = text.replace(/^Ingredients\s*/i, '').trim()
            }
          }

          // Volume
          if (text.includes('Content volume') || text.includes('content volume')) {
            const cells = tr.querySelectorAll('td, th')
            if (cells.length >= 2) {
              result.volume_display = (cells[cells.length - 1].textContent || '').trim()
            } else {
              result.volume_display = text.replace(/^Content volume.*?(?=\d)/i, '').trim()
            }
          }
        }

        // Fallback: Look for INCI text in text nodes if table didn't have it
        if (!result.ingredients_raw) {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
          while (walker.nextNode()) {
            const txt = (walker.currentNode.textContent || '').trim()
            if (txt.length > 50 && /^(?:Water|Aqua|Butylene Glycol|Glycerin)/.test(txt) && txt.includes(',')) {
              result.ingredients_raw = txt
              break
            }
          }
        }

        // Rating and review count from review section
        const body = document.body.innerText || ''
        const ratingMatch = body.match(/(\d\.\d)\s*\n\s*(\d[\d,]*)\s*reviews/i)
        if (ratingMatch) {
          result.rating_avg = parseFloat(ratingMatch[1])
          result.review_count = parseInt(ratingMatch[2].replace(/,/g, ''), 10)
        }

        return result
      }, BASE_URL)

      if (!detail.name_en) return null

      return {
        source_id: sourceId,
        source_url: url,
        name_en: detail.name_en,
        name_ko: detail.name_ko,
        brand_en: detail.brand_en,
        brand_ko: detail.brand_ko,
        category_raw: categoryRaw,
        price_usd: detail.price_usd,
        price_krw: detail.price_krw,
        description_raw: detail.description_raw,
        ingredients_raw: detail.ingredients_raw,
        volume_display: detail.volume_display,
        image_url: detail.image_url,
        rating_avg: detail.rating_avg,
        review_count: detail.review_count,
      }
    } catch (error) {
      console.error(`[olive-young] Failed to scrape product ${sourceId}:`, error instanceof Error ? error.message : error)
      return null
    } finally {
      await browserPage.close()
    }
  }

  /**
   * Run a full or incremental scrape across all mapped categories.
   * Stores results in ss_product_staging via the provided Supabase client.
   *
   * When skipDetails=true, only listing pages are scraped (fast pass).
   * Use enrichDetails() afterwards to fill in ingredients/description.
   */
  async runScrape(
    supabase: SupabaseClient,
    runId: string,
    options: {
      mode: 'full' | 'incremental'
      categories?: string[]
      maxPagesPerCategory?: number
      skipDetails?: boolean
    }
  ): Promise<PipelineStats> {
    const categories = options.categories
      ? CATEGORY_MAP.filter(c => options.categories!.includes(c.olive_young_id))
      : CATEGORY_MAP

    const maxPages = options.mode === 'incremental'
      ? (options.maxPagesPerCategory ?? 2)
      : (options.maxPagesPerCategory ?? 20)

    try {
      await this.ensureBrowser()

      for (const category of categories) {
        console.log(`[olive-young] Scraping category: ${category.olive_young_name} (${category.olive_young_id})`)

        try {
          await this.scrapeCategory(supabase, runId, category, maxPages, options.skipDetails ?? false)
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
              skip_details: options.skipDetails ?? false,
              errors: this.stats.errors.slice(-10),
            },
          })
          .eq('id', runId)
      }
    } finally {
      await this.closeBrowser()
    }

    return this.stats
  }

  /**
   * Enrich staged products that lack ingredients by scraping their detail pages.
   * Runs with configurable concurrency (multiple browser tabs in parallel).
   *
   * Targets both 'pending' and 'processed' rows missing ingredients.
   * For 'processed' rows, also backfills ingredients_raw on the linked ss_products record.
   */
  async enrichDetails(
    supabase: SupabaseClient,
    options: { batchSize?: number; concurrency?: number } = {}
  ): Promise<{ enriched: number; failed: number; remaining: number }> {
    const batchSize = options.batchSize ?? 50
    const concurrency = options.concurrency ?? 4

    // Fetch staged products that lack ingredient data (pending OR processed)
    const { data: staged, error } = await supabase
      .from('ss_product_staging')
      .select('id, source_id, raw_data, status, processed_product_id')
      .eq('source', 'olive_young')
      .in('status', ['pending', 'processed'])
      .or('raw_data->>ingredients_raw.is.null,raw_data->>ingredients_raw.eq.')
      .limit(batchSize)

    if (error || !staged) {
      console.error('[olive-young] Failed to fetch staged products for enrichment:', error?.message)
      return { enriched: 0, failed: 0, remaining: 0 }
    }

    if (staged.length === 0) {
      console.log('[olive-young] No staged products need enrichment')
      return { enriched: 0, failed: 0, remaining: 0 }
    }

    console.log(`[olive-young] Enriching ${staged.length} products with ${concurrency} concurrent tabs`)

    let enriched = 0
    let failed = 0

    try {
      await this.ensureBrowser()

      // Process in concurrent batches
      for (let i = 0; i < staged.length; i += concurrency) {
        const batch = staged.slice(i, i + concurrency)

        const results = await Promise.allSettled(
          batch.map(async (row) => {
            const rawData = row.raw_data as RawProductData
            await this.delay()
            const detail = await this.scrapeProductDetail(row.source_id, rawData.category_raw)

            if (detail && detail.ingredients_raw) {
              // Merge detail data into raw_data
              const updated: RawProductData = {
                ...rawData,
                name_en: detail.name_en || rawData.name_en,
                brand_en: detail.brand_en || rawData.brand_en,
                description_raw: detail.description_raw || rawData.description_raw,
                ingredients_raw: detail.ingredients_raw,
                volume_display: detail.volume_display ?? rawData.volume_display,
                image_url: detail.image_url ?? rawData.image_url,
                rating_avg: detail.rating_avg ?? rawData.rating_avg,
                review_count: detail.review_count ?? rawData.review_count,
                price_usd: detail.price_usd ?? rawData.price_usd,
              }

              await supabase
                .from('ss_product_staging')
                .update({ raw_data: updated })
                .eq('id', row.id)

              // If this row was already processed, backfill ingredients_raw on ss_products
              if (row.status === 'processed' && row.processed_product_id) {
                await supabase
                  .from('ss_products')
                  .update({ ingredients_raw: detail.ingredients_raw })
                  .eq('id', row.processed_product_id)
              }

              return true
            }
            return false
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) enriched++
          else failed++
        }

        console.log(`[olive-young] Enrichment progress: ${enriched} enriched, ${failed} failed, ${i + batch.length}/${staged.length} processed`)
      }
    } finally {
      await this.closeBrowser()
    }

    // Count remaining (both pending and processed without ingredients)
    const { count } = await supabase
      .from('ss_product_staging')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'olive_young')
      .in('status', ['pending', 'processed'])
      .or('raw_data->>ingredients_raw.is.null,raw_data->>ingredients_raw.eq.')

    return { enriched, failed, remaining: count ?? 0 }
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
    maxPages: number,
    skipDetails: boolean = false
  ): Promise<void> {
    // Load all listings via MORE button clicks (maxPages = max MORE clicks)
    const listings = await this.scrapeAllListings(category.olive_young_id, maxPages)

    if (listings.length === 0) {
      console.log(`[olive-young] No products found in ${category.olive_young_name}`)
      return
    }

    console.log(`[olive-young] Found ${listings.length} total products in ${category.olive_young_name}`)

    const seenIds = new Set<string>()

    for (const listing of listings) {
      if (seenIds.has(listing.source_id)) continue
      seenIds.add(listing.source_id)

      let detail: ScrapedProductDetail | null = null
      if (!skipDetails) {
        await this.delay()
        detail = await this.scrapeProductDetail(listing.source_id, category.olive_young_name)
      }

      const rawData: RawProductData = {
        source: 'olive_young',
        source_url: listing.source_url,
        source_id: listing.source_id,
        name_en: detail?.name_en ?? listing.name_en,
        name_ko: detail?.name_ko ?? listing.name_ko,
        brand_en: detail?.brand_en || listing.brand_en,
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

      // Log progress every 200 products
      if (this.stats.scraped > 0 && this.stats.scraped % 200 === 0) {
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
        this.stats.duplicates++
      } else {
        this.stats.failed++
        this.stats.errors.push(`Stage ${rawData.source_id}: ${error.message}`)
      }
    } else {
      this.stats.new++
    }
  }
}
