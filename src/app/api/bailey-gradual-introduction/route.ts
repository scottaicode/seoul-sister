import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GradualIntroductionPlan } from '@/types/bailey-profile'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bailey's wisdom: Product introduction order based on gentleness and importance
const INTRODUCTION_PRIORITY = {
  'cleanser': 1,
  'moisturizer': 2,
  'sunscreen': 3,
  'toner': 4,
  'serum': 5,
  'eye-cream': 6,
  'essence': 7,
  'treatment': 8,
  'exfoliant': 9,
  'mask': 10,
  'oil': 11
}

// Products that commonly cause purging
const PURGING_PRODUCTS = [
  'retinol', 'retinoid', 'tretinoin',
  'salicylic acid', 'bha',
  'glycolic acid', 'lactic acid', 'aha',
  'benzoyl peroxide',
  'vitamin c'
]

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      whatsappNumber,
      products,
      userProfile,
      routineGoal,
      startingFrom = 'scratch' // 'scratch' or 'existing'
    } = await request.json()

    if (!products || products.length === 0) {
      return NextResponse.json({
        error: 'No products to introduce',
        message: 'Add products to your wishlist first'
      }, { status: 400 })
    }

    // Sort products by introduction priority
    const sortedProducts = sortProductsByPriority(products, userProfile, startingFrom)

    // Generate week-by-week plan
    const introductionPlan = generateIntroductionPlan(
      sortedProducts,
      userProfile,
      routineGoal
    )

    // Identify potential purging products
    const purgingAnalysis = analyzePurgingRisk(sortedProducts)

    // Create personalized instructions
    const instructions = generatePersonalizedInstructions(
      introductionPlan,
      purgingAnalysis,
      userProfile
    )

    // Save plan to database
    const { data: savedPlan, error } = await supabase
      .from('routine_introduction_plans')
      .insert({
        user_id: userId,
        whatsapp_number: whatsappNumber,
        plan_name: `${userProfile?.name || 'User'}'s Skincare Journey`,
        total_duration_days: 30,
        current_day: 0,
        current_phase: 'preparation',
        products_to_introduce: sortedProducts,
        introduction_schedule: introductionPlan,
        status: 'not-started',
        expected_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving introduction plan:', error)
    }

    return NextResponse.json({
      success: true,
      plan: {
        ...introductionPlan,
        purgingExpectations: purgingAnalysis,
        personalizedInstructions: instructions,
        savedId: savedPlan?.id
      },
      baileyAdvice: generateBaileyAdvice(sortedProducts, purgingAnalysis, userProfile)
    })

  } catch (error) {
    console.error('Error creating introduction plan:', error)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}

function sortProductsByPriority(
  products: any[],
  userProfile: any,
  startingFrom: string
) {
  return products.sort((a, b) => {
    // Essentials first
    const aPriority = INTRODUCTION_PRIORITY[a.productType as keyof typeof INTRODUCTION_PRIORITY] || 99
    const bPriority = INTRODUCTION_PRIORITY[b.productType as keyof typeof INTRODUCTION_PRIORITY] || 99

    // Gentle products before actives
    const aIsActive = containsActives(a.ingredients)
    const bIsActive = containsActives(b.ingredients)

    if (!aIsActive && bIsActive) return -1
    if (aIsActive && !bIsActive) return 1

    return aPriority - bPriority
  })
}

function containsActives(ingredients: string): boolean {
  if (!ingredients) return false
  const lowerIngredients = ingredients.toLowerCase()
  return PURGING_PRODUCTS.some(active => lowerIngredients.includes(active))
}

