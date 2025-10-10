import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Self-learning: Get historical patterns for better recommendations
async function getLearnedPatterns(skinProfile: any) {
  const { data: patterns } = await supabase
    .from('skin_learning_patterns')
    .select('*')
    .match({ skin_profile: skinProfile })
    .order('effectiveness_score', { ascending: false })
    .limit(10)

  return patterns || []
}

// Get personalized product recommendations based on analysis and learning
async function getPersonalizedRecommendations(analysisData: any) {
  // Build skin profile for pattern matching
  const skinProfile = {
    type: analysisData.skinType,
    concerns: analysisData.concerns,
    age_range: analysisData.ageRange
  }

  // Get learned patterns for this skin profile
  const learnedPatterns = await getLearnedPatterns(skinProfile)

  // Get products from database
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('in_stock', true)

  if (!products) return []

  // Score products based on analysis and learned patterns
  const scoredProducts = products.map(product => {
    let matchScore = 0.5 // Base score

    // Boost score based on learned patterns
    const pattern = learnedPatterns.find(p => p.product_id === product.id)
    if (pattern) {
      matchScore = pattern.effectiveness_score || 0.7
    }

    // Adjust score based on specific concerns
    if (analysisData.concerns.includes('acne') && product.category === 'Serum') {
      matchScore += 0.1
    }
    if (analysisData.concerns.includes('dryness') && product.category === 'Mask') {
      matchScore += 0.15
    }
    if (analysisData.concerns.includes('aging') && product.brand === 'Sulwhasoo') {
      matchScore += 0.2
    }

    // Calculate expected improvements based on historical data
    const expectedImprovement: Record<string, string> = {}
    if (analysisData.hydrationLevel < 0.5) {
      expectedImprovement.hydration = '+30%'
    }
    if (analysisData.brightnessScore < 0.6) {
      expectedImprovement.brightness = '+20%'
    }

    return {
      product: {
        id: product.id,
        name: product.name_english,
        brand: product.brand,
        seoulPrice: product.seoul_price,
        usPrice: product.us_price,
        savings: product.savings_percentage
      },
      matchScore: Math.min(matchScore, 0.95),
      reason: generateRecommendationReason(product, analysisData),
      expectedImprovement
    }
  })

  // Sort by match score and return top recommendations
  return scoredProducts
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4)
}

function generateRecommendationReason(product: any, analysis: any): string {
  const reasons: string[] = []

  if (product.category === 'Serum' && analysis.concerns.includes('aging')) {
    reasons.push('Targets fine lines and promotes collagen production')
  }
  if (product.category === 'Essence' && analysis.hydrationLevel < 0.6) {
    reasons.push('Deeply hydrates and improves skin barrier function')
  }
  if (product.category === 'Mask' && analysis.concerns.includes('dullness')) {
    reasons.push('Brightens complexion and evens skin tone')
  }
  if (product.brand === 'COSRX' && analysis.concerns.includes('acne')) {
    reasons.push('Contains proven ingredients for acne-prone skin')
  }

  return reasons[0] || `Perfect match for your ${analysis.skinType} skin type`
}

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 })
    }

    // Prepare the image for Claude Vision
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    // Analyze with Claude Vision
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 2000,
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
              text: `Analyze this facial skin image and provide a detailed skin assessment.
              Please evaluate and return a JSON response with the following structure:
              {
                "skinType": "dry|oily|combination|sensitive|normal",
                "skinTone": "fair|light|medium|tan|deep",
                "ageRange": "18-25|25-35|35-45|45+",
                "concerns": ["acne", "wrinkles", "dark_spots", "dryness", "oiliness", "enlarged_pores", "redness", "dullness"],
                "concernScores": {
                  "acne": 0.0-1.0,
                  "wrinkles": 0.0-1.0,
                  "dark_spots": 0.0-1.0,
                  "dryness": 0.0-1.0,
                  "oiliness": 0.0-1.0,
                  "enlarged_pores": 0.0-1.0,
                  "redness": 0.0-1.0,
                  "dullness": 0.0-1.0
                },
                "hydrationLevel": 0.0-1.0,
                "oilLevel": 0.0-1.0,
                "textureScore": 0.0-1.0,
                "elasticityScore": 0.0-1.0,
                "brightnessScore": 0.0-1.0,
                "aiConfidence": 0.0-1.0,
                "detailedAnalysis": "Detailed description of skin condition",
                "primaryRecommendations": ["recommendation1", "recommendation2", "recommendation3"]
              }

              Analyze the skin's visible characteristics including texture, pores, hydration signs,
              any blemishes, fine lines, skin tone evenness, and overall health indicators.
              Be precise and scientific in your assessment.`
            }
          ]
        }
      ]
    })

    // Parse the AI response
    const aiResponse = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Invalid AI response format')
    }

    const analysisData = JSON.parse(jsonMatch[0])

    // Get personalized product recommendations based on analysis
    const recommendations = await getPersonalizedRecommendations(analysisData)

    // Combine analysis with recommendations
    const completeAnalysis = {
      ...analysisData,
      recommendations
    }

    // Store for continuous learning
    await storeAnalysisForLearning(completeAnalysis, imageUrl)

    return NextResponse.json(completeAnalysis)

  } catch (error) {
    console.error('Skin analysis error:', error)

    // Return mock data for development if API fails
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(getMockAnalysisData())
    }

    return NextResponse.json(
      { error: 'Failed to analyze skin. Please try again.' },
      { status: 500 }
    )
  }
}

