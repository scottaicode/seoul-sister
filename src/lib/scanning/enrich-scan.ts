import { SupabaseClient } from '@supabase/supabase-js'
import { detectScanOverlap, type IngredientOverlapResult } from '@/lib/intelligence/ingredient-overlap'

// ─── Types ───────────────────────────────────────────────────────────

export interface OwnershipData {
  already_owned: boolean
  custom_name: string | null
  status: string | null
}

export interface ScanEnrichment {
  personalization: PersonalizationData | null
  pricing: PricingData | null
  community: CommunityData | null
  counterfeit: CounterfeitData | null
  trending: TrendingData | null
  ingredientInsights: IngredientInsightsData | null
  seasonalContext: SeasonalContextData | null
  ownership: OwnershipData | null
  /**
   * Feature 16.1 — Active ingredients in the scanned product that already
   * exist in the user's routine + inventory. Lets the user see "you already
   * have niacinamide in 3 products" before deciding to add a 4th. Null when
   * no overlap or when the user has no existing products to compare against.
   */
  overlapPreview: IngredientOverlapResult | null
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

export interface IngredientInsightItem {
  ingredientName: string
  concern: string
  effectivenessScore: number
  sampleSize: number
}

export interface IngredientInsightsData {
  insights: IngredientInsightItem[]
  skinType: string
}

export interface SeasonalContextData {
  season: string
  climate: string
  textureAdvice: string
  goodIngredients: string[]
  cautionIngredients: string[]
  patternDescription: string
}

// ─── Season Helper ──────────────────────────────────────────────────

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
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
  // Run all 9 enrichment queries in parallel
  const [
    personalization,
    pricing,
    community,
    counterfeit,
    trending,
    ingredientInsights,
    seasonalContext,
    ownership,
    overlapPreview,
  ] = await Promise.all([
    fetchPersonalization(supabase, userId, ingredientNames),
    productId ? fetchPricing(supabase, productId, brand) : Promise.resolve(null),
    productId ? fetchCommunity(supabase, productId, skinType) : Promise.resolve(null),
    fetchCounterfeit(supabase, brand),
    productId ? fetchTrending(supabase, productId, brand) : Promise.resolve(null),
    fetchIngredientInsights(supabase, userId, ingredientNames),
    fetchSeasonalContext(supabase, userId, ingredientNames),
    productId ? fetchOwnership(supabase, userId, productId) : Promise.resolve(null),
    fetchOverlapPreview(supabase, userId, ingredientNames, productId),
  ])

  // Drop the overlap preview if it has no entries — the UI shouldn't render
  // an empty section.
  const overlap =
    overlapPreview && overlapPreview.entries.length > 0 ? overlapPreview : null

  return {
    personalization,
    pricing,
    community,
    counterfeit,
    trending,
    ingredientInsights,
    seasonalContext,
    ownership,
    overlapPreview: overlap,
  }
}

// ─── Overlap Preview (Feature 16.1) ──────────────────────────────────

/**
 * Resolves the scanned product's ingredient names to ingredient IDs in our
 * catalog, then asks the overlap detector which of those actives the user
 * already has elsewhere. Names that don't match a catalog row (new or unknown
 * ingredients) are simply skipped — the user just won't see a stacking note
 * for them.
 *
 * The `excludeProductId` argument prevents the scanned product itself from
 * counting as a "second product with this ingredient" if the user happens to
 * already own it.
 */
async function fetchOverlapPreview(
  supabase: SupabaseClient,
  userId: string,
  ingredientNames: string[],
  scannedProductId: string | null
): Promise<IngredientOverlapResult | null> {
  if (!ingredientNames.length) return null

  try {
    // Resolve names -> IDs. Use both name_en and name_inci so we catch the
    // catalog regardless of how the scan returned the ingredient string.
    // Lowercase comparison via or() with ilike is too noisy at scale — we
    // rely on exact name_en/name_inci matches, which is good enough because
    // Sonnet pulls the canonical INCI strings from the label during scanning.
    const lowerNames = ingredientNames.map((n) => n.trim()).filter(Boolean)
    if (!lowerNames.length) return null

    // Pull candidate ingredients in two passes (name_en, name_inci) and union
    // them. Avoid ilike loops to keep this a single round trip.
    const { data: byEn } = await supabase
      .from('ss_ingredients')
      .select('id, name_en')
      .in('name_en', lowerNames)

    const { data: byInci } = await supabase
      .from('ss_ingredients')
      .select('id, name_inci')
      .in('name_inci', lowerNames)

    const idSet = new Set<string>()
    for (const r of byEn ?? []) idSet.add(r.id as string)
    for (const r of byInci ?? []) idSet.add(r.id as string)

    if (idSet.size === 0) return null

    return await detectScanOverlap(
      supabase,
      userId,
      Array.from(idSet),
      scannedProductId
    )
  } catch {
    return null
  }
}

// ─── Personalization (database-driven) ──────────────────────────────

