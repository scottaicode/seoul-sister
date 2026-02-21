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

    const [
      productCount,
      ingredientCount,
      linkCount,
      priceCount,
      stagingCounts,
      recentRuns,
      latestQualityRun,
      categoryDist,
      priceCoverage,
      productsWithRaw,
      productsWithLinks,
      brandCount,
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

      // Staging counts by status
      db.from('ss_product_staging').select('status')
        .then(r => {
          const counts: Record<string, number> = {
            pending: 0, processing: 0, processed: 0, failed: 0, duplicate: 0,
          }
          let total = 0
          for (const row of r.data ?? []) {
            const s = (row as { status: string }).status
            if (s in counts) counts[s]++
            total++
          }
          return { ...counts, total }
        }),

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

      // Category distribution
      db.from('ss_products').select('category')
        .then(r => {
          const counts: Record<string, number> = {}
          for (const row of r.data ?? []) {
            const cat = (row as { category: string }).category || 'unknown'
            counts[cat] = (counts[cat] || 0) + 1
          }
          // Sort by count descending
          return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([category, count]) => ({ category, count }))
        }),

      // Price coverage by retailer
      db.from('ss_product_prices')
        .select('retailer_id, ss_retailers(name)')
        .then(r => {
          const counts: Record<string, { name: string; count: number }> = {}
          for (const row of r.data ?? []) {
            const rid = (row as { retailer_id: string }).retailer_id
            const rname = ((row as Record<string, unknown>).ss_retailers as { name: string } | null)?.name ?? rid
            if (!counts[rid]) counts[rid] = { name: rname, count: 0 }
            counts[rid].count++
          }
          return Object.values(counts).sort((a, b) => b.count - a.count)
        }),

      // Products with ingredients_raw
      db.from('ss_products')
        .select('*', { count: 'exact', head: true })
        .not('ingredients_raw', 'is', null)
        .then(r => r.count ?? 0),

      // Products with at least one ingredient link (via RPC or fallback)
      db.rpc('count_unlinked_products').then(r => {
        if (r.error) return null
        return typeof r.data === 'number' ? r.data : Number(r.data ?? 0)
      }),

      // Distinct brand count
      db.from('ss_products').select('brand_en')
        .then(r => {
          const brands = new Set(
            (r.data ?? []).map((row) => (row as { brand_en: string }).brand_en)
          )
          return brands.size
        }),
    ])

    // Calculate linked products count
    const linkedProducts = productsWithLinks !== null
      ? productsWithRaw - productsWithLinks // unlinked count inverted
      : null

    return NextResponse.json({
      database: {
        total_products: productCount,
        total_brands: brandCount,
        total_ingredients: ingredientCount,
        total_ingredient_links: linkCount,
        total_price_records: priceCount,
        products_with_ingredients_raw: productsWithRaw,
        products_with_ingredient_links: linkedProducts,
        ingredient_link_pct: productsWithRaw > 0 && linkedProducts !== null
          ? Math.round((linkedProducts / productsWithRaw) * 100)
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
