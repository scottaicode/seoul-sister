import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

interface SkinAnalysisResult {
  skinType: 'dry' | 'oily' | 'combination' | 'normal' | 'sensitive'
  concerns: string[]
  tone: string
  recommendations: {
    productIds: string[]
    routine: {
      morning: string[]
      evening: string[]
    }
    ingredients: {
      beneficial: string[]
      avoid: string[]
    }
  }
  confidenceScore: number
}

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
      max_tokens: 1000,
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
            text: `Analyze this facial skin image and provide a detailed K-beauty focused skin analysis. Return ONLY valid JSON with this structure:
{
  "skinType": "dry|oily|combination|normal|sensitive",
  "concerns": ["array of specific concerns like acne, dark spots, fine lines, etc"],
  "tone": "description of skin tone",
  "hydrationLevel": 1-10,
  "textureScore": 1-10,
  "clarityScore": 1-10,
  "recommendations": {
    "routine": {
      "morning": ["cleanser type", "toner type", "serum type", "moisturizer type", "SPF"],
      "evening": ["oil cleanser", "water cleanser", "toner", "essence", "serum", "moisturizer", "treatment"]
    },
    "ingredients": {
      "beneficial": ["hyaluronic acid", "niacinamide", etc],
      "avoid": ["alcohol", "fragrance", etc based on skin sensitivity]
    },
    "keyProducts": ["specific K-beauty product categories needed"]
  },
  "confidenceScore": 0.85
}`
          }
        ]
      }]
    })

    const analysisText = response.content[0].type === 'text' ? response.content[0].text : ''
    const analysis = JSON.parse(analysisText) as SkinAnalysisResult

    // Get personalized product recommendations based on analysis
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('category', getRelevantCategories(analysis.concerns))
      .limit(10)

    // Save analysis to user profile
    if (userId) {
      await supabase
        .from('user_skin_profiles')
        .upsert({
          whatsapp_number: userId,
          current_skin_type: analysis.skinType,
          skin_concerns: analysis.concerns,
          preferred_categories: getRelevantCategories(analysis.concerns),
          last_analysis_date: new Date().toISOString()
        })
    }

    return NextResponse.json({
      analysis,
      recommendedProducts: products || [],
      savedProfile: !!userId
    })

  } catch (error) {
    console.error('Skin analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze skin' },
      { status: 500 }
    )
  }
}

function getRelevantCategories(concerns: string[]): string[] {
  const categoryMap: Record<string, string[]> = {
    'acne': ['cleanser', 'treatment', 'spot-treatment'],
    'dark spots': ['serum', 'essence', 'treatment'],
    'fine lines': ['serum', 'eye-cream', 'moisturizer'],
    'dryness': ['moisturizer', 'essence', 'face-oil'],
    'oiliness': ['cleanser', 'toner', 'moisturizer'],
    'sensitivity': ['cleanser', 'moisturizer', 'sunscreen'],
    'dullness': ['exfoliant', 'essence', 'vitamin-c'],
    'pores': ['cleanser', 'toner', 'clay-mask']
  }

  const categories = new Set<string>()
  concerns.forEach(concern => {
    const lowerConcern = concern.toLowerCase()
    Object.entries(categoryMap).forEach(([key, cats]) => {
      if (lowerConcern.includes(key)) {
        cats.forEach(cat => categories.add(cat))
      }
    })
  })

  return Array.from(categories)
}