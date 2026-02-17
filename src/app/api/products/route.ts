import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { productSearchSchema } from '@/lib/utils/validation'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = productSearchSchema.parse({
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      min_price: searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined,
      max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
      min_rating: searchParams.get('min_rating') ? Number(searchParams.get('min_rating')) : undefined,
      sort_by: (searchParams.get('sort_by') as 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'trending') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let query = supabase.from('ss_products').select('*', { count: 'exact' })

    if (params.query) {
      query = query.or(`name_en.ilike.%${params.query}%,brand_en.ilike.%${params.query}%`)
    }
    if (params.category) {
      query = query.eq('category', params.category)
    }
    if (params.brand) {
      query = query.ilike('brand_en', `%${params.brand}%`)
    }
    if (params.min_price !== undefined) {
      query = query.gte('price_usd', params.min_price)
    }
    if (params.max_price !== undefined) {
      query = query.lte('price_usd', params.max_price)
    }
    if (params.min_rating !== undefined) {
      query = query.gte('rating_avg', params.min_rating)
    }

    switch (params.sort_by) {
      case 'price_asc':
        query = query.order('price_usd', { ascending: true, nullsFirst: false })
        break
      case 'price_desc':
        query = query.order('price_usd', { ascending: false, nullsFirst: false })
        break
      case 'rating':
        query = query.order('rating_avg', { ascending: false, nullsFirst: false })
        break
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      default:
        query = query.order('rating_avg', { ascending: false, nullsFirst: false })
    }

    const offset = (params.page - 1) * params.limit
    query = query.range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      products: data ?? [],
      total: count ?? 0,
      page: params.page,
      total_pages: Math.ceil((count ?? 0) / params.limit),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
