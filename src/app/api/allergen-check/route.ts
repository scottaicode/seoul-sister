import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AllergenDetector } from '@/lib/allergen-detector'
import type { UserProfile } from '@/types/user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/allergen-check - Check product for allergens
export async function POST(request: NextRequest) {
  try {
    const { user_id, product_id } = await request.json()

    if (!user_id || !product_id) {
      return NextResponse.json(
        { error: 'User ID and Product ID are required' },
        { status: 400 }
      )
    }

    // Fetch user profile
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user_id)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Perform allergen analysis
    const allergenAnalysis = AllergenDetector.analyzeProduct(product, userProfile)

    // Log the allergen check for learning
    await supabase
      .from('user_product_interactions')
      .insert([{
        user_id,
        product_id,
        interaction_type: 'allergen_check',
        interaction_data: {
          risk_level: allergenAnalysis.overallRiskLevel,
          risk_score: allergenAnalysis.overallRiskScore,
          alerts_count: allergenAnalysis.alerts.length
        }
      }])

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name_english,
        brand: product.brand
      },
      allergen_analysis: allergenAnalysis,
      recommendation: allergenAnalysis.overallRiskLevel === 'high'
        ? 'We recommend avoiding this product due to high allergen risk'
        : allergenAnalysis.overallRiskLevel === 'medium'
        ? 'Patch test recommended before use'
        : 'Generally safe for use based on your allergen profile'
    })

  } catch (error) {
    console.error('Error in allergen check:', error)
    return NextResponse.json(
      { error: 'Failed to check allergens' },
      { status: 500 }
    )
  }
}

// GET /api/allergen-check/alternatives?user_id=xxx&category=yyy - Get allergen-free alternatives
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const category = searchParams.get('category')

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

    // Fetch all products
    let query = supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: products, error: productsError } = await query

    if (productsError || !products) {
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    // Get allergen-free alternatives
    const allergenFreeProducts = AllergenDetector.getAllergenFreeAlternatives(
      products,
      userProfile.ingredient_allergies,
      category || undefined
    )

    // Analyze each safe product for additional benefits
    const analyzedProducts = allergenFreeProducts.slice(0, 10).map(product => {
      const analysis = AllergenDetector.analyzeProduct(product, userProfile)
      return {
        product: {
          id: product.id,
          name: product.name_english,
          brand: product.brand,
          category: product.category,
          seoul_price: product.seoul_price,
          us_price: product.us_price,
          savings_percentage: product.savings_percentage,
          image_url: product.image_url
        },
        safety_score: 100 - analysis.overallRiskScore,
        safety_level: analysis.overallRiskLevel,
        why_safe: analysis.alerts.length === 0
          ? 'No known allergens detected for your profile'
          : `Low risk: ${analysis.alerts.length} minor concerns identified`
      }
    })

    return NextResponse.json({
      total_safe_products: allergenFreeProducts.length,
      user_allergens: userProfile.ingredient_allergies,
      safe_alternatives: analyzedProducts
    })

  } catch (error) {
    console.error('Error fetching allergen-free alternatives:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alternatives' },
      { status: 500 }
    )
  }
}