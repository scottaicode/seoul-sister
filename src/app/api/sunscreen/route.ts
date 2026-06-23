import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sunscreenSearchSchema } from '@/lib/utils/validation'
import { handleApiError } from '@/lib/utils/error-handler'
import { findSunscreens } from '@/lib/intelligence/sunscreen-finder'

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
      // v10.8.19 (Bailey): 'tinted' filter — accepts 'true' (tinted only) or
      // 'false' (untinted only). Absence = no filter (any tint state).
      tinted: searchParams.get('tinted') === 'true' ? true
        : searchParams.get('tinted') === 'false' ? false
        : undefined,
      activity: searchParams.get('activity') || undefined,
      min_spf: searchParams.get('min_spf') ? Number(searchParams.get('min_spf')) : undefined,
      sort_by: searchParams.get('sort_by') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    })

    // The 'activity' filter (suitable_for_activity) is retained in the schema for
    // future expert-curated rankings but is 99% NULL in the catalog and not wired
    // into the shared finder. When set, apply it as a post-filter here so the page
    // contract is unchanged. The core attribute filtering lives in findSunscreens
    // (shared with Yuri's find_sunscreen_match tool).
    const offset = (params.page - 1) * params.limit
    const { products: matched, total } = await findSunscreens({
      pa_rating: params.pa_rating,
      white_cast: params.white_cast,
      finish: params.finish,
      sunscreen_type: params.sunscreen_type,
      under_makeup: params.under_makeup,
      water_resistant: params.water_resistant,
      tinted: params.tinted,
      min_spf: params.min_spf,
      sort_by: params.sort_by as 'price_asc' | 'price_desc' | 'spf' | 'rating' | undefined,
      // over-fetch to support pagination + optional activity post-filter
      limit: offset + params.limit,
    })

    let products = matched
    if (params.activity && params.activity !== 'daily') {
      const allowed = params.activity === 'water_sports'
        ? ['water_sports']
        : ['outdoor', 'water_sports']
      products = products.filter(p =>
        p.suitable_for_activity != null && allowed.includes(p.suitable_for_activity)
      )
    }

    const page = products.slice(offset, offset + params.limit)

    return NextResponse.json({
      products: page,
      total,
      page: params.page,
      total_pages: Math.ceil(total / params.limit),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
