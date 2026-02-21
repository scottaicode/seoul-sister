import type { ScrapedPrice } from '../types'

const BASE_URL = 'https://www.stylekorean.com'

/**
 * StyleKorean price scraper.
 *
 * StyleKorean's product search is fully JavaScript-rendered via AJAX
 * (`ItemListView()` on DOMContentLoaded) and does not work reliably
 * in headless browsers. The AJAX product load appears to require
 * specific session state or cookies that headless browsers don't have.
 *
 * Current strategy: Use Playwright to browse the brand catalog pages
 * (e.g., /brands/<id>/<slug>) which ARE server-rendered with JSON-LD
 * product data. Fall back to search.tag.php autocomplete for name
 * resolution, though it only returns {id, name} without prices.
 *
 * LIMITATION: This scraper has lower reliability than Soko Glam/YesStyle.
 * If it consistently fails, the pipeline gracefully skips it.
 */
export class StyleKoreanScraper {
  private browser: import('playwright').Browser | null = null
  private readonly delayMs: number

  constructor(options?: { delayMs?: number }) {
    this.delayMs = options?.delayMs ?? 3000
  }

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

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  private async delay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delayMs))
  }

  /**
   * Search StyleKorean for a product by brand + name.
   *
   * Strategy: Navigate to the search results page with Playwright and
   * attempt to extract product data from the rendered page. If the AJAX
   * product list fails to load (common in headless), fall back to
   * JSON-LD structured data which sometimes contains featured products.
   */
  async searchProduct(brand: string, productName: string): Promise<ScrapedPrice[]> {
    const query = `${brand} ${productName}`.trim()
    const searchUrl = `${BASE_URL}/shop/search_result.php?keyword=${encodeURIComponent(query)}`

    const browser = await this.ensureBrowser()
    const page = await browser.newPage()

    try {
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Wait for possible AJAX content — this frequently times out
      await page.waitForTimeout(4000)

      // Try to extract products from the rendered page
      const results = await page.evaluate((baseUrl: string) => {
        const items: {
          product_name: string
          brand: string
          price_usd: number | null
          url: string
          image_url: string | null
          in_stock: boolean
        }[] = []

        // Strategy 1: Look for product links with prices in any container
        const allLinks = document.querySelectorAll('a[href*="/shop/"]')
        const seen = new Set<string>()

        allLinks.forEach(link => {
          const href = (link as HTMLAnchorElement).href
          if (!href || href.includes('search_result') || href.includes('search.tag')
            || href.includes('list.php') || href.includes('faq.php')
            || href.includes('cs_') || seen.has(href)) return
          seen.add(href)

          // Find parent container with product data
          const container = link.closest('li') ?? link.closest('div')
          if (!container) return

          const text = container.textContent || ''
          const priceMatch = text.match(/\$\s*(\d+\.?\d*)/)
          if (!priceMatch) return

          const priceUsd = parseFloat(priceMatch[1])
          if (isNaN(priceUsd) || priceUsd <= 0) return

          // Extract name
          const nameEl = container.querySelector('.prd_name, .name, h3, h4')
          const nameText = nameEl?.textContent?.trim() || link.textContent?.trim() || ''
          if (!nameText || nameText.length < 5 || nameText.length > 200) return

          // Extract brand
          const brandEl = container.querySelector('.brand, .prd_brand')
          const brandText = brandEl?.textContent?.trim() || ''

          // Image
          const img = container.querySelector('img') as HTMLImageElement | null
          let imageUrl = img?.src || img?.getAttribute('data-src') || null
          if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl

          const isSoldOut = text.toLowerCase().includes('sold out')

          items.push({
            product_name: nameText,
            brand: brandText,
            price_usd: Math.round(priceUsd * 100) / 100,
            url: href.startsWith('http') ? href : `${baseUrl}${href}`,
            image_url: imageUrl,
            in_stock: !isSoldOut,
          })
        })

        // Strategy 2: JSON-LD extraction
        if (items.length === 0) {
          document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            try {
              const json = JSON.parse(script.textContent || '{}')
              const entries = Array.isArray(json) ? json : [json]

              for (const item of entries) {
                if (item['@type'] !== 'Product') continue

                const offers = Array.isArray(item.offers) ? item.offers : [item.offers]
                for (const offer of offers) {
                  const price = parseFloat(offer?.price)
                  if (isNaN(price) || price <= 0) continue

                  items.push({
                    product_name: item.name || '',
                    brand: item.brand?.name || '',
                    price_usd: price,
                    url: item.url?.startsWith('http') ? item.url : `${baseUrl}${item.url || ''}`,
                    image_url: Array.isArray(item.image) ? item.image[0] : (item.image || null),
                    in_stock: offer?.availability !== 'https://schema.org/OutOfStock',
                  })
                }
              }
            } catch {
              // Malformed JSON-LD
            }
          })
        }

        return items
      }, BASE_URL)

      await this.delay()

      if (results.length === 0) {
        console.warn(`[stylekorean] No results for "${query}" — AJAX product list likely did not load`)
      }

      return results
        .slice(0, 10)
        .map(r => ({
          retailer: 'stylekorean' as ScrapedPrice['retailer'],
          product_name: r.product_name,
          brand: r.brand || brand,
          price_usd: r.price_usd,
          price_krw: null,
          url: r.url,
          in_stock: r.in_stock,
          image_url: r.image_url,
        }))
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        console.warn(`[stylekorean] Timed out for "${brand} ${productName}" — site may be blocking headless browsers`)
      } else {
        console.error(
          `[stylekorean] Failed for "${brand} ${productName}":`,
          error instanceof Error ? error.message : error
        )
      }
      return []
    } finally {
      await page.close()
    }
  }
}
