import type { ScrapedPrice } from '../types'

const BASE_URL = 'https://sokoglam.com'

/**
 * Shopify predictive search API response shape.
 */
interface ShopifySearchResponse {
  resources: {
    results: {
      products: Array<{
        id: number
        title: string
        handle: string
        vendor: string
        price: string          // e.g. "25.00"
        price_min: string
        price_max: string
        available: boolean
        image: string | null
        url: string
      }>
    }
  }
}

/**
 * Soko Glam price scraper.
 *
 * Soko Glam is a Shopify store. Instead of scraping HTML (which Shopify
 * often blocks with bot detection), we use the Shopify Predictive Search
 * API that every Shopify store exposes:
 *
 *   GET /search/suggest.json?q=<query>&resources[type]=product&resources[limit]=10
 *
 * This returns clean JSON with product name, vendor, price, availability,
 * and URL — no HTML parsing needed.
 */
export class SokoGlamScraper {
  private readonly delayMs: number

  constructor(options?: { delayMs?: number }) {
    this.delayMs = options?.delayMs ?? 3000
  }

  private async delay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delayMs))
  }

  /**
   * Search Soko Glam for a product by brand + name using Shopify's search API.
   */
  async searchProduct(brand: string, productName: string): Promise<ScrapedPrice[]> {
    const query = `${brand} ${productName}`.trim()
    const searchUrl = `${BASE_URL}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=10`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn(`[soko-glam] Search returned ${response.status} for "${query}"`)
        return []
      }

      const data = await response.json() as ShopifySearchResponse

      await this.delay()

      const products = data.resources?.results?.products
      if (!products || products.length === 0) return []

      const results: ScrapedPrice[] = []

      for (const product of products) {
        const price = parseFloat(product.price)
        if (isNaN(price) || price <= 0) continue

        let imageUrl = product.image
        if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl

        results.push({
          retailer: 'soko_glam',
          product_name: product.title,
          brand: product.vendor || brand,
          price_usd: Math.round(price * 100) / 100,
          price_krw: null,
          url: `${BASE_URL}${product.url}`,
          in_stock: product.available,
          image_url: imageUrl,
        })

        if (results.length >= 5) break
      }

      return results
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[soko-glam] Search timed out for "${brand} ${productName}"`)
      } else {
        console.error(
          `[soko-glam] Search failed for "${brand} ${productName}":`,
          error instanceof Error ? error.message : error
        )
      }
      return []
    }
  }
}