function generateIntroductionPlan(
  products: any[],
  userProfile: any,
  routineGoal: string
) {
  const plan: GradualIntroductionPlan['schedule'] = {
    week1: {
      products: [],
      instructions: '',
      watchFor: []
    },
    week2: {
      products: [],
      instructions: '',
      watchFor: []
    },
    week3: {
      products: [],
      instructions: '',
      watchFor: []
    },
    week4: {
      products: [],
      instructions: '',
      watchFor: []
    }
  }

  // Week 1: Start with absolute essentials
  const essentials = products.filter(p =>
    ['cleanser', 'moisturizer', 'sunscreen'].includes(p.productType)
  )
  plan.week1.products = essentials.slice(0, 2).map(p => p.productName)
  plan.week1.instructions = 'Start with the basics. Use gentle cleanser at night, moisturizer morning and night.'
  plan.week1.watchFor = [
    'Any redness or irritation',
    'Tightness after cleansing',
    'Breakouts in unusual areas'
  ]

  // Week 2: Add third essential or hydration
  const week2Products = products.filter(p =>
    ['sunscreen', 'toner', 'essence'].includes(p.productType) &&
    !plan.week1.products.includes(p.productName)
  )
  if (week2Products.length > 0) {
    plan.week2.products = [week2Products[0].productName]
    plan.week2.instructions = week2Products[0].productType === 'sunscreen'
      ? 'Add sunscreen every morning, even indoors. This is your most important anti-aging step.'
      : 'Add hydrating layer after cleansing. Pat gently into skin.'
    plan.week2.watchFor = [
      'Pilling (product rolling off)',
      'Increased oiliness',
      'Sensitivity to sun'
    ]
  }

  // Week 3: Introduce first treatment
  const treatments = products.filter(p =>
    ['serum', 'treatment', 'eye-cream'].includes(p.productType) &&
    !plan.week1.products.includes(p.productName) &&
    !plan.week2.products.includes(p.productName)
  )
  if (treatments.length > 0) {
    const gentleTreatment = treatments.find(t => !containsActives(t.ingredients)) || treatments[0]
    plan.week3.products = [gentleTreatment.productName]
    plan.week3.instructions = containsActives(gentleTreatment.ingredients)
      ? '⚠️ Active ingredient alert! Start using every other night. May cause purging (temporary breakouts).'
      : 'Add targeted treatment. Use after toner/essence, before moisturizer.'
    plan.week3.watchFor = containsActives(gentleTreatment.ingredients)
      ? ['Purging (small breakouts)', 'Dryness or peeling', 'Increased sensitivity']
      : ['Changes in skin texture', 'Improvement in target concerns']
  }

  // Week 4: Add final products or increase frequency
  const remaining = products.filter(p =>
    !plan.week1.products.includes(p.productName) &&
    !plan.week2.products.includes(p.productName) &&
    !plan.week3.products.includes(p.productName)
  )
  if (remaining.length > 0) {
    plan.week4.products = [remaining[0].productName]
    plan.week4.instructions = 'If skin is tolerating everything well, add this final product. Otherwise, focus on consistency.'
  } else {
    plan.week4.products = []
    plan.week4.instructions = 'Focus on consistency. Increase active usage if skin is tolerating well.'
  }
  plan.week4.watchFor = ['Overall skin improvement', 'Need for routine adjustments']

  return plan
}

function analyzePurgingRisk(products: any[]) {
  const purgingProducts = products.filter(p => containsActives(p.ingredients))

  if (purgingProducts.length === 0) {
    return {
      likely: false,
      products: [],
      duration: 'N/A',
      symptoms: [],
      reassurance: 'Your products are gentle and unlikely to cause purging.'
    }
  }

  const purgingIngredients = purgingProducts.map(p => {
    const ingredients = p.ingredients?.toLowerCase() || ''
    return PURGING_PRODUCTS.find(active => ingredients.includes(active))
  }).filter(Boolean)

  return {
    likely: true,
    products: purgingProducts.map(p => p.productName),
    duration: '2-6 weeks',
    symptoms: [
      'Small whiteheads in usual breakout areas',
      'Increased cell turnover (mild peeling)',
      'Temporary increase in breakouts'
    ],
    reassurance: `Purging is NORMAL and TEMPORARY! It means the ${purgingIngredients.join(', ')} is working. Your skin is pushing out trapped debris. This is different from a bad reaction - purging happens only where you usually break out. If you get irritation in new areas, that's a reaction and you should stop the product.`
  }
}

