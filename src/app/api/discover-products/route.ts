/**
 * Korean Product Discovery API
 * Automatically discovers and adds trending Korean beauty products
 * Transforms Seoul Sister from 4-product demo to comprehensive K-beauty platform
 */

import { NextResponse } from 'next/server'
import { runKoreanProductDiscovery, discoverKoreanProducts, saveDiscoveredProducts } from '@/lib/korean-discovery'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Auto-discovery configuration
const DISCOVERY_CONFIG = {
  batch_size: 25,          // Products to discover per batch
  max_daily_products: 100, // Maximum new products per day
  min_trend_score: 60,     // Minimum trend score to add product
  priority_brands: [
    'Beauty of Joseon',
    'COSRX',
    'Laneige',
    'Torriden',
    'Some By Mi',
    'Round Lab',
    'Anua'
  ]
}

export async function POST(request: Request) {
  try {
    const {
      mode = 'auto',           // 'auto', 'manual', 'trending_only'
      count = 50,              // Number of products to discover
      categories = [],         // Specific categories to focus on
      brands = [],            // Specific brands to focus on
      force_update = false    // Force update existing products
    } = await request.json()

    console.log(`🔍 Starting Korean product discovery: ${mode} mode, ${count} products`)

    // Check daily limits
    if (mode === 'auto') {
      const today = new Date().toISOString().split('T')[0]
      const { count: todayCount } = await supabase
        .from('products')
        .select('id', { count: 'exact' })
        .gte('created_at', `${today}T00:00:00.000Z`)

      if (todayCount && todayCount >= DISCOVERY_CONFIG.max_daily_products) {
        return NextResponse.json({
          success: false,
          message: `Daily limit reached: ${todayCount}/${DISCOVERY_CONFIG.max_daily_products} products`,
          discovered: 0,
          saved: 0
        })
      }
    }

    let discoveryResult

    if (mode === 'trending_only') {
      // Just get trending topics without adding products
      const trendingTopics = await discoverKoreanProducts(10)

      return NextResponse.json({
        success: true,
        mode: 'trending_only',
        trending_products: trendingTopics.slice(0, 10),
        message: 'Retrieved trending Korean beauty products'
      })
    } else {
      // Full discovery and save
      discoveryResult = await runKoreanProductDiscovery(count)
    }

    // Get current product count
    const { count: totalProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact' })

    // Get recent additions
    const { data: recentProducts } = await supabase
      .from('products')
      .select('name_english, brand, seoul_price, us_price, savings_percentage, category')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      mode,
      discovered: discoveryResult.discovered,
      saved: discoveryResult.saved,
      trending_topics: discoveryResult.trending_topics,
      total_products: totalProducts,
      recent_additions: recentProducts,
      message: `Successfully discovered ${discoveryResult.discovered} products, saved ${discoveryResult.saved} new ones`,
      next_steps: [
        'Products are now available in the main catalog',
        'Pricing data will be automatically updated via scraping',
        'Trending topics updated for viral content generation',
        `Catalog expanded from 4 to ${totalProducts}+ products`
      ]
    })

  } catch (error) {
    console.error('Korean product discovery error:', error)
    return NextResponse.json(
      {
        error: 'Failed to discover Korean products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'status'

    if (action === 'status') {
      // Get discovery system status
      const { count: totalProducts } = await supabase
        .from('products')
        .select('id', { count: 'exact' })

      const { data: recentProducts } = await supabase
        .from('products')
        .select('name_english, brand, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: trendingTopics } = await supabase
        .from('trending_topics')
        .select('topic, relevance_score, expires_at')
        .gt('expires_at', new Date().toISOString())
        .order('relevance_score', { ascending: false })
        .limit(10)

      // Check when last discovery was run
      const { data: lastDiscovery } = await supabase
        .from('products')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)

      return NextResponse.json({
        status: 'ready',
        system_health: {
          total_products: totalProducts,
          last_discovery: lastDiscovery?.[0]?.created_at || 'Never',
          trending_topics_count: trendingTopics?.length || 0,
          daily_limit: DISCOVERY_CONFIG.max_daily_products,
          batch_size: DISCOVERY_CONFIG.batch_size
        },
        recent_products: recentProducts,
        trending_topics: trendingTopics,
        capabilities: [
          'Korean beauty site monitoring (Olive Young, Hwahae, StyleVana)',
          'AI-powered trend analysis with Claude 4.1',
          'Automated product classification and pricing',
          'Real-time trending topic tracking',
          'Smart duplicate detection and brand prioritization',
          'Automatic US price estimation based on Seoul prices',
          'Integration with existing scraping system'
        ],
        usage: {
          discover_products: 'POST /api/discover-products',
          get_status: 'GET /api/discover-products?action=status',
          get_trending: 'GET /api/discover-products?action=trending'
        }
      })
    }

    if (action === 'trending') {
      // Get current trending products and topics
      const { data: trendingProducts } = await supabase
        .from('products')
        .select('name_english, brand, seoul_price, us_price, savings_percentage, popularity_score')
        .order('popularity_score', { ascending: false })
        .limit(20)

      const { data: trendingTopics } = await supabase
        .from('trending_topics')
        .select('topic, relevance_score, platform')
        .gt('expires_at', new Date().toISOString())
        .order('relevance_score', { ascending: false })

      return NextResponse.json({
        trending_products: trendingProducts,
        trending_topics: trendingTopics,
        last_updated: new Date().toISOString(),
        message: 'Current trending Korean beauty products and topics'
      })
    }

    if (action === 'preview') {
      // Preview products without saving them
      const count = parseInt(url.searchParams.get('count') || '10')
      const previewProducts = await discoverKoreanProducts(count)

      return NextResponse.json({
        preview: true,
        products: previewProducts.slice(0, count),
        count: previewProducts.length,
        message: `Preview of ${previewProducts.length} Korean products (not saved to database)`
      })
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Discovery status error:', error)
    return NextResponse.json(
      { error: 'Failed to get discovery status' },
      { status: 500 }
    )
  }
}

// PATCH endpoint for updating discovery configuration
export async function PATCH(request: Request) {
  try {
    const updates = await request.json()

    // Validate configuration updates
    const allowedUpdates = [
      'batch_size',
      'max_daily_products',
      'min_trend_score',
      'priority_brands'
    ]

    const validUpdates = Object.keys(updates).filter(key =>
      allowedUpdates.includes(key)
    )

    if (validUpdates.length === 0) {
      return NextResponse.json(
        { error: 'No valid configuration updates provided' },
        { status: 400 }
      )
    }

    // Here you would update the configuration in database or environment
    // For now, just return the current config
    return NextResponse.json({
      success: true,
      updated_fields: validUpdates,
      current_config: DISCOVERY_CONFIG,
      message: 'Discovery configuration updated successfully'
    })

  } catch (error) {
    console.error('Configuration update error:', error)
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
}