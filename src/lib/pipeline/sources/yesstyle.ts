import type { ScrapedPrice } from '../types'

const BASE_URL = 'https://www.yesstyle.com'

/**
 * YesStyle price scraper.
 *
 * YesStyle is a Next.js/MUI app — product data is rendered via React hydration
 * with dynamic MUI class names. We use Playwright to load the search page
 * and extract product data from the rendered DOM.
 *
 * Key selectors:
 * - Product URLs: /en/<slug>/info.html/pid.<id>
 * - Prices: "US$ XX.XX" format
 * - Search URL: /en/list.html?q=<query>&bpt=48
 */
export class YesStyleScraper {
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
   * Search YesStyle for a product by brand + name and return scraped prices.
   */
  async searchProduct(brand: string, productName: string): Promise<ScrapedPrice[]> {
    const query = `${brand} ${productName}`.trim()
    const searchUrl = `${BASE_URL}/en/list.html?q=${encodeURIComponent(query)}&bpt=48`

    const browser = await this.ensureBrowser()
    const page = await browser.newPage()

    try {
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Wait for product links to render (MUI hydration)
      // Product URLs have the pattern: /en/<slug>/info.html/pid.<id>
      await page.waitForSelector('a[href*="/info.html/pid."]', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)

      const results = await page.evaluate((baseUrl: string) => {
        const items: {
          product_name: string
          brand: string
          price_usd: number | null
          url: string
          image_url: string | null
          in_stock: boolean
        }[] = []

        // Find all product links — they contain /info.html/pid.
        const productLinks = document.querySelectorAll('a[href*="/info.html/pid."]')
        const seen = new Set<string>()

        productLinks.forEach(link => {
          const href = (link as HTMLAnchorElement).href
          // Deduplicate by URL
          const pid = href.match(/pid\.(\d+)/)?.[1]
          if (!pid || seen.has(pid)) return
          seen.add(pid)

          // Walk up to find the product card container
          // In MUI grids, the product card is typically 2-3 levels up
          let container = link.parentElement
          for (let i = 0; i < 5 && container; i++) {
            // Stop at a grid-level container that has both image and price
            const hasImg = container.querySelector('img') !== null
            const text = container.textContent || ''
            const hasPrice = /US\$\s*\d+/.test(text)
            if (hasImg && hasPrice) break
            container = container.parentElement
          }

          if (!container) return

          const allText = container.textContent || ''

          // Extract price — YesStyle uses "US$ XX.XX" format
          // Look for sale price first (usually the one displayed prominently)
          const priceMatches = allText.match(/US\$\s*(\d+\.?\d*)/g)
          let priceUsd: number | null = null
          if (priceMatches && priceMatches.length > 0) {
            // If multiple prices, the first is usually the sale price
            const firstMatch = priceMatches[0].match(/US\$\s*(\d+\.?\d*)/)
            if (firstMatch) {
              priceUsd = parseFloat(firstMatch[1])
              if (isNaN(priceUsd) || priceUsd <= 0) priceUsd = null
            }
          }

          // Extract product name — prefer the slug from the URL which is clean
          // URL format: /en/cosrx-advanced-snail-96-mucin-power-essence-100ml/info.html/pid.XXX
          const urlSlug = href.match(/\/en\/([^/]+)\/info\.html/)?.[1] || ''
          const slugName = urlSlug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase()) // Title case

          // The link text includes badges and prices — unreliable for names
          // Use the URL slug as the primary product name source (always clean)
          // Example slug: "cosrx-advanced-snail-96-mucin-power-essence-100ml"
          let nameText = slugName
          if (!nameText || nameText.length < 5) {
            // Fallback: try link text with cleanup
            const raw = link.textContent?.trim() || ''
            nameText = raw
              .replace(/US\$\s*[\d.]+/g, '')
              .replace(/\d+%\s*OFF/gi, '')
              .replace(/FLASH SALE/gi, '')
              .replace(/Value Set Available/gi, '')
              .replace(/[\d,]+\s*$/g, '')
              .trim()
          }

          // Skip if we couldn't extract a usable name
          if (!nameText || nameText.length < 5 || nameText.length > 200) return

          // Extract brand from the slug — first word(s) before the product description
          const linkText = link.textContent?.trim() || ''
          const brandMatch = linkText.match(/(?:FLASH SALE|Value Set Available)*\s*([A-Za-z][A-Za-z0-9\s.&']+?)\s*[-–]\s*/)
          const extractedBrand = brandMatch ? brandMatch[1].trim() : ''

          // Image — find the product image (usually the first img in the card)
          const img = container.querySelector('img[src*="cloudfront.net"], img[src*="yesstyle"]') as HTMLImageElement | null
          let imageUrl = img?.src || null
          if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl

          // Stock check
          const isSoldOut = allText.toLowerCase().includes('sold out')
            || allText.toLowerCase().includes('out of stock')

          if (priceUsd && priceUsd > 0.99) {  // Skip $0.99 placeholder/free items
            items.push({
              product_name: nameText,
              brand: extractedBrand,
              price_usd: Math.round(priceUsd * 100) / 100,
              url: href.startsWith('http') ? href : `${baseUrl}${href}`,
              image_url: imageUrl,
              in_stock: !isSoldOut,
            })
          }
        })

        return items
      }, BASE_URL)

      await this.delay()

      return results
        .slice(0, 10)
        .map(r => ({
          retailer: 'yesstyle' as ScrapedPrice['retailer'],
          product_name: r.product_name,
          brand: r.brand,
          price_usd: r.price_usd,
          price_krw: null,
          url: r.url,
          in_stock: r.in_stock,
          image_url: r.image_url,
        }))
    } catch (error) {
      console.error(`[yesstyle] Search failed for "${brand} ${productName}":`, error instanceof Error ? error.message : error)
      return []
    } finally {
      await page.close()
    }
  }
}
