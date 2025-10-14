import { NextResponse } from 'next/server';
import PriceIntelligenceScraper from '@/lib/price-intelligence/scraper';

export async function POST(request: Request) {
  try {
    console.log('🚀 Starting price intelligence scraping...');

    // Verify this is being called from our cron job or admin
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scraper = new PriceIntelligenceScraper();

    // Run the main scraping process
    const results = await scraper.scrapeAllRetailers();

    // Generate deal alerts based on new prices
    await scraper.generateDealAlerts();

    const summary = {
      totalRetailers: results.length,
      successfulRetailers: results.filter(r => r.success).length,
      totalProductsScraped: results.reduce((sum, r) => sum + r.productsScraped, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      results: results.map(r => ({
        retailer: r.retailerName,
        success: r.success,
        productsScraped: r.productsScraped,
        errors: r.errors.length,
        duration: r.duration
      }))
    };

    console.log('✅ Price scraping completed:', summary);

    return NextResponse.json({
      success: true,
      message: 'Price scraping completed successfully',
      summary
    });

  } catch (error) {
    console.error('❌ Price scraping failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint for manual testing
export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Price Intelligence Scraper',
    status: 'Ready',
    endpoints: {
      scrape: 'POST /api/price-intelligence/scrape (requires authorization)',
      prices: 'GET /api/price-intelligence/prices',
      deals: 'GET /api/price-intelligence/deals'
    }
  });
}