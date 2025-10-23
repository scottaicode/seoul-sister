import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { CurrentRoutineProduct, RoutineAnalysis } from '@/types/bailey-profile'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bailey's routine order rules
const ROUTINE_ORDER = {
  morning: [
    'oil-cleanser',
    'water-cleanser',
    'cleanser',
    'exfoliant',
    'toner',
    'essence',
    'serum',
    'ampoule',
    'eye-cream',
    'moisturizer',
    'face-oil',
    'sunscreen'
  ],
  evening: [
    'makeup-remover',
    'oil-cleanser',
    'water-cleanser',
    'cleanser',
    'exfoliant',
    'toner',
    'essence',
    'treatment',
    'serum',
    'ampoule',
    'sheet-mask',
    'eye-cream',
    'moisturizer',
    'face-oil',
    'sleeping-mask',
    'spot-treatment'
  ]
}

// Bailey's product compatibility rules
const INCOMPATIBLE_COMBINATIONS = [
  { ingredients: ['retinol', 'vitamin c'], reason: 'Can cause irritation when used together' },
  { ingredients: ['retinol', 'aha'], reason: 'Too much exfoliation, can damage skin barrier' },
  { ingredients: ['retinol', 'bha'], reason: 'Over-exfoliation risk' },
  { ingredients: ['vitamin c', 'niacinamide'], reason: 'Can reduce effectiveness of both' },
  { ingredients: ['benzoyl peroxide', 'retinol'], reason: 'Can deactivate each other' },
  { ingredients: ['aha', 'bha'], reason: 'Use on alternate days to prevent over-exfoliation' }
]

export async function POST(request: NextRequest) {
  try {
    const { userId, whatsappNumber, products, userProfile } = await request.json()

    if (!products || products.length === 0) {
      return NextResponse.json({
        error: 'No products to analyze',
        message: 'Start by adding your current products using the scanner'
      }, { status: 400 })
    }

    // Analyze routine completeness
    const completenessAnalysis = analyzeCompleteness(products)

    // Check product compatibility
    const compatibilityAnalysis = analyzeCompatibility(products)

    // Evaluate for user's specific needs
    const personalizedAnalysis = await analyzeForUserNeeds(products, userProfile)

    // Generate proper product order
    const routineOrder = generateRoutineOrder(products)

    // Calculate overall scores
    const scores = calculateScores(
      completenessAnalysis,
      compatibilityAnalysis,
      personalizedAnalysis,
      products
    )

    // Generate Bailey's recommendations
    const recommendations = await generateRecommendations(
      products,
      completenessAnalysis,
      compatibilityAnalysis,
      personalizedAnalysis,
      userProfile
    )

    // Save analysis to database
    const analysisResult: Partial<RoutineAnalysis> = {
      userId,
      overallScore: scores.overall,
      scores,
      gaps: completenessAnalysis.gaps,
      conflicts: compatibilityAnalysis.conflicts,
      recommendedOrder: routineOrder,
      improvements: recommendations.improvements,
      aiDetailedAnalysis: recommendations.detailedAnalysis
    }

    const { data: savedAnalysis, error } = await supabase
      .from('routine_analysis')
      .insert({
        user_id: userId,
        whatsapp_number: whatsappNumber,
        routine_score: scores.overall / 100,
        completeness_score: scores.completeness / 100,
        compatibility_score: scores.compatibility / 100,
        missing_categories: completenessAnalysis.gaps.missingCategories,
        product_conflicts: compatibilityAnalysis.conflicts,
        recommended_order: routineOrder,
        improvement_suggestions: recommendations.improvements,
        ai_detailed_analysis: recommendations.detailedAnalysis
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving analysis:', error)
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      baileyInsights: generateBaileyInsights(scores, completenessAnalysis, compatibilityAnalysis),
      savedId: savedAnalysis?.id
    })

  } catch (error) {
    console.error('Error analyzing routine:', error)
    return NextResponse.json({ error: 'Failed to analyze routine' }, { status: 500 })
  }
}

function analyzeCompleteness(products: CurrentRoutineProduct[]) {
  const essentialCategories = ['cleanser', 'moisturizer', 'sunscreen']
  const recommendedCategories = ['toner', 'serum', 'eye-cream']
  const advancedCategories = ['essence', 'ampoule', 'mask', 'treatment']

  const currentCategories = products.map(p => p.productType?.toLowerCase())

  const missingEssentials = essentialCategories.filter(cat => !currentCategories.includes(cat))
  const missingRecommended = recommendedCategories.filter(cat => !currentCategories.includes(cat))
  const missingAdvanced = advancedCategories.filter(cat => !currentCategories.includes(cat))

  return {
    hasEssentials: missingEssentials.length === 0,
    completenessLevel:
      missingEssentials.length === 0 && missingRecommended.length === 0 ? 'complete' :
      missingEssentials.length === 0 ? 'basic' : 'incomplete',
    gaps: {
      missingCategories: [...missingEssentials, ...missingRecommended],
      missingForGoals: [], // Will be filled based on user goals
      recommendations: []
    },
    score: calculateCompletenessScore(missingEssentials, missingRecommended, products.length)
  }
}