async function fetchPersonalization(
  supabase: SupabaseClient,
  userId: string,
  ingredientNames: string[]
): Promise<PersonalizationData | null> {
  const { data: profile } = await supabase
    .from('ss_user_profiles')
    .select('skin_type, skin_concerns, allergies, fitzpatrick_scale')
    .eq('user_id', userId)
    .maybeSingle()

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

  // --- Database-driven comedogenic warnings ---
  // Query ingredients with high comedogenic ratings (3+) from the database
  try {
    const { data: comedogenicIngredients } = await supabase
      .from('ss_ingredients')
      .select('name_inci, name_en, comedogenic_rating')
      .gte('comedogenic_rating', 3)

    if (comedogenicIngredients?.length && (profile.skin_type === 'oily' || profile.skin_type === 'combination')) {
      for (const ci of comedogenicIngredients) {
        const ciNameLower = (ci.name_en || ci.name_inci).toLowerCase()
        if (lowerIngredients.some(i => i.includes(ciNameLower) || ciNameLower.includes(i))) {
          warnings.push(`Contains ${ci.name_en || ci.name_inci} (comedogenic rating ${ci.comedogenic_rating}/5) — can clog pores for ${profile.skin_type} skin`)
        }
      }
    }
  } catch {
    // Fall through — non-critical
  }

  // --- Database-driven irritant warnings ---
  // Query ingredients with low safety ratings (1-2) or flagged as fragrance
  try {
    const { data: irritantIngredients } = await supabase
      .from('ss_ingredients')
      .select('name_inci, name_en, safety_rating, is_fragrance')
      .or('safety_rating.lte.2,is_fragrance.eq.true')

    if (irritantIngredients?.length && profile.skin_type === 'sensitive') {
      for (const ir of irritantIngredients) {
        const irNameLower = (ir.name_en || ir.name_inci).toLowerCase()
        if (lowerIngredients.some(i => i.includes(irNameLower) || irNameLower.includes(i))) {
          const reason = ir.is_fragrance
            ? 'fragrance ingredient'
            : `safety rating ${ir.safety_rating}/5`
          warnings.push(`Contains ${ir.name_en || ir.name_inci} (${reason}) — may irritate sensitive skin`)
        }
      }
    }
  } catch {
    // Fall through — non-critical
  }

  // --- Database-driven beneficial ingredient notes ---
  // Query ingredient effectiveness for the user's skin type
  try {
    const { data: effectiveIngredients } = await supabase
      .from('ss_ingredient_effectiveness')
      .select(`
        effectiveness_score, concern,
        ingredient:ss_ingredients(name_en, name_inci)
      `)
      .or(`skin_type.eq.${profile.skin_type || 'normal'},skin_type.eq.__all__`)
      .gte('effectiveness_score', 0.70)
      .gte('sample_size', 5)
      .order('effectiveness_score', { ascending: false })

    if (effectiveIngredients?.length) {
      for (const ei of effectiveIngredients) {
        const ing = ei.ingredient as unknown as Record<string, unknown> | null
        if (!ing) continue
        const ingName = (ing.name_en as string) || (ing.name_inci as string) || ''
        const ingNameLower = ingName.toLowerCase()
        if (lowerIngredients.some(i => i.includes(ingNameLower) || ingNameLower.includes(i))) {
          const pct = Math.round((ei.effectiveness_score as number) * 100)
          notes.push(`Contains ${ingName} — ${pct}% effective for ${ei.concern} with ${profile.skin_type} skin`)
        }
      }
    }
  } catch {
    // Fall through — non-critical
  }

  // --- Database-driven concern-specific notes ---
  // If the effectiveness query above didn't find concern-specific matches,
  // check if the user's concerns match ingredient effectiveness data
  if (profile.skin_concerns?.length) {
    try {
      for (const concern of profile.skin_concerns) {
        const { data: concernEffective } = await supabase
          .from('ss_ingredient_effectiveness')
          .select(`
            effectiveness_score, concern,
            ingredient:ss_ingredients(name_en, name_inci)
          `)
          .eq('concern', concern.toLowerCase())
          .gte('effectiveness_score', 0.60)
          .gte('sample_size', 5)
          .order('effectiveness_score', { ascending: false })
          .limit(10)

        if (concernEffective?.length) {
          for (const ce of concernEffective) {
            const ing = ce.ingredient as unknown as Record<string, unknown> | null
            if (!ing) continue
            const ingName = (ing.name_en as string) || (ing.name_inci as string) || ''
            const ingNameLower = ingName.toLowerCase()
            if (lowerIngredients.some(i => i.includes(ingNameLower) || ingNameLower.includes(i))) {
              notes.push(`Contains ${ingName} — targets your concern: ${concern}`)
            }
          }
        }
      }
    } catch {
      // Fall through — non-critical
    }
  }

  return {
    skin_type: profile.skin_type || 'unknown',
    concerns: profile.skin_concerns || [],
    allergies: profile.allergies || [],
    fitzpatrick_scale: profile.fitzpatrick_scale,
    personalized_warnings: [...new Set(warnings)].slice(0, 8),
    skin_match_notes: [...new Set(notes)].slice(0, 5),
  }
}

