import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mock price database - In production, this would connect to real price APIs
const PRICE_DATABASE: Record<string, any> = {
  // Popular skincare barcodes (these would be real in production)
  '8809581447639': {
    name: 'Snail 96 Mucin Power Essence',
    brand: 'COSRX',
    category: 'Essence',
    size: '100ml',
    prices: {
      amazon: 23.00,
      sephora: 29.00,
      ulta: 28.00,
      target: 24.99,
      yesstyle: 18.00,
      oliveyoung: 15.00
    }
  },
  '8806334375775': {
    name: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    category: 'Serum',
    size: '30ml',
    prices: {
      amazon: 17.99,
      sephora: 24.00,
      ulta: 23.00,
      yesstyle: 14.00,
      stylevana: 13.50
    }
  },
  '3337875774085': {
    name: 'Cicaplast Baume B5',
    brand: 'La Roche-Posay',
    category: 'Treatment',
    size: '40ml',
    prices: {
      amazon: 14.99,
      cvs: 19.99,
      walgreens: 18.99,
      target: 16.99,
      ulta: 17.99
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      barcode,
      storePrice,
      storeName,
      userId,
      whatsappNumber,
      existingProducts
    } = await request.json()

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 })
    }

    // Look up product by barcode (would use real API in production)
    const productInfo = await lookupProduct(barcode)

    if (!productInfo) {
      // Try alternative lookup methods
      const alternativeProduct = await alternativeLookup(barcode)
      if (!alternativeProduct) {
        return NextResponse.json({
          error: 'Product not found. Try taking a photo of the product instead.',
          barcode
        }, { status: 404 })
      }
    }

    // Get current online prices
    const priceComparison = await comparePrices(
      productInfo || { name: 'Unknown Product', prices: {} },
      storePrice
    )

    // Check for similar products in user's collection
    const duplicateCheck = checkForSimilarProducts(
      productInfo,
      existingProducts || []
    )

    // Analyze if user needs this product
    const userProfile = await getUserProfile(whatsappNumber)
    const personalizedRecommendation = analyzeForUser(
      productInfo,
      duplicateCheck,
      userProfile
    )

    // Generate Bailey's insight
    const baileyMessage = generateBaileyInsight(
      priceComparison,
      duplicateCheck,
      personalizedRecommendation
    )

    // Save scan to database
    const { data: savedScan } = await supabase
      .from('scanned_products')
      .insert({
        user_id: userId,
        barcode,
        product_name: productInfo?.name || 'Unknown',
        brand: productInfo?.brand || 'Unknown',
        retail_price: storePrice,
        store_location: storeName,
        online_prices: priceComparison.online,
        ingredients: productInfo?.ingredients || '',
        cleanliness_rating: calculateCleanlinessScore(productInfo?.ingredients),
        user_needs_this: personalizedRecommendation.userNeedsThis,
        similar_owned_products: duplicateCheck.similar,
        ai_recommendation: baileyMessage
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      product: productInfo || { name: 'Product Found', brand: 'Check Details' },
      storeName,
      priceComparison,
      ingredients: productInfo?.ingredients ? {
        cleanlinessScore: calculateCleanlinessScore(productInfo.ingredients)
      } : null,
      recommendation: personalizedRecommendation,
      duplicateCheck,
      baileyMessage,
      savedId: savedScan?.id
    })

  } catch (error) {
    console.error('Error in barcode lookup:', error)
    return NextResponse.json({ error: 'Failed to process barcode' }, { status: 500 })
  }
}

async function lookupProduct(barcode: string) {
  // Check our mock database first
  if (PRICE_DATABASE[barcode]) {
    return PRICE_DATABASE[barcode]
  }

  // In production, would call real barcode APIs like:
  // - Open Food Facts API
  // - Barcode Lookup API
  // - UPC Database API
  // - Brand-specific APIs

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Return mock data for demo
  if (barcode.startsWith('0')) {
    return {
      name: 'CeraVe Moisturizing Cream',
      brand: 'CeraVe',
      category: 'Moisturizer',
      size: '453g',
      prices: {
        amazon: 14.99,
        cvs: 19.99,
        target: 16.99,
        walmart: 13.88
      },
      ingredients: 'Aqua, Cetearyl Alcohol, Ceramides, Niacinamide, Hyaluronic Acid'
    }
  }

  return null
}

async function alternativeLookup(barcode: string) {
  // Try different lookup methods
  // 1. Check if it's an internal store code
  // 2. Try ISBN lookup for beauty books
  // 3. Try manufacturer code patterns

  // For demo, return null
  return null
}

async function comparePrices(product: any, storePrice: number) {
  const onlinePrices = product.prices || {}

  // Find lowest online price
  let lowestPrice = storePrice
  let lowestRetailer = 'current store'

  Object.entries(onlinePrices).forEach(([retailer, price]) => {
    if ((price as number) < lowestPrice) {
      lowestPrice = price as number
      lowestRetailer = retailer
    }
  })

  const savings = storePrice - lowestPrice

  // Determine verdict
  let verdict: 'good-deal' | 'overpriced' | 'fair'
  if (savings > storePrice * 0.2) {
    verdict = 'overpriced'
  } else if (savings < storePrice * -0.1) {
    verdict = 'good-deal'
  } else {
    verdict = 'fair'
  }

  return {
    inStore: storePrice,
    online: {
      ...onlinePrices,
      lowest: {
        price: lowestPrice,
        retailer: lowestRetailer,
        savings: Math.max(0, savings)
      }
    },
    verdict,
    savings,
    recommendation: generatePriceRecommendation(verdict, savings)
  }
}