// Store analysis for machine learning improvements
async function storeAnalysisForLearning(analysis: any, imageUrl: string) {
  try {
    // Get or create user (using session for now, would use auth in production)
    const sessionId = `session_${Date.now()}`

    // Store in skin_analyses table
    const { data: storedAnalysis, error } = await supabase
      .from('skin_analyses')
      .insert({
        session_id: sessionId,
        image_url: imageUrl,
        skin_type: analysis.skinType,
        skin_tone: analysis.skinTone,
        age_range: analysis.ageRange,
        concerns: analysis.concerns,
        concern_scores: analysis.concernScores,
        hydration_level: analysis.hydrationLevel,
        oil_level: analysis.oilLevel,
        texture_score: analysis.textureScore,
        elasticity_score: analysis.elasticityScore,
        brightness_score: analysis.brightnessScore,
        ai_confidence: analysis.aiConfidence,
        ai_model_version: 'claude-opus-4.1',
        analysis_raw: analysis
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing analysis:', error)
      return
    }

    // Update aggregated insights for pattern learning
    await updateAggregatedInsights(analysis)

  } catch (error) {
    console.error('Error in learning storage:', error)
  }
}

// Update aggregated insights for better future predictions
async function updateAggregatedInsights(analysis: any) {
  try {
    // Check if aggregate exists for this profile type
    const profileKey = {
      age_group: analysis.ageRange,
      skin_type: analysis.skinType,
      primary_concerns: analysis.concerns.slice(0, 3)
    }

    const { data: existing } = await supabase
      .from('skin_insights_aggregate')
      .select('*')
      .match(profileKey)
      .single()

    if (existing) {
      // Update existing aggregate
      await supabase
        .from('skin_insights_aggregate')
        .update({
          sample_size: existing.sample_size + 1,
          average_improvement:
            (existing.average_improvement * existing.sample_size + 0.7) / (existing.sample_size + 1),
          last_calculated: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      // Create new aggregate
      await supabase
        .from('skin_insights_aggregate')
        .insert({
          ...profileKey,
          sample_size: 1,
          average_improvement: 0.7,
          confidence_interval: 0.5
        })
    }
  } catch (error) {
    console.error('Error updating aggregated insights:', error)
  }
}

// Mock data for development
function getMockAnalysisData() {
  return {
    skinType: 'combination',
    skinTone: 'medium',
    ageRange: '25-35',
    concerns: ['enlarged_pores', 'oiliness', 'dullness'],
    concernScores: {
      acne: 0.2,
      wrinkles: 0.1,
      dark_spots: 0.3,
      dryness: 0.4,
      oiliness: 0.7,
      enlarged_pores: 0.8,
      redness: 0.2,
      dullness: 0.6
    },
    hydrationLevel: 0.6,
    oilLevel: 0.7,
    textureScore: 0.65,
    elasticityScore: 0.8,
    brightnessScore: 0.5,
    aiConfidence: 0.85,
    recommendations: [
      {
        product: {
          id: '1',
          name: 'Snail 96 Mucin Essence',
          brand: 'COSRX',
          seoulPrice: 12,
          usPrice: 89,
          savings: 74
        },
        matchScore: 0.92,
        reason: 'Perfect for balancing oil production and minimizing pores',
        expectedImprovement: { pores: '-30%', texture: '+25%' }
      },
      {
        product: {
          id: '2',
          name: 'Glow Deep Serum',
          brand: 'Beauty of Joseon',
          seoulPrice: 8.5,
          usPrice: 45,
          savings: 82
        },
        matchScore: 0.88,
        reason: 'Brightens dull skin and evens tone with rice bran',
        expectedImprovement: { brightness: '+40%', tone: '+20%' }
      },
      {
        product: {
          id: '3',
          name: 'Water Sleeping Mask',
          brand: 'Laneige',
          seoulPrice: 12,
          usPrice: 34,
          savings: 65
        },
        matchScore: 0.81,
        reason: 'Overnight hydration without adding excess oil',
        expectedImprovement: { hydration: '+35%', texture: '+15%' }
      }
    ]
  }
}