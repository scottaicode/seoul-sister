import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bailey's comprehensive ingredient database
const INGREDIENT_DATABASE = {
  beneficial: {
    'hyaluronic acid': { benefits: ['hydration', 'plumping'], suitable: ['all'], rating: 5 },
    'niacinamide': { benefits: ['brightening', 'pore-minimizing', 'oil-control'], suitable: ['all'], rating: 5 },
    'vitamin c': { benefits: ['brightening', 'antioxidant', 'collagen'], suitable: ['most'], rating: 4 },
    'retinol': { benefits: ['anti-aging', 'acne', 'texture'], suitable: ['experienced'], rating: 5 },
    'salicylic acid': { benefits: ['acne', 'exfoliation', 'blackheads'], suitable: ['oily', 'acne-prone'], rating: 4 },
    'glycolic acid': { benefits: ['exfoliation', 'brightness', 'texture'], suitable: ['most'], rating: 4 },
    'centella asiatica': { benefits: ['soothing', 'healing', 'anti-inflammatory'], suitable: ['all'], rating: 5 },
    'ceramides': { benefits: ['barrier-repair', 'hydration', 'protection'], suitable: ['all'], rating: 5 },
    'peptides': { benefits: ['anti-aging', 'firming', 'collagen'], suitable: ['all'], rating: 4 },
    'green tea': { benefits: ['antioxidant', 'soothing', 'anti-aging'], suitable: ['all'], rating: 4 },
    'snail mucin': { benefits: ['healing', 'hydration', 'anti-aging'], suitable: ['most'], rating: 4 },
    'rice water': { benefits: ['brightening', 'hydration', 'soothing'], suitable: ['all'], rating: 4 },
    'vitamin e': { benefits: ['antioxidant', 'moisturizing', 'healing'], suitable: ['all'], rating: 4 },
    'aloe vera': { benefits: ['soothing', 'healing', 'hydration'], suitable: ['all'], rating: 4 },
    'panthenol': { benefits: ['healing', 'hydration', 'soothing'], suitable: ['all'], rating: 4 },
    'allantoin': { benefits: ['soothing', 'healing', 'moisturizing'], suitable: ['all'], rating: 4 },
    'arbutin': { benefits: ['brightening', 'pigmentation', 'gentle'], suitable: ['all'], rating: 4 },
    'kojic acid': { benefits: ['brightening', 'pigmentation'], suitable: ['most'], rating: 3 },
    'azelaic acid': { benefits: ['acne', 'rosacea', 'pigmentation'], suitable: ['most'], rating: 4 },
    'squalane': { benefits: ['moisturizing', 'non-comedogenic', 'barrier'], suitable: ['all'], rating: 5 }
  },
  concerning: {
    'alcohol denat': { concerns: ['drying', 'irritating'], severity: 'high' },
    'fragrance': { concerns: ['irritating', 'allergenic'], severity: 'medium' },
    'essential oils': { concerns: ['irritating', 'photosensitizing'], severity: 'medium' },
    'sodium lauryl sulfate': { concerns: ['stripping', 'irritating'], severity: 'high' },
    'mineral oil': { concerns: ['comedogenic', 'occlusive'], severity: 'low' },
    'parabens': { concerns: ['controversial', 'preservative'], severity: 'low' },
    'phthalates': { concerns: ['endocrine', 'controversial'], severity: 'medium' },
    'formaldehyde': { concerns: ['carcinogenic', 'irritating'], severity: 'high' },
    'triclosan': { concerns: ['antibacterial-resistance', 'endocrine'], severity: 'medium' },
    'oxybenzone': { concerns: ['coral-toxic', 'allergenic'], severity: 'medium' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, userId, whatsappNumber, existingProducts } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 })
    }

    // Bailey's Vision: Analyze product photo with Claude Vision
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    const visionResponse = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `You are Bailey's skincare expert. Analyze this skincare product image and extract all information.

Please identify and return a JSON response with:
{
  "productName": "exact product name",
  "brand": "brand name",
  "productType": "cleanser|toner|serum|moisturizer|sunscreen|treatment|mask|other",
  "size": "product size if visible",
  "ingredients": "full ingredient list if visible (INCI names)",
  "keyIngredients": ["list of highlighted/marketed ingredients"],
  "claims": ["product claims visible on packaging"],
  "usage": "AM|PM|BOTH",
  "targetConcerns": ["acne", "aging", "dryness", etc],
  "skinTypes": ["oily", "dry", "combination", "sensitive", "all"],
  "isKBeauty": true/false,
  "packaging": "tube|jar|bottle|pump|dropper",
  "textVisible": "any other relevant text on the product",
  "warnings": ["any warnings or cautions visible"],
  "confidence": 0.0-1.0
}

Be extremely detailed in reading ALL text on the product, especially the ingredients list.
If you can't see ingredients clearly, note that in the response.`
            }
          ]
        }
      ]
    })

    const productData = JSON.parse(
      (visionResponse.content[0] as any).text.match(/\{[\s\S]*\}/)?.[0] || '{}'
    )

    // Bailey's Ingredient Analysis
    const ingredientAnalysis = await analyzeIngredients(productData.ingredients || '')

    // Bailey's Cleanliness Score Calculation
    const cleanlinessScore = calculateCleanlinessScore(ingredientAnalysis)

    // Check for duplicates in user's routine
    const duplicateAnalysis = await checkForDuplicates(
      productData,
      ingredientAnalysis,
      existingProducts
    )

    // Bailey's Personalized Recommendation
    const userProfile = await getUserProfile(whatsappNumber)
    const personalizedAnalysis = await generatePersonalizedAnalysis(
      productData,
      ingredientAnalysis,
      userProfile
    )

    // Save to database
    const savedProduct = await saveScannedProduct({
      userId,
      whatsappNumber,
      productData,
      ingredientAnalysis,
      cleanlinessScore,
      duplicateAnalysis,
      personalizedAnalysis
    })

    return NextResponse.json({
      success: true,
      product: productData,
      analysis: {
        cleanlinessScore,
        ingredientAnalysis,
        duplicateAnalysis,
        personalizedRecommendation: personalizedAnalysis,
        savedId: savedProduct?.id
      },
      baileyMessage: generateBaileyMessage(cleanlinessScore, duplicateAnalysis, personalizedAnalysis)
    })

  } catch (error) {
    console.error('Error in Bailey product scanner:', error)
    return NextResponse.json({ error: 'Failed to analyze product' }, { status: 500 })
  }
}

