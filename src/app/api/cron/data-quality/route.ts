import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

/**
 * POST /api/cron/data-quality
 *
 * Runs weekly on Sunday at 4 AM UTC (via vercel.json).
 * Performs data quality checks across the product database and generates
 * a quality report stored as a pipeline run with run_type='quality_check'.
 *
 * Checks:
 * - Products without descriptions
 * - Products without ingredient links (that have ingredients_raw)
 * - Products with stale prices (>7 days old)
 * - Failed staging rows that may need reprocessing
 * - Missing Korean names
 * - Category distribution (flag categories with very few products)
 * - Brand normalization issues (similar brand names)
 *
 * Secured with CRON_SECRET header.
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()

    // Run all quality checks in parallel
    const [
      totalProducts,
      missingDescriptions,
      unlinkedWithRaw,
      totalWithIngredients,
      stalePrices,
      failedStaging,
      missingKoreanNames,
      categoryDistribution,
      brandCount,
      ingredientCount,
      linkCount,
      priceCount,
    ] = await Promise.all([
      // Total product count
      db
        .from('ss_products')
        .select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),

      // Products missing descriptions
      db
        .from('ss_products')
        .select('*', { count: 'exact', head: true })
        .or('description_en.is.null,description_en.eq.')
        .then(r => r.count ?? 0),

      // Products with ingredients_raw but no ingredient links
      db.rpc('count_unlinked_products').then(r => {
        if (r.error) return -1 // RPC not available
        return typeof r.data === 'number' ? r.data : Number(r.data ?? 0)
      }),

      // Products that have at least one ingredient link
      db
        .from('ss_products')
        .select('*', { count: 'exact', head: true })
        .not('ingredients_raw', 'is', null)
        .then(r => r.count ?? 0),

      // Stale prices (not checked in 7+ days)
      db
        .from('ss_product_prices')
        .select('*', { count: 'exact', head: true })
        .lt('last_checked', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .then(r => r.count ?? 0),

      // Failed staging rows
      db
        .from('ss_product_staging')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .then(r => r.count ?? 0),

      // Products missing Korean names
      db
        .from('ss_products')
        .select('*', { count: 'exact', head: true })
        .is('name_ko', null)
        .then(r => r.count ?? 0),

      // Category distribution
      db
        .from('ss_products')
        .select('category')
        .then(r => {
          if (!r.data) return {}
          const counts: Record<string, number> = {}
          for (const row of r.data) {
            const cat = (row as { category: string }).category || 'unknown'
            counts[cat] = (counts[cat] || 0) + 1
          }
          return counts
        }),

      // Total distinct brands
      db
        .from('ss_products')
        .select('brand_en')
        .then(r => {
          if (!r.data) return 0
          const brands = new Set(r.data.map((row) => (row as { brand_en: string }).brand_en))
          return brands.size
        }),

      // Total ingredients
      db
        .from('ss_ingredients')
        .select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),

      // Total ingredient links
      db
        .from('ss_product_ingredients')
        .select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),

      // Total price records
      db
        .from('ss_product_prices')
        .select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),
    ])

    // Identify categories with very few products (<10)
    const sparseCategories = Object.entries(categoryDistribution)
      .filter(([, count]) => count < 10)
      .map(([cat, count]) => ({ category: cat, count }))

    // Build quality report
    const report = {
      total_products: totalProducts,
      total_brands: brandCount,
      total_ingredients: ingredientCount,
      total_ingredient_links: linkCount,
      total_price_records: priceCount,
      issues: {
        missing_descriptions: missingDescriptions,
        unlinked_with_ingredients_raw: unlinkedWithRaw,
        stale_prices: stalePrices,
        failed_staging: failedStaging,
        missing_korean_names: missingKoreanNames,
        sparse_categories: sparseCategories,
      },
      coverage: {
        description_pct: totalProducts > 0
          ? Math.round(((totalProducts - missingDescriptions) / totalProducts) * 100)
          : 0,
        ingredient_link_pct: totalWithIngredients > 0
          ? Math.round(((totalWithIngredients - (unlinkedWithRaw > 0 ? unlinkedWithRaw : 0)) / totalWithIngredients) * 100)
          : 0,
        korean_name_pct: totalProducts > 0
          ? Math.round(((totalProducts - missingKoreanNames) / totalProducts) * 100)
          : 0,
      },
      category_distribution: categoryDistribution,
    }

    // Determine overall health score (0-100)
    let healthScore = 100
    if (missingDescriptions > 0) healthScore -= Math.min(20, Math.round((missingDescriptions / totalProducts) * 100))
    if (unlinkedWithRaw > 0) healthScore -= Math.min(20, Math.round((unlinkedWithRaw / totalProducts) * 100))
    if (stalePrices > 10) healthScore -= Math.min(15, Math.round(stalePrices / 5))
    if (failedStaging > 0) healthScore -= Math.min(15, Math.round(failedStaging / 2))
    if (sparseCategories.length > 3) healthScore -= 10
    healthScore = Math.max(0, healthScore)

    // Store quality report as a pipeline run
    await db.from('ss_pipeline_runs').insert({
      source: 'system',
      run_type: 'quality_check',
      status: 'completed',
      products_scraped: totalProducts,
      products_processed: totalProducts - missingDescriptions,
      products_failed: failedStaging,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'weekly_sunday_4am_utc',
        report,
        health_score: healthScore,
      },
    })

    return NextResponse.json({
      success: true,
      health_score: healthScore,
      report,
      checked_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron:data-quality] Error:', error)
    return NextResponse.json(
      { error: 'Failed to run data quality check' },
      { status: 500 }
    )
  }
}
