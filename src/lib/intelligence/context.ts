import { getServiceClient } from '@/lib/supabase'
import type { SkinProfile } from '@/types/database'

// ---------------------------------------------------------------------------
// Intelligence Context — Shared data layer for all personalized features
// ---------------------------------------------------------------------------

export interface IntelligenceProfile {
  userId: string
  skinType: string | null
  skinConcerns: string[]
  allergies: string[]
  fitzpatrickScale: number | null
  climate: string | null
  locationText: string | null
  ageRange: string | null
  budgetRange: string | null
  experienceLevel: string | null
  cycleTrackingEnabled: boolean
  latitude: number | null
  longitude: number | null
}

export interface IngredientEffectivenessRow {
  ingredientName: string
  ingredientId: string
  ingredientFunction: string | null
  concern: string
  effectivenessScore: number
  sampleSize: number
}

export interface SeasonalPattern {
  season: string
  textureAdvice: string
  ingredientsToEmphasize: string[]
  ingredientsToReduce: string[]
  patternDescription: string
}

export interface ActiveTrend {
  trendName: string
  trendType: string
  status: string
  signalStrength: number
}

export interface IntelligenceContext {
  profile: IntelligenceProfile | null
  ingredientEffectiveness: IngredientEffectivenessRow[]
  seasonalPatterns: SeasonalPattern[]
  activeTrends: ActiveTrend[]
}

// ---------------------------------------------------------------------------
// Current season helper
// ---------------------------------------------------------------------------

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1 // 1-12
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

// ---------------------------------------------------------------------------
// Main loader — runs all queries in parallel, non-critical failures safe
// ---------------------------------------------------------------------------

export async function loadIntelligenceContext(
  userId: string | null
): Promise<IntelligenceContext> {
  const db = getServiceClient()

  // If no userId, return empty context with only trend data
  if (!userId) {
    const trends = await loadActiveTrends(db)
    return {
      profile: null,
      ingredientEffectiveness: [],
      seasonalPatterns: [],
      activeTrends: trends,
    }
  }

  // Load profile first (other queries depend on skin_type / climate)
  let profile: IntelligenceProfile | null = null
  try {
    const { data } = await db
      .from('ss_user_profiles')
      .select(
        'user_id, skin_type, skin_concerns, allergies, fitzpatrick_scale, climate, location_text, age_range, budget_range, experience_level, cycle_tracking_enabled, latitude, longitude'
      )
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      const raw = data as Record<string, unknown>
      profile = {
        userId: raw.user_id as string,
        skinType: (raw.skin_type as string) || null,
        skinConcerns: (raw.skin_concerns as string[]) || [],
        allergies: (raw.allergies as string[]) || [],
        fitzpatrickScale: (raw.fitzpatrick_scale as number) || null,
        climate: (raw.climate as string) || null,
        locationText: (raw.location_text as string) || null,
        ageRange: (raw.age_range as string) || null,
        budgetRange: (raw.budget_range as string) || null,
        experienceLevel: (raw.experience_level as string) || null,
        cycleTrackingEnabled: (raw.cycle_tracking_enabled as boolean) || false,
        latitude: (raw.latitude as number) || null,
        longitude: (raw.longitude as number) || null,
      }
    }
  } catch {
    // Profile loading is non-critical
  }

  // Run remaining queries in parallel (each is non-critical)
  const [effectiveness, seasonal, trends] = await Promise.all([
    loadIngredientEffectiveness(db, profile?.skinType || null),
    loadSeasonalPatterns(db, profile?.climate || null),
    loadActiveTrends(db),
  ])

  return {
    profile,
    ingredientEffectiveness: effectiveness,
    seasonalPatterns: seasonal,
    activeTrends: trends,
  }
}

// ---------------------------------------------------------------------------
// Sub-loaders (each wrapped in try/catch, return empty on failure)
// ---------------------------------------------------------------------------

async function loadIngredientEffectiveness(
  db: ReturnType<typeof getServiceClient>,
  skinType: string | null
): Promise<IngredientEffectivenessRow[]> {
  if (!skinType) return []
  try {
    const { data } = await db
      .from('ss_ingredient_effectiveness')
      .select(
        `effectiveness_score, sample_size, concern,
         ingredient_id,
         ingredient:ss_ingredients(id, name_en, function)`
      )
      .or(`skin_type.eq.${skinType},skin_type.eq.__all__`)
      .gte('sample_size', 5)
      .order('effectiveness_score', { ascending: false })
      .limit(20)

    return (data || []).map((row: Record<string, unknown>) => {
      const ing = row.ingredient as Record<string, unknown> | null
      return {
        ingredientName: (ing?.name_en as string) || 'Unknown',
        ingredientId: (ing?.id as string) || (row.ingredient_id as string) || '',
        ingredientFunction: (ing?.function as string) || null,
        concern: (row.concern as string) || '',
        effectivenessScore: row.effectiveness_score as number,
        sampleSize: row.sample_size as number,
      }
    })
  } catch {
    return []
  }
}

