import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Database } from '@/types/database'
import { PersonalizedRecommendation, SkinType, SkinConcern } from '@/types/skin-analysis'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const whatsappNumber = searchParams.get('whatsapp_number')
    const limit = parseInt(searchParams.get('limit') || '8')

    if (!whatsappNumber) {
      return NextResponse.json({ error: 'WhatsApp number is required' }, { status: 400 })
    }

    const { data: skinProfile }: { data: any } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .single()

    const { data: products, error: productsError }: { data: any[] | null, error: any } = await supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)

    if (productsError || !products) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    const { data: productInterests } = await supabase
      .from('product_interests')
      .select('*')
      .eq('phone_number', whatsappNumber)
      .order('timestamp', { ascending: false })
      .limit(20)

    const recommendations = await generateAdvancedRecommendations(
      products,
      skinProfile,
      productInterests || []
    )

    const limitedRecommendations = recommendations.slice(0, limit)

    return NextResponse.json({
      recommendations: limitedRecommendations,
      user_profile: skinProfile ? {
        skin_type: skinProfile.current_skin_type,
        concerns: skinProfile.skin_concerns,
        preferred_categories: skinProfile.preferred_categories
      } : null,
      analysis_date: skinProfile?.last_analysis_date || null,
      total_products_analyzed: products.length
    })

  } catch (error) {
    console.error('Error generating enhanced recommendations:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { whatsappNumber, preferences, includeExplanation = false } = body

    if (!whatsappNumber) {
      return NextResponse.json({ error: 'WhatsApp number is required' }, { status: 400 })
    }

    const { data: skinProfile }: { data: any } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .single()

    const { data: products }: { data: any[] | null } = await supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)

    if (!products) {
      return NextResponse.json({ error: 'No products available' }, { status: 404 })
    }

    let analysisPrompt = `
Generate personalized Korean skincare product recommendations based on:

${skinProfile ? `
User Skin Profile:
- Skin Type: ${skinProfile.current_skin_type || 'Unknown'}
- Concerns: ${skinProfile.skin_concerns?.join(', ') || 'None specified'}
- Preferred Categories: ${skinProfile.preferred_categories?.join(', ') || 'None specified'}
` : 'No specific skin profile available - provide general recommendations'}

${preferences ? `
Additional Preferences:
- Budget Range: ${preferences.budgetRange || 'Not specified'}
- Routine Complexity: ${preferences.routineComplexity || 'Not specified'}
- Time of Day: ${preferences.timeOfDay || 'Not specified'}
- Specific Concerns: ${preferences.specificConcerns?.join(', ') || 'None'}
` : ''}

Available Products (select from these):
${products.map(p => `
- ${p.name_english} by ${p.brand} (${p.category})
  Price: $${p.seoul_price} (US: $${p.us_price}, ${p.savings_percentage}% savings)
  Ingredients: ${p.ingredients || 'Not specified'}
  Skin Type: ${p.skin_type || 'All types'}
`).join('\n')}

Provide a JSON response with top 8 personalized recommendations:
{
  "recommendations": [
    {
      "productId": "product_id",
      "matchScore": 0.0-1.0,
      "reasons": ["reason1", "reason2", "reason3"],
      "concerns_addressed": ["concern1", "concern2"],
      "routine_placement": "morning|evening|both",
      "expected_benefits": ["benefit1", "benefit2"],
      "compatibility_notes": "brief compatibility note"
    }
  ],
  "routine_suggestions": {
    "morning": ["productId1", "productId2"],
    "evening": ["productId3", "productId4"]
  },
  ${includeExplanation ? '"explanation": "Detailed explanation of recommendation logic",' : ''}
  "confidence_score": 0.0-1.0
}

Focus on evidence-based matching and consider ingredient synergies.
`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 3000,
      messages: [{ role: 'user', content: analysisPrompt }]
    })

    const aiResponse = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Invalid AI response format')
    }

    const aiRecommendations = JSON.parse(jsonMatch[0])

    const enhancedRecommendations = aiRecommendations.recommendations.map((rec: any) => {
      const product = products.find(p => p.id === rec.productId)
      return {
        ...rec,
        product: product ? {
          id: product.id,
          name: product.name_english,
          brand: product.brand,
          category: product.category,
          seoul_price: product.seoul_price,
          us_price: product.us_price,
          savings_percentage: product.savings_percentage,
          image_url: product.image_url
        } : null
      }
    })

    return NextResponse.json({
      ...aiRecommendations,
      recommendations: enhancedRecommendations,
      generated_at: new Date().toISOString(),
      user_profile: skinProfile
    })

  } catch (error) {
    console.error('Error in POST personalized recommendations:', error)
    return NextResponse.json({ error: 'Failed to generate custom recommendations' }, { status: 500 })
  }
}

