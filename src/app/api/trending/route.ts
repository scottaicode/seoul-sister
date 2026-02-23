import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'
import { trendingSearchSchema } from '@/lib/utils/validation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ---------------------------------------------------------------------------
// Soft auth: extract user ID from Bearer token if present (non-critical)
// ---------------------------------------------------------------------------
async function softAuth(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    return user?.id ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Load skin profile for personalized relevance
// ---------------------------------------------------------------------------
interface SkinProfile {
  skinType: string
  skinConcerns: string[]
}

async function loadSkinProfile(userId: string): Promise<SkinProfile | null> {
  const { data } = await supabase
    .from('ss_user_profiles')
    .select('skin_type, skin_concerns')
    .eq('user_id', userId)
    .single()

  if (!data?.skin_type) return null
  return {
    skinType: data.skin_type as string,
    skinConcerns: (data.skin_concerns as string[]) ?? [],
  }
}

// ---------------------------------------------------------------------------
// Calculate per-product cohort label + relevance score using ingredient
// effectiveness data for the user's skin type
// ---------------------------------------------------------------------------
interface CohortInfo {
  label: string           // e.g. "Great for oily skin"
  score: number           // 0-100 average effectiveness percentage
  relevanceMultiplier: number // multiplier for trend_score sorting
}

async function calculateCohortData(
  productIds: string[],
  profile: SkinProfile
): Promise<Map<string, CohortInfo>> {
  const result = new Map<string, CohortInfo>()
  if (productIds.length === 0) return result

  // 1. Get effective ingredients for user's skin type
  const { data: effectiveness } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, concern, effectiveness_score, sample_size')
    .eq('skin_type', profile.skinType)
    .gte('sample_size', 5)
    .order('effectiveness_score', { ascending: false })
    .limit(30)

  if (!effectiveness?.length) return result

  const effectiveIngredientIds = effectiveness.map(e => e.ingredient_id)
  const effectivenessMap = new Map(
    effectiveness.map(e => [e.ingredient_id as string, e])
  )

  // 2. Find which trending products contain these effective ingredients
  const { data: links } = await supabase
    .from('ss_product_ingredients')
    .select('product_id, ingredient_id')
    .in('product_id', productIds)
    .in('ingredient_id', effectiveIngredientIds)
    .limit(5000)

  if (!links?.length) return result

  // 3. Score each product by average effectiveness of matched ingredients
  const productScores = new Map<string, { totalScore: number; count: number; concerns: Set<string> }>()

  for (const link of links) {
    const eff = effectivenessMap.get(link.ingredient_id as string)
    if (!eff) continue

    const existing = productScores.get(link.product_id as string)
    if (existing) {
      existing.totalScore += (eff.effectiveness_score as number)
      existing.count++
      existing.concerns.add(eff.concern as string)
    } else {
      productScores.set(link.product_id as string, {
        totalScore: eff.effectiveness_score as number,
        count: 1,
        concerns: new Set([eff.concern as string]),
      })
    }
  }

  // 4. Build cohort labels
  for (const [productId, info] of productScores) {
    const avgScore = info.totalScore / info.count
    const pct = Math.round(avgScore * 100)

    // Concern bonus: if product addresses user's stated concerns, boost relevance
    const userConcerns = profile.skinConcerns.map(c => c.toLowerCase())
    const matchesConcern = [...info.concerns].some(c =>
      userConcerns.some(uc => c.toLowerCase().includes(uc) || uc.includes(c.toLowerCase()))
    )
    const concernBonus = matchesConcern ? 0.15 : 0

    // Build human-readable label
    let label: string
    if (pct >= 75) {
      label = `Great for ${profile.skinType} skin (${pct}%)`
    } else if (pct >= 60) {
      label = `Good for ${profile.skinType} skin (${pct}%)`
    } else {
      label = `Mixed for ${profile.skinType} skin (${pct}%)`
    }

    result.set(productId, {
      label,
      score: pct,
      relevanceMultiplier: avgScore + concernBonus,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// GET /api/trending
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || undefined
    const tab = searchParams.get('tab') || 'trending'
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50)

    // Soft auth for personalized data
    const userId = await softAuth(request)

    // Load profile if authenticated (needed for for_you tab and cohort labels)
    let profile: SkinProfile | null = null
    if (userId) {
      try {
        profile = await loadSkinProfile(userId)
      } catch {
        // Non-critical
      }
    }

    // ---- "for_you" tab: personalized trending ----
    if (tab === 'for_you') {
      if (!profile) {
        return NextResponse.json({
          trending: [],
          skinType: null,
          message: 'Sign in and complete your skin profile for personalized trends.',
        })
      }

      // Fetch all trending products that have a matched product_id
      const { data, error } = await supabase
        .from('ss_trending_products')
        .select('*, product:ss_products(*)')
        .not('product_id', 'is', null)
        .order('trend_score', { ascending: false })
        .limit(100)

      if (error) throw error

      const trendingItems = (data ?? []).filter(
        (t: Record<string, unknown>) => t.product !== null
      )

      // Calculate cohort data for all products
      const productIds = trendingItems
        .map((t: Record<string, unknown>) => t.product_id as string)
        .filter(Boolean)

      const cohortMap = await calculateCohortData(productIds, profile)

      // Filter to products with relevance > 0 and sort by trend_score × relevance
      const relevantItems = trendingItems
        .filter((t: Record<string, unknown>) => cohortMap.has(t.product_id as string))
        .map((t: Record<string, unknown>) => {
          const cohort = cohortMap.get(t.product_id as string)!
          return {
            ...t,
            cohort_label: cohort.label,
            cohort_score: cohort.score,
            relevance_score: Math.round(
              (t.trend_score as number) * cohort.relevanceMultiplier * 100
            ) / 100,
          }
        })
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, limit)

      return NextResponse.json({
        trending: relevantItems,
        skinType: profile.skinType,
      })
    }

    // ---- "emerging" tab: products trending in Korea but unknown in the US ----
    if (tab === 'emerging') {
      const { data, error } = await supabase
        .from('ss_trending_products')
        .select('*, product:ss_products(*)')
        .eq('source', 'olive_young')
        .gt('gap_score', 30)
        .order('gap_score', { ascending: false })
        .order('trend_score', { ascending: false })
        .limit(limit)

      if (error) throw error

      let trending = data ?? []

      // Attach cohort labels if authenticated
      if (profile) {
        const productIds = trending
          .filter((t: Record<string, unknown>) => t.product_id)
          .map((t: Record<string, unknown>) => t.product_id as string)

        const cohortMap = await calculateCohortData(productIds, profile)

        trending = trending.map((t: Record<string, unknown>) => {
          const cohort = cohortMap.get(t.product_id as string)
          return {
            ...t,
            cohort_label: cohort?.label ?? null,
            cohort_score: cohort?.score ?? null,
          }
        })
      }

      return NextResponse.json({
        trending,
        skinType: profile?.skinType ?? null,
      })
    }

    // ---- Standard trending tab ----
    let query = supabase
      .from('ss_trending_products')
      .select('*, product:ss_products(*)')

    if (source) {
      query = query.eq('source', source)
    }

    // Sort order depends on source:
    // - olive_young: by rank_position (bestseller ranking order)
    // - reddit: by trend_score (calculated from mentions + sentiment)
    // - "All": rank_position first (for olive_young rows), then trend_score (for reddit rows)
    if (source === 'olive_young') {
      query = query.order('rank_position', { ascending: true, nullsFirst: false })
    } else if (source === 'reddit') {
      query = query.order('trend_score', { ascending: false })
    } else {
      // "All" — show olive_young by rank first (nulls last), then reddit by score
      query = query.order('rank_position', { ascending: true, nullsFirst: false })
        .order('trend_score', { ascending: false })
    }

    query = query.limit(limit)

    const { data, error } = await query

    if (error) throw error

    // For olive_young source, keep entries even without a matched product
    // (we display source_product_name and source_product_brand as fallback)
    // For other sources, filter out entries where the product join returned null
    let trending = (data ?? []).filter(
      (t: Record<string, unknown>) =>
        t.source === 'olive_young' || t.product !== null
    )

    // Attach cohort labels if authenticated
    if (profile) {
      const productIds = trending
        .filter((t: Record<string, unknown>) => t.product_id)
        .map((t: Record<string, unknown>) => t.product_id as string)

      const cohortMap = await calculateCohortData(productIds, profile)

      trending = trending.map((t: Record<string, unknown>) => {
        const cohort = cohortMap.get(t.product_id as string)
        return {
          ...t,
          cohort_label: cohort?.label ?? null,
          cohort_score: cohort?.score ?? null,
        }
      })
    }

    return NextResponse.json({
      trending,
      skinType: profile?.skinType ?? null,
    })
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
