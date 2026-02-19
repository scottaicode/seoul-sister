import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sunscreenSearchSchema } from '@/lib/utils/validation'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = sunscreenSearchSchema.parse({
      skin_type: searchParams.get('skin_type') || undefined,
      pa_rating: searchParams.get('pa_rating') || undefined,
      white_cast: searchParams.get('white_cast') || undefined,
      finish: searchParams.get('finish') || undefined,
      sunscreen_type: searchParams.get('sunscreen_type') || undefined,
      under_makeup: searchParams.get('under_makeup') === 'true' ? true : undefined,
      water_resistant: searchParams.get('water_resistant') === 'true' ? true : undefined,
      activity: searchParams.get('activity') || undefined,
      min_spf: searchParams.get('min_spf') ? Number(searchParams.get('min_spf')) : undefined,
      sort_by: searchParams.get('sort_by') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let query = supabase
      .from('ss_products')
      .select('*', { count: 'exact' })
      .eq('category', 'sunscreen')

    // Sunscreen-specific filters
    if (params.pa_rating) {
      // Filter for minimum PA rating: PA++++ >= PA+++ >= PA++ >= PA+
      const paRankings = ['PA+', 'PA++', 'PA+++', 'PA++++']
      const minIndex = paRankings.indexOf(params.pa_rating)
      const validRatings = paRankings.slice(minIndex)
      query = query.in('pa_rating', validRatings)
    }

    if (params.white_cast) {
      if (params.white_cast === 'none') {
        query = query.eq('white_cast', 'none')
      } else if (params.white_cast === 'minimal') {
        query = query.in('white_cast', ['none', 'minimal'])
      }
      // 'moderate' and 'heavy' = no filter (show all)
    }

    if (params.finish) {
      query = query.eq('finish', params.finish)
    }

    if (params.sunscreen_type) {
      query = query.eq('sunscreen_type', params.sunscreen_type)
    }

    if (params.under_makeup) {
      query = query.eq('under_makeup', true)
    }

    if (params.water_resistant) {
      query = query.eq('water_resistant', true)
    }

    if (params.activity) {
      if (params.activity === 'water_sports') {
        query = query.eq('suitable_for_activity', 'water_sports')
      } else if (params.activity === 'outdoor') {
        query = query.in('suitable_for_activity', ['outdoor', 'water_sports'])
      }
      // 'daily' = no filter, all sunscreens work for daily
    }

    if (params.min_spf) {
      query = query.gte('spf_rating', params.min_spf)
    }

    // Sorting
    switch (params.sort_by) {
      case 'price_asc':
        query = query.order('price_usd', { ascending: true, nullsFirst: false })
        break
      case 'price_desc':
        query = query.order('price_usd', { ascending: false, nullsFirst: false })
        break
      case 'spf':
        query = query.order('spf_rating', { ascending: false, nullsFirst: false })
        break
      case 'rating':
      default:
        query = query.order('rating_avg', { ascending: false, nullsFirst: false })
        break
    }

    // Pagination
    const offset = (params.page - 1) * params.limit
    query = query.range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) throw error

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
