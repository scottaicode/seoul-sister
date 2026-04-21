import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const searchSchema = z.object({
  query: z.string().max(200).optional(),
  categories: z.array(z.string()).optional(),
  skin_types: z.array(z.string()).optional(),
  skin_concerns: z.array(z.string()).optional(),
  price_max: z.number().positive().optional(),
  brands: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).optional().default(10),
})

// Skin concern → product category mapping (lowercase to match ss_products.category)
const CONCERN_CATEGORY_MAP: Record<string, string[]> = {
  acne: ['cleanser', 'toner', 'serum', 'spot treatment'],
  dry: ['moisturizer', 'essence', 'ampoule'],
  dryness: ['moisturizer', 'essence', 'ampoule'],
  wrinkles: ['serum', 'essence', 'eye care'],
  aging: ['serum', 'essence', 'eye care'],
  hyperpigmentation: ['serum', 'ampoule'],
  'dark spots': ['serum', 'ampoule'],
  redness: ['toner', 'moisturizer', 'essence'],
  sensitive: ['toner', 'moisturizer', 'essence'],
  pores: ['toner', 'serum', 'exfoliator'],
  oily: ['cleanser', 'toner', 'sunscreen'],
  'sun protection': ['sunscreen'],
  'barrier damage': ['moisturizer', 'essence'],
}

/**
 * POST /api/admin/products/search
 *
 * Returns product recommendations for LGAAS content generation.
 * Auth via X-LGAAS-API-Key header (same shared secret as ingredients context).
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    const body = await request.json()
    const params = searchSchema.parse(body)
    const { query, categories, skin_types, skin_concerns, price_max, brands, limit } = params

    if (!query && !categories?.length && !skin_types?.length && !skin_concerns?.length && !brands?.length) {
      throw new AppError('At least one filter is required', 400)
    }

    const supabase = getServiceClient()

    // Merge explicit categories with concern-derived categories (lowercase to match DB)
    const allCategories = new Set<string>((categories || []).map(c => c.toLowerCase()))
    if (skin_concerns?.length) {
      for (const concern of skin_concerns) {
        const mapped = CONCERN_CATEGORY_MAP[concern.toLowerCase().trim()]
        if (mapped) mapped.forEach(c => allCategories.add(c))
      }
    }

    // Build query
    // Include `id` so we can fetch ingredient lists per product (LGAAS Blueprint 44).
    let dbQuery = supabase
      .from('ss_products')
      .select('id, name_en, brand_en, category, price_usd, rating_avg, description_en, image_url, sunscreen_type, white_cast, finish')

    if (query) {
      // Text search: match product name or brand name
      const terms = query.trim().split(/\s+/).filter(t => t.length > 1)
      if (terms.length > 0) {
        const nameFilters = terms.map(t => `name_en.ilike.%${t}%`).join(',')
        const brandFilters = terms.map(t => `brand_en.ilike.%${t}%`).join(',')
        dbQuery = dbQuery.or(`${nameFilters},${brandFilters}`)
      }
    } else {
      // Structured search: categories, skin types (brands handled below, regardless of query)
      if (allCategories.size > 0) {
        dbQuery = dbQuery.in('category', Array.from(allCategories))
      }

      if (skin_types?.length) {
        // Skin type matching via description or name (ss_products doesn't have a skin_type column)
        dbQuery = dbQuery.or(skin_types.map(t => `description_en.ilike.%${t}%`).join(','))
      }
    }

    // Blueprint 44 Gap 3b — brands filter is a constraint, not an alternative to query.
    // Previously this lived inside the `else` branch so query+brands silently dropped brands.
    // Now it applies in both modes: with a text query, it narrows the text matches to the
    // requested brand(s); without a text query, it behaves as before.
    if (brands?.length) {
      dbQuery = dbQuery.or(brands.map(b => `brand_en.ilike.%${b}%`).join(','))
    }

    if (price_max !== undefined) {
      dbQuery = dbQuery.lte('price_usd', price_max)
    }

    dbQuery = dbQuery
      .not('price_usd', 'is', null)
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(limit)

    const { data: products, error } = await dbQuery

    if (error) {
      console.error('Product search error:', error)
      throw new AppError('Database query failed', 500)
    }

    // Blueprint 44 Gap 3a — batch-fetch ingredient lists for all returned products
    // so LGAAS-style consumers can ground ingredient claims in real data instead of
    // training-knowledge-extending from adjacent SKUs. Top 15 ingredients per product
    // by INCI position (position 1 = highest concentration). Fast single query using
    // PostgREST's .in() over the product ID list; costs one extra round-trip.
    const productIds = (products || []).map(p => p.id).filter(Boolean)
    const ingredientsByProductId = new Map<string, Array<Record<string, unknown>>>()
    if (productIds.length > 0) {
      const { data: pi, error: piError } = await supabase
        .from('ss_product_ingredients')
        .select('product_id, position, ingredient:ss_ingredients(name_inci, name_en, function, is_active, safety_rating)')
        .in('product_id', productIds)
        .order('position')
        .limit(productIds.length * 15)
      if (piError) {
        console.warn('Product ingredient fetch failed (non-fatal):', piError.message)
      } else if (pi) {
        // Supabase's typegen infers the embedded `ingredient` relation as an
        // array even for a single-row relationship, so normalize defensively.
        for (const row of pi as unknown as Array<{
          product_id: string
          position: number
          ingredient:
            | { name_inci: string; name_en: string | null; function: string | null; is_active: boolean | null; safety_rating: number | null }
            | Array<{ name_inci: string; name_en: string | null; function: string | null; is_active: boolean | null; safety_rating: number | null }>
            | null
        }>) {
          if (!row.product_id || !row.ingredient) continue
          const ing = Array.isArray(row.ingredient) ? row.ingredient[0] : row.ingredient
          if (!ing) continue
          if (!ingredientsByProductId.has(row.product_id)) {
            ingredientsByProductId.set(row.product_id, [])
          }
          const existing = ingredientsByProductId.get(row.product_id)!
          if (existing.length >= 15) continue
          existing.push({
            position: row.position,
            inci_name: ing.name_inci,
            common_name: ing.name_en,
            function: ing.function,
            is_active: ing.is_active,
            safety_rating: ing.safety_rating,
          })
        }
      }
    }

    const formatted = (products || []).map(p => {
      const product: Record<string, unknown> = {
        name: p.name_en,
        brand: p.brand_en,
        category: p.category,
        us_price: p.price_usd,
        rating: p.rating_avg,
        description: p.description_en,
        image_url: p.image_url,
      }
      // Include sunscreen-specific fields when available
      if (p.sunscreen_type) product.sunscreen_type = p.sunscreen_type
      if (p.white_cast) product.white_cast = p.white_cast
      if (p.finish) product.finish = p.finish
      // Blueprint 44 Gap 3a — expose ingredient list (top 15 by INCI position) when
      // available. Empty array if no ingredient linkage exists for this product
      // (not all products in ss_products have been INCI-mapped into
      // ss_product_ingredients yet).
      product.ingredients = ingredientsByProductId.get(p.id) || []
      return product
    })

    return NextResponse.json({
      products: formatted,
      total: formatted.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