function analyzeCompatibility(products: CurrentRoutineProduct[]) {
  const conflicts: any[] = []
  const warnings: string[] = []

  // Extract all ingredients from products
  const productIngredients = products.map(p => ({
    product: p.productName,
    ingredients: extractKeyIngredients(p.ingredients || '')
  }))

  // Check for incompatible combinations
  for (let i = 0; i < productIngredients.length; i++) {
    for (let j = i + 1; j < productIngredients.length; j++) {
      const product1 = productIngredients[i]
      const product2 = productIngredients[j]

      for (const rule of INCOMPATIBLE_COMBINATIONS) {
        const hasConflict = rule.ingredients.every(ing =>
          product1.ingredients.some(i1 => i1.includes(ing)) ||
          product2.ingredients.some(i2 => i2.includes(ing))
        )

        if (hasConflict &&
            rule.ingredients.some(ing => product1.ingredients.some(i1 => i1.includes(ing))) &&
            rule.ingredients.some(ing => product2.ingredients.some(i2 => i2.includes(ing)))) {
          conflicts.push({
            products: [product1.product, product2.product],
            reason: rule.reason,
            solution: 'Use these products at different times of day or on alternate days'
          })
        }
      }
    }
  }

  // Check for too many actives
  const activeCount = productIngredients.reduce((count, p) => {
    const actives = ['retinol', 'aha', 'bha', 'vitamin c', 'niacinamide']
    return count + p.ingredients.filter(ing =>
      actives.some(active => ing.toLowerCase().includes(active))
    ).length
  }, 0)

  if (activeCount > 3) {
    warnings.push('You have many active ingredients. Consider reducing to prevent irritation.')
  }

  return {
    conflicts,
    warnings,
    isCompatible: conflicts.length === 0,
    score: Math.max(0, 100 - (conflicts.length * 20) - (warnings.length * 10))
  }
}

function extractKeyIngredients(ingredientsList: string): string[] {
  const ingredients = ingredientsList.toLowerCase().split(',').map(i => i.trim())
  const keyIngredients = [
    'retinol', 'retinoid', 'vitamin c', 'ascorbic acid', 'niacinamide',
    'salicylic acid', 'glycolic acid', 'lactic acid', 'aha', 'bha',
    'hyaluronic acid', 'peptide', 'ceramide', 'benzoyl peroxide'
  ]

  return ingredients.filter(ing =>
    keyIngredients.some(key => ing.includes(key))
  )
}

async function analyzeForUserNeeds(products: CurrentRoutineProduct[], userProfile: any) {
  if (!userProfile) {
    return {
      score: 50,
      feedback: 'Create your profile for personalized analysis'
    }
  }

  let score = 50
  const feedback: string[] = []

  // Check if products address user's skin concerns
  const concerns = userProfile.skin_concerns || []
  const addressedConcerns: string[] = []

  // Map concerns to required ingredients
  const concernIngredientMap: Record<string, string[]> = {
    'acne': ['salicylic acid', 'niacinamide', 'benzoyl peroxide'],
    'aging': ['retinol', 'peptide', 'vitamin c'],
    'dryness': ['hyaluronic acid', 'ceramide', 'glycerin'],
    'hyperpigmentation': ['vitamin c', 'niacinamide', 'kojic acid', 'arbutin'],
    'sensitivity': ['centella', 'aloe', 'panthenol']
  }

  concerns.forEach((concern: string) => {
    const requiredIngredients = concernIngredientMap[concern] || []
    const hasIngredient = products.some(p =>
      requiredIngredients.some(ing =>
        p.ingredients?.toLowerCase().includes(ing)
      )
    )

    if (hasIngredient) {
      addressedConcerns.push(concern)
      score += 10
    } else {
      feedback.push(`Missing products to address: ${concern}`)
      score -= 5
    }
  })

  // Check if suitable for user's skin type
  const unsuitableProducts = products.filter(p => {
    if (!p.aiReview?.suitability) return false
    return p.aiReview.suitability < 0.5
  })

  if (unsuitableProducts.length > 0) {
    score -= (unsuitableProducts.length * 10)
    feedback.push(`${unsuitableProducts.length} products may not suit your skin type`)
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    addressedConcerns,
    feedback
  }
}

function generateRoutineOrder(products: CurrentRoutineProduct[]) {
  const morningProducts = products.filter(p =>
    p.usageFrequency === 'daily-am' || p.usageFrequency === 'daily-both'
  )
  const eveningProducts = products.filter(p =>
    p.usageFrequency === 'daily-pm' || p.usageFrequency === 'daily-both'
  )

  const sortByOrder = (productList: CurrentRoutineProduct[], orderTemplate: string[]) => {
    return productList.sort((a, b) => {
      const aIndex = orderTemplate.indexOf(a.productType?.toLowerCase() || '')
      const bIndex = orderTemplate.indexOf(b.productType?.toLowerCase() || '')

      if (aIndex === -1 && bIndex === -1) return 0
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1

      return aIndex - bIndex
    }).map(p => p.productName)
  }

  return {
    morning: sortByOrder(morningProducts, ROUTINE_ORDER.morning),
    evening: sortByOrder(eveningProducts, ROUTINE_ORDER.evening)
  }
}

