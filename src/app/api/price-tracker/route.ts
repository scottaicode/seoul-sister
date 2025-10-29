import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Enhanced retailer data for price tracking
const TRUSTED_RETAILERS = {
  'yesstyle': {
    name: 'YesStyle',
    baseUrl: 'https://www.yesstyle.com',
    trustScore: 95,
    avgShipping: 7,
    specialties: ['K-Beauty', 'J-Beauty', 'C-Beauty'],
    promoPattern: /(?:SAVE|OFF|SALE)(\d+)/i
  },
  'oliveyoung': {
    name: 'Olive Young Global',
    baseUrl: 'https://global.oliveyoung.com',
    trustScore: 93,
    avgShipping: 10,
    specialties: ['Korean Beauty', 'Authentic Products'],
    promoPattern: /(\d+)(?:%|\s*OFF)/i
  },
  'sephora': {
    name: 'Sephora',
    baseUrl: 'https://www.sephora.com',
    trustScore: 90,
    avgShipping: 3,
    specialties: ['Premium Beauty', 'Fast Shipping'],
    promoPattern: /(\d+)(?:%|\s*OFF)/i
  },
  'ulta': {
    name: 'Ulta Beauty',
    baseUrl: 'https://www.ulta.com',
    trustScore: 88,
    avgShipping: 4,
    specialties: ['Beauty Rewards', 'Sales Events'],
    promoPattern: /(\d+)(?:%|\s*OFF)/i
  },
  'amazon': {
    name: 'Amazon',
    baseUrl: 'https://www.amazon.com',
    trustScore: 85,
    avgShipping: 2,
    specialties: ['Fast Delivery', 'Prime Benefits'],
    promoPattern: /(\d+)(?:%|\s*OFF|\s*COUPON)/i
  },
  'iherb': {
    name: 'iHerb',
    baseUrl: 'https://www.iherb.com',
    trustScore: 88,
    avgShipping: 5,
    specialties: ['K-Beauty', 'Natural Products'],
    promoPattern: /(\d+)(?:%|\s*OFF)/i
  }
}

