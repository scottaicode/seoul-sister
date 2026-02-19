/**
 * POST /api/admin/pipeline/link-ingredients
 *
 * Processes a batch of products that have ingredients_raw but no
 * ss_product_ingredients rows. Parses INCI strings, matches or creates
 * ingredients in ss_ingredients, and inserts links.
 *
 * Protected by service role key (admin only).
 *
 * Body: {
 *   batch_size?: number (1-200, default 50)
 * }
 *
 * GET /api/admin/pipeline/link-ingredients
 *
 * Returns counts of products by ingredient linking status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { linkBatch } from '@/lib/pipeline/ingredient-linker'

export const maxDuration = 300 // 5 min — ingredient linking with Sonnet calls can take time

const linkSchema = z.object({
  batch_size: z.number().int().min(1).max(200).optional().default(50),
})

function verifyAdminAuth(request: NextRequest): void {
  const key = request.headers.get('x-service-key')
    ?? request.headers.get('authorization')?.replace('Bearer ', '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey || !key || key !== serviceKey) {
    throw new AppError('Unauthorized: admin access required', 401)
  }
}

export async function POST(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    const body = await request.json()
    const params = linkSchema.parse(body)

    const supabase = getServiceClient()
    const result = await linkBatch(supabase, params.batch_size)

    return NextResponse.json({
      success: true,
      products_linked: result.products_linked,
      products_skipped: result.products_skipped,
      products_failed: result.products_failed,
      ingredients_created: result.ingredients_created,
      ingredients_matched: result.ingredients_matched,
      remaining: result.remaining,
      cost: result.cost,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    const supabase = getServiceClient()

    const [totalProducts, productsWithRaw, totalLinks, totalIngredients] = await Promise.all([
      supabase
        .from('ss_products')
        .select('*', { count: 'exact', head: true })
        .then(({ count }) => count ?? 0),
      supabase
        .from('ss_products')
        .select('*', { count: 'exact', head: true })
        .not('ingredients_raw', 'is', null)
        .then(({ count }) => count ?? 0),
      supabase
        .from('ss_product_ingredients')
        .select('*', { count: 'exact', head: true })
        .then(({ count }) => count ?? 0),
      supabase
        .from('ss_ingredients')
        .select('*', { count: 'exact', head: true })
        .then(({ count }) => count ?? 0),
    ])

    // Find how many products with ingredients_raw already have links
    const { data: withRaw } = await supabase
      .from('ss_products')
      .select('id')
      .not('ingredients_raw', 'is', null)

    let productsLinked = 0
    if (withRaw && withRaw.length > 0) {
      const ids = withRaw.map((p) => p.id as string)
      const { data: linked } = await supabase
        .from('ss_product_ingredients')
        .select('product_id')
        .in('product_id', ids)

      const linkedSet = new Set((linked ?? []).map((r) => r.product_id as string))
      productsLinked = linkedSet.size
    }

    return NextResponse.json({
      products: {
        total: totalProducts,
        with_ingredients_raw: productsWithRaw,
        linked: productsLinked,
        unlinked: productsWithRaw - productsLinked,
        without_ingredients_raw: totalProducts - productsWithRaw,
      },
      ingredients: {
        total: totalIngredients,
      },
      links: {
        total: totalLinks,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