// ─── Ingredient Insights (6th fetcher) ──────────────────────────────

async function fetchIngredientInsights(
  supabase: SupabaseClient,
  userId: string,
  ingredientNames: string[]
): Promise<IngredientInsightsData | null> {
  if (ingredientNames.length === 0) return null

  try {
    // Get user's skin type
    const { data: profile } = await supabase
      .from('ss_user_profiles')
      .select('skin_type')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile?.skin_type) return null

    // Match scanned ingredient names to database ingredients
    // Use ilike for fuzzy matching on common names
    const lowerNames = ingredientNames.map(n => n.toLowerCase())

    const { data: dbIngredients } = await supabase
      .from('ss_ingredients')
      .select('id, name_inci, name_en')

    if (!dbIngredients?.length) return null

    // Find matching ingredient IDs
    const matchedIds: string[] = []
    for (const dbIng of dbIngredients) {
      const dbNameLower = (dbIng.name_en || dbIng.name_inci).toLowerCase()
      if (lowerNames.some(n => n.includes(dbNameLower) || dbNameLower.includes(n))) {
        matchedIds.push(dbIng.id)
      }
    }

    if (matchedIds.length === 0) return null

    // Fetch effectiveness data for matched ingredients + user's skin type
    const { data: effectiveness } = await supabase
      .from('ss_ingredient_effectiveness')
      .select(`
        effectiveness_score, sample_size, concern, ingredient_id,
        ingredient:ss_ingredients(name_en, name_inci)
      `)
      .in('ingredient_id', matchedIds)
      .or(`skin_type.eq.${profile.skin_type},skin_type.eq.__all__`)
      .gte('sample_size', 5)
      .order('effectiveness_score', { ascending: false })

    if (!effectiveness?.length) return null

    const insights: IngredientInsightItem[] = effectiveness.map(e => {
      const ing = e.ingredient as unknown as Record<string, unknown> | null
      return {
        ingredientName: (ing?.name_en as string) || (ing?.name_inci as string) || 'Unknown',
        concern: (e.concern as string) || '',
        effectivenessScore: e.effectiveness_score as number,
        sampleSize: e.sample_size as number,
      }
    })

    // Dedupe by ingredient name (keep highest score per ingredient)
    const seen = new Set<string>()
    const deduped = insights.filter(i => {
      const key = `${i.ingredientName.toLowerCase()}-${i.concern}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      insights: deduped.slice(0, 8),
      skinType: profile.skin_type,
    }
  } catch {
    return null
  }
}

// ─── Seasonal Context (7th fetcher) ─────────────────────────────────

async function fetchSeasonalContext(
  supabase: SupabaseClient,
  userId: string,
  ingredientNames: string[]
): Promise<SeasonalContextData | null> {
  try {
    // Get user's climate
    const { data: profile } = await supabase
      .from('ss_user_profiles')
      .select('climate')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile?.climate) return null

    const currentSeason = getCurrentSeason()

    // Query seasonal patterns for user's climate
    const { data: patterns } = await supabase
      .from('ss_learning_patterns')
      .select('data, pattern_description')
      .eq('pattern_type', 'seasonal')
      .eq('skin_type', profile.climate)

    if (!patterns?.length) return null

    // Find the pattern for the current season
    const currentPattern = patterns.find(p => {
      const d = p.data as Record<string, unknown>
      return d.season === currentSeason
    })

    if (!currentPattern) return null

    const data = currentPattern.data as Record<string, unknown>
    const toEmphasize = (data.ingredients_to_emphasize as string[]) || []
    const toReduce = (data.ingredients_to_reduce as string[]) || []

    // Cross-reference scanned ingredients against seasonal advice
    const lowerIngredients = ingredientNames.map(n => n.toLowerCase())

    const goodIngredients = lowerIngredients.filter(i =>
      toEmphasize.some(e => i.includes(e.toLowerCase()) || e.toLowerCase().includes(i))
    )
    const cautionIngredients = lowerIngredients.filter(i =>
      toReduce.some(r => i.includes(r.toLowerCase()) || r.toLowerCase().includes(i))
    )

    // Only return if there's something relevant to show
    if (goodIngredients.length === 0 && cautionIngredients.length === 0) return null

    return {
      season: currentSeason,
      climate: profile.climate,
      textureAdvice: (data.texture_advice as string) || '',
      goodIngredients,
      cautionIngredients,
      patternDescription: currentPattern.pattern_description || '',
    }
  } catch {
    return null
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

// ─── Ownership Check ──────────────────────────────────────────────────

async function fetchOwnership(
  supabase: SupabaseClient,
  userId: string,
  productId: string
): Promise<OwnershipData | null> {
  try {
    const { data } = await supabase
      .from('ss_user_products')
      .select('custom_name, status')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('status', 'active')
      .maybeSingle()

    if (!data) return null

    return {
      already_owned: true,
      custom_name: data.custom_name || null,
      status: data.status || null,
    }
  } catch {
    return null
  }
}
