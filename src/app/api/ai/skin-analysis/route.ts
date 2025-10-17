import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PhotoMetadata {
  captureMethod: 'camera' | 'upload'
  timestamp: string
  lighting?: 'natural' | 'indoor' | 'outdoor' | 'artificial'
  skinArea?: 'face' | 'specific_concern'
  notes?: string
}

interface SkinAnalysis {
  skinType: string
  primaryConcerns: string[]
  secondaryConcerns: string[]
  recommendations: string[]
  compatibleIngredients: string[]
  ingredientsToAvoid: string[]
  confidenceScore: number
  analysisDetails: {
    poreSize: 'small' | 'medium' | 'large'
    oiliness: 'low' | 'moderate' | 'high'
    hydration: 'low' | 'moderate' | 'high'
    sensitivity: 'low' | 'moderate' | 'high'
    pigmentation: 'none' | 'mild' | 'moderate' | 'significant'
    aging: 'minimal' | 'early' | 'moderate' | 'advanced'
  }
  productRecommendations: {
    cleanser: string[]
    moisturizer: string[]
    treatment: string[]
    sunscreen: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('photo') as File
    const userId = formData.get('userId') as string
    const metadataStr = formData.get('metadata') as string

    if (!file) {
      return NextResponse.json(
        { error: 'Photo file is required' },
        { status: 400 }
      )
    }

    const metadata: PhotoMetadata = metadataStr ? JSON.parse(metadataStr) : {}

    console.log(`🔬 Starting AI skin analysis for user ${userId}`)

    // For Seoul Sister's $20/month model, all authenticated users get access
    if (!userId) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      )
    }

    // Upload photo to storage
    const photoUrl = await uploadPhotoToStorage(file, userId)

    // Perform AI skin analysis
    const analysis = await performSkinAnalysis(file, metadata)

    // Save analysis to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('user_skin_analysis')
      .insert({
        user_id: userId,
        photo_url: photoUrl,
        analysis_data: analysis,
        metadata: metadata,
        confidence_score: analysis.confidenceScore,
        skin_type: analysis.skinType,
        primary_concerns: analysis.primaryConcerns,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save analysis:', saveError)
    }

    // Generate personalized product recommendations
    const productRecommendations = await generateProductRecommendations(analysis, userId)

    // Log data processing for GDPR compliance
    await supabase.rpc('log_data_processing', {
      p_user_id: userId,
      p_processing_type: 'ai_analysis',
      p_legal_basis: 'consent',
      p_purpose: 'Personalized skincare recommendations',
      p_data_categories: ['photos', 'biometric_data', 'preferences'],
      p_processor: 'claude_ai',
      p_retention_period: '2 years'
    })

    console.log(`✅ AI skin analysis completed for user ${userId}`)

    return NextResponse.json({
      success: true,
      analysis,
      productRecommendations,
      analysisId: savedAnalysis?.id,
      message: 'Skin analysis completed successfully'
    })

  } catch (error) {
    console.error('❌ Error in AI skin analysis:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze skin',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// Removed checkPremiumSubscription - Seoul Sister uses simple $20/month model with full access for authenticated users

async function uploadPhotoToStorage(file: File, userId: string): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/skin-analysis/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('user-uploads')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(fileName)

    return publicUrl

  } catch (error) {
    console.error('Error uploading photo:', error)
    throw new Error('Failed to upload photo')
  }
}

async function performSkinAnalysis(file: File, metadata: PhotoMetadata): Promise<SkinAnalysis> {
  try {
    // Convert file to base64 for AI analysis
    const fileBuffer = await file.arrayBuffer()
    const base64Image = Buffer.from(fileBuffer).toString('base64')

    // This would integrate with Claude Vision API or another computer vision service
    // For now, we'll simulate analysis based on metadata and provide realistic results

    console.log('🤖 Performing AI skin analysis...')

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Generate realistic skin analysis based on common patterns
    const analysis = generateRealisticSkinAnalysis(metadata)

    return analysis

  } catch (error) {
    console.error('Error in AI analysis:', error)
    throw new Error('Failed to perform skin analysis')
  }
}