async function analyzeIngredients(ingredientsList: string) {
  const ingredients = ingredientsList.toLowerCase().split(',').map(i => i.trim())
  const analysis = {
    beneficial: [] as any[],
    concerning: [] as any[],
    neutral: [] as any[],
    purpose: {} as Record<string, string>,
    score: 0
  }

  for (const ingredient of ingredients) {
    let found = false

    // Check beneficial ingredients
    for (const [key, data] of Object.entries(INGREDIENT_DATABASE.beneficial)) {
      if (ingredient.includes(key)) {
        analysis.beneficial.push({
          name: ingredient,
          standardName: key,
          benefits: data.benefits,
          rating: data.rating,
          purpose: `Added for ${data.benefits.join(', ')}`
        })
        analysis.purpose[ingredient] = `${data.benefits.join(', ')}`
        analysis.score += data.rating
        found = true
        break
      }
    }

    // Check concerning ingredients
    if (!found) {
      for (const [key, data] of Object.entries(INGREDIENT_DATABASE.concerning)) {
        if (ingredient.includes(key)) {
          analysis.concerning.push({
            name: ingredient,
            standardName: key,
            concerns: data.concerns,
            severity: data.severity,
            purpose: `Controversial: ${data.concerns.join(', ')}`
          })
          analysis.purpose[ingredient] = `⚠️ ${data.concerns.join(', ')}`
          analysis.score -= data.severity === 'high' ? 3 : data.severity === 'medium' ? 2 : 1
          found = true
          break
        }
      }
    }

    // If not found in either, it's neutral
    if (!found && ingredient) {
      analysis.neutral.push({
        name: ingredient,
        purpose: determineIngredientPurpose(ingredient)
      })
      analysis.purpose[ingredient] = determineIngredientPurpose(ingredient)
    }
  }

  return analysis
}

