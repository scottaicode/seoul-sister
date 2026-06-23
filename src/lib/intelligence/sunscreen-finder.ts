// ---------------------------------------------------------------------------
// Sunscreen finder — shared core
// ---------------------------------------------------------------------------
// Filters ss_products (category='sunscreen') by K-beauty-specific attributes
// (PA rating, white cast, finish, tint, under-makeup, SPF). This is DATA: it
// returns the products that MATCH the requested filters. It does NOT rank
// "best for you" — that judgment is Yuri's (Yuri Sole Authority Principle).
//
// Used by:
//   - GET /api/sunscreen (the standalone finder page)
//   - Yuri's find_sunscreen_match tool (so she can filter conversationally)
// ---------------------------------------------------------------------------
import { getServiceClient } from '@/lib/supabase'

export interface SunscreenFilters {
  pa_rating?: string // 'PA+' | 'PA++' | 'PA+++' | 'PA++++' (minimum)
  white_cast?: string // 'none' | 'minimal' | 'moderate' | 'heavy'
  finish?: string // 'matte' | 'dewy' | 'natural' etc.
  sunscreen_type?: string // 'chemical' | 'physical' | 'hybrid'
  under_makeup?: boolean
  water_resistant?: boolean
  tinted?: boolean
  min_spf?: number
  sort_by?: 'price_asc' | 'price_desc' | 'spf' | 'rating'
  limit?: number
  /** When true, only verified products (use for Yuri tool; the standalone
   *  /api/sunscreen page passes false to preserve its historical behavior of
   *  showing the full catalog). Defaults to false. */
  verifiedOnly?: boolean
}

export interface SunscreenRow {
  id: string
  name_en: string
  name_ko: string | null
  brand_en: string
  category: string
  price_usd: number | null
  image_url: string | null
  rating_avg: number | null
  review_count: number | null
  spf_rating: number | null
  pa_rating: string | null
  white_cast: string | null
  finish: string | null
  sunscreen_type: string | null
  under_makeup: boolean | null
  water_resistant: boolean | null
  is_tinted: boolean | null
  volume_display: string | null
  suitable_for_activity: string | null
}

const PA_RANKINGS = ['PA+', 'PA++', 'PA+++', 'PA++++']

export async function findSunscreens(filters: SunscreenFilters) {
  const supabase = getServiceClient()
  // Cap higher than the tool's needs so the paginated page can over-fetch.
  const limit = Math.min(filters.limit ?? 20, 500)

  let query = supabase
    .from('ss_products')
    .select(
      'id, name_en, name_ko, brand_en, category, price_usd, image_url, rating_avg, review_count, ' +
        'spf_rating, pa_rating, white_cast, finish, sunscreen_type, under_makeup, ' +
        'water_resistant, is_tinted, volume_display, suitable_for_activity',
      { count: 'exact' }
    )
    .eq('category', 'sunscreen')

  if (filters.verifiedOnly) query = query.eq('is_verified', true)

  // Minimum PA rating: PA++++ >= PA+++ >= PA++ >= PA+
  if (filters.pa_rating) {
    const minIndex = PA_RANKINGS.indexOf(filters.pa_rating)
    if (minIndex >= 0) query = query.in('pa_rating', PA_RANKINGS.slice(minIndex))
  }

  if (filters.white_cast === 'none') {
    query = query.eq('white_cast', 'none')
  } else if (filters.white_cast === 'minimal') {
    query = query.in('white_cast', ['none', 'minimal'])
  }

  if (filters.finish) query = query.eq('finish', filters.finish)
  if (filters.sunscreen_type) query = query.eq('sunscreen_type', filters.sunscreen_type)
  if (filters.under_makeup) query = query.eq('under_makeup', true)
  if (filters.water_resistant) query = query.eq('water_resistant', true)
  if (filters.tinted !== undefined) query = query.eq('is_tinted', filters.tinted)
  if (filters.min_spf) query = query.gte('spf_rating', filters.min_spf)

  switch (filters.sort_by) {
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

  query = query.limit(limit)

  const { data, error, count } = await query
  if (error) throw error

  return {
    products: (data ?? []) as unknown as SunscreenRow[],
    total: count ?? 0,
  }
}
