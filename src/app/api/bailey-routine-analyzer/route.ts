import { NextRequest, NextResponse } from 'next/server'
import { ingredientAnalyzer } from '@/lib/ingredient-analyzer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RoutineProduct {
  name: string
  category: string
  ingredients: string[]
  step: number
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const userId = formData.get('userId') as string

    // In production, this would analyze multiple product images
    // For now, we'll simulate routine analysis with demo data

    // Get user's skin profile
    let userSkinType = 'normal'
    let userConcerns: string[] = []

    if (userId) {
      const { data: profile } = await supabase
        .from('user_skin_profiles')
        .select('current_skin_type, skin_concerns')
        .eq('whatsapp_number', userId)
        .single() as any

      if (profile) {
        userSkinType = profile.current_skin_type || 'normal'
        userConcerns = profile.skin_concerns || []
      }
    }

    // Simulate routine products (in production, these would be extracted from images)
    const routineProducts: RoutineProduct[] = [
      {
        name: "Gentle Foam Cleanser",
        category: "cleanser",
        ingredients: ["water", "glycerin", "cocamidopropyl betaine"],
        step: 1
      },
      {
        name: "BHA Toner",
        category: "toner",
        ingredients: ["water", "salicylic acid", "niacinamide"],
        step: 2
      },
      {
        name: "Vitamin C Serum",
        category: "serum",
        ingredients: ["water", "ascorbic acid", "vitamin e"],
        step: 3
      },
      {
        name: "Hyaluronic Acid Moisturizer",
        category: "moisturizer",
        ingredients: ["water", "hyaluronic acid", "ceramides"],
        step: 4
      }
    ]

    // Analyze routine compatibility
    const routineAnalysis = analyzeRoutineCompatibility(routineProducts, userSkinType)

    // Check for ingredient conflicts
    const conflicts = checkIngredientConflicts(routineProducts)

    // Generate optimal layering order
    const optimalOrder = generateOptimalOrder(routineProducts)

    // Calculate overall routine score
    const routineScore = calculateRoutineScore(routineAnalysis, conflicts)

    // Generate Bailey's personalized analysis
    const baileyAnalysis = generateBaileyRoutineAnalysis(
      routineProducts,
      routineScore,
      conflicts,
      userSkinType,
      userConcerns
    )

    return NextResponse.json({
      routineScore,
      productCount: routineProducts.length,
      optimalOrder,
      conflicts,
      recommendations: routineAnalysis.recommendations,
      warnings: routineAnalysis.warnings,
      baileyAnalysis,
      improvements: generateImprovements(routineProducts, userSkinType, userConcerns)
    })

  } catch (error) {
    console.error('Routine analyzer error:', error)

    // Return demo analysis
    return NextResponse.json({
      routineScore: 78,
      productCount: 4,
      optimalOrder: [
        "1. Cleanser (pH 5.5)",
        "2. Toner (pH 3.5 - BHA)",
        "3. Serum (pH 3.0 - Vitamin C)",
        "4. Moisturizer (pH 5.5-6.5)"
      ],
      conflicts: [
        {
          products: ["Vitamin C Serum", "BHA Toner"],
          issue: "Using acids together may cause irritation",
          solution: "Alternate usage - BHA in PM, Vitamin C in AM"
        }
      ],
      recommendations: [
        "Add SPF for morning routine",
        "Consider adding a hydrating essence before serum",
        "Add a gentle retinol for anti-aging benefits"
      ],
      warnings: [
        "Multiple actives detected - introduce gradually",
        "Ensure adequate wait time between acid products"
      ],
      baileyAnalysis: "Your routine shows good understanding of skincare basics! I notice you're using both BHA and Vitamin C - while effective, this combination might be too strong for daily use. I'd suggest using BHA in the evening and Vitamin C in the morning. The layering order is mostly correct, but you might benefit from adding a hydrating essence between your toner and serum for better absorption. Your cleanser and moisturizer choices are excellent for maintaining skin barrier health. Consider adding SPF as your final morning step - it's non-negotiable for anti-aging!",
      improvements: [
        {
          category: "Missing Steps",
          items: ["Sunscreen (AM)", "Double cleanse (PM)", "Weekly exfoliation"]
        },
        {
          category: "Product Upgrades",
          items: ["Add peptides for anti-aging", "Include centella for soothing"]
        }
      ]
    })
  }
}

function analyzeRoutineCompatibility(
  products: RoutineProduct[],
  skinType: string
): { recommendations: string[], warnings: string[] } {
  const recommendations: string[] = []
  const warnings: string[] = []

  // Check for missing essential steps
  const categories = products.map(p => p.category)

  if (!categories.includes('cleanser')) {
    recommendations.push('Add a gentle cleanser as first step')
  }

  if (!categories.includes('moisturizer')) {
    recommendations.push('Add a moisturizer to seal in hydration')
  }

  if (!categories.includes('sunscreen')) {
    recommendations.push('Add SPF for morning routine')
  }

  // Check for skin type compatibility
  const hasOilControl = products.some(p =>
    p.ingredients.some(i => i.includes('salicylic') || i.includes('niacinamide'))
  )

  if (skinType === 'oily' && !hasOilControl) {
    recommendations.push('Consider adding oil-control ingredients')
  }

  if (skinType === 'dry' && hasOilControl) {
    warnings.push('Oil-control products may be too drying for your skin type')
  }

  return { recommendations, warnings }
}

