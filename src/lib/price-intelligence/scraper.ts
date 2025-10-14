import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ProductPrice {
  productId: string;
  retailerId: string;
  currentPrice: number;
  originalPrice?: number;
  salePrice?: number;
  currency: string;
  inStock: boolean;
  stockLevel: 'high' | 'medium' | 'low' | 'out_of_stock';
  retailerProductName: string;
  retailerProductUrl: string;
  retailerSku?: string;
  shippingCost?: number;
  shippingTimeDays?: number;
  priceConfidence: number;
  dataSource: 'scraping' | 'api' | 'manual';
}

export interface ScrapingResult {
  success: boolean;
  retailerId: string;
  retailerName: string;
  productsScraped: number;
  errors: string[];
  duration: number;
  prices: ProductPrice[];
}

export class PriceIntelligenceScraper {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private readonly requestDelay = 2000; // 2 seconds between requests
  private readonly maxRetries = 3;

  constructor() {
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Main scraping orchestrator - runs daily to update all prices
   */
  async scrapeAllRetailers(): Promise<ScrapingResult[]> {
    console.log('🚀 Starting daily price scraping...');
    const startTime = Date.now();

    // Get active retailers from database
    const { data: retailers, error } = await supabase
      .from('price_retailers')
      .select('*')
      .eq('is_active', true)
      .eq('scraping_enabled', true);

    if (error || !retailers) {
      throw new Error(`Failed to fetch retailers: ${error?.message}`);
    }

    const results: ScrapingResult[] = [];

    for (const retailer of retailers) {
      try {
        console.log(`📊 Scraping ${retailer.name}...`);
        const result = await this.scrapeRetailer(retailer);
        results.push(result);

        // Update last scraped timestamp
        await supabase
          .from('price_retailers')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('id', retailer.id);

        // Respect rate limits
        await this.delay(this.requestDelay);
      } catch (error) {
        console.error(`❌ Failed to scrape ${retailer.name}:`, error);
        results.push({
          success: false,
          retailerId: retailer.id,
          retailerName: retailer.name,
          productsScraped: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          duration: 0,
          prices: []
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`✅ Scraping completed in ${totalDuration}ms`);

    return results;
  }

  /**
   * Scrape a specific retailer for K-beauty product prices
   */
  private async scrapeRetailer(retailer: any): Promise<ScrapingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const prices: ProductPrice[] = [];

    try {
      // Get our product catalog to know what to search for
      const { data: products } = await supabase
        .from('products')
        .select('id, name, brand, inci_ingredients');

      if (!products) {
        throw new Error('No products found in catalog');
      }

      // Route to specific retailer scraper
      switch (retailer.domain) {
        case 'sephora.com':
          const sephoraResults = await this.scrapeSephora(products, retailer);
          prices.push(...sephoraResults);
          break;

        case 'yesstyle.com':
          const yesStyleResults = await this.scrapeYesStyle(products, retailer);
          prices.push(...yesStyleResults);
          break;

        case 'global.oliveyoung.com':
          const oliveYoungResults = await this.scrapeOliveYoung(products, retailer);
          prices.push(...oliveYoungResults);
          break;

        case 'stylekorean.com':
          const styleKoreanResults = await this.scrapeStyleKorean(products, retailer);
          prices.push(...styleKoreanResults);
          break;

        case 'amazon.com':
          const amazonResults = await this.scrapeAmazon(products, retailer);
          prices.push(...amazonResults);
          break;

        default:
          throw new Error(`No scraper implemented for ${retailer.domain}`);
      }

      // Save prices to database
      if (prices.length > 0) {
        await this.savePricesToDatabase(prices);
      }

      return {
        success: true,
        retailerId: retailer.id,
        retailerName: retailer.name,
        productsScraped: prices.length,
        errors,
        duration: Date.now() - startTime,
        prices
      };

    } catch (error) {
      return {
        success: false,
        retailerId: retailer.id,
        retailerName: retailer.name,
        productsScraped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: Date.now() - startTime,
        prices: []
      };
    }
  }

  /**
   * Sephora scraper - Premium US retailer
   */
  private async scrapeSephora(products: any[], retailer: any): Promise<ProductPrice[]> {
    const prices: ProductPrice[] = [];

    for (const product of products.slice(0, 5)) { // Limit for testing
      try {
        // Search for product on Sephora
        const searchQuery = encodeURIComponent(`${product.brand} ${product.name}`);
        const searchUrl = `https://www.sephora.com/api/catalog/products?keyword=${searchQuery}`;

        const response = await this.makeRequest(searchUrl, {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        });

        if (response.products && response.products.length > 0) {
          const match = this.findBestMatch(product, response.products);

          if (match) {
            const price: ProductPrice = {
              productId: product.id,
              retailerId: retailer.id,
              currentPrice: match.currentSku?.listPrice || 0,
              originalPrice: match.currentSku?.origlistPrice,
              currency: 'USD',
              inStock: match.currentSku?.isLimitedQuantity === false,
              stockLevel: match.currentSku?.isLimitedQuantity ? 'low' : 'high',
              retailerProductName: match.displayName,
              retailerProductUrl: `https://www.sephora.com/product/${match.productId}`,
              retailerSku: match.currentSku?.skuId,
              shippingCost: retailer.average_shipping_cost,
              shippingTimeDays: retailer.typical_processing_days,
              priceConfidence: 0.9,
              dataSource: 'scraping'
            };

            prices.push(price);
          }
        }

        await this.delay(1000); // Be respectful to Sephora
      } catch (error) {
        console.error(`Error scraping Sephora for ${product.name}:`, error);
      }
    }

    return prices;
  }

  /**
   * YesStyle scraper - Popular Asian beauty retailer
   */
  private async scrapeYesStyle(products: any[], retailer: any): Promise<ProductPrice[]> {
    const prices: ProductPrice[] = [];

    for (const product of products.slice(0, 5)) {
      try {
        const searchQuery = encodeURIComponent(`${product.brand} ${product.name}`);
        const searchUrl = `https://www.yesstyle.com/en/search.html?q=${searchQuery}`;

        // YesStyle typically requires more complex scraping
        // This is a simplified version - would need proper HTML parsing
        const html = await this.makeRequestText(searchUrl);

        // Extract price information from HTML (simplified)
        const priceMatch = html.match(/\$(\d+\.?\d*)/);

        if (priceMatch) {
          const price: ProductPrice = {
            productId: product.id,
            retailerId: retailer.id,
            currentPrice: parseFloat(priceMatch[1]),
            currency: 'USD',
            inStock: !html.includes('out of stock'),
            stockLevel: 'medium',
            retailerProductName: product.name,
            retailerProductUrl: searchUrl,
            shippingCost: retailer.average_shipping_cost,
            shippingTimeDays: retailer.typical_processing_days,
            priceConfidence: 0.7, // Lower confidence for HTML parsing
            dataSource: 'scraping'
          };

          prices.push(price);
        }

        await this.delay(2000); // Be extra respectful
      } catch (error) {
        console.error(`Error scraping YesStyle for ${product.name}:`, error);
      }
    }

    return prices;
  }

  /**
   * Olive Young scraper - Official Korean retailer
   */
  private async scrapeOliveYoung(products: any[], retailer: any): Promise<ProductPrice[]> {
    const prices: ProductPrice[] = [];

    // Olive Young Global has an API-like structure
    for (const product of products.slice(0, 5)) {
      try {
        const searchQuery = encodeURIComponent(product.name);
        const searchUrl = `https://global.oliveyoung.com/product/search?keyword=${searchQuery}`;

        const response = await this.makeRequest(searchUrl, {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        });

        // Process Olive Young response structure
        if (response.data && response.data.products) {
          const match = this.findBestMatch(product, response.data.products);

          if (match) {
            // Convert KRW to USD (approximate)
            const krwToUsd = 0.00075; // This should be updated with real exchange rates

            const price: ProductPrice = {
              productId: product.id,
              retailerId: retailer.id,
              currentPrice: match.salePrice * krwToUsd,
              originalPrice: match.originalPrice * krwToUsd,
              currency: 'USD',
              inStock: match.stockYn === 'Y',
              stockLevel: match.stockYn === 'Y' ? 'high' : 'out_of_stock',
              retailerProductName: match.goodsNm,
              retailerProductUrl: `https://global.oliveyoung.com/product/${match.goodsNo}`,
              retailerSku: match.goodsNo,
              shippingCost: retailer.average_shipping_cost,
              shippingTimeDays: retailer.typical_processing_days,
              priceConfidence: 0.95, // High confidence for official API
              dataSource: 'scraping'
            };

            prices.push(price);
          }
        }

        await this.delay(1500);
      } catch (error) {
        console.error(`Error scraping Olive Young for ${product.name}:`, error);
      }
    }

    return prices;
  }

  /**
   * StyleKorean scraper - K-beauty specialist
   */
  private async scrapeStyleKorean(products: any[], retailer: any): Promise<ProductPrice[]> {
    const prices: ProductPrice[] = [];

    for (const product of products.slice(0, 5)) {
      try {
        const searchQuery = encodeURIComponent(`${product.brand} ${product.name}`);
        const searchUrl = `https://www.stylekorean.com/shop/search_result.php?search_text=${searchQuery}`;

        const html = await this.makeRequestText(searchUrl);

        // Parse StyleKorean HTML structure (simplified)
        const priceMatch = html.match(/\$(\d+\.?\d*)/);
        const nameMatch = html.match(/<h3[^>]*>([^<]+)<\/h3>/);

        if (priceMatch) {
          const price: ProductPrice = {
            productId: product.id,
            retailerId: retailer.id,
            currentPrice: parseFloat(priceMatch[1]),
            currency: 'USD',
            inStock: !html.includes('sold out'),
            stockLevel: 'medium',
            retailerProductName: nameMatch ? nameMatch[1] : product.name,
            retailerProductUrl: searchUrl,
            shippingCost: retailer.average_shipping_cost,
            shippingTimeDays: retailer.typical_processing_days,
            priceConfidence: 0.8,
            dataSource: 'scraping'
          };

          prices.push(price);
        }

        await this.delay(2000);
      } catch (error) {
        console.error(`Error scraping StyleKorean for ${product.name}:`, error);
      }
    }

    return prices;
  }

  /**
   * Amazon scraper - Convenience factor
   */
  private async scrapeAmazon(products: any[], retailer: any): Promise<ProductPrice[]> {
    const prices: ProductPrice[] = [];

    // Amazon scraping is complex due to anti-bot measures
    // This would typically require headless browser or API access
    for (const product of products.slice(0, 3)) {
      try {
        // Amazon Product Advertising API would be preferred
        // This is a simplified placeholder
        const searchQuery = encodeURIComponent(`${product.brand} ${product.name} korean beauty`);

        // Use a more sophisticated approach for Amazon
        // This might require Puppeteer or similar
        const price: ProductPrice = {
          productId: product.id,
          retailerId: retailer.id,
          currentPrice: 25.99, // Placeholder - would come from actual scraping
          currency: 'USD',
          inStock: true,
          stockLevel: 'high',
          retailerProductName: product.name,
          retailerProductUrl: `https://amazon.com/s?k=${searchQuery}`,
          shippingCost: 0, // Amazon Prime
          shippingTimeDays: 2,
          priceConfidence: 0.6, // Lower confidence without real scraping
          dataSource: 'scraping'
        };

        prices.push(price);
        await this.delay(3000); // Amazon requires longer delays
      } catch (error) {
        console.error(`Error scraping Amazon for ${product.name}:`, error);
      }
    }

    return prices;
  }

  /**
   * Find the best matching product from search results
   */
  private findBestMatch(targetProduct: any, searchResults: any[]): any | null {
    if (!searchResults || searchResults.length === 0) return null;

    // Simple matching algorithm - can be improved with fuzzy matching
    const targetName = `${targetProduct.brand} ${targetProduct.name}`.toLowerCase();

    for (const result of searchResults) {
      const resultName = (result.displayName || result.name || result.goodsNm || '').toLowerCase();

      // Check for brand and product name matches
      if (resultName.includes(targetProduct.brand.toLowerCase()) &&
          resultName.includes(targetProduct.name.toLowerCase().split(' ')[0])) {
        return result;
      }
    }

    return searchResults[0]; // Fallback to first result
  }

  /**
   * Save scraped prices to database
   */
  private async savePricesToDatabase(prices: ProductPrice[]): Promise<void> {
    const priceData = prices.map(price => ({
      product_id: price.productId,
      retailer_id: price.retailerId,
      current_price: price.currentPrice,
      original_price: price.originalPrice,
      sale_price: price.salePrice,
      currency: price.currency,
      in_stock: price.inStock,
      stock_level: price.stockLevel,
      retailer_product_name: price.retailerProductName,
      retailer_product_url: price.retailerProductUrl,
      retailer_sku: price.retailerSku,
      shipping_cost: price.shippingCost,
      shipping_time_days: price.shippingTimeDays,
      price_confidence: price.priceConfidence,
      data_source: price.dataSource,
      price_date: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('product_prices')
      .upsert(priceData, {
        onConflict: 'product_id,retailer_id,price_date'
      });

    if (error) {
      throw new Error(`Failed to save prices: ${error.message}`);
    }

    console.log(`💾 Saved ${prices.length} prices to database`);
  }

  /**
   * Make HTTP request with error handling and retries
   */
  private async makeRequest(url: string, headers: Record<string, string> = {}, retries = 0): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          ...headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < this.maxRetries) {
        console.log(`Retrying request to ${url} (${retries + 1}/${this.maxRetries})`);
        await this.delay(1000 * (retries + 1)); // Exponential backoff
        return this.makeRequest(url, headers, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Make HTTP request for HTML content
   */
  private async makeRequestText(url: string, headers: Record<string, string> = {}): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        ...headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Delay execution for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate daily deal alerts based on price changes
   */
  async generateDealAlerts(): Promise<void> {
    console.log('🔍 Analyzing prices for deal opportunities...');

    // Find significant price drops
    const { data: priceChanges } = await supabase.rpc('find_price_drops', {
      min_savings_percentage: 15,
      days_back: 7
    });

    if (priceChanges && priceChanges.length > 0) {
      // Save deals to daily_deals table
      const deals = priceChanges.map((change: any) => ({
        product_id: change.product_id,
        retailer_id: change.retailer_id,
        current_price: change.current_price,
        previous_price: change.previous_price,
        savings_amount: change.savings_amount,
        savings_percentage: change.savings_percentage,
        deal_type: 'price_drop',
        deal_score: Math.min(100, Math.round(change.savings_percentage * 2))
      }));

      await supabase.from('daily_deals').upsert(deals);
      console.log(`🎯 Generated ${deals.length} deal alerts`);
    }
  }
}

export default PriceIntelligenceScraper;