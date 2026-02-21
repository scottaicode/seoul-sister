import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { PricePipeline } from '@/lib/pipeline/price-pipeline'
import type { PriceRetailer } from '@/lib/pipeline/types'

export const maxDuration = 300 // 5 min — price scraping is slow

const VALID_RETAILERS: PriceRetailer[] = ['yesstyle', 'soko_glam', 'amazon', 'stylekorean']

const priceSchema = z.object({
  retailer: z.enum(['yesstyle', 'soko_glam', 'amazon', 'stylekorean', 'all']),
  batch_size: z.number().int().min(1).max(500).optional().default(50),
  brands: z.array(z.string()).optional(),
  product_ids: z.array(z.string().uuid()).optional(),
  stale_hours: z.number().int().min(1).optional().default(24),
})

function verifyAdminAuth(request: NextRequest): void {
  const key = request.headers.get('x-service-key')
    ?? request.headers.get('authorization')?.replace('Bearer ', '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey || !key || key !== serviceKey) {
    throw new AppError('Unauthorized: admin access required', 401)
  }
}

/**
 * POST /api/admin/pipeline/prices
 *
 * Runs the price scraping pipeline for one or all retailers.
 * Protected by service role key (admin only).
 *
 * Body: {
 *   retailer: 'yesstyle' | 'soko_glam' | 'amazon' | 'stylekorean' | 'all'
 *   batch_size?: number (1-500, default 50)
 *   brands?: string[] (only scrape these brands)
 *   product_ids?: string[] (only scrape these products)
 *   stale_hours?: number (skip if price checked within N hours, default 24)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    const body = await request.json()
    const params = priceSchema.parse(body)

    const supabase = getServiceClient()
    const pipeline = new PricePipeline()

    if (params.retailer === 'all') {
      const results = await pipeline.runAll(supabase, {
        batch_size: params.batch_size,
        brands: params.brands,
        product_ids: params.product_ids,
        stale_hours: params.stale_hours,
      })

      const totals = results.reduce(
        (acc, r) => ({
          products_searched: acc.products_searched + r.products_searched,
          prices_found: acc.prices_found + r.prices_found,
          prices_matched: acc.prices_matched + r.prices_matched,
          prices_new: acc.prices_new + r.prices_new,
          prices_updated: acc.prices_updated + r.prices_updated,
        }),
        { products_searched: 0, prices_found: 0, prices_matched: 0, prices_new: 0, prices_updated: 0 }
      )

      return NextResponse.json({
        success: true,
        totals,
        retailers: results,
      })
    }

    const result = await pipeline.run(supabase, {
      retailer: params.retailer,
      batch_size: params.batch_size,
      brands: params.brands,
      product_ids: params.product_ids,
      stale_hours: params.stale_hours,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/admin/pipeline/prices
 *
 * Returns price coverage statistics across retailers.
 */
export async function GET(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    const supabase = getServiceClient()

    // Total products and those with any price
    const { count: totalProducts } = await supabase
      .from('ss_products')
      .select('*', { count: 'exact', head: true })

    const { count: productsWithPrices } = await supabase
      .from('ss_product_prices')
      .select('product_id', { count: 'exact', head: true })

    // Price count per retailer
    const { data: retailerCounts } = await supabase
      .from('ss_product_prices')
      .select('retailer_id, ss_retailers(name)')

    // Group by retailer
    const byRetailer: Record<string, number> = {}
    for (const row of retailerCounts ?? []) {
      const name = (row.ss_retailers as unknown as { name: string })?.name || 'unknown'
      byRetailer[name] = (byRetailer[name] || 0) + 1
    }

    // Stale prices (not checked in 24h)
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: stalePrices } = await supabase
      .from('ss_product_prices')
      .select('*', { count: 'exact', head: true })
      .lt('last_checked', staleThreshold)

    // Price history count
    const { count: historyCount } = await supabase
      .from('ss_price_history')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      total_products: totalProducts ?? 0,
      products_with_prices: productsWithPrices ?? 0,
      coverage_pct: totalProducts ? Math.round(((productsWithPrices ?? 0) / totalProducts) * 100) : 0,
      by_retailer: byRetailer,
      stale_prices: stalePrices ?? 0,
      price_history_records: historyCount ?? 0,
      available_retailers: VALID_RETAILERS,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