function determineIngredientPurpose(ingredient: string): string {
  // Bailey's ingredient purpose detection
  if (ingredient.includes('water') || ingredient.includes('aqua')) return 'Base/Solvent'
  if (ingredient.includes('glycer')) return 'Humectant/Moisturizer'
  if (ingredient.includes('dimethicone')) return 'Silicone/Smoothing'
  if (ingredient.includes('tocopherol')) return 'Vitamin E/Antioxidant'
  if (ingredient.includes('phenoxy')) return 'Preservative'
  if (ingredient.includes('citric')) return 'pH Adjuster'
  if (ingredient.includes('xanthan')) return 'Thickener/Stabilizer'
  if (ingredient.includes('carbomer')) return 'Gel Former'
  if (ingredient.includes('edta')) return 'Chelating Agent'
  if (ingredient.includes('benzyl')) return 'Preservative/Fragrance'
  return 'Formulation Support'
}

function calculateCleanlinessScore(analysis: any): number {
  // Bailey's cleanliness scoring algorithm
  const beneficialCount = analysis.beneficial.length
  const concerningCount = analysis.concerning.length
  const totalIngredients = beneficialCount + concerningCount + analysis.neutral.length

  if (totalIngredients === 0) return 0

  let score = 50 // Start at neutral

  // Add points for beneficial ingredients
  score += (beneficialCount * 10)

  // Subtract for concerning ingredients
  analysis.concerning.forEach((ing: any) => {
    if (ing.severity === 'high') score -= 20
    else if (ing.severity === 'medium') score -= 10
    else score -= 5
  })

  // Bonus for high ratio of beneficial ingredients
  const beneficialRatio = beneficialCount / totalIngredients
  if (beneficialRatio > 0.5) score += 20
  else if (beneficialRatio > 0.3) score += 10

  // Normalize to 0-100
  return Math.max(0, Math.min(100, score))
}