function generatePersonalizedInstructions(
  plan: any,
  purgingAnalysis: any,
  userProfile: any
) {
  const instructions = {
    general: [] as string[],
    skinTypeSpecific: [] as string[],
    medicationWarnings: [] as string[],
    lifestyleAdaptations: [] as string[]
  }

  // General instructions (Bailey's wisdom)
  instructions.general = [
    'Patch test each new product behind your ear for 24 hours',
    'Introduce only ONE new product per week',
    'Take weekly progress photos in the same lighting',
    'Keep a skin diary noting any reactions',
    'Be patient - real results take 6-12 weeks'
  ]

  // Skin type specific
  if (userProfile?.current_skin_type === 'sensitive') {
    instructions.skinTypeSpecific = [
      'Extra caution: Your sensitive skin needs slower introduction',
      'Consider starting with every-other-day use',
      'If irritation occurs, take a break for 2-3 days'
    ]
  } else if (userProfile?.current_skin_type === 'oily') {
    instructions.skinTypeSpecific = [
      'You may tolerate actives better, but still go slow',
      'Watch for over-drying which can increase oil production'
    ]
  } else if (userProfile?.current_skin_type === 'dry') {
    instructions.skinTypeSpecific = [
      'Focus on hydration between active treatments',
      'May need richer formulations than suggested'
    ]
  }

  // Medication warnings
  if (userProfile?.current_medications?.some((med: string) =>
    med.toLowerCase().includes('accutane') || med.toLowerCase().includes('isotretinoin')
  )) {
    instructions.medicationWarnings = [
      '⚠️ ACCUTANE USER: Avoid ALL actives (retinol, acids)',
      'Focus on gentle, hydrating products only',
      'Extra sun protection is critical'
    ]
  }

  // Lifestyle adaptations
  if (userProfile?.lifestyle_factors?.exerciseFrequency === 'daily') {
    instructions.lifestyleAdaptations.push(
      'Wait 30 minutes after workout before applying products'
    )
  }

  if (userProfile?.location_climate === 'dry') {
    instructions.lifestyleAdaptations.push(
      'May need to layer extra hydration in your climate'
    )
  }

  return instructions
}

function generateBaileyAdvice(products: any[], purgingAnalysis: any, userProfile: any) {
  let advice = "🌸 Your personalized introduction plan is ready! "

  // Encouragement based on starting point
  if (products.length <= 3) {
    advice += "Starting simple is perfect - we'll build your routine gradually. "
  } else {
    advice += "You have great products selected! Let's introduce them strategically. "
  }

  // Purging preparation
  if (purgingAnalysis.likely) {
    advice += "⚠️ Important: Some of your products may cause 'purging' - temporary breakouts that mean they're working! Don't give up during weeks 2-4. "
  }

  // Personalized tip
  if (userProfile?.age && userProfile.age < 25) {
    advice += "At your age, consistency matters more than having many products. "
  } else if (userProfile?.age && userProfile.age > 40) {
    advice += "Your skin may take longer to show results - patience is key! "
  }

  advice += "Remember: One product at a time, and your skin will thank you! 💕"

  return advice
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')
    const userId = searchParams.get('userId')

    if (!planId && !userId) {
      return NextResponse.json({ error: 'Plan ID or User ID required' }, { status: 400 })
    }

    let query = supabase
      .from('routine_introduction_plans')
      .select('*')

    if (planId) {
      query = query.eq('id', planId)
    } else if (userId) {
      query = query.eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
    }

    const { data, error } = await query.single()

    if (error || !data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({ plan: data })

  } catch (error) {
    console.error('Error fetching plan:', error)
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
  }
}

// Update plan progress
export async function PUT(request: NextRequest) {
  try {
    const { planId, currentDay, currentPhase, status } = await request.json()

    const { data, error } = await supabase
      .from('routine_introduction_plans')
      .update({
        current_day: currentDay,
        current_phase: currentPhase,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: data })

  } catch (error) {
    console.error('Error updating plan:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}