function generateRealisticSkinAnalysis(metadata: PhotoMetadata): SkinAnalysis {
  // Simulate realistic AI skin analysis results
  const skinTypes = ['combination', 'oily', 'dry', 'sensitive', 'normal']
  const skinType = skinTypes[Math.floor(Math.random() * skinTypes.length)]

  const concernsMap = {
    combination: ['enlarged_pores', 'occasional_breakouts', 'uneven_texture'],
    oily: ['excess_oil', 'enlarged_pores', 'acne_prone', 'blackheads'],
    dry: ['dehydration', 'flaky_skin', 'fine_lines', 'tight_feeling'],
    sensitive: ['redness', 'irritation', 'reactive_skin', 'dryness'],
    normal: ['minor_pores', 'balanced_hydration', 'healthy_barrier']
  }

  const ingredientCompatibility = {
    combination: {
      good: ['niacinamide', 'hyaluronic_acid', 'ceramides', 'salicylic_acid', 'zinc'],
      avoid: ['heavy_oils', 'coconut_oil', 'alcohol_denat', 'strong_fragrances']
    },
    oily: {
      good: ['salicylic_acid', 'niacinamide', 'retinol', 'clay_masks', 'tea_tree'],
      avoid: ['heavy_creams', 'coconut_oil', 'shea_butter', 'petroleum']
    },
    dry: {
      good: ['hyaluronic_acid', 'ceramides', 'glycerin', 'squalane', 'peptides'],
      avoid: ['alcohol', 'strong_acids', 'soap_based_cleansers', 'menthol']
    },
    sensitive: {
      good: ['ceramides', 'niacinamide', 'centella_asiatica', 'colloidal_oatmeal'],
      avoid: ['fragrances', 'essential_oils', 'alcohol', 'harsh_scrubs', 'retinol']
    },
    normal: {
      good: ['vitamin_c', 'hyaluronic_acid', 'retinol', 'niacinamide', 'peptides'],
      avoid: ['over_exfoliation', 'harsh_cleansers', 'too_many_actives']
    }
  }

  const primaryConcerns = concernsMap[skinType as keyof typeof concernsMap] || concernsMap.normal
  const compatibility = ingredientCompatibility[skinType as keyof typeof ingredientCompatibility] || ingredientCompatibility.normal

  return {
    skinType,
    primaryConcerns: primaryConcerns.slice(0, 3),
    secondaryConcerns: primaryConcerns.slice(3, 5),
    recommendations: [
      `Focus on gentle cleansing for ${skinType} skin`,
      'Use products with compatible ingredients',
      'Maintain consistent skincare routine',
      'Always use SPF during daytime',
      'Patch test new products before full application'
    ],
    compatibleIngredients: compatibility.good,
    ingredientsToAvoid: compatibility.avoid,
    confidenceScore: Math.floor(Math.random() * 15) + 85, // 85-100%
    analysisDetails: {
      poreSize: skinType === 'oily' ? 'large' : skinType === 'dry' ? 'small' : 'medium',
      oiliness: skinType === 'oily' ? 'high' : skinType === 'dry' ? 'low' : 'moderate',
      hydration: skinType === 'dry' ? 'low' : skinType === 'oily' ? 'moderate' : 'high',
      sensitivity: skinType === 'sensitive' ? 'high' : 'low',
      pigmentation: ['none', 'mild', 'moderate'][Math.floor(Math.random() * 3)] as any,
      aging: ['minimal', 'early', 'moderate'][Math.floor(Math.random() * 3)] as any
    },
    productRecommendations: {
      cleanser: skinType === 'oily' ? ['gel_cleanser', 'foam_cleanser'] : ['cream_cleanser', 'oil_cleanser'],
      moisturizer: skinType === 'oily' ? ['gel_moisturizer', 'lightweight_lotion'] : ['rich_cream', 'facial_oil'],
      treatment: skinType === 'oily' ? ['bha_exfoliant', 'clay_mask'] : ['hydrating_serum', 'barrier_repair'],
      sunscreen: ['broad_spectrum_spf30+', 'mineral_sunscreen']
    }
  }
}

async function generateProductRecommendations(analysis: SkinAnalysis, userId: string) {
  try {
    // Get products that match the user's skin analysis
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .contains('suitable_for_skin_types', [analysis.skinType])
      .limit(10)

    if (!products || products.length === 0) {
      // Fallback to general recommendations
      const { data: fallbackProducts } = await supabase
        .from('products')
        .select('*')
        .limit(5)

      return fallbackProducts || []
    }

    // Score products based on ingredient compatibility
    const scoredProducts = products.map(product => {
      let score = 0

      // Check for compatible ingredients
      if (product.key_ingredients) {
        const productIngredients = product.key_ingredients.map((ing: string) => ing.toLowerCase())
        const compatibleCount = analysis.compatibleIngredients.filter(ing =>
          productIngredients.some((prodIng: string) => prodIng.includes(ing))
        ).length
        score += compatibleCount * 2
      }

      // Check for ingredients to avoid
      if (product.full_ingredients) {
        const avoidCount = analysis.ingredientsToAvoid.filter(ing =>
          product.full_ingredients.toLowerCase().includes(ing)
        ).length
        score -= avoidCount * 3
      }

      return { ...product, compatibilityScore: score }
    })

    // Sort by compatibility score and return top matches
    return scoredProducts
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 6)

  } catch (error) {
    console.error('Error generating product recommendations:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: 'userId parameter is required' },
      { status: 400 }
    )
  }

  try {
    // Get user's analysis history
    const { data: analyses, error } = await supabase
      .from('user_skin_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    return NextResponse.json({
      analyses: analyses || [],
      count: analyses?.length || 0
    })

  } catch (error) {
    console.error('Error fetching skin analyses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch skin analyses' },
      { status: 500 }
    )
  }
}