// GET /api/price-tracker - Get price data and deals for products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const userId = searchParams.get('userId')
    const dealType = searchParams.get('dealType') // 'active', 'expired', 'alerts'

    if (dealType === 'alerts' && userId) {
      return getPriceAlerts(userId)
    }

    if (productId) {
      return getProductPriceHistory(productId)
    }

    // Return current deals and price insights
    return getCurrentDealsAndInsights()

  } catch (error) {
    console.error('Error in price tracker API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/price-tracker - Set price alerts or track new products
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, productId, targetPrice, retailer, productName, productUrl } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    switch (action) {
      case 'set_alert':
        return setPriceAlert(userId, productId, targetPrice, retailer)

      case 'track_product':
        return trackNewProduct(userId, productName, productUrl, retailer)

      case 'check_deals':
        return checkForDeals(userId)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in price tracker POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getCurrentDealsAndInsights() {
  // Simulate current deals data (in production, this would scrape/API call retailers)
  const currentDeals = [
    {
      id: 'deal_1',
      productName: 'COSRX Snail 96 Mucin Power Essence',
      brand: 'COSRX',
      originalPrice: 25.00,
      salePrice: 18.99,
      discount: 24,
      retailer: 'yesstyle',
      retailerName: 'YesStyle',
      trustScore: 95,
      dealExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      dealType: 'flash_sale',
      savingsValue: 6.01,
      availability: 'in_stock',
      authenticity: 'verified',
      shippingDays: 7,
      promoCode: 'KBEAUTY24'
    },
    {
      id: 'deal_2',
      productName: 'Beauty of Joseon Glow Deep Serum',
      brand: 'Beauty of Joseon',
      originalPrice: 17.00,
      salePrice: 12.75,
      discount: 25,
      retailer: 'oliveyoung',
      retailerName: 'Olive Young Global',
      trustScore: 93,
      dealExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      dealType: 'clearance',
      savingsValue: 4.25,
      availability: 'limited_stock',
      authenticity: 'verified',
      shippingDays: 10,
      promoCode: null
    },
    {
      id: 'deal_3',
      productName: 'Laneige Water Sleeping Mask',
      brand: 'Laneige',
      originalPrice: 34.00,
      salePrice: 25.50,
      discount: 25,
      retailer: 'sephora',
      retailerName: 'Sephora',
      trustScore: 90,
      dealExpiry: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      dealType: 'seasonal_sale',
      savingsValue: 8.50,
      availability: 'in_stock',
      authenticity: 'verified',
      shippingDays: 3,
      promoCode: null
    }
  ]

  // Calculate deal insights
  const insights = {
    totalDealsFound: currentDeals.length,
    averageSavings: Math.round(currentDeals.reduce((sum, deal) => sum + deal.discount, 0) / currentDeals.length),
    biggestSaving: Math.max(...currentDeals.map(deal => deal.savingsValue)),
    expiringSoon: currentDeals.filter(deal => {
      const expiry = new Date(deal.dealExpiry)
      const now = new Date()
      const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60)
      return hoursUntilExpiry <= 24
    }).length,
    retailerBreakdown: countByRetailer(currentDeals),
    brandBreakdown: countByBrand(currentDeals)
  }

  return NextResponse.json({
    deals: currentDeals,
    insights,
    lastUpdated: new Date().toISOString(),
    nextUpdateIn: '2 hours'
  })
}

async function setPriceAlert(userId: string, productId: string, targetPrice: number, retailer?: string) {
  try {
    // Check if alert already exists
    const { data: existingAlert } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('retailer', retailer || 'any')
      .single()

    if (existingAlert) {
      // Update existing alert
      const { data, error } = await supabase
        .from('price_alerts')
        .update({
          target_price: targetPrice,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAlert.id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        message: 'Price alert updated successfully',
        alert: data
      })
    }

    // Create new alert
    const { data, error } = await supabase
      .from('price_alerts')
      .insert({
        user_id: userId,
        product_id: productId,
        target_price: targetPrice,
        retailer: retailer || 'any',
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      message: 'Price alert created successfully',
      alert: data
    })

  } catch (error) {
    console.error('Error setting price alert:', error)
    return NextResponse.json({ error: 'Failed to set price alert' }, { status: 500 })
  }
}

async function trackNewProduct(userId: string, productName: string, productUrl: string, retailer: string) {
  try {
    // Extract product info from URL and store for tracking
    const productInfo = await analyzeProductUrl(productUrl, retailer)

    const { data, error } = await supabase
      .from('tracked_products')
      .insert({
        user_id: userId,
        product_name: productName,
        product_url: productUrl,
        retailer: retailer,
        initial_price: productInfo.price,
        brand: productInfo.brand,
        category: productInfo.category,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      message: 'Product added to tracking list',
      product: data,
      priceHistory: productInfo
    })

  } catch (error) {
    console.error('Error tracking new product:', error)
    return NextResponse.json({ error: 'Failed to track product' }, { status: 500 })
  }
}

async function analyzeProductUrl(url: string, retailer: string) {
  // Simulate product analysis (in production, this would scrape the product page)
  const retailerData = TRUSTED_RETAILERS[retailer as keyof typeof TRUSTED_RETAILERS]

  return {
    price: 19.99,
    brand: 'COSRX',
    category: 'Serum',
    availability: 'in_stock',
    retailerInfo: retailerData,
    scrapedAt: new Date().toISOString(),
    authenticity: 'pending_verification'
  }
}

async function getPriceAlerts(userId: string) {
  try {
    const { data: alerts, error } = await supabase
      .from('price_alerts')
      .select(`
        *,
        products (
          name_english,
          brand,
          image_url
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Check for triggered alerts (simulate price checking)
    const triggeredAlerts = alerts?.filter(alert => {
      // Simulate current price check
      const currentPrice = alert.target_price * (0.8 + Math.random() * 0.4) // Random price between 80-120% of target
      return currentPrice <= alert.target_price
    }) || []

    return NextResponse.json({
      activeAlerts: alerts || [],
      triggeredAlerts,
      totalAlerts: alerts?.length || 0
    })

  } catch (error) {
    console.error('Error getting price alerts:', error)
    return NextResponse.json({ error: 'Failed to get price alerts' }, { status: 500 })
  }
}

async function getProductPriceHistory(productId: string) {
  // Simulate price history data
  const priceHistory = generateMockPriceHistory(productId)

  return NextResponse.json({
    productId,
    priceHistory,
    currentBestPrice: Math.min(...priceHistory.map(p => p.price)),
    priceAnalysis: {
      averagePrice: priceHistory.reduce((sum, p) => sum + p.price, 0) / priceHistory.length,
      lowestPrice: Math.min(...priceHistory.map(p => p.price)),
      highestPrice: Math.max(...priceHistory.map(p => p.price)),
      priceVolatility: 'moderate',
      recommendation: 'Good time to buy - price is below average'
    }
  })
}

async function checkForDeals(userId: string) {
  // Get user's skin profile and preferences for personalized deals
  const { data: profile } = await supabase
    .from('user_skin_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Get user's tracked products and alerts
  const { data: trackedProducts } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  // Generate personalized deal recommendations
  const personalizedDeals = await generatePersonalizedDeals(profile, trackedProducts || [])

  return NextResponse.json({
    personalizedDeals,
    savingsOpportunity: calculatePotentialSavings(personalizedDeals),
    dealCount: personalizedDeals.length
  })
}

function generateMockPriceHistory(productId: string) {
  const basePrice = 20 + Math.random() * 30
  const history = []

  for (let i = 30; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    // Simulate price fluctuations
    const variation = (Math.random() - 0.5) * 0.2 // ±10% variation
    const price = Math.max(basePrice * (1 + variation), 5) // Minimum $5

    history.push({
      date: date.toISOString(),
      price: Number(price.toFixed(2)),
      retailer: ['yesstyle', 'sephora', 'ulta', 'amazon'][Math.floor(Math.random() * 4)],
      availability: Math.random() > 0.1 ? 'in_stock' : 'out_of_stock'
    })
  }

  return history
}

function generatePersonalizedDeals(profile: any, trackedProducts: any[]): any[] {
  // Simulate AI-generated personalized deals based on skin profile
  const deals: any[] = []

  if (profile?.skin_concerns?.includes('acne')) {
    deals.push({
      productName: 'COSRX BHA Blackhead Power Liquid',
      reason: 'Perfect for acne-prone skin',
      originalPrice: 25.00,
      salePrice: 19.99,
      discount: 20,
      retailer: 'yesstyle'
    })
  }

  if (profile?.skin_concerns?.includes('dryness')) {
    deals.push({
      productName: 'Laneige Water Bank Moisture Cream',
      reason: 'Excellent for dry skin hydration',
      originalPrice: 38.00,
      salePrice: 28.50,
      discount: 25,
      retailer: 'sephora'
    })
  }

  return deals
}

function calculatePotentialSavings(deals: any[]) {
  return deals.reduce((total, deal) => total + (deal.originalPrice - deal.salePrice), 0)
}

function countByRetailer(deals: any[]) {
  return deals.reduce((acc, deal) => {
    acc[deal.retailer] = (acc[deal.retailer] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

function countByBrand(deals: any[]) {
  return deals.reduce((acc, deal) => {
    acc[deal.brand] = (acc[deal.brand] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}