function generatePriceRecommendation(
  verdict: 'good-deal' | 'overpriced' | 'fair',
  savings: number
): string {
  switch (verdict) {
    case 'good-deal':
      return 'Great price! This is lower than most online retailers.'
    case 'overpriced':
      return `You can save $${savings.toFixed(2)} by buying online instead.`
    case 'fair':
      return 'Fair price. Consider online if you can wait for shipping.'
    default:
      return 'Compare prices before purchasing.'
  }
}

function checkForSimilarProducts(product: any, existingProducts: any[]) {
  const similar: any[] = []
  let hasDuplicate = false

  if (!product || existingProducts.length === 0) {
    return { hasDuplicate: false, similar: [] }
  }

  existingProducts.forEach(existing => {
    // Check for exact match
    if (existing.productName?.toLowerCase() === product.name?.toLowerCase()) {
      hasDuplicate = true
      similar.push({
        name: existing.productName,
        similarity: 'Exact match - you already own this!'
      })
      return
    }

    // Check for same category and brand
    if (existing.brand === product.brand && existing.productType === product.category) {
      similar.push({
        name: existing.productName,
        similarity: `Same ${product.brand} ${product.category}`
      })
    }

    // Check for similar ingredients
    if (product.ingredients && existing.ingredients) {
      const productIngredients = product.ingredients.toLowerCase().split(',')
      const existingIngredients = existing.ingredients.toLowerCase().split(',')

      const commonIngredients = productIngredients.filter((ing: string) =>
        existingIngredients.some((e: string) => e.includes(ing.trim()))
      )

      if (commonIngredients.length > 3) {
        similar.push({
          name: existing.productName,
          similarity: `Similar ingredients (${commonIngredients.length} in common)`
        })
      }
    }
  })

  return {
    hasDuplicate,
    similar,
    duplicateAdvice: hasDuplicate
      ? "You already own this product! Save your money."
      : similar.length > 0
      ? "You have similar products. Consider if you really need this."
      : null
  }
}

async function getUserProfile(whatsappNumber?: string) {
  if (!whatsappNumber) return null

  const { data } = await supabase
    .from('user_skin_profiles')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .single()

  return data
}

function analyzeForUser(
  product: any,
  duplicateCheck: any,
  userProfile: any
) {
  const recommendation = {
    userNeedsThis: true,
    reason: '',
    similarOwned: duplicateCheck.similar,
    duplicateIngredients: [] as string[],
    betterAlternatives: [] as any[]
  }

  // Check if duplicate
  if (duplicateCheck.hasDuplicate) {
    recommendation.userNeedsThis = false
    recommendation.reason = 'You already own this exact product!'
    return recommendation
  }

  // Check if too many similar products
  if (duplicateCheck.similar.length >= 2) {
    recommendation.userNeedsThis = false
    recommendation.reason = `You have ${duplicateCheck.similar.length} similar products already.`
    return recommendation
  }

  // Check for user's skin concerns
  if (userProfile) {
    if (userProfile.skin_concerns?.includes('acne') && product.category === 'Heavy Cream') {
      recommendation.userNeedsThis = false
      recommendation.reason = 'This might be too heavy for acne-prone skin.'
    } else if (userProfile.current_skin_type === 'oily' && product.category === 'Face Oil') {
      recommendation.userNeedsThis = false
      recommendation.reason = 'You might not need additional oil for oily skin.'
    }
  }

  // Default positive recommendation
  if (recommendation.userNeedsThis) {
    recommendation.reason = product.category
      ? `This ${product.category.toLowerCase()} could be a good addition to your routine.`
      : 'Consider if this fills a gap in your current routine.'
  }

  return recommendation
}

function calculateCleanlinessScore(ingredients?: string): number {
  if (!ingredients) return 50

  const concerningIngredients = [
    'sulfate', 'paraben', 'phthalate', 'formaldehyde',
    'triclosan', 'oxybenzone', 'fragrance', 'parfum'
  ]

  const beneficialIngredients = [
    'hyaluronic', 'niacinamide', 'ceramide', 'peptide',
    'retinol', 'vitamin c', 'salicylic', 'glycolic'
  ]

  const lowerIngredients = ingredients.toLowerCase()
  let score = 70 // Base score

  // Deduct for concerning ingredients
  concerningIngredients.forEach(bad => {
    if (lowerIngredients.includes(bad)) score -= 10
  })

  // Add for beneficial ingredients
  beneficialIngredients.forEach(good => {
    if (lowerIngredients.includes(good)) score += 5
  })

  return Math.max(0, Math.min(100, score))
}

function generateBaileyInsight(
  priceComparison: any,
  duplicateCheck: any,
  recommendation: any
): string {
  let message = ''

  // Price insight
  if (priceComparison.verdict === 'overpriced') {
    message = `⚠️ Overpriced! You can save $${priceComparison.savings.toFixed(2)} online. `
  } else if (priceComparison.verdict === 'good-deal') {
    message = `✅ Good deal! This beats most online prices. `
  } else {
    message = `Price is fair. `
  }

  // Duplicate warning
  if (duplicateCheck.hasDuplicate) {
    message += "But wait - you already own this! Put it back and save your money. "
  } else if (duplicateCheck.similar.length > 0) {
    message += `You have ${duplicateCheck.similar.length} similar products. `
  }

  // Personal recommendation
  if (!recommendation.userNeedsThis) {
    message += recommendation.reason
  } else if (priceComparison.verdict !== 'overpriced') {
    message += "If you need it, this is a reasonable purchase."
  }

  return message
}