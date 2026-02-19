import { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────

export interface ScanEnrichment {
  personalization: PersonalizationData | null
  pricing: PricingData | null
  community: CommunityData | null
  counterfeit: CounterfeitData | null
  trending: TrendingData | null
}

export interface PersonalizationData {
  skin_type: string
  concerns: string[]
  allergies: string[]
  fitzpatrick_scale: number | null
  personalized_warnings: string[]
  skin_match_notes: string[]
}

export interface PricingData {
  prices: Array<{
    retailer: string
    price_usd: number
    url: string | null
    in_stock: boolean
    is_authorized: boolean
    trust_score: number | null
  }>
  best_deal: { retailer: string; price_usd: number; savings_vs_max: number } | null
}

export interface CommunityData {
  total_reviews: number
  avg_rating: number
  skin_type_reviews: number
  skin_type_avg_rating: number | null
  holy_grail_count: number
  broke_me_out_count: number
  would_repurchase_pct: number | null
  effectiveness_score: number | null
  effectiveness_sample_size: number
}

export interface CounterfeitData {
  markers: Array<{ marker_type: string; description: string; severity: string }>
  verified_retailers: Array<{ name: string; trust_score: number; is_authorized: boolean }>
  counterfeit_report_count: number
}

export interface TrendingData {
  is_trending: boolean
  trend_score: number
  source: string | null
  sentiment_score: number | null
  trend_signals: Array<{ trend_name: string; status: string; source: string }>
}

// ─── Main Enrichment Function ────────────────────────────────────────

export async function enrichScanResult(
  supabase: SupabaseClient,
  userId: string,
  productId: string | null,
  brand: string,
  ingredientNames: string[],
  skinType?: string
): Promise<ScanEnrichment> {
  // Run all enrichment queries in parallel
  const [personalization, pricing, community, counterfeit, trending] = await Promise.all([
    fetchPersonalization(supabase, userId, ingredientNames),
    productId ? fetchPricing(supabase, productId, brand) : Promise.resolve(null),
    productId ? fetchCommunity(supabase, productId, skinType) : Promise.resolve(null),
    fetchCounterfeit(supabase, brand),
    productId ? fetchTrending(supabase, productId, brand) : Promise.resolve(null),
  ])

  return { personalization, pricing, community, counterfeit, trending }
}

// ─── Personalization ─────────────────────────────────────────────────

async function fetchPersonalization(
  supabase: SupabaseClient,
  userId: string,
  ingredientNames: string[]
): Promise<PersonalizationData | null> {
  const { data: profile } = await supabase
    .from('ss_user_profiles')
    .select('skin_type, skin_concerns, allergies, fitzpatrick_scale')
    .eq('user_id', userId)
    .single()

  if (!profile) return null

  const warnings: string[] = []
  const notes: string[] = []
  const lowerIngredients = ingredientNames.map(n => n.toLowerCase())

  // Check allergies against ingredients
  if (profile.allergies?.length) {
    for (const allergy of profile.allergies) {
      const allergyLower = allergy.toLowerCase()
      const match = ingredientNames.find(n => n.toLowerCase().includes(allergyLower))
      if (match) {
        warnings.push(`Contains ${match} — you listed "${allergy}" as an allergy`)
      }
    }
  }

  // Skin-type-specific warnings
  if (profile.skin_type === 'oily' || profile.skin_type === 'combination') {
    const comedogenicOils = ['coconut oil', 'cocoa butter', 'wheat germ oil', 'isopropyl myristate']
    for (const oil of comedogenicOils) {
      if (lowerIngredients.some(i => i.includes(oil))) {
        warnings.push(`Contains ${oil} — can be comedogenic for ${profile.skin_type} skin`)
      }
    }
  }

  if (profile.skin_type === 'sensitive') {
    const irritants = ['denatured alcohol', 'alcohol denat', 'fragrance', 'parfum', 'essential oil']
    for (const irritant of irritants) {
      if (lowerIngredients.some(i => i.includes(irritant))) {
        warnings.push(`Contains ${irritant} — may irritate sensitive skin`)
      }
    }
  }

  // Beneficial ingredient notes
  const beneficialMap: Record<string, string[]> = {
    'dry': ['hyaluronic acid', 'ceramide', 'squalane', 'glycerin', 'panthenol'],
    'oily': ['niacinamide', 'salicylic acid', 'zinc', 'tea tree'],
    'combination': ['niacinamide', 'hyaluronic acid', 'centella'],
    'sensitive': ['centella', 'allantoin', 'panthenol', 'madecassoside', 'aloe'],
    'normal': ['vitamin c', 'retinol', 'peptide', 'antioxidant'],
  }

  const beneficials = beneficialMap[profile.skin_type || ''] || []
  for (const b of beneficials) {
    if (lowerIngredients.some(i => i.includes(b))) {
      notes.push(`Contains ${b} — great for ${profile.skin_type} skin`)
    }
  }

  // Concern-specific notes
  if (profile.skin_concerns?.length) {
    const concernIngredients: Record<string, string[]> = {
      'acne': ['salicylic acid', 'benzoyl peroxide', 'tea tree', 'niacinamide', 'zinc'],
      'aging': ['retinol', 'peptide', 'vitamin c', 'collagen', 'adenosine'],
      'hyperpigmentation': ['vitamin c', 'arbutin', 'niacinamide', 'tranexamic acid', 'kojic acid'],
      'dryness': ['hyaluronic acid', 'ceramide', 'squalane', 'shea butter'],
      'redness': ['centella', 'cica', 'madecassoside', 'allantoin', 'green tea'],
      'pores': ['niacinamide', 'bha', 'salicylic acid', 'clay', 'charcoal'],
    }
    for (const concern of profile.skin_concerns) {
      const helpfulIngredients = concernIngredients[concern.toLowerCase()] || []
      for (const hi of helpfulIngredients) {
        if (lowerIngredients.some(i => i.includes(hi))) {
          notes.push(`Contains ${hi} — targets your concern: ${concern}`)
        }
      }
    }
  }

  return {
    skin_type: profile.skin_type || 'unknown',
    concerns: profile.skin_concerns || [],
    allergies: profile.allergies || [],
    fitzpatrick_scale: profile.fitzpatrick_scale,
    personalized_warnings: warnings,
    skin_match_notes: [...new Set(notes)].slice(0, 5), // Dedupe and limit
  }
}

// ─── Pricing ─────────────────────────────────────────────────────────

async function fetchPricing(
  supabase: SupabaseClient,
  productId: string,
  brand: string
): Promise<PricingData | null> {
  const { data: prices } = await supabase
    .from('ss_product_prices')
    .select(`
      price_usd,
      url,
      in_stock,
      retailer:ss_retailers(name, trust_score, is_authorized, authorized_brands)
    `)
    .eq('product_id', productId)
    .order('price_usd', { ascending: true })

  if (!prices?.length) return null

  const formatted = prices
    .filter((p: Record<string, unknown>) => p.retailer)
    .map((p: Record<string, unknown>) => {
      const r = p.retailer as Record<string, unknown>
      const authorizedBrands = (r.authorized_brands as string[]) || []
      return {
        retailer: r.name as string,
        price_usd: p.price_usd as number,
        url: p.url as string | null,
        in_stock: p.in_stock as boolean,
        is_authorized: (r.is_authorized as boolean) && authorizedBrands.some(
          (b: string) => brand.toLowerCase().includes(b.toLowerCase())
        ),
        trust_score: r.trust_score as number | null,
      }
    })

  if (!formatted.length) return null

  const inStockPrices = formatted.filter(p => p.in_stock)
  const maxPrice = Math.max(...formatted.map(p => p.price_usd))
  const cheapest = inStockPrices[0] || formatted[0]

  return {
    prices: formatted,
    best_deal: {
      retailer: cheapest.retailer,
      price_usd: cheapest.price_usd,
      savings_vs_max: maxPrice > cheapest.price_usd
        ? Math.round(((maxPrice - cheapest.price_usd) / maxPrice) * 100)
        : 0,
    },
  }
}

// ─── Community ───────────────────────────────────────────────────────

async function fetchCommunity(
  supabase: SupabaseClient,
  productId: string,
  skinType?: string
): Promise<CommunityData | null> {
  // All reviews for this product
  const { data: reviews } = await supabase
    .from('ss_reviews')
    .select('rating, skin_type, reaction, would_repurchase')
    .eq('product_id', productId)

  // Effectiveness data
  const { data: effectiveness } = await supabase
    .from('ss_product_effectiveness')
    .select('effectiveness_score, sample_size, skin_type')
    .eq('product_id', productId)

  if (!reviews?.length && !effectiveness?.length) return null

  const totalReviews = reviews?.length || 0
  const avgRating = totalReviews > 0
    ? reviews!.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
    : 0

  const skinTypeReviews = skinType
    ? reviews?.filter(r => r.skin_type === skinType) || []
    : []

  const holyGrail = reviews?.filter(r => r.reaction === 'holy_grail').length || 0
  const brokeOut = reviews?.filter(r => r.reaction === 'broke_me_out').length || 0

  const repurchaseVotes = reviews?.filter(r => r.would_repurchase !== null) || []
  const wouldRepurchasePct = repurchaseVotes.length > 0
    ? Math.round((repurchaseVotes.filter(r => r.would_repurchase).length / repurchaseVotes.length) * 100)
    : null

  // Find effectiveness for this skin type, or overall
  const skinEffectiveness = effectiveness?.find(e => e.skin_type === skinType)
    || effectiveness?.find(e => e.skin_type === '__all__')
    || effectiveness?.[0]

  return {
    total_reviews: totalReviews,
    avg_rating: Math.round(avgRating * 10) / 10,
    skin_type_reviews: skinTypeReviews.length,
    skin_type_avg_rating: skinTypeReviews.length > 0
      ? Math.round((skinTypeReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / skinTypeReviews.length) * 10) / 10
      : null,
    holy_grail_count: holyGrail,
    broke_me_out_count: brokeOut,
    would_repurchase_pct: wouldRepurchasePct,
    effectiveness_score: skinEffectiveness?.effectiveness_score ?? null,
    effectiveness_sample_size: skinEffectiveness?.sample_size ?? 0,
  }
}

// ─── Counterfeit ─────────────────────────────────────────────────────

async function fetchCounterfeit(
  supabase: SupabaseClient,
  brand: string
): Promise<CounterfeitData | null> {
  // Get counterfeit markers for this brand (and generic markers)
  const { data: markers } = await supabase
    .from('ss_counterfeit_markers')
    .select('marker_type, description, severity')
    .or(`brand.ilike.%${brand}%,brand.eq.generic`)
    .order('severity', { ascending: false })

  // Get verified retailers for this brand
  const { data: retailers } = await supabase
    .from('ss_retailers')
    .select('name, trust_score, is_authorized, authorized_brands, counterfeit_report_count')
    .order('trust_score', { ascending: false })

  const relevantRetailers = (retailers || [])
    .filter((r: Record<string, unknown>) => {
      const brands = (r.authorized_brands as string[]) || []
      return (r.is_authorized as boolean) || brands.some(
        (b: string) => brand.toLowerCase().includes(b.toLowerCase())
      )
    })
    .slice(0, 5)

  const totalCounterfeitReports = (retailers || [])
    .reduce((sum: number, r: Record<string, unknown>) => sum + ((r.counterfeit_report_count as number) || 0), 0)

  if (!markers?.length && !relevantRetailers.length) return null

  return {
    markers: (markers || []).slice(0, 6).map(m => ({
      marker_type: m.marker_type,
      description: m.description,
      severity: m.severity,
    })),
    verified_retailers: relevantRetailers.map((r: Record<string, unknown>) => ({
      name: r.name as string,
      trust_score: r.trust_score as number,
      is_authorized: r.is_authorized as boolean,
    })),
    counterfeit_report_count: totalCounterfeitReports,
  }
}

// ─── Trending ────────────────────────────────────────────────────────

async function fetchTrending(
  supabase: SupabaseClient,
  productId: string,
  brand: string
): Promise<TrendingData | null> {
  // Check if product is in trending
  const { data: trending } = await supabase
    .from('ss_trending_products')
    .select('trend_score, source, sentiment_score')
    .eq('product_id', productId)
    .order('trend_score', { ascending: false })
    .limit(1)

  // Check trend signals related to the brand
  const { data: signals } = await supabase
    .from('ss_trend_signals')
    .select('trend_name, status, source')
    .or(`keyword.ilike.%${brand}%,trend_name.ilike.%${brand}%`)
    .in('status', ['emerging', 'growing', 'peak'])
    .order('signal_strength', { ascending: false })
    .limit(3)

  const trendEntry = trending?.[0]
  const isTrending = !!trendEntry || (signals?.length || 0) > 0

  if (!isTrending) return null

  return {
    is_trending: true,
    trend_score: trendEntry?.trend_score || 0,
    source: trendEntry?.source || null,
    sentiment_score: trendEntry?.sentiment_score || null,
    trend_signals: (signals || []).map(s => ({
      trend_name: s.trend_name,
      status: s.status,
      source: s.source,
    })),
  }
}
