import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const pricesSchema = z.object({
  product_ids: z.array(z.string().uuid()).max(20).optional(),
  // Permissive name-based lookup so callers without product IDs can still fetch
  // prices. Names are matched ILIKE against ss_products.name_en for any term
  // that has at least 4 chars; if none match, the entry returns no prices.
  product_names: z.array(z.string().min(4).max(200)).max(20).optional(),
})

interface PriceRow {
  product_id: string
  retailer_id: string
  price_usd: number | null
  price_krw: number | null
  url: string | null
  in_stock: boolean | null
  last_checked: string
  retailer:
    | { name: string | null; country: string | null; trust_score: number | null; is_authorized: boolean | null }
    | Array<{ name: string | null; country: string | null; trust_score: number | null; is_authorized: boolean | null }>
    | null
}

/**
 * POST /api/admin/products/prices
 *
 * Returns the freshest known price per (product, retailer) for the requested
 * products, with last_checked timestamps so the calling system (LGAAS Reddit
 * reply generator, blog generator, etc.) can decide whether to surface the
 * number, mark it stale, or skip the price claim.
 *
 * Auth via X-LGAAS-API-Key header (same shared secret as products/search and
 * ingredients/context endpoints).
 *
 * Two query modes:
 *   - product_ids[]:    UUIDs from ss_products.id (preferred, exact match)
 *   - product_names[]:  string terms matched ILIKE against ss_products.name_en
 *                       (fallback when caller doesn't have IDs from a prior
 *                       /products/search call)
 *
 * Response shape:
 *   {
 *     products: [
 *       {
 *         product_id: uuid,
 *         name: string,
 *         brand: string,
 *         prices: [
 *           {
 *             retailer_name: string,
 *             retailer_country: string,
 *             retailer_trust_score: number,
 *             retailer_is_authorized: boolean,
 *             price_usd: number,
 *             price_krw: number,
 *             url: string,
 *             in_stock: boolean,
 *             last_checked: ISO8601,
 *             age_days: number    // computed by the endpoint, server time
 *           },
 *           ...
 *         ]
 *       },
 *       ...
 *     ]
 *   }
 *
 * Per-product price array is sorted by last_checked DESC (freshest first) and
 * capped at 5 retailers per product. Products with no price records are still
 * returned with `prices: []` so the caller can distinguish "not in catalog"
 * from "no price data."
 *
 * Created: Apr 28 2026 (Blueprint 58 — restore grounded comparative price
 * claims for Reddit replies after the Apr 22 SKIN1004 confabulation incident).
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    const body = await request.json()
    const params = pricesSchema.parse(body)
    const { product_ids, product_names } = params

    if (!product_ids?.length && !product_names?.length) {
      throw new AppError('At least one of product_ids or product_names is required', 400)
    }

    const supabase = getServiceClient()

    // Resolve all requested products (by ID + by name) into a unique product set.
    const resolvedProductIds = new Set<string>()
    const productMeta = new Map<string, { name: string; brand: string }>()

    if (product_ids?.length) {
      const { data: byId, error: idErr } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en')
        .in('id', product_ids)
      if (idErr) {
        console.error('Price endpoint: product ID lookup failed:', idErr)
        throw new AppError('Database query failed', 500)
      }
      for (const p of byId || []) {
        resolvedProductIds.add(p.id)
        productMeta.set(p.id, { name: p.name_en, brand: p.brand_en })
      }
    }

    if (product_names?.length) {
      // For each requested name, OR-match against name_en. Multiple terms in
      // a single name string get AND-joined so "skin1004 madagascar centella
      // ampoule" only matches products containing all those tokens.
      for (const rawName of product_names) {
        const tokens = rawName.trim().split(/\s+/).filter(t => t.length >= 3)
        if (tokens.length === 0) continue
        let q = supabase
          .from('ss_products')
          .select('id, name_en, brand_en')
        for (const t of tokens) {
          q = q.or(`name_en.ilike.%${t}%,brand_en.ilike.%${t}%`)
        }
        const { data: byName, error: nameErr } = await q.limit(5)
        if (nameErr) {
          console.warn('Price endpoint: name lookup failed (non-fatal):', nameErr.message)
          continue
        }
        for (const p of byName || []) {
          resolvedProductIds.add(p.id)
          if (!productMeta.has(p.id)) {
            productMeta.set(p.id, { name: p.name_en, brand: p.brand_en })
          }
        }
      }
    }

    if (resolvedProductIds.size === 0) {
      return NextResponse.json({ products: [] })
    }

    // Fetch all price rows for the resolved product set, freshest first.
    const idList = Array.from(resolvedProductIds)
    const { data: priceRows, error: priceErr } = await supabase
      .from('ss_product_prices')
      .select(`
        product_id,
        retailer_id,
        price_usd,
        price_krw,
        url,
        in_stock,
        last_checked,
        retailer:ss_retailers(name, country, trust_score, is_authorized)
      `)
      .in('product_id', idList)
      .order('last_checked', { ascending: false })
      .limit(idList.length * 8) // cap at 8 retailers per product (we'll dedupe + cap to 5 below)

    if (priceErr) {
      console.error('Price endpoint: price fetch failed:', priceErr)
      throw new AppError('Database query failed', 500)
    }

    // Group prices by product_id, keeping only the freshest entry per retailer
    // (in case ss_product_prices has multiple rows for the same product/retailer
    // pair — should be rare but defensive).
    const pricesByProductId = new Map<string, Array<Record<string, unknown>>>()
    const seenRetailerPerProduct = new Map<string, Set<string>>()
    const now = Date.now()

    for (const row of (priceRows as unknown as PriceRow[]) || []) {
      const pid = row.product_id
      if (!pid) continue
      const retailerId = row.retailer_id
      if (!retailerId) continue
      // Dedupe by retailer per product — first row wins (freshest first via ORDER BY)
      if (!seenRetailerPerProduct.has(pid)) seenRetailerPerProduct.set(pid, new Set())
      const seen = seenRetailerPerProduct.get(pid)!
      if (seen.has(retailerId)) continue
      seen.add(retailerId)

      // Cap at 5 retailers per product
      const existing = pricesByProductId.get(pid) || []
      if (existing.length >= 5) continue

      const r = Array.isArray(row.retailer) ? row.retailer[0] : row.retailer
      const lastChecked = row.last_checked
      const ageDays = lastChecked
        ? Math.floor((now - new Date(lastChecked).getTime()) / (1000 * 60 * 60 * 24))
        : null

      existing.push({
        retailer_name: r?.name || null,
        retailer_country: r?.country || null,
        retailer_trust_score: r?.trust_score ?? null,
        retailer_is_authorized: r?.is_authorized ?? null,
        price_usd: row.price_usd,
        price_krw: row.price_krw,
        url: row.url,
        in_stock: row.in_stock,
        last_checked: lastChecked,
        age_days: ageDays,
      })
      pricesByProductId.set(pid, existing)
    }

    // Build response — preserve every resolved product, even if it has no price data,
    // so the caller can distinguish "no catalog match" from "no prices yet."
    const response = idList.map(pid => {
      const meta = productMeta.get(pid) || { name: '', brand: '' }
      return {
        product_id: pid,
        name: meta.name,
        brand: meta.brand,
        prices: pricesByProductId.get(pid) || [],
      }
    })

    return NextResponse.json({ products: response })
  } catch (error) {
    return handleApiError(error)
  }
}
