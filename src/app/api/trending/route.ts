import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'
import { trendingSearchSchema } from '@/lib/utils/validation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || undefined
    const tab = searchParams.get('tab') || 'trending'
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50)

    let query = supabase
      .from('ss_trending_products')
      .select('*, product:ss_products(*)')

    if (source) {
      query = query.eq('source', source)
    }

    // Sort by rank_position when viewing olive_young data (including "All" which is mostly olive_young)
    // This ensures the bestseller ranking order is preserved
    if (source === 'olive_young' || !source) {
      query = query.order('rank_position', { ascending: true, nullsFirst: true })
        .order('trend_score', { ascending: false })
    } else {
      query = query.order('trend_score', { ascending: false })
    }

    query = query.limit(limit)

    const { data, error } = await query

    if (error) throw error

    // For olive_young source, keep entries even without a matched product
    // (we display source_product_name and source_product_brand as fallback)
    // For other sources, filter out entries where the product join returned null
    const trending = (data ?? []).filter(
      (t: Record<string, unknown>) =>
        t.source === 'olive_young' || t.product !== null
    )

    return NextResponse.json({ trending })
  } catch (error) {
    return handleApiError(error)
  }
}

// TikTok Moment Capture: search for a product by name/description
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = trendingSearchSchema.parse(body)

    // Search products matching the query
    const { data: products, error } = await supabase
      .from('ss_products')
      .select('*')
      .or(`name_en.ilike.%${query}%,brand_en.ilike.%${query}%,description_en.ilike.%${query}%`)
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(10)

    if (error) throw error

    if (!products || products.length === 0) {
      return NextResponse.json({
        products: [],
        message: 'No products found. Try searching with different keywords.',
      })
    }

    // Get trending data for matched products
    const productIds = products.map((p: Record<string, unknown>) => p.id)
    const { data: trendingData } = await supabase
      .from('ss_trending_products')
      .select('*')
      .in('product_id', productIds)

    // Get review summaries for matched products
    const { data: reviewData } = await supabase
      .from('ss_reviews')
      .select('product_id, rating, reaction')
      .in('product_id', productIds)

    // Build review summaries per product
    const reviewSummaries: Record<string, {
      count: number
      avg_rating: number
      holy_grail_count: number
      broke_me_out_count: number
    }> = {}

    for (const r of reviewData ?? []) {
      const pid = r.product_id as string
      if (!reviewSummaries[pid]) {
        reviewSummaries[pid] = { count: 0, avg_rating: 0, holy_grail_count: 0, broke_me_out_count: 0 }
      }
      reviewSummaries[pid].count++
      reviewSummaries[pid].avg_rating += r.rating as number
      if (r.reaction === 'holy_grail') reviewSummaries[pid].holy_grail_count++
      if (r.reaction === 'broke_me_out') reviewSummaries[pid].broke_me_out_count++
    }

    for (const pid of Object.keys(reviewSummaries)) {
      if (reviewSummaries[pid].count > 0) {
        reviewSummaries[pid].avg_rating = Math.round(
          (reviewSummaries[pid].avg_rating / reviewSummaries[pid].count) * 10
        ) / 10
      }
    }

    // Merge trending info into products
    const trendingMap = new Map(
      (trendingData ?? []).map((t: Record<string, unknown>) => [t.product_id, t])
    )

    const results = products.map((p: Record<string, unknown>) => ({
      ...p,
      trending: trendingMap.get(p.id) ?? null,
      review_summary: reviewSummaries[p.id as string] ?? null,
    }))

    return NextResponse.json({ products: results })
  } catch (error) {
    return handleApiError(error)
  }
}
