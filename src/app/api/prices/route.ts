import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { isOrderableHere } from '@/lib/pricing/price-scope'
import { isRecommendedRetailer } from '@/lib/yuri/tools'

const priceQuerySchema = z.object({
  product_id: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = priceQuerySchema.parse({
      product_id: searchParams.get('product_id'),
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('ss_products')
      .select('id, name_en, name_ko, brand_en, price_usd, price_krw, image_url')
      .eq('id', params.product_id)
      .single()

    if (productError || !product) {
      throw new AppError('Product not found', 404)
    }

    // Fetch all retailer prices
    const { data: prices, error: pricesError } = await supabase
      .from('ss_product_prices')
      .select(`
        price_usd,
        price_krw,
        url,
        in_stock,
        last_checked,
        retailer:ss_retailers (
          id,
          name,
          website,
          country,
          trust_score,
          ships_international,
          affiliate_program,
          affiliate_url_template,
          ships_to_us
        )
      `)
      .eq('product_id', params.product_id)
      .order('price_usd', { ascending: true })

    if (pricesError) {
      throw pricesError
    }

    // Where the shopper is, from Vercel's edge geolocation. A network guess,
    // used only to decide which listings this shopper can actually order.
    const shopperCountry = request.headers.get('x-vercel-ip-country')?.toUpperCase() ?? null
    // Unknown location (no header, e.g. local dev) is treated as US for this
    // UI decision only: it is the conservative choice, since it can only hide a
    // Global link as a "deal", never present an unorderable one as one.
    const shopperInUs = shopperCountry === null || shopperCountry === 'US'

    const retailerPrices = (prices ?? []).map(p => {
      const retailer = p.retailer as unknown as Record<string, unknown> | null
      const shipsToUs = typeof retailer?.ships_to_us === 'boolean' ? (retailer.ships_to_us as boolean) : null
      return {
        retailer_name: (retailer?.name as string) ?? 'Unknown',
        retailer_url: p.url,
        price_usd: Number(p.price_usd),
        price_krw: p.price_krw,
        in_stock: p.in_stock,
        trust_score: (retailer?.trust_score as number) ?? null,
        country: (retailer?.country as string) ?? null,
        ships_international: (retailer?.ships_international as boolean) ?? false,
        ships_to_us: shipsToUs,
        // Oct 21 2026: Olive Young Global stopped shipping to the US on May 29.
        // A US shopper can't order a ships_to_us:false listing, so it is shown
        // as an international comparison, never as a deal to click through to.
        orderable_here: isOrderableHere(
          shipsToUs,
          shopperInUs,
          typeof retailer?.ships_international === 'boolean' ? (retailer.ships_international as boolean) : null
        ),
        is_affiliate: (retailer?.affiliate_program as boolean) ?? false,
        last_checked: p.last_checked,
      }
    })

    // No fabricated fallback row. This used to invent an "Olive Young" listing
    // from ss_products.price_usd stamped last_checked = now, so an undated
    // February price rendered as "Just checked". An unknown price stays unknown.

    // The highlighted listing must be a store we'd actually send someone to,
    // that can deliver to them. Same rule Yuri gets via cheapest_ships_to_us.
    const bestDeal =
      retailerPrices.find(p => p.in_stock && p.orderable_here && isRecommendedRetailer(p.retailer_name)) ?? null

    return NextResponse.json({
      product,
      prices: retailerPrices,
      best_deal: bestDeal,
      shopper_in_us: shopperInUs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
