/**
 * Refresh Database with Wholesale Pricing
 * Clears old retail data and populates with authentic Korean wholesale pricing
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runKoreanProductDiscovery } from '@/lib/korean-discovery'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    console.log('🧹 Starting wholesale data refresh...')

    // Step 1: Clear old retail pricing data
    console.log('🗑️ Clearing old retail pricing data...')

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      console.error('Error deleting old data:', deleteError)
      return NextResponse.json({ error: 'Failed to clear old data' }, { status: 500 })
    }

    console.log('✅ Old retail data cleared')

    // Step 2: Populate with Korean wholesale pricing
    console.log('🏪 Discovering products from Korean wholesale distributors...')

    const discoveryResult = await runKoreanProductDiscovery(50)

    console.log(`✅ Discovery complete: ${discoveryResult.discovered} products discovered, ${discoveryResult.saved} saved`)

    // Step 3: Verify new data
    const { data: newProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, brand, name_english, seoul_price, us_price, savings_percentage')
      .order('savings_percentage', { ascending: false })
      .limit(10)

    if (fetchError) {
      console.error('Error fetching new data:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch new data' }, { status: 500 })
    }

    // Calculate some stats
    const totalProducts = newProducts?.length || 0
    const avgSavings = totalProducts > 0
      ? Math.round(newProducts.reduce((sum, p) => sum + p.savings_percentage, 0) / totalProducts)
      : 0
    const avgSeoulPrice = totalProducts > 0
      ? Math.round((newProducts.reduce((sum, p) => sum + p.seoul_price, 0) / totalProducts) * 100) / 100
      : 0

    return NextResponse.json({
      success: true,
      message: 'Database refreshed with wholesale pricing',
      summary: {
        productsDiscovered: discoveryResult.discovered,
        productsSaved: discoveryResult.saved,
        averageSavings: `${avgSavings}%`,
        averageSeoulPrice: `$${avgSeoulPrice}`,
        trendingTopics: discoveryResult.trending_topics
      },
      sampleProducts: newProducts?.slice(0, 5).map(p => ({
        brand: p.brand,
        name: p.name_english,
        seoulPrice: `$${p.seoul_price}`,
        usPrice: `$${p.us_price}`,
        savings: `${p.savings_percentage}%`
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Wholesale refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh wholesale data', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint for status
export async function GET() {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, brand, name_english, seoul_price, us_price, savings_percentage, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    const totalCount = products?.length || 0
    const lastUpdated = products?.[0]?.created_at

    return NextResponse.json({
      status: 'ready',
      totalProducts: totalCount,
      lastUpdated,
      recentProducts: products?.slice(0, 3).map(p => ({
        brand: p.brand,
        name: p.name_english,
        seoulPrice: `$${p.seoul_price}`,
        savings: `${p.savings_percentage}%`
      })),
      endpoint: 'POST /api/refresh-wholesale-data'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status', details: String(error) },
      { status: 500 }
    )
  }
}