async function generateAdvancedRecommendations(
  products: any[],
  skinProfile: any,
  productInterests: any[]
): Promise<PersonalizedRecommendation[]> {
  const recommendations: PersonalizedRecommendation[] = []

  if (!skinProfile) {
    return generateGenericRecommendations(products)
  }

  const interestedBrands = [...new Set(productInterests.map(pi => pi.product_brand).filter(Boolean))]
  const interestedCategories = [...new Set(productInterests.map(pi => pi.category).filter(Boolean))]

  for (const product of products) {
    const matchScore = calculateAdvancedMatchScore(
      product,
      skinProfile,
      interestedBrands,
      interestedCategories
    )

    if (matchScore > 0.4) {
      const reasons = generateMatchReasons(product, skinProfile)
      const concernsAddressed = mapProductToConcerns(product, skinProfile.skin_concerns || [])

      recommendations.push({
        productId: product.id,
        matchScore,
        reasons,
        concerns_addressed: concernsAddressed,
        routine_placement: determineRoutinePlacement(product.category),
      })
    }
  }

  return recommendations.sort((a, b) => b.matchScore - a.matchScore)
}

function calculateAdvancedMatchScore(
  product: any,
  skinProfile: any,
  interestedBrands: string[],
  interestedCategories: string[]
): number {
  let score = 0.5

  if (skinProfile.current_skin_type && product.skin_type) {
    const skinTypes = product.skin_type.toLowerCase().split(',').map((s: string) => s.trim())
    if (skinTypes.includes(skinProfile.current_skin_type.toLowerCase()) ||
        skinTypes.includes('all') ||
        skinTypes.includes('all types')) {
      score += 0.15
    }
  }

  if (skinProfile.skin_concerns && skinProfile.skin_concerns.length > 0) {
    const concernMatch = calculateConcernCompatibility(product, skinProfile.skin_concerns)
    score += concernMatch * 0.25
  }

  if (skinProfile.preferred_categories && skinProfile.preferred_categories.includes(product.category?.toLowerCase())) {
    score += 0.1
  }

  if (interestedBrands.includes(product.brand)) {
    score += 0.05
  }

  if (interestedCategories.includes(product.category)) {
    score += 0.05
  }

  return Math.min(score, 1.0)
}

