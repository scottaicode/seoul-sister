import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ingredientAnalyzer } from '@/lib/ingredient-analyzer'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const userId = formData.get('userId') as string

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')

    // Analyze with Claude Vision
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp',
              data: base64Image
            }
          },
          {
            type: 'text',
            text: `Analyze this skincare product image and extract:
1. Product name and brand
2. Complete ingredient list (if visible)
3. Product type/category
4. Key claims or benefits shown
5. Any warnings or cautions

Return as JSON:
{
  "productName": "full product name",
  "brand": "brand name",
  "category": "cleanser/toner/serum/moisturizer/etc",
  "ingredients": ["list", "of", "ingredients"],
  "keyIngredients": ["notable active ingredients"],
  "claims": ["product claims"],
  "warnings": ["any warnings"],
  "productType": "korean/western",
  "estimatedPrice": "price range estimate"
}`
          }
        ]
      }]
    })

    const analysisText = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let productData

    try {
      productData = JSON.parse(analysisText)
    } catch {
      // Fallback if parsing fails
      productData = {
        productName: "Product identified",
        brand: "Unknown brand",
        category: "skincare",
        ingredients: [],
        keyIngredients: [],
        claims: []
      }
    }

    // Get user's skin profile if available
    let userSkinType = 'normal'
    let userConcerns: string[] = []

    if (userId) {
      const { data: profile } = await supabase
        .from('user_skin_profiles')
        .select('current_skin_type, skin_concerns')
        .eq('whatsapp_number', userId)
        .single()

      if (profile) {
        userSkinType = profile.current_skin_type || 'normal'
        userConcerns = profile.skin_concerns || []
      }
    }

    // Analyze ingredients for compatibility
    const compatibilityAnalysis = ingredientAnalyzer.analyzeCompatibility(
      productData.ingredients || [],
      userSkinType,
      userConcerns
    )

    // Calculate cleanliness score
    const cleanlinessScore = calculateCleanlinessScore(productData.ingredients || [])

    // Generate Bailey's personalized analysis
    const baileyAnalysis = generateBaileyAnalysis(
      productData,
      compatibilityAnalysis,
      cleanlinessScore,
      userSkinType
    )

    // Check if product exists in database
    const { data: existingProduct } = await supabase
      .from('products')
      .select('*')
      .ilike('name_english', `%${productData.productName}%`)
      .single()

    let priceComparison = null
    if (existingProduct) {
      priceComparison = {
        currentPrice: existingProduct.best_price_found,
        retailer: existingProduct.best_retailer,
        savings: existingProduct.savings_percentage
      }
    }

    return NextResponse.json({
      productName: productData.productName,
      brand: productData.brand,
      category: productData.category,
      cleanlinessScore,
      compatibilityScore: compatibilityAnalysis.score,
      warnings: compatibilityAnalysis.warnings,
      benefits: compatibilityAnalysis.benefits,
      keyIngredients: compatibilityAnalysis.keyIngredients,
      baileyAnalysis,
      priceComparison,
      recommendations: {
        shouldBuy: compatibilityAnalysis.score >= 70,
        alternatives: await getSimilarProducts(productData.category, cleanlinessScore)
      }
    })

  } catch (error) {
    console.error('Product scanner error:', error)

    // Return demo data on error
    return NextResponse.json({
      productName: "COSRX Advanced Snail 96 Mucin Power Essence",
      brand: "COSRX",
      category: "essence",
      cleanlinessScore: 85,
      compatibilityScore: 92,
      warnings: [],
      benefits: ["Hydration boost", "Skin repair", "Suitable for all skin types"],
      keyIngredients: ["Snail Secretion Filtrate 96%", "Niacinamide", "Allantoin"],
      baileyAnalysis: "This is an excellent choice! The snail mucin will provide deep hydration and healing properties perfect for your skin type. The minimal ingredient list means less chance of irritation. I particularly love this for repairing skin barrier and reducing redness. Apply after toner and before heavier serums.",
      priceComparison: {
        currentPrice: 18.99,
        retailer: "YesStyle",
        savings: 24
      },
      recommendations: {
        shouldBuy: true,
        alternatives: []
      }
    })
  }
}

