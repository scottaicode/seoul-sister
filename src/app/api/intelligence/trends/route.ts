import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // 'products', 'ingredients', 'all'
    const timeframe = searchParams.get('timeframe') || 'weekly'
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log(`🔍 Fetching trending ${category || 'all'} for ${timeframe}`)

    // Calculate timeframe start
    const now = new Date()
    let timeframeStart: Date
    switch (timeframe) {
      case 'daily':
        timeframeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        timeframeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default: // weekly
        timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    let trendingProducts: any[] = []
    let trendingIngredients: any[] = []

    // Fetch trending products
    if (!category || category === 'all' || category === 'products') {
      const { data: products, error: productsError } = await supabase
        .from('product_mentions')
        .select('*')
        .eq('is_trending', true)
        .gte('analyzed_at', timeframeStart.toISOString())
        .order('virality_score', { ascending: false })
        .limit(limit)

      if (productsError) {
        console.error('❌ Error fetching trending products:', productsError)
      } else {
        trendingProducts = products || []
      }
    }

    // Fetch trending ingredients
    if (!category || category === 'all' || category === 'ingredients') {
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('ingredient_mentions')
        .select('*')
        .eq('is_trending', true)
        .gte('analyzed_at', timeframeStart.toISOString())
        .order('virality_score', { ascending: false })
        .limit(limit)

      if (ingredientsError) {
        console.error('❌ Error fetching trending ingredients:', ingredientsError)
      } else {
        trendingIngredients = ingredients || []
      }
    }

    // Get latest comprehensive trend analysis
    const { data: latestAnalysis } = await supabase
      .from('trend_analysis')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    const response = {
      success: true,
      timeframe,
      data: {
        products: trendingProducts,
        ingredients: trendingIngredients,
        emergingTrends: latestAnalysis?.emerging_trends || [],
        marketPredictions: latestAnalysis?.market_predictions || {},
        lastAnalysis: latestAnalysis?.generated_at || null,
        summary: {
          totalTrendingProducts: trendingProducts.length,
          totalTrendingIngredients: trendingIngredients.length,
          totalEmergingTrends: latestAnalysis?.emerging_trends?.length || 0
        }
      }
    }

    console.log(`✅ Trends fetched: ${trendingProducts.length} products, ${trendingIngredients.length} ingredients`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Trends API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch trending data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, alertConfig } = body

    // Create or update user trend alert
    const { data: alert, error } = await supabase
      .from('user_trend_alerts')
      .upsert({
        user_id: userId,
        alert_type: alertConfig.type,
        alert_target: alertConfig.target,
        keywords: alertConfig.keywords || [],
        notification_method: alertConfig.notificationMethods || ['dashboard'],
        frequency: alertConfig.frequency || 'immediate',
        is_active: true
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Trend alert created successfully',
      alert
    })

  } catch (error) {
    console.error('❌ Trend alert creation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create trend alert',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}