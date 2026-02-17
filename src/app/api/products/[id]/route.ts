import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from('ss_products')
      .select('*')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Fetch ingredients with details (joined via ss_product_ingredients)
    const { data: productIngredients, error: ingredientsError } = await supabase
      .from('ss_product_ingredients')
      .select(`
        position,
        concentration_pct,
        ingredient:ss_ingredients (
          id,
          name_inci,
          name_en,
          name_ko,
          function,
          description,
          safety_rating,
          comedogenic_rating,
          is_fragrance,
          is_active,
          common_concerns
        )
      `)
      .eq('product_id', id)
      .order('position', { ascending: true })

    if (ingredientsError) {
      console.error('Error fetching ingredients:', ingredientsError)
    }

    // Fetch prices from retailers
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
          affiliate_program
        )
      `)
      .eq('product_id', id)
      .order('price_usd', { ascending: true })

    if (pricesError) {
      console.error('Error fetching prices:', pricesError)
    }

    // Fetch reviews summary
    const { data: reviews, error: reviewsError } = await supabase
      .from('ss_reviews')
      .select('rating, reaction')
      .eq('product_id', id)

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError)
    }

    const reviewSummary = reviews && reviews.length > 0
      ? {
          count: reviews.length,
          avg_rating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
          holy_grail_count: reviews.filter(r => r.reaction === 'holy_grail').length,
          broke_me_out_count: reviews.filter(r => r.reaction === 'broke_me_out').length,
        }
      : null

    return NextResponse.json({
      product,
      ingredients: productIngredients ?? [],
      prices: prices ?? [],
      review_summary: reviewSummary,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
