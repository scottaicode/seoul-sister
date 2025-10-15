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

    // Transform the data for the frontend with authenticity scoring
    const priceComparisons = (priceData || []).map((price: any, index: number) => {
      const authenticityScore = calculateAuthenticityScore(price.price_retailers, price.current_price, product.name);

      return {
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
        lastUpdated: price.updated_at,
        authenticity: authenticityScore
      };
    });

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

function calculateAuthenticityScore(retailer: any, price: number, productName: string): any {
  let score = 0;
  const factors = [];

  // Official retailer status (highest weight) - based on research
  const officialRetailers = {
    'YesStyle': { score: 95, tier: 'VERIFIED', reason: 'Official authorized K-beauty retailer' },
    'StyleKorean': { score: 95, tier: 'VERIFIED', reason: 'Official K-beauty specialist with direct partnerships' },
    'Olive Young Global': { score: 98, tier: 'VERIFIED', reason: 'Official Korean pharmacy chain - guaranteed authentic' },
    'Sephora': { score: 90, tier: 'TRUSTED', reason: 'Authorized premium retailer with strict policies' },
    'Ulta': { score: 85, tier: 'TRUSTED', reason: 'Authorized beauty retailer' },
    'Amazon': { score: 65, tier: 'CAUTION', reason: 'Marketplace - verify seller credentials' }
  };

  const officialStatus = officialRetailers[retailer?.name as keyof typeof officialRetailers];
  if (officialStatus) {
    score = officialStatus.score;
    factors.push({
      factor: 'Retailer Verification',
      impact: officialStatus.score,
      description: officialStatus.reason
    });
  } else {
    score = 45; // Unknown retailer
    factors.push({
      factor: 'Unverified Retailer',
      impact: 45,
      description: 'Retailer not in official database - proceed with caution'
    });
  }

  // Price authenticity check
  const authenticPriceRanges: Record<string, { min: number; max: number }> = {
    'snail': { min: 18, max: 35 }, // COSRX Snail Essence
    'relief sun': { min: 14, max: 28 }, // Beauty of Joseon SPF
    'green tea': { min: 16, max: 30 } // Innisfree Serum
  };

  const priceCheck = Object.entries(authenticPriceRanges).find(([keyword]) =>
    productName.toLowerCase().includes(keyword)
  );

  if (priceCheck && price) {
    const [, range] = priceCheck;
    if (price < range.min * 0.6) {
      score -= 25; // Suspiciously low price
      factors.push({
        factor: 'Price Alert',
        impact: -25,
        description: 'Price significantly below authentic range - counterfeit risk'
      });
    } else if (price >= range.min && price <= range.max) {
      score += 5; // Price in authentic range
      factors.push({
        factor: 'Price Verification',
        impact: 5,
        description: 'Price within expected authentic range'
      });
    }
  }

  // Geographic authenticity
  if (retailer?.country === 'South Korea' || retailer?.country === 'Korea') {
    score += 10;
    factors.push({
      factor: 'Korean Source',
      impact: 10,
      description: 'Korean retailers typically ensure authentic sourcing'
    });
  }

  // Determine risk level and visual indicators - luxury design
  let riskLevel = 'MODERATE';
  let riskColor = '#F59E0B'; // amber
  let iconType = 'warning';
  let recommendation = 'VERIFY CAREFULLY';

  if (score >= 90) {
    riskLevel = 'VERIFIED';
    riskColor = '#D4AF37'; // luxury gold
    iconType = 'verified';
    recommendation = 'VERIFIED AUTHENTIC';
  } else if (score >= 80) {
    riskLevel = 'TRUSTED';
    riskColor = '#10B981'; // emerald
    iconType = 'trusted';
    recommendation = 'TRUSTED RETAILER';
  } else if (score >= 65) {
    riskLevel = 'CAUTION';
    riskColor = '#F59E0B'; // amber
    iconType = 'warning';
    recommendation = 'PROCEED WITH CAUTION';
  } else if (score >= 45) {
    riskLevel = 'HIGH_RISK';
    riskColor = '#F97316'; // orange
    iconType = 'danger';
    recommendation = 'HIGH COUNTERFEIT RISK';
  } else {
    riskLevel = 'AVOID';
    riskColor = '#DC2626'; // red
    iconType = 'blocked';
    recommendation = 'AVOID - LIKELY COUNTERFEIT';
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    riskLevel,
    riskColor,
    iconType,
    recommendation,
    factors,
    lastUpdated: new Date().toISOString()
  };
}