import type { ScrapedPrice } from '../types'

/**
 * Amazon price scraper.
 *
 * Amazon aggressively blocks automated scraping (CAPTCHA, WAF, bot detection).
 * We use Playwright with stealth-like settings to mimic real browser behavior.
 *
 * This is the least reliable scraper — expect higher failure rates than other
 * retailers. If Amazon blocks consistently, fall back to the other 3 retailers
 * which provide sufficient price coverage.
 *
 * Strategy:
 * - Use Playwright to load Amazon search results
 * - Search for brand + product name in the Beauty & Personal Care category
 * - Extract price from rendered search results
 * - Limit concurrency to 1 request at a time with long delays
 */
export class AmazonScraper {
  private browser: import('playwright').Browser | null = null
  private readonly delayMs: number

  constructor(options?: { delayMs?: number }) {
    // Longer delays for Amazon to avoid rate limiting
    this.delayMs = options?.delayMs ?? 5000
  }

  private async ensureBrowser(): Promise<import('playwright').Browser> {
    if (!this.browser) {
      const { chromium } = await import('playwright')
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
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
    // Add jitter to look more human
    const jitter = Math.random() * 2000
    await new Promise(resolve => setTimeout(resolve, this.delayMs + jitter))
  }

  /**
   * Search Amazon for a K-beauty product and extract prices.
   * Searches within the Beauty & Personal Care category (node 3760911).
   */
  async searchProduct(brand: string, productName: string): Promise<ScrapedPrice[]> {
    const query = `${brand} ${productName}`.trim()
    // Beauty & Personal Care: rh=n:3760911
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&rh=n%3A3760911`

    const browser = await this.ensureBrowser()
    const page = await browser.newPage()

    try {
      // Set a realistic viewport and user agent
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      })

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)

      // Check if we hit a CAPTCHA
      const pageContent = await page.content()
      if (pageContent.includes('captcha') || pageContent.includes('Type the characters')) {
        console.warn('[amazon] CAPTCHA detected, skipping this search')
        return []
      }

      // Wait for search results to load
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 }).catch(() => {})

      const results = await page.evaluate(() => {
        const items: {
          product_name: string
          brand: string
          price_usd: number | null
          url: string
          image_url: string | null
          in_stock: boolean
          is_sponsored: boolean
        }[] = []

        const resultCards = document.querySelectorAll('[data-component-type="s-search-result"]')

        resultCards.forEach(card => {
          // Product name from the title link
          const titleEl = card.querySelector('h2 a span, [data-cy="title-recipe"] span')
          const name = titleEl?.textContent?.trim() || ''
          if (!name) return

          // Product URL
          const linkEl = card.querySelector('h2 a') as HTMLAnchorElement | null
          const href = linkEl?.href || ''
          if (!href) return

          // Brand — sometimes in a separate row above the title
          const brandEl = card.querySelector('[class*="puis-light-weight-text"] span, .a-size-base-plus')
          const brandText = brandEl?.textContent?.trim() || ''

          // Price — main price display
          const wholePart = card.querySelector('.a-price .a-price-whole')?.textContent?.replace(/[^0-9]/g, '') || ''
          const fracPart = card.querySelector('.a-price .a-price-fraction')?.textContent?.replace(/[^0-9]/g, '') || '00'
          const priceUsd = wholePart ? parseFloat(`${wholePart}.${fracPart}`) : null

          // Image
          const imgEl = card.querySelector('.s-image') as HTMLImageElement | null
          const imageUrl = imgEl?.src || null

          // Check sponsored
          const isSponsored = card.querySelector('[data-component-type="sp-sponsored-result"]') !== null
            || (card.textContent || '').includes('Sponsored')

          // Stock — Amazon shows "Currently unavailable" for OOS items
          const inStock = !(card.textContent || '').includes('Currently unavailable')

          if (priceUsd && priceUsd > 0) {
            items.push({
              product_name: name,
              brand: brandText,
              price_usd: Math.round(priceUsd * 100) / 100,
              url: href,
              image_url: imageUrl,
              in_stock: inStock,
              is_sponsored: isSponsored,
            })
          }
        })

        return items
      })

      await this.delay()

      return results
        .filter(r => !r.is_sponsored) // Skip sponsored results for accuracy
        .slice(0, 5) // Top 5 organic results
        .map(r => ({
          retailer: 'amazon' as const,
          product_name: r.product_name,
          brand: r.brand || brand,
          price_usd: r.price_usd,
          price_krw: null,
          url: r.url,
          in_stock: r.in_stock,
          image_url: r.image_url,
        }))
    } catch (error) {
      console.error(`[amazon] Search failed for "${brand} ${productName}":`, error instanceof Error ? error.message : error)
      return []
    } finally {
      await page.close()
    }
  }
}
