import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { requireAdmin } from '@/lib/auth'

/**
 * GET /api/admin/pipeline/dashboard
 *
 * Returns comprehensive pipeline dashboard data in a single request:
 * - Database stats (products, ingredients, links, prices, brands)
 * - Staging counts by status
 * - Recent pipeline runs
 * - Latest quality report
 * - Category distribution
 * - Price coverage by retailer
 *
 * Protected by service role key (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const db = getServiceClient()

    // Known statuses and categories for count queries
    const STATUSES = ['pending', 'processing', 'processed', 'failed', 'duplicate'] as const
    const CATEGORIES = [
      'cleanser', 'toner', 'essence', 'serum', 'ampoule', 'moisturizer',
      'sunscreen', 'mask', 'exfoliator', 'lip_care', 'eye_care', 'oil',
      'mist', 'spot_treatment',
    ] as const

    // --- Staging counts: one count query per status (avoids 1,000-row limit) ---
    const stagingCountPromises = STATUSES.map(status =>
      db.from('ss_product_staging')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)
        .then(r => ({ status, count: r.count ?? 0 }))
    )
    const stagingTotalPromise = db.from('ss_product_staging')
      .select('*', { count: 'exact', head: true })
      .then(r => r.count ?? 0)

    // --- Category distribution: one count query per category ---
    const categoryCountPromises = CATEGORIES.map(category =>
      db.from('ss_products')
        .select('*', { count: 'exact', head: true })
        .eq('category', category)
        .then(r => ({ category, count: r.count ?? 0 }))
    )

    // --- Price coverage: count per retailer using join ---
    // Fetch retailers first, then count prices per retailer
    const retailerListPromise = db.from('ss_retailers')
      .select('id, name')
      .then(r => r.data ?? [])

    const [
      productCount,
      ingredientCount,
      linkCount,
      priceCount,
      ...stagingResults
    ] = await Promise.all([
      // Total products
      db.from('ss_products').select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),

      // Total ingredients
      db.from('ss_ingredients').select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),

      // Total ingredient links
      db.from('ss_product_ingredients').select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),

      // Total price records
      db.from('ss_product_prices').select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),

      // All staging count promises
      ...stagingCountPromises,
    ])

    // Resolve staging total separately (not mixed into typed array)
    const stagingTotal = await stagingTotalPromise

    // Build staging counts object
    const stagingCounts: Record<string, number> = { total: stagingTotal }
    for (const result of stagingResults as Array<{ status: string; count: number }>) {
      stagingCounts[result.status] = result.count
    }
    // Fill any missing statuses with 0
    for (const s of STATUSES) {
      if (!(s in stagingCounts)) stagingCounts[s] = 0
    }

    const [
      recentRuns,
      latestQualityRun,
      categoryResults,
      retailerList,
      productsWithRaw,
    ] = await Promise.all([
      // Recent pipeline runs (last 20)
      db.from('ss_pipeline_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20)
        .then(r => r.data ?? []),

      // Latest quality check run
      db.from('ss_pipeline_runs')
        .select('*')
        .eq('run_type', 'quality_check')
        .order('started_at', { ascending: false })
        .limit(1)
        .then(r => r.data?.[0] ?? null),

      // Category distribution (resolve all category count promises)
      Promise.all(categoryCountPromises),

      // Retailer list for price coverage
      retailerListPromise,

      // Products with ingredients_raw
      db.from('ss_products')
        .select('*', { count: 'exact', head: true })
        .not('ingredients_raw', 'is', null)
        .then(r => r.count ?? 0),
    ])

    // Category distribution: filter out zero-count, sort descending
    const categoryDist = (categoryResults as Array<{ category: string; count: number }>)
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)

    // Price coverage by retailer: count per retailer
    const retailers = retailerList as Array<{ id: string; name: string }>
    const priceCoverageResults = await Promise.all(
      retailers.map(r =>
        db.from('ss_product_prices')
          .select('*', { count: 'exact', head: true })
          .eq('retailer_id', r.id)
          .then(res => ({ name: r.name, count: res.count ?? 0 }))
      )
    )
    const priceCoverage = priceCoverageResults
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)

    // Brand count: use paginated approach to count distinct brands
    // Fetch brands in pages of 1000 to get all unique values
    let brandCount = 0
    {
      const allBrands = new Set<string>()
      let page = 0
      const pageSize = 1000
      let hasMore = true
      while (hasMore) {
        const { data } = await db.from('ss_products')
          .select('brand_en')
          .range(page * pageSize, (page + 1) * pageSize - 1)
        if (!data || data.length === 0) {
          hasMore = false
        } else {
          for (const row of data) {
            allBrands.add((row as { brand_en: string }).brand_en)
          }
          if (data.length < pageSize) hasMore = false
          page++
        }
      }
      brandCount = allBrands.size
    }

    // Linked product count: count distinct product_ids in ss_product_ingredients.
    // PostgREST can't do COUNT(DISTINCT), so we paginate through the link table
    // collecting unique product_ids. Ordered by product_id so duplicates cluster
    // and the Set stays efficient. ~166K rows at 5K per page = ~34 requests.
    // This is acceptable for an admin dashboard that loads occasionally.
    let linkedProducts: number | null = null
    try {
      const linkedIds = new Set<string>()
      let from = 0
      const pageSize = 5000
      let hasMore = true
      while (hasMore) {
        const { data } = await db.from('ss_product_ingredients')
          .select('product_id')
          .order('product_id')
          .range(from, from + pageSize - 1)
        if (!data || data.length === 0) {
          hasMore = false
        } else {
          for (const row of data) {
            linkedIds.add((row as { product_id: string }).product_id)
          }
          from += data.length
          if (data.length < pageSize) hasMore = false
        }
      }
      linkedProducts = linkedIds.size
    } catch {
      linkedProducts = null
    }

    return NextResponse.json({
      database: {
        total_products: productCount,
        total_brands: brandCount,
        total_ingredients: ingredientCount,
        total_ingredient_links: linkCount,
        total_price_records: priceCount,
        products_with_ingredients_raw: productsWithRaw,
        products_with_ingredient_links: linkedProducts,
        ingredient_link_pct: (productCount as number) > 0 && linkedProducts !== null
          ? Math.round((linkedProducts / (productCount as number)) * 100)
          : null,
      },
      staging: stagingCounts,
      recent_runs: recentRuns,
      latest_quality_report: latestQualityRun,
      category_distribution: categoryDist,
      price_coverage: priceCoverage,
      fetched_at: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