function checkIngredientConflicts(products: RoutineProduct[]): any[] {
  const conflicts: any[] = []

  // Check for vitamin C + retinol conflict
  const hasVitaminC = products.some(p =>
    p.ingredients.some(i => i.includes('ascorbic') || i.includes('vitamin c'))
  )
  const hasRetinol = products.some(p =>
    p.ingredients.some(i => i.includes('retinol') || i.includes('retinoid'))
  )

  if (hasVitaminC && hasRetinol) {
    conflicts.push({
      products: ["Vitamin C product", "Retinol product"],
      issue: "May cause irritation when used together",
      solution: "Use Vitamin C in AM, Retinol in PM"
    })
  }

  // Check for multiple acids
  const acidProducts = products.filter(p =>
    p.ingredients.some(i =>
      i.includes('acid') && !i.includes('hyaluronic')
    )
  )

  if (acidProducts.length > 1) {
    conflicts.push({
      products: acidProducts.map(p => p.name),
      issue: "Multiple acids may over-exfoliate",
      solution: "Alternate usage or reduce frequency"
    })
  }

  return conflicts
}

function generateOptimalOrder(products: RoutineProduct[]): string[] {
  // Sort by product category in optimal application order
  const orderMap: Record<string, number> = {
    'cleanser': 1,
    'toner': 2,
    'essence': 3,
    'serum': 4,
    'ampoule': 5,
    'eye-cream': 6,
    'moisturizer': 7,
    'face-oil': 8,
    'sunscreen': 9
  }

  return products
    .sort((a, b) => (orderMap[a.category] || 99) - (orderMap[b.category] || 99))
    .map((p, i) => `${i + 1}. ${p.name} (${p.category})`)
}

function calculateRoutineScore(
  analysis: any,
  conflicts: any[]
): number {
  let score = 100

  // Deduct for conflicts
  score -= conflicts.length * 10

  // Deduct for warnings
  score -= analysis.warnings.length * 5

  // Bonus for complete routine
  if (analysis.recommendations.length === 0) {
    score += 10
  }

  return Math.max(0, Math.min(100, score))
}

function generateBaileyRoutineAnalysis(
  products: RoutineProduct[],
  score: number,
  conflicts: any[],
  skinType: string,
  concerns: string[]
): string {
  let analysis = ""

  // Opening based on score
  if (score >= 80) {
    analysis = "Your routine is looking fantastic! "
  } else if (score >= 60) {
    analysis = "Good foundation, but there's room for optimization! "
  } else {
    analysis = "Let's work on improving your routine together! "
  }

  // Comment on product count
  if (products.length > 7) {
    analysis += "You're using quite a few products - remember, sometimes less is more. "
  } else if (products.length < 3) {
    analysis += "Your minimalist approach is great, but you might be missing some key steps. "
  }

  // Address conflicts
  if (conflicts.length > 0) {
    analysis += `I noticed some potential conflicts: ${conflicts[0].issue}. ${conflicts[0].solution}. `
  }

  // Skin type specific advice
  const skinAdvice: Record<string, string> = {
    'oily': "For oily skin, focus on lightweight, water-based formulas and oil-control ingredients.",
    'dry': "For dry skin, layer hydrating products and seal with a rich moisturizer.",
    'combination': "For combination skin, consider using different products on different areas of your face.",
    'sensitive': "For sensitive skin, introduce new products slowly and avoid harsh actives.",
    'normal': "Your normal skin type gives you flexibility - focus on prevention and maintenance."
  }

  analysis += skinAdvice[skinType] || ""

  // Add specific concern advice
  if (concerns.includes('acne')) {
    analysis += " For acne, ensure you're using non-comedogenic products and consider adding BHA."
  }

  if (concerns.includes('aging')) {
    analysis += " For anti-aging, retinol and peptides are your best friends."
  }

  return analysis
}

function generateImprovements(
  products: RoutineProduct[],
  skinType: string,
  concerns: string[]
): any[] {
  const improvements: any[] = []

  const categories = products.map(p => p.category)

  // Missing steps based on concerns
  const missingSteps: string[] = []

  if (!categories.includes('sunscreen')) {
    missingSteps.push('Sunscreen (essential for anti-aging)')
  }

  if (concerns.includes('aging') && !categories.includes('eye-cream')) {
    missingSteps.push('Eye cream for fine lines')
  }

  if (missingSteps.length > 0) {
    improvements.push({
      category: "Missing Steps",
      items: missingSteps
    })
  }

  // Ingredient suggestions
  const beneficialIngredients: string[] = []

  if (concerns.includes('dark spots')) {
    beneficialIngredients.push('Niacinamide for brightening')
  }

  if (skinType === 'dry') {
    beneficialIngredients.push('Ceramides for barrier repair')
  }

  if (beneficialIngredients.length > 0) {
    improvements.push({
      category: "Ingredient Additions",
      items: beneficialIngredients
    })
  }

  return improvements
}