async function loadSeasonalPatterns(
  db: ReturnType<typeof getServiceClient>,
  climate: string | null
): Promise<SeasonalPattern[]> {
  if (!climate) return []
  try {
    const { data } = await db
      .from('ss_learning_patterns')
      .select('data, pattern_description')
      .eq('pattern_type', 'seasonal')
      .eq('skin_type', climate)

    const currentSeason = getCurrentSeason()

    return (data || [])
      .map((row: Record<string, unknown>) => {
        const d = row.data as Record<string, unknown>
        return {
          season: (d.season as string) || '',
          textureAdvice: (d.texture_advice as string) || '',
          ingredientsToEmphasize: (d.ingredients_to_emphasize as string[]) || [],
          ingredientsToReduce: (d.ingredients_to_reduce as string[]) || [],
          patternDescription: (row.pattern_description as string) || '',
        }
      })
      .sort((a, b) => {
        // Current season first
        if (a.season === currentSeason && b.season !== currentSeason) return -1
        if (b.season === currentSeason && a.season !== currentSeason) return 1
        return 0
      })
  } catch {
    return []
  }
}

async function loadActiveTrends(
  db: ReturnType<typeof getServiceClient>
): Promise<ActiveTrend[]> {
  try {
    const { data } = await db
      .from('ss_trend_signals')
      .select('trend_name, trend_type, status, signal_strength')
      .in('status', ['emerging', 'trending'])
      .order('signal_strength', { ascending: false })
      .limit(10)

    return (data || [])
      .filter((row: Record<string, unknown>) => row.trend_name)
      .map((row: Record<string, unknown>) => ({
        trendName: row.trend_name as string,
        trendType: (row.trend_type as string) || '',
        status: row.status as string,
        signalStrength: (row.signal_strength as number) || 0,
      }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Helper: Get personalized ingredient insights for a list of ingredient names
// ---------------------------------------------------------------------------

export function getPersonalizedIngredientInsights(
  context: IntelligenceContext,
  ingredientNames: string[]
): Array<{
  ingredientName: string
  effective: boolean
  score: number | null
  concern: string | null
  seasonal: string | null
  isAllergen: boolean
}> {
  if (!context.profile || ingredientNames.length === 0) return []

  const currentSeason = getCurrentSeason()
  const currentSeasonalPattern = context.seasonalPatterns.find(
    (p) => p.season === currentSeason
  )

  return ingredientNames.map((name) => {
    const nameLower = name.toLowerCase()

    // Check effectiveness
    const effectivenessMatch = context.ingredientEffectiveness.find((e) =>
      e.ingredientName.toLowerCase().includes(nameLower) ||
      nameLower.includes(e.ingredientName.toLowerCase())
    )

    // Check seasonal
    let seasonalNote: string | null = null
    if (currentSeasonalPattern) {
      const isEmphasized = currentSeasonalPattern.ingredientsToEmphasize.some(
        (i) => nameLower.includes(i.toLowerCase())
      )
      const isReduced = currentSeasonalPattern.ingredientsToReduce.some(
        (i) => nameLower.includes(i.toLowerCase())
      )
      if (isEmphasized) {
        seasonalNote = `Emphasize in ${currentSeason} for ${context.profile!.climate} climate`
      } else if (isReduced) {
        seasonalNote = `Reduce in ${currentSeason} for ${context.profile!.climate} climate`
      }
    }

    // Check allergen
    const isAllergen = context.profile!.allergies.some(
      (a) => nameLower.includes(a.toLowerCase()) || a.toLowerCase().includes(nameLower)
    )

    return {
      ingredientName: name,
      effective: effectivenessMatch ? effectivenessMatch.effectivenessScore >= 0.70 : false,
      score: effectivenessMatch?.effectivenessScore ?? null,
      concern: effectivenessMatch?.concern ?? null,
      seasonal: seasonalNote,
      isAllergen,
    }
  })
}

// ---------------------------------------------------------------------------
// Helper: Get current seasonal advice for the user's climate
// ---------------------------------------------------------------------------

export function getSeasonalAdvice(
  context: IntelligenceContext
): SeasonalPattern | null {
  const currentSeason = getCurrentSeason()
  return context.seasonalPatterns.find((p) => p.season === currentSeason) || null
}
