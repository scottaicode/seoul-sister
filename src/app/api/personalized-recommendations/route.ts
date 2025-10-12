import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SkinAnalysisEngine } from '@/lib/skin-analysis'
import type { PersonalizedRecommendation } from '@/types/user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/personalized-recommendations?user_id=xxx&limit=10
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '8')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Fetch user profile
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Get user's interaction history for machine learning
    const { data: interactions } = await supabase
      .from('user_product_interactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Get user's previous analysis results
    const { data: analysisHistory } = await supabase
      .from('skin_analysis_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Fetch all available products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)

    if (productsError || !products) {
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    // Generate personalized recommendations
    const recommendations = await generatePersonalizedRecommendations(
      userProfile,
      products,
      interactions || [],
      analysisHistory || []
    )

    // Limit results
    const limitedRecommendations = recommendations.slice(0, limit)

    return NextResponse.json({
      recommendations: limitedRecommendations,
      user_profile: {
        skin_type: userProfile.skin_type,
        skin_concerns: userProfile.skin_concerns,
        experience_level: userProfile.skincare_experience
      },
      total_products_analyzed: products.length
    })

  } catch (error) {
    console.error('Error generating personalized recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}

async function generatePersonalizedRecommendations(
  userProfile: any,
  products: any[],
  interactions: any[],
  analysisHistory: any[]
): Promise<PersonalizedRecommendation[]> {
  const recommendations: PersonalizedRecommendation[] = []

  // Create sets for quick lookup
  const viewedProducts = new Set(interactions.map(i => i.product_id))
  const analyzedProducts = new Set(analysisHistory.map(a => a.product_id))
  const purchasedProducts = new Set(
    interactions.filter(i => i.interaction_type === 'purchased').map(i => i.product_id)
  )

  for (const product of products) {
    const recommendation = await analyzeProductForUser(
      product,
      userProfile,
      interactions,
      analysisHistory,
      {
        hasViewed: viewedProducts.has(product.id),
        hasAnalyzed: analyzedProducts.has(product.id),
        hasPurchased: purchasedProducts.has(product.id)
      }
    )

    if (recommendation.compatibility_score > 40) { // Only include decent matches
      recommendations.push(recommendation)
    }
  }

  // Sort by compatibility score and apply diversity
  const sortedRecommendations = recommendations.sort((a, b) =>
    b.compatibility_score - a.compatibility_score
  )

  // Apply category diversity to avoid recommending all serums or all masks
  return applyDiversityFilter(sortedRecommendations, userProfile)
}

async function analyzeProductForUser(
  product: any,
  userProfile: any,
  interactions: any[],
  analysisHistory: any[],
  userHistory: {
    hasViewed: boolean
    hasAnalyzed: boolean
    hasPurchased: boolean
  }
): Promise<PersonalizedRecommendation> {
  let compatibilityScore = 50 // Base score

  const reasons: string[] = []
  const riskFactors: string[] = []
  const personalizedBenefits: string[] = []

  // Skin type compatibility
  if (userProfile.skin_type && product.ingredients) {
    const skinTypeBonus = calculateSkinTypeCompatibility(
      product.ingredients,
      userProfile.skin_type
    )
    compatibilityScore += skinTypeBonus

    if (skinTypeBonus > 0) {
      reasons.push(`Formulated for ${userProfile.skin_type} skin`)
    }
  }

  // Skin concerns matching
  if (userProfile.skin_concerns && userProfile.skin_concerns.length > 0) {
    const concernsMatch = calculateConcernsMatch(
      product.ingredients || '',
      product.category,
      userProfile.skin_concerns
    )
    compatibilityScore += concernsMatch.score
    reasons.push(...concernsMatch.reasons)
    personalizedBenefits.push(...concernsMatch.benefits)
  }

  // Allergen detection
  if (userProfile.ingredient_allergies && userProfile.ingredient_allergies.length > 0) {
    const allergenRisk = checkForAllergens(
      product.ingredients || '',
      userProfile.ingredient_allergies
    )
    compatibilityScore -= allergenRisk.penalty
    riskFactors.push(...allergenRisk.warnings)
  }

  // Price range preference
  if (userProfile.price_range_min && userProfile.price_range_max) {
    if (product.seoul_price >= userProfile.price_range_min &&
        product.seoul_price <= userProfile.price_range_max) {
      compatibilityScore += 5
      reasons.push('Within your preferred price range')
    }
  }

  // Experience level adjustment
  if (userProfile.skincare_experience === 'beginner') {
    if (product.category === 'Essence' || product.category === 'Mask') {
      compatibilityScore += 5
      reasons.push('Perfect for beginners')
    }
    if (product.ingredients && product.ingredients.includes('retinol')) {
      compatibilityScore -= 10
      riskFactors.push('Contains advanced ingredients - start slowly')
    }
  }

  // Brand preference based on history
  const brandInteractions = interactions.filter(i =>
    i.interaction_data?.brand === product.brand
  )
  if (brandInteractions.length > 0) {
    const avgRating = brandInteractions
      .filter(i => i.rating)
      .reduce((sum, i) => sum + i.rating, 0) / brandInteractions.length

    if (avgRating > 3.5) {
      compatibilityScore += 8
      reasons.push(`You've liked ${product.brand} products before`)
    }
  }

  // Novelty bonus (encourage trying new products)
  if (!userHistory.hasViewed && !userHistory.hasPurchased) {
    compatibilityScore += 3
  }

  // Previous analysis results
  const existingAnalysis = analysisHistory.find(a => a.product_id === product.id)
  if (existingAnalysis) {
    compatibilityScore = existingAnalysis.compatibility_score
    reasons.push('Based on your previous skin analysis')
  }

  // Determine confidence level
  let confidenceLevel: 'high' | 'medium' | 'low' = 'medium'
  if (compatibilityScore >= 80) confidenceLevel = 'high'
  if (compatibilityScore <= 50) confidenceLevel = 'low'

  // Adjust confidence based on data completeness
  if (!userProfile.skin_type || userProfile.skin_concerns.length === 0) {
    confidenceLevel = 'low'
  }

  return {
    product_id: product.id,
    compatibility_score: Math.min(100, Math.max(0, compatibilityScore)),
    recommendation_reason: reasons.slice(0, 3), // Top 3 reasons
    risk_factors: riskFactors,
    personalized_benefits: personalizedBenefits,
    confidence_level: confidenceLevel
  }
}

function calculateSkinTypeCompatibility(ingredients: string, skinType: string): number {
  const ingredientList = ingredients.toLowerCase()

  const beneficialIngredients = {
    'oily': ['niacinamide', 'salicylic acid', 'tea tree', 'zinc'],
    'dry': ['hyaluronic acid', 'ceramide', 'glycerin', 'squalane'],
    'sensitive': ['centella', 'aloe', 'chamomile', 'panthenol'],
    'combination': ['niacinamide', 'hyaluronic acid'],
    'normal': ['vitamin c', 'retinol', 'peptide']
  }

  const harmfulIngredients = {
    'oily': ['heavy oil', 'petrolatum'],
    'dry': ['alcohol', 'menthol'],
    'sensitive': ['fragrance', 'essential oil', 'alcohol'],
    'combination': ['heavy oil'],
    'normal': []
  }

  const beneficial = beneficialIngredients[skinType as keyof typeof beneficialIngredients] || []
  const harmful = harmfulIngredients[skinType as keyof typeof harmfulIngredients] || []

  let score = 0

  beneficial.forEach(ingredient => {
    if (ingredientList.includes(ingredient)) score += 5
  })

  harmful.forEach(ingredient => {
    if (ingredientList.includes(ingredient)) score -= 8
  })

  return score
}

function calculateConcernsMatch(
  ingredients: string,
  category: string,
  concerns: string[]
): { score: number; reasons: string[]; benefits: string[] } {
  let score = 0
  const reasons: string[] = []
  const benefits: string[] = []

  const concernIngredients = {
    'acne': ['salicylic acid', 'niacinamide', 'tea tree', 'benzoyl peroxide'],
    'aging': ['retinol', 'peptide', 'vitamin c', 'collagen'],
    'hyperpigmentation': ['vitamin c', 'arbutin', 'kojic acid', 'niacinamide'],
    'dryness': ['hyaluronic acid', 'ceramide', 'glycerin'],
    'sensitivity': ['centella', 'aloe', 'panthenol'],
    'dullness': ['vitamin c', 'alpha hydroxy', 'beta hydroxy']
  }

  concerns.forEach(concern => {
    const targetIngredients = concernIngredients[concern as keyof typeof concernIngredients] || []

    targetIngredients.forEach(ingredient => {
      if (ingredients.toLowerCase().includes(ingredient)) {
        score += 8
        reasons.push(`Contains ${ingredient} for ${concern}`)
        benefits.push(`Helps improve ${concern}`)
      }
    })

    // Category bonuses
    if (concern === 'aging' && category === 'Serum') {
      score += 5
      reasons.push('Anti-aging serum')
    }
    if (concern === 'dryness' && category === 'Mask') {
      score += 5
      reasons.push('Hydrating mask treatment')
    }
  })

  return { score, reasons, benefits }
}

function checkForAllergens(
  ingredients: string,
  allergies: string[]
): { penalty: number; warnings: string[] } {
  let penalty = 0
  const warnings: string[] = []

  allergies.forEach(allergen => {
    if (ingredients.toLowerCase().includes(allergen.toLowerCase())) {
      penalty += 25 // Heavy penalty for allergens
      warnings.push(`Contains ${allergen} - known allergen`)
    }
  })

  return { penalty, warnings }
}

function applyDiversityFilter(
  recommendations: PersonalizedRecommendation[],
  userProfile: any
): PersonalizedRecommendation[] {
  const categoryCount: Record<string, number> = {}
  const diversified: PersonalizedRecommendation[] = []

  for (const rec of recommendations) {
    // Get product details to check category
    const category = 'unknown' // Would need to join with products table

    if (!categoryCount[category]) {
      categoryCount[category] = 0
    }

    // Limit to 2-3 products per category for diversity
    if (categoryCount[category] < 3) {
      diversified.push(rec)
      categoryCount[category]++
    }

    // Stop when we have enough recommendations
    if (diversified.length >= 12) break
  }

  return diversified
}