function calculateConcernCompatibility(product: any, concerns: SkinConcern[]): number {
  const ingredients = product.ingredients?.toLowerCase() || ''
  const category = product.category?.toLowerCase() || ''

  const concernMappings: Record<SkinConcern, { ingredients: string[], categories: string[] }> = {
    'acne': {
      ingredients: ['salicylic acid', 'niacinamide', 'tea tree', 'benzoyl peroxide'],
      categories: ['cleanser', 'serum', 'toner']
    },
    'hyperpigmentation': {
      ingredients: ['vitamin c', 'arbutin', 'kojic acid', 'niacinamide'],
      categories: ['serum', 'essence']
    },
    'fine-lines': {
      ingredients: ['retinol', 'peptide', 'collagen'],
      categories: ['serum', 'eye-cream']
    },
    'wrinkles': {
      ingredients: ['retinol', 'peptide', 'vitamin c'],
      categories: ['serum', 'eye-cream']
    },
    'large-pores': {
      ingredients: ['niacinamide', 'salicylic acid'],
      categories: ['toner', 'serum']
    },
    'dullness': {
      ingredients: ['vitamin c', 'alpha hydroxy', 'rice bran'],
      categories: ['serum', 'mask']
    },
    'dark-spots': {
      ingredients: ['vitamin c', 'arbutin', 'kojic acid'],
      categories: ['serum', 'essence']
    },
    'redness': {
      ingredients: ['centella', 'aloe', 'niacinamide'],
      categories: ['serum', 'essence']
    },
    'dryness': {
      ingredients: ['hyaluronic acid', 'ceramide', 'glycerin'],
      categories: ['moisturizer', 'mask']
    },
    'oiliness': {
      ingredients: ['niacinamide', 'salicylic acid'],
      categories: ['toner', 'serum']
    },
    'sensitivity': {
      ingredients: ['centella', 'aloe', 'panthenol'],
      categories: ['essence', 'moisturizer']
    },
    'uneven-texture': {
      ingredients: ['glycolic acid', 'lactic acid'],
      categories: ['exfoliant', 'serum']
    },
    'blackheads': {
      ingredients: ['salicylic acid', 'charcoal'],
      categories: ['cleanser', 'mask']
    },
    'dehydration': {
      ingredients: ['hyaluronic acid', 'sodium hyaluronate'],
      categories: ['essence', 'serum']
    }
  }

  let compatibility = 0
  let concernCount = 0

  concerns.forEach(concern => {
    const mapping = concernMappings[concern]
    if (!mapping) return

    concernCount++
    let concernScore = 0

    mapping.ingredients.forEach(ingredient => {
      if (ingredients.includes(ingredient)) {
        concernScore += 0.5
      }
    })

    mapping.categories.forEach(cat => {
      if (category.includes(cat)) {
        concernScore += 0.3
      }
    })

    compatibility += Math.min(concernScore, 1.0)
  })

  return concernCount > 0 ? compatibility / concernCount : 0
}

function generateMatchReasons(product: any, skinProfile: any): string[] {
  const reasons: string[] = []

  if (skinProfile.current_skin_type && product.skin_type?.toLowerCase().includes(skinProfile.current_skin_type.toLowerCase())) {
    reasons.push(`Suitable for ${skinProfile.current_skin_type} skin`)
  }

  if (product.savings_percentage > 50) {
    reasons.push(`Excellent savings: ${product.savings_percentage}% off US price`)
  }

  if (product.brand === 'COSRX' || product.brand === 'Beauty of Joseon') {
    reasons.push(`Trusted Korean brand with proven results`)
  }

  return reasons.slice(0, 3)
}

function mapProductToConcerns(product: any, userConcerns: SkinConcern[]): SkinConcern[] {
  const ingredients = product.ingredients?.toLowerCase() || ''
  const addressed: SkinConcern[] = []

  const mappings = {
    'acne': ['salicylic acid', 'niacinamide', 'tea tree'],
    'hyperpigmentation': ['vitamin c', 'arbutin', 'kojic acid'],
    'dryness': ['hyaluronic acid', 'ceramide', 'glycerin']
  } as Record<SkinConcern, string[]>

  userConcerns.forEach(concern => {
    const targetIngredients = mappings[concern]
    if (targetIngredients?.some(ingredient => ingredients.includes(ingredient))) {
      addressed.push(concern)
    }
  })

  return addressed
}

function determineRoutinePlacement(category: string): 'morning' | 'evening' | 'both' {
  const morningCategories = ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen']
  const eveningCategories = ['cleanser', 'toner', 'serum', 'moisturizer', 'mask']

  const cat = category?.toLowerCase()

  if (cat === 'sunscreen') return 'morning'
  if (cat === 'mask' || cat === 'exfoliant') return 'evening'

  return 'both'
}

function generateGenericRecommendations(products: any[]): PersonalizedRecommendation[] {
  return products
    .slice(0, 8)
    .map(product => ({
      productId: product.id,
      matchScore: 0.6,
      reasons: ['Popular Korean beauty essential', `${product.savings_percentage}% savings`],
      concerns_addressed: [],
      routine_placement: determineRoutinePlacement(product.category) as 'morning' | 'evening' | 'both'
    }))
}