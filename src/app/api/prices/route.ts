import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

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
          affiliate_url_template
        )
      `)
      .eq('product_id', params.product_id)
      .order('price_usd', { ascending: true })

    if (pricesError) {
      throw pricesError
    }

    const retailerPrices = (prices ?? []).map(p => {
      const retailer = p.retailer as unknown as Record<string, unknown> | null
      return {
        retailer_name: (retailer?.name as string) ?? 'Unknown',
        retailer_url: p.url,
        price_usd: Number(p.price_usd),
        price_krw: p.price_krw,
        in_stock: p.in_stock,
        trust_score: (retailer?.trust_score as number) ?? null,
        country: (retailer?.country as string) ?? null,
        ships_international: (retailer?.ships_international as boolean) ?? false,
        is_affiliate: (retailer?.affiliate_program as boolean) ?? false,
        last_checked: p.last_checked,
      }
    })

    const bestDeal = retailerPrices.find(p => p.in_stock) ?? null
    const koreaPrice = retailerPrices.find(p => p.country === 'KR')
    const usPrices = retailerPrices.filter(p => p.country === 'US')
    const usAvg = usPrices.length > 0
      ? usPrices.reduce((sum, p) => sum + p.price_usd, 0) / usPrices.length
      : null

    const savingsPct = bestDeal && usAvg
      ? Math.round(((usAvg - bestDeal.price_usd) / usAvg) * 100)
      : null

    return NextResponse.json({
      product,
      prices: retailerPrices,
      best_deal: bestDeal,
      korea_price_usd: koreaPrice?.price_usd ?? null,
      us_avg_price: usAvg ? Math.round(usAvg * 100) / 100 : null,
      savings_pct: savingsPct,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