async function checkForDuplicates(
  newProduct: any,
  ingredientAnalysis: any,
  existingProducts?: any[]
) {
  if (!existingProducts || existingProducts.length === 0) {
    return { hasDuplicates: false }
  }

  const duplicates = {
    hasDuplicates: false,
    similarProducts: [] as any[],
    duplicateIngredients: [] as string[],
    recommendations: [] as string[]
  }

  // Check for similar product types
  const sameTypeProducts = existingProducts.filter(
    p => p.productType === newProduct.productType
  )

  if (sameTypeProducts.length > 0) {
    duplicates.hasDuplicates = true
    duplicates.similarProducts = sameTypeProducts.map(p => ({
      name: p.productName,
      brand: p.brand,
      similarity: 'Same product type'
    }))
    duplicates.recommendations.push(
      `You already have ${sameTypeProducts.length} ${newProduct.productType}(s) in your routine`
    )
  }

  // Check for duplicate key ingredients
  const newKeyIngredients = ingredientAnalysis.beneficial.map((i: any) => i.standardName)
  existingProducts.forEach(product => {
    if (product.keyIngredients) {
      const overlap = product.keyIngredients.filter((ing: string) =>
        newKeyIngredients.includes(ing.toLowerCase())
      )
      if (overlap.length > 0) {
        duplicates.duplicateIngredients.push(...overlap)
      }
    }
  })

  if (duplicates.duplicateIngredients.length > 0) {
    duplicates.recommendations.push(
      `This product contains ingredients you already have: ${[...new Set(duplicates.duplicateIngredients)].join(', ')}`
    )
  }

  return duplicates
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

async function generatePersonalizedAnalysis(
  product: any,
  ingredientAnalysis: any,
  userProfile: any
) {
  const analysis = {
    userNeedsThis: false,
    suitabilityScore: 0,
    reasons: [] as string[],
    warnings: [] as string[],
    betterAlternatives: [] as any[]
  }

  if (!userProfile) {
    analysis.reasons.push('Create your profile for personalized recommendations')
    return analysis
  }

  // Check if product matches user's skin type
  if (product.skinTypes?.includes(userProfile.current_skin_type) ||
      product.skinTypes?.includes('all')) {
    analysis.suitabilityScore += 30
    analysis.reasons.push(`Suitable for your ${userProfile.current_skin_type} skin`)
  } else {
    analysis.warnings.push(`May not be ideal for ${userProfile.current_skin_type} skin`)
    analysis.suitabilityScore -= 20
  }

  // Check if product addresses user's concerns
  const addressedConcerns = product.targetConcerns?.filter((c: string) =>
    userProfile.skin_concerns?.includes(c)
  ) || []

  if (addressedConcerns.length > 0) {
    analysis.suitabilityScore += (addressedConcerns.length * 15)
    analysis.reasons.push(`Targets your concerns: ${addressedConcerns.join(', ')}`)
    analysis.userNeedsThis = true
  }

  // Check for allergens or avoided ingredients
  if (userProfile.current_medications?.includes('accutane')) {
    if (ingredientAnalysis.beneficial.some((i: any) =>
      ['retinol', 'salicylic acid', 'glycolic acid'].includes(i.standardName)
    )) {
      analysis.warnings.push('⚠️ Contains ingredients to avoid while on Accutane')
      analysis.userNeedsThis = false
      analysis.suitabilityScore = 0
    }
  }

  // Calculate final score
  analysis.suitabilityScore = Math.max(0, Math.min(100, analysis.suitabilityScore))

  // Suggest better alternatives from database
  if (analysis.suitabilityScore < 50) {
    const { data: alternatives } = await supabase
      .from('products')
      .select('id, name_english, brand, seoul_price')
      .eq('category', product.productType)
      .eq('skin_type', userProfile.current_skin_type)
      .limit(2)

    if (alternatives) {
      analysis.betterAlternatives = alternatives.map(alt => ({
        name: alt.name_english,
        brand: alt.brand,
        price: alt.seoul_price,
        reason: 'Better match for your skin profile'
      }))
    }
  }

  return analysis
}

async function saveScannedProduct(data: any) {
  const { data: saved, error } = await supabase
    .from('current_routine_products')
    .insert({
      user_id: data.userId,
      whatsapp_number: data.whatsappNumber,
      product_name: data.productData.productName,
      brand: data.productData.brand,
      product_type: data.productData.productType,
      ingredients: data.productData.ingredients,
      cleanliness_score: data.cleanlinessScore / 100,
      ingredient_analysis: data.ingredientAnalysis,
      ai_review: {
        productData: data.productData,
        analysis: data.personalizedAnalysis,
        scannedAt: new Date().toISOString()
      }
    })
    .select()
    .single()

  return saved
}

function generateBaileyMessage(
  cleanlinessScore: number,
  duplicateAnalysis: any,
  personalizedAnalysis: any
): string {
  let message = ''

  // Cleanliness assessment
  if (cleanlinessScore >= 80) {
    message += "✨ Excellent choice! This product has very clean ingredients. "
  } else if (cleanlinessScore >= 60) {
    message += "Good product with mostly beneficial ingredients. "
  } else if (cleanlinessScore >= 40) {
    message += "This product has some concerning ingredients to be aware of. "
  } else {
    message += "⚠️ This product contains several ingredients you might want to avoid. "
  }

  // Duplicate warning
  if (duplicateAnalysis.hasDuplicates) {
    message += `You already have similar products in your routine. `
  }

  // Personalized advice
  if (personalizedAnalysis.userNeedsThis) {
    message += "This would be a great addition to address your skin concerns!"
  } else if (personalizedAnalysis.suitabilityScore < 50) {
    message += "Consider the suggested alternatives for better results."
  }

  return message
}