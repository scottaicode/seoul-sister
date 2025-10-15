import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required'
      }, { status: 400 });
    }

    const supabase = createClient();

    // Get all price data for this product across retailers
    const { data: priceData, error: priceError } = await supabase
      .from('product_prices')
      .select(`
        *,
        price_retailers (
          id,
          name,
          domain,
          country
        )
      `)
      .eq('product_id', productId)
      .order('total_cost', { ascending: true });

    if (priceError) {
      console.error('Error fetching price data:', priceError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch price comparison data'
      }, { status: 500 });
    }

    // Get product information
    const productMap: Record<string, any> = {
      'cosrx-snail-essence': {
        name: 'Advanced Snail 96 Mucin Power Essence',
        brand: 'COSRX',
        category: 'skincare',
        image_url: null
      },
      'beauty-joseon-spf': {
        name: 'Relief Sun: Rice + Probiotics SPF50+ PA++++',
        brand: 'Beauty of Joseon',
        category: 'skincare',
        image_url: null
      },
      'innisfree-green-tea-serum': {
        name: 'Green Tea Seed Hyaluronic Serum',
        brand: 'Innisfree',
        category: 'skincare',
        image_url: null
      },
      'some-by-mi-bye-bye-toner': {
        name: 'Bye Bye Blackhead Wonder Miracle Toner',
        brand: 'Some By Mi',
        category: 'skincare',
        image_url: null
      },
      'torriden-dive-in-serum': {
        name: 'DIVE-IN Low Molecule Hyaluronic Acid Serum',
        brand: 'Torriden',
        category: 'skincare',
        image_url: null
      }
    };

    const product = productMap[productId] || {
      name: 'Korean Beauty Product',
      brand: 'K-Beauty',
      category: 'skincare',
      image_url: null
    };

    // Transform the data for the frontend
    const priceComparisons = (priceData || []).map((price: any, index: number) => ({
      retailer: price.price_retailers?.name || 'Unknown Retailer',
      domain: price.price_retailers?.domain || '',
      price: price.current_price || 0,
      originalPrice: price.original_price || null,
      inStock: price.in_stock || false,
      shippingCost: price.shipping_cost || 0,
      totalCost: price.total_cost || (price.current_price + (price.shipping_cost || 0)),
      url: `https://${price.price_retailers?.domain || 'example.com'}/product/${productId}`,
      isBestDeal: index === 0, // First item (lowest total cost) is best deal
      retailerProductName: price.retailer_product_name || product.name,
      currency: price.currency || 'USD',
      lastUpdated: price.updated_at
    }));

    // Calculate comparison metrics
    const inStockPrices = priceComparisons.filter(p => p.inStock);
    const allPrices = priceComparisons.map(p => p.totalCost);

    const analytics = {
      totalRetailers: priceComparisons.length,
      inStockRetailers: inStockPrices.length,
      lowestPrice: Math.min(...allPrices),
      highestPrice: Math.max(...allPrices),
      priceDifference: Math.max(...allPrices) - Math.min(...allPrices),
      avgPrice: allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0,
      maxSavingsPercentage: allPrices.length > 0 ?
        Math.round((1 - Math.min(...allPrices) / Math.max(...allPrices)) * 100) : 0
    };

    return NextResponse.json({
      success: true,
      product,
      priceComparisons,
      analytics,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in product comparison API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}