function calculateCompletenessScore(
  missingEssentials: string[],
  missingRecommended: string[],
  totalProducts: number
): number {
  let score = 100

  // Heavy penalty for missing essentials
  score -= missingEssentials.length * 20

  // Moderate penalty for missing recommended
  score -= missingRecommended.length * 10

  // Bonus for having a comprehensive routine
  if (totalProducts >= 5) score += 10
  if (totalProducts >= 7) score += 10

  return Math.max(0, Math.min(100, score))
}

function calculateScores(
  completeness: any,
  compatibility: any,
  personalized: any,
  products: CurrentRoutineProduct[]
) {
  // Calculate cleanliness score
  const cleanlinessScores = products.map(p => p.cleanlinessScore || 50)
  const avgCleanliness = cleanlinessScores.length > 0
    ? cleanlinessScores.reduce((a, b) => a + b, 0) / cleanlinessScores.length * 100
    : 50

  // Calculate value score (based on price if available)
  const valueScore = 70 // Default, would calculate based on actual prices

  return {
    completeness: completeness.score,
    compatibility: compatibility.score,
    cleanliness: avgCleanliness,
    effectiveness: personalized.score,
    value: valueScore,
    overall: Math.round(
      (completeness.score * 0.25) +
      (compatibility.score * 0.25) +
      (avgCleanliness * 0.2) +
      (personalized.score * 0.2) +
      (valueScore * 0.1)
    )
  }
}

async function generateRecommendations(
  products: CurrentRoutineProduct[],
  completeness: any,
  compatibility: any,
  personalized: any,
  userProfile: any
) {
  const improvements: string[] = []

  // Completeness recommendations
  if (completeness.gaps.missingCategories.length > 0) {
    improvements.push(
      `Add these essential products: ${completeness.gaps.missingCategories.join(', ')}`
    )
  }

  // Compatibility recommendations
  if (compatibility.conflicts.length > 0) {
    improvements.push(
      'Separate conflicting products to different times of day'
    )
  }

  // Personalized recommendations
  if (personalized.feedback) {
    improvements.push(...personalized.feedback)
  }

  // Order recommendations
  improvements.push('Follow the recommended layering order for better absorption')

  // Generate detailed AI analysis
  const detailedAnalysis = await generateAIAnalysis(
    products,
    completeness,
    compatibility,
    personalized,
    userProfile,
    improvements
  )

  return {
    improvements,
    detailedAnalysis
  }
}

async function generateAIAnalysis(
  products: any,
  completeness: any,
  compatibility: any,
  personalized: any,
  userProfile: any,
  improvements: string[]
) {
  const prompt = `
Analyze this skincare routine and provide Bailey-style insights:

Products: ${products.map((p: any) => `${p.productName} (${p.productType})`).join(', ')}
User Profile: ${userProfile ? `${userProfile.current_skin_type} skin, concerns: ${userProfile.skin_concerns?.join(', ')}` : 'No profile'}
Completeness: ${completeness.completenessLevel}
Conflicts: ${compatibility.conflicts.length} found
Improvements needed: ${improvements.join('; ')}

Provide a caring, educational analysis that:
1. Explains what's working well
2. Identifies critical gaps
3. Suggests specific products to add
4. Warns about any risks
5. Encourages gradual improvement

Keep it friendly and supportive, like Bailey would want.
`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    return (response.content[0] as any).text
  } catch (error) {
    console.error('Error generating AI analysis:', error)
    return 'Your routine shows promise! Focus on adding missing essentials gradually, and remember that consistency is more important than having many products.'
  }
}

function generateBaileyInsights(scores: any, completeness: any, compatibility: any) {
  let insight = ''

  // Overall assessment
  if (scores.overall >= 80) {
    insight = "🌟 Excellent routine! You're taking wonderful care of your skin. "
  } else if (scores.overall >= 60) {
    insight = "👍 Good foundation! A few tweaks will take your routine to the next level. "
  } else if (scores.overall >= 40) {
    insight = "🌱 You're on the right path! Let's strengthen your routine step by step. "
  } else {
    insight = "💫 Let's build you a routine that truly works for your skin! "
  }

  // Specific feedback
  if (!completeness.hasEssentials) {
    insight += "First priority: add the missing essentials (cleanser, moisturizer, sunscreen). "
  }

  if (compatibility.conflicts.length > 0) {
    insight += "Some of your products conflict - I'll help you use them safely. "
  }

  if (scores.cleanliness < 60) {
    insight += "Consider switching to cleaner alternatives for better results. "
  }

  insight += "Remember: start slowly with new products, one at a time!"

  return insight
}