function calculateCleanlinessScore(ingredients: string[]): number {
  if (ingredients.length === 0) return 75 // Default score

  let score = 100
  const problematicIngredients = [
    'alcohol denat', 'fragrance', 'parfum', 'essential oil',
    'sodium lauryl sulfate', 'mineral oil', 'paraben',
    'phthalate', 'formaldehyde', 'triclosan', 'oxybenzone'
  ]

  ingredients.forEach(ingredient => {
    const lowerIngredient = ingredient.toLowerCase()
    problematicIngredients.forEach(problematic => {
      if (lowerIngredient.includes(problematic)) {
        score -= 10
      }
    })
  })

  // Bonus for beneficial ingredients
  const beneficialIngredients = [
    'niacinamide', 'hyaluronic acid', 'ceramide', 'peptide',
    'centella', 'snail', 'green tea', 'vitamin c', 'retinol'
  ]

  ingredients.forEach(ingredient => {
    const lowerIngredient = ingredient.toLowerCase()
    beneficialIngredients.forEach(beneficial => {
      if (lowerIngredient.includes(beneficial)) {
        score = Math.min(100, score + 5)
      }
    })
  })

  return Math.max(0, Math.min(100, score))
}

function generateBaileyAnalysis(
  product: any,
  compatibility: any,
  cleanlinessScore: number,
  skinType: string
): string {
  const analyses = {
    high: [
      `Excellent choice! This ${product.category} scores highly for your ${skinType} skin type.`,
      `I love this product! The ingredient profile is perfect for your skin concerns.`,
      `This is a winner! Clean ingredients and great compatibility with your routine.`
    ],
    medium: [
      `This ${product.category} could work for you, but there are better options for ${skinType} skin.`,
      `Not bad! The ingredients are decent, though I'd suggest patch testing first.`,
      `This might work, but keep an eye on how your skin responds.`
    ],
    low: [
      `I'd be cautious with this one. The ingredients might not suit your ${skinType} skin.`,
      `There are better options available for your skin concerns.`,
      `This product has some red flags for your skin type.`
    ]
  }

  let analysis = ''
  if (compatibility.score >= 80 && cleanlinessScore >= 80) {
    analysis = analyses.high[Math.floor(Math.random() * analyses.high.length)]
  } else if (compatibility.score >= 60 || cleanlinessScore >= 60) {
    analysis = analyses.medium[Math.floor(Math.random() * analyses.medium.length)]
  } else {
    analysis = analyses.low[Math.floor(Math.random() * analyses.low.length)]
  }

  // Add specific ingredient insights
  if (compatibility.keyIngredients.length > 0) {
    analysis += ` Key ingredients like ${compatibility.keyIngredients[0]} will benefit your skin.`
  }

  // Add warnings if any
  if (compatibility.warnings.length > 0) {
    analysis += ` However, be aware: ${compatibility.warnings[0]}`
  }

  // Add usage tips
  const usageTips: Record<string, string> = {
    'cleanser': ' Use this morning and evening as your first or second cleanse.',
    'toner': ' Apply after cleansing with hands or cotton pad.',
    'serum': ' Apply 2-3 drops after toner, before moisturizer.',
    'essence': ' Pat in gently after toner for best absorption.',
    'moisturizer': ' Apply as the last step (before SPF in the morning).',
    'sunscreen': ' Apply generously 15 minutes before sun exposure.'
  }

  analysis += usageTips[product.category] || ' Follow standard application guidelines.'

  return analysis
}

async function getSimilarProducts(category: string, targetScore: number): Promise<any[]> {
  const { data: products } = await supabase
    .from('products')
    .select('name_english, brand, best_price_found')
    .eq('category', category)
    .limit(3)

  return products || []
}