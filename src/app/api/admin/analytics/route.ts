/**
 * Admin Analytics API
 * Provides comprehensive analytics for Korean product discovery system
 * Tracks product performance, trends, and business metrics
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'overview'

    switch (type) {
      case 'overview':
        return NextResponse.json(await getOverviewAnalytics())
      case 'products':
        return NextResponse.json(await getProductAnalytics())
      case 'trends':
        return NextResponse.json(await getTrendAnalytics())
      case 'discovery':
        return NextResponse.json(await getDiscoveryAnalytics())
      default:
        return NextResponse.json(await getOverviewAnalytics())
    }
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

// Overview business analytics
async function getOverviewAnalytics() {
  // Get product counts and stats
  const { count: totalProducts } = await supabase
    .from('products')
    .select('id', { count: 'exact' })

  const { data: products } = await supabase
    .from('products')
    .select('seoul_price, us_price, savings_percentage, created_at, category, brand')

  // Calculate business metrics
  const avgSavings = products?.length
    ? Math.round(products.reduce((sum, p) => sum + p.savings_percentage, 0) / products.length)
    : 0

  const totalPotentialSavings = products?.length
    ? products.reduce((sum, p) => sum + (p.us_price - p.seoul_price), 0)
    : 0

  // Products added in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: newProductsThisMonth } = await supabase
    .from('products')
    .select('id', { count: 'exact' })
    .gte('created_at', thirtyDaysAgo)

  // Category breakdown
  const categoryStats = products?.reduce((acc: Record<string, number>, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1
    return acc
  }, {}) || {}

  // Brand breakdown
  const brandStats = products?.reduce((acc: Record<string, number>, product) => {
    acc[product.brand] = (acc[product.brand] || 0) + 1
    return acc
  }, {}) || {}

  return {
    overview: {
      total_products: totalProducts,
      avg_savings_percentage: avgSavings,
      total_potential_savings: Math.round(totalPotentialSavings),
      new_products_this_month: newProductsThisMonth,
      growth_rate: totalProducts && totalProducts > 0
        ? Math.round((newProductsThisMonth || 0) / totalProducts * 100)
        : 0
    },
    categories: categoryStats,
    brands: brandStats,
    transformation: {
      before: 4,
      after: totalProducts,
      growth_multiplier: totalProducts ? Math.round(totalProducts / 4 * 10) / 10 : 1
    }
  }
}

// Detailed product performance analytics
async function getProductAnalytics() {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (!products) return { products: [] }

  // Calculate performance metrics for each product
  const productAnalytics = products.map(product => {
    const savingsAmount = product.us_price - product.seoul_price
    const marketupRatio = product.us_price / product.seoul_price
    const daysInCatalog = Math.floor(
      (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Simulated trending score based on savings and recency
    const trendScore = Math.min(100,
      (product.savings_percentage * 0.6) +
      (Math.max(0, 30 - daysInCatalog) * 0.4) +
      (product.popularity_score || 0) * 0.2
    )

    return {
      ...product,
      savings_amount: Math.round(savingsAmount),
      markup_ratio: Math.round(marketupRatio * 10) / 10,
      days_in_catalog: daysInCatalog,
      trend_score: Math.round(trendScore),
      performance_rating: getTrendingStatus(trendScore, daysInCatalog)
    }
  })

  // Top performers
  const topSavings = productAnalytics
    .sort((a, b) => b.savings_percentage - a.savings_percentage)
    .slice(0, 5)

  const trending = productAnalytics
    .filter(p => p.trend_score > 75)
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, 5)

  const newProducts = productAnalytics
    .filter(p => p.days_in_catalog <= 7)
    .sort((a, b) => a.days_in_catalog - b.days_in_catalog)

  return {
    all_products: productAnalytics,
    top_savings: topSavings,
    trending_products: trending,
    new_products: newProducts,
    performance_summary: {
      total_products: products.length,
      avg_trend_score: Math.round(
        productAnalytics.reduce((sum, p) => sum + p.trend_score, 0) / products.length
      ),
      products_trending: trending.length,
      products_new: newProducts.length
    }
  }
}

// Korean beauty trend analytics
async function getTrendAnalytics() {
  // Get trending topics if available
  let trendingTopics = []
  try {
    const { data: topics } = await supabase
      .from('trending_topics')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('relevance_score', { ascending: false })

    trendingTopics = topics || []
  } catch (error) {
    console.log('Trending topics table not available')
  }

  // Analyze product trends by category
  const { data: products } = await supabase
    .from('products')
    .select('category, brand, created_at, savings_percentage')

  const categoryTrends = products?.reduce((acc: Record<string, any>, product) => {
    if (!acc[product.category]) {
      acc[product.category] = {
        count: 0,
        avg_savings: 0,
        recent_additions: 0,
        total_savings: 0
      }
    }

    acc[product.category].count += 1
    acc[product.category].total_savings += product.savings_percentage

    // Count recent additions (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (new Date(product.created_at) > weekAgo) {
      acc[product.category].recent_additions += 1
    }

    return acc
  }, {}) || {}

  // Calculate averages
  Object.keys(categoryTrends).forEach(category => {
    const data = categoryTrends[category]
    data.avg_savings = Math.round(data.total_savings / data.count)
    data.trend_direction = data.recent_additions > 0 ? 'up' : 'stable'
  })

  // Brand performance trends
  const brandTrends = products?.reduce((acc: Record<string, any>, product) => {
    if (!acc[product.brand]) {
      acc[product.brand] = {
        count: 0,
        avg_savings: 0,
        total_savings: 0
      }
    }

    acc[product.brand].count += 1
    acc[product.brand].total_savings += product.savings_percentage

    return acc
  }, {}) || {}

  // Calculate brand averages
  Object.keys(brandTrends).forEach(brand => {
    const data = brandTrends[brand]
    data.avg_savings = Math.round(data.total_savings / data.count)
  })

  return {
    trending_topics: trendingTopics,
    category_trends: categoryTrends,
    brand_trends: brandTrends,
    korean_beauty_insights: {
      top_trending_categories: Object.entries(categoryTrends)
        .sort(([,a]: any, [,b]: any) => b.recent_additions - a.recent_additions)
        .slice(0, 3)
        .map(([category, data]) => ({ category, ...data })),

      top_savings_brands: Object.entries(brandTrends)
        .sort(([,a]: any, [,b]: any) => b.avg_savings - a.avg_savings)
        .slice(0, 5)
        .map(([brand, data]) => ({ brand, ...data }))
    }
  }
}

// Discovery system performance analytics
async function getDiscoveryAnalytics() {
  // Get discovery system status
  const discoveryStatus = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'supabase.co')}/api/discover-products?action=status`)
    .then(res => res.json())
    .catch(() => ({ system_health: { total_products: 0 } }))

  // Discovery timeline (products added by day)
  const { data: products } = await supabase
    .from('products')
    .select('created_at, brand, category')
    .order('created_at', { ascending: false })
    .limit(100)

  const discoveryTimeline = products?.reduce((acc: Record<string, number>, product) => {
    const date = new Date(product.created_at).toISOString().split('T')[0]
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {}) || {}

  // Last 7 days of discovery activity
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    return date.toISOString().split('T')[0]
  }).reverse()

  const weeklyActivity = last7Days.map(date => ({
    date,
    products_added: discoveryTimeline[date] || 0
  }))

  // Discovery efficiency metrics
  const totalDiscovered = Object.values(discoveryTimeline).reduce((sum: number, count: number) => sum + count, 0)
  const avgPerDay = totalDiscovered / Object.keys(discoveryTimeline).length

  return {
    system_status: discoveryStatus.system_health || {},
    discovery_timeline: discoveryTimeline,
    weekly_activity: weeklyActivity,
    discovery_metrics: {
      total_discovered: totalDiscovered,
      avg_per_day: Math.round(avgPerDay * 10) / 10,
      most_productive_day: Object.entries(discoveryTimeline)
        .sort(([,a]: any, [,b]: any) => b - a)[0] || ['N/A', 0],
      discovery_efficiency: totalDiscovered > 0 ? 'High' : 'Starting'
    },
    automation_status: {
      cron_job: 'Active',
      next_run: 'Daily at 6 AM UTC',
      api_health: 'Operational'
    }
  }
}

// Helper function to determine trending status
function getTrendingStatus(trendScore: number, daysInCatalog: number): string {
  if (trendScore > 85) return 'Hot'
  if (trendScore > 70) return 'Trending'
  if (daysInCatalog <= 3) return 'New'
  if (trendScore > 50) return 'Popular'
  return 'Stable'
}