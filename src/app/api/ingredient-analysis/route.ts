import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Database } from '@/types/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, whatsappNumber, ingredients } = body

    if (!productId && !ingredients) {
      return NextResponse.json({ error: 'Product ID or ingredients list is required' }, { status: 400 })
    }

    let productData: any = null
    let ingredientsList = ingredients

    if (productId) {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error || !product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      productData = product
      ingredientsList = (product as any).ingredients || ''
    }

    if (!ingredientsList) {
      return NextResponse.json({ error: 'No ingredients found for analysis' }, { status: 400 })
    }

    let userSkinProfile: any = null
    if (whatsappNumber) {
      const { data } = await supabase
        .from('user_skin_profiles')
        .select('*')
        .eq('whatsapp_number', whatsappNumber)
        .single()

      userSkinProfile = data
    }

    const analysisPrompt = `
Analyze these skincare ingredients for safety, efficacy, and compatibility:

${ingredientsList}

${userSkinProfile ? `
User's skin profile:
- Skin Type: ${userSkinProfile.current_skin_type || 'Not specified'}
- Concerns: ${userSkinProfile.skin_concerns?.join(', ') || 'None specified'}
- Preferred Categories: ${userSkinProfile.preferred_categories?.join(', ') || 'None specified'}

Please provide personalized analysis based on this profile.
` : ''}

Provide a detailed JSON response with the following structure:
{
  "overallSafety": 0.0-1.0,
  "compatibilityScore": 0.0-1.0,
  "beneficialIngredients": [
    {
      "name": "ingredient name",
      "benefits": ["benefit1", "benefit2"],
      "suitability": 0.0-1.0
    }
  ],
  "concernIngredients": [
    {
      "name": "ingredient name",
      "concerns": ["concern1", "concern2"],
      "severity": "low|medium|high"
    }
  ],
  "skinTypeCompatibility": {
    "oily": 0.0-1.0,
    "dry": 0.0-1.0,
    "combination": 0.0-1.0,
    "sensitive": 0.0-1.0,
    "normal": 0.0-1.0,
    "mature": 0.0-1.0
  },
  "concernsAddressed": ["acne", "aging", "hyperpigmentation", "dryness", "sensitivity"],
  "recommendedUsage": "morning|evening|both",
  "contraindications": ["condition1", "condition2"],
  "summary": "Brief overall assessment",
  "personalizedNote": "${userSkinProfile ? 'Personalized note based on user profile' : null}"
}

Focus on evidence-based analysis and be specific about ingredient interactions.
`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: analysisPrompt
        }
      ]
    })

    const aiResponse = response.content[0].type === 'text' ? response.content[0].text : ''

    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Invalid AI response format')
    }

    const analysisResult = JSON.parse(jsonMatch[0])

    const result = {
      product: productData ? {
        id: productData.id,
        name: productData.name_english,
        brand: productData.brand,
        category: productData.category
      } : null,
      analysis: analysisResult,
      analyzedAt: new Date().toISOString(),
      userProfile: userSkinProfile ? {
        skinType: userSkinProfile.current_skin_type,
        concerns: userSkinProfile.skin_concerns
      } : null
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in ingredient analysis:', error)
    return NextResponse.json({ error: 'Failed to analyze ingredients' }, { status: 500 })
  }
}