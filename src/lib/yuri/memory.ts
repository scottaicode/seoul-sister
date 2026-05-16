import { getServiceClient } from '@/lib/supabase'
import type { SkinProfile, YuriConversation, YuriMessage, SpecialistType, CyclePhaseInfo, UserCycleTracking } from '@/types/database'
import { getCyclePhase, getPhaseLabel } from '@/lib/intelligence/cycle-routine'
import { detectRoutineOverlap, type IngredientOverlapResult } from '@/lib/intelligence/ingredient-overlap'

// ---------------------------------------------------------------------------
// Intent classification for conditional context loading
// ---------------------------------------------------------------------------

export type ConversationTopic =
  | 'routine'
  | 'ingredients'
  | 'pricing'
  | 'trending'
  | 'skin_profile'
  | 'products'
  | 'counterfeit'
  | 'general'

/**
 * Classify the user's message intent to determine which context sections to load.
 * First message of any conversation always returns 'general' (load everything).
 * Subsequent messages load only relevant sections to save Supabase queries and tokens.
 */
export function classifyIntent(
  message: string,
  isFirstMessage: boolean
): Set<ConversationTopic> {
  if (isFirstMessage) return new Set(['general'])

  const topics = new Set<ConversationTopic>()
  const m = message.toLowerCase()

  if (/routine|order|layer|morning|night|pm\b|am\b|step|cycle|hormonal|menstrual/.test(m)) {
    topics.add('routine')
  }
  if (/ingredient|inci|ph\b|concentration|formula|niacinamide|retinol|hyaluronic|vitamin c|bha|aha|centella|ceramide|peptide/.test(m)) {
    topics.add('ingredients')
  }
  if (/price|budget|cheap|dupe|alternative|save|cost|afford|expensive|value/.test(m)) {
    topics.add('pricing')
  }
  if (/trending|popular|viral|korea|tiktok|olive young|new product|emerging|bestseller|reddit/.test(m)) {
    topics.add('trending')
  }
  if (/skin type|concern|allergy|sensitive|oily|dry|combo|acne|aging|wrinkle|pore|dark spot|redness|barrier/.test(m)) {
    topics.add('skin_profile')
  }
  if (/product|recommend|suggest|best|which|compare|review|serum|moisturizer|cleanser|toner|sunscreen|mask/.test(m)) {
    topics.add('products')
  }
  if (/fake|counterfeit|authentic|batch code|real|genuine|seller|trust/.test(m)) {
    topics.add('counterfeit')
  }

  return topics.size > 0 ? topics : new Set(['general'])
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CorrectionCategory =
  | 'reformulation'
  | 'discontinued'
  | 'price'
  | 'ingredient'
  | 'brand_identity'
  | 'other'

export interface DecisionMemory {
  decisions: Array<{ topic: string; decision: string; date: string }>
  /**
   * Phase 15.4 — preferences now carry a `date` so the rendering layer can
   * surface "you told me this on YYYY-MM-DD" inline. Date defaults to the
   * extraction date when Sonnet doesn't provide one (Sonnet prompt isn't
   * asked for it to avoid wasting tokens on something rarely relevant).
   */
  preferences: Array<{ topic: string; preference: string; date: string }>
  commitments: Array<{ item: string; date: string }>
  corrections: Array<{
    topic: string
    yuri_said: string
    truth: string
    category: CorrectionCategory
    date: string
  }>
  extracted_at: string
}

export interface SpecialistInsightMemory {
  specialistType: string
  data: Record<string, unknown>
  createdAt: string
}

export interface RecentConversationExcerpt {
  conversationId: string
  title: string | null
  messages: Array<{ role: string; content: string }>
}

export interface UserProduct {
  product_id: string | null
  custom_name: string | null
  custom_brand: string | null
  category: string | null
  texture_weight: number | null
  notes: string | null
  status: string
}

/**
 * A routine entry with explicit ownership status. Yuri must distinguish
 * "in the user's saved plan" from "in the user's actual inventory" to avoid
 * confidently claiming a user owns a product they only have on a routine card.
 */
export interface RoutineProductEntry {
  productId: string | null
  display: string             // "Goodal Vita C (Goodal) — serum"
  ownership: 'owned' | 'planned_only' | 'unknown'
}

export interface UserContext {
  skinProfile: SkinProfile | null
  recentConversations: ConversationMemory[]
  recentExcerpts: RecentConversationExcerpt[]
  productReactions: ProductReaction[]
  knownAllergies: string[]
  knownPreferences: string[]
  routineProducts: RoutineProductEntry[]
  userProducts: UserProduct[]
  learningInsights: LearningContextData[]
  specialistInsights: SpecialistInsightMemory[]
  decisionMemory: DecisionMemory | null
  cyclePhase: CyclePhaseInfo | null
  locationName: string | null
  /**
   * Feature 16.1 — Ingredient stacking analysis across the user's active
   * routines + inventory. Surfaces active ingredients that appear in 2+
   * products so Yuri can flag redundancy proactively (Bailey's gap, May 8 2026).
   * Null when overlap detection isn't loaded for this conversation turn (intent
   * classification deemed it irrelevant) or when no overlap exists.
   */
  ingredientOverlap: IngredientOverlapResult | null
  /**
   * Glass Skin Score history — most recent 3 scores. Lets Yuri reference past
   * scores naturally ("you were at 49 in February, ready for a new baseline?")
   * and identify stale-baseline situations during active treatment. Empty array
   * when user has never taken a score. Bailey's gap (May 16 2026): Yuri had
   * zero awareness her last score was 80+ days old mid-Phase 2.
   */
  glassSkinHistory: GlassSkinScoreSummary[]
}

export interface GlassSkinScoreSummary {
  takenAt: string                // ISO timestamp
  takenDate: string              // YYYY-MM-DD
  daysAgo: number                // computed at load time
  overall: number                // 0-100
  luminosity: number
  smoothness: number
  clarity: number
  hydration: number
  evenness: number
}

export interface LearningContextData {
  type: 'effectiveness' | 'trend' | 'seasonal'
  summary: string
}

export interface ConversationMemory {
  conversationId: string
  title: string | null
  specialistType: SpecialistType | null
  conversationType: string | null
  summary: string
  keyInsights: string[]
  timestamp: string
  aiSummary: string | null
  /**
   * Pre-stored natural opener from this conversation's summary generation.
   * When the user starts a fresh conversation, Yuri can use this to pick up
   * naturally (e.g. "you're 10 days into Phase 2 now, how's the chin?")
   * instead of starting cold. Null when no summary has been generated yet,
   * or when extraction failed to produce a clean opener.
   */
  nextSessionOpener: string | null
}

export interface ProductReaction {
  productName: string
  reaction: 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'
  /**
   * Phase 15.4 — when the user logged this reaction. Surfaced inline so Yuri
   * can calibrate confidence (a 90-day-old "broke me out" deserves "is this
   * still happening?" before re-recommending the product).
   */
  recordedAt: string | null
}

// ---------------------------------------------------------------------------
// Load user context for Yuri conversations
// ---------------------------------------------------------------------------

export interface LoadUserContextOptions {
  /** The current user message — used for intent classification. */
  message?: string
  /** True if this is the first message in the conversation (loads everything). */
  isFirstMessage?: boolean
}

export async function loadUserContext(
  userId: string,
  currentConversationId?: string,
  options?: LoadUserContextOptions
): Promise<UserContext> {
  const db = getServiceClient()

  // Classify intent to decide which context sections to load
  const topics = classifyIntent(
    options?.message || '',
    options?.isFirstMessage ?? true // Default to loading everything if not specified
  )
  const loadAll = topics.has('general')

  // ALWAYS load: profile + conversations + decision memory (cheap, critical)
  const alwaysPromises = Promise.all([
    // Skin profile
    db
      .from('ss_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),

    // Recent conversations (last 10) for memory context
    db
      .from('ss_yuri_conversations')
      .select('id, title, specialist_type, conversation_type, updated_at, summary, next_session_opener')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  // CONDITIONAL: product reactions (needed for products, ingredients, skin_profile, or general)
  const loadReactions = loadAll || topics.has('products') || topics.has('ingredients') || topics.has('skin_profile')
  const reactionsPromise = loadReactions
    ? db
        .from('ss_user_product_reactions')
        .select(`
          reaction,
          product_id,
          created_at,
          ss_products (name_en)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
    : Promise.resolve({ data: null })

  // CONDITIONAL: routine products (needed for routine or general)
  const loadRoutine = loadAll || topics.has('routine')
  const routinePromise = loadRoutine
    ? db
        .from('ss_user_routines')
        .select(`
          id,
          routine_type,
          ss_routine_products (
            step_order,
            product_id,
            ss_products (name_en, brand_en, category)
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
    : Promise.resolve({ data: null })

  // CONDITIONAL: user product inventory (needed for routine, products, or general)
  // product_id is selected so we can mark routine products as owned vs.
  // planned-but-not-yet-owned. (Bailey hit this on May 3 when Yuri claimed she
  // owned Torriden DIVE-IN — it was in her saved routine but she'd never
  // bought it. ss_user_routines is the plan; ss_user_products is the inventory.)
  const loadUserProducts = loadAll || topics.has('routine') || topics.has('products')
  const userProductsPromise = loadUserProducts
    ? db
        .from('ss_user_products')
        .select('product_id, custom_name, custom_brand, category, texture_weight, notes, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('custom_name')
    : Promise.resolve({ data: null })

  // CONDITIONAL: specialist insights (only for general — these are rarely referenced in focused queries)
  const loadSpecialist = loadAll
  const specialistInsightsPromise = loadSpecialist
    ? db
        .from('ss_specialist_insights')
        .select('specialist_type, data, created_at, conversation_id, ss_yuri_conversations!inner(user_id)')
        .eq('ss_yuri_conversations.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
    : Promise.resolve({ data: null })

  // CONDITIONAL: ingredient overlap (Feature 16.1). Load whenever routine,
  // ingredients, or products topics are active — these are the moments Yuri
  // benefits from knowing the user has niacinamide stacked across 5 products.
  // Skipped on focused queries about pricing/trending/counterfeit where it's
  // irrelevant noise. Always loaded on first message ('general').
  const loadOverlap = loadAll || topics.has('routine') || topics.has('ingredients') || topics.has('products')
  const overlapPromise: Promise<IngredientOverlapResult | null> = loadOverlap
    ? detectRoutineOverlap(db, userId)
    : Promise.resolve(null)

  // CONDITIONAL: Glass Skin Score history. Lightweight (3 rows max). Load when
  // topics touch routine/skin_profile/general — these are the moments where
  // referencing past scores or suggesting a fresh baseline is appropriate.
  // Skipped on focused pricing/trending queries.
  const loadGlassSkin = loadAll || topics.has('routine') || topics.has('skin_profile')
  const glassSkinPromise = loadGlassSkin
    ? db
        .from('ss_glass_skin_scores')
        .select('created_at, overall_score, luminosity_score, smoothness_score, clarity_score, hydration_score, evenness_score')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
    : Promise.resolve({ data: null })

  // Execute all queries in parallel
  const [
    [profileResult, conversationsResult],
    reactionsResult,
    routineResult,
    userProductsResult,
    specialistInsightsResult,
    overlapResult,
    glassSkinResult,
  ] = await Promise.all([
    alwaysPromises,
    reactionsPromise,
    routinePromise,
    userProductsPromise,
    specialistInsightsPromise,
    overlapPromise,
    glassSkinPromise,
  ])

  const skinProfile = profileResult.data as SkinProfile | null

  // CONDITIONAL: learning insights (needed for ingredients, skin_profile, products, or general)
  const loadLearning = loadAll || topics.has('ingredients') || topics.has('skin_profile') || topics.has('products')
  const learningInsights = loadLearning
    ? await loadLearningContext(db, skinProfile)
    : []

  // Load cycle phase if tracking is enabled (needed for routine or general)
  let cyclePhase: CyclePhaseInfo | null = null
  if (loadAll || topics.has('routine')) {
    try {
      const profileRaw = profileResult.data as Record<string, unknown> | null
      if (profileRaw?.cycle_tracking_enabled) {
        const { data: latestCycle } = await db
          .from('ss_user_cycle_tracking')
          .select('cycle_start_date, cycle_length_days')
          .eq('user_id', userId)
          .order('cycle_start_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestCycle) {
          const entry = latestCycle as unknown as UserCycleTracking
          const avgLength = (profileRaw.avg_cycle_length as number) || entry.cycle_length_days || 28
          cyclePhase = getCyclePhase(entry.cycle_start_date, avgLength)
        }
      }
    } catch {
      // Cycle loading is non-critical
    }
  }

  // Build conversation memories from recent conversations
  const recentConversations: ConversationMemory[] = (conversationsResult.data || []).map(
    (conv: { id: string; title: string | null; specialist_type: SpecialistType | null; conversation_type: string | null; updated_at: string; summary: string | null; next_session_opener: string | null }) => ({
      conversationId: conv.id,
      title: conv.title,
      specialistType: conv.specialist_type,
      conversationType: conv.conversation_type,
      summary: conv.title || 'Untitled conversation',
      keyInsights: [],
      timestamp: conv.updated_at,
      aiSummary: conv.summary || null,
      nextSessionOpener: conv.next_session_opener || null,
    })
  )

  // Extract product reactions
  const productReactions: ProductReaction[] = (reactionsResult.data || []).map(
    (r: Record<string, unknown>) => ({
      productName: (r.ss_products as Record<string, string>)?.name_en || 'Unknown',
      reaction: r.reaction as ProductReaction['reaction'],
      recordedAt: (r.created_at as string) || null,
    })
  )

  // Extract user product inventory FIRST so we can build an ownership set
  // for the routine extraction below.
  const userProducts: UserProduct[] = (userProductsResult.data || []).map(
    (r: Record<string, unknown>) => ({
      product_id: (r.product_id as string | null) || null,
      custom_name: r.custom_name as string | null,
      custom_brand: r.custom_brand as string | null,
      category: r.category as string | null,
      texture_weight: r.texture_weight as number | null,
      notes: r.notes as string | null,
      status: r.status as string,
    })
  )

  // Build a Set of product_ids the user actually owns (from ss_user_products)
  // so the routine extraction can mark each routine entry as owned vs.
  // planned-but-not-yet-owned.
  const ownedProductIds = new Set<string>(
    userProducts
      .map((up) => up.product_id)
      .filter((id): id is string => id != null)
  )
  const ownedNameTokens = userProducts
    .flatMap((up) => [up.custom_name, up.custom_brand])
    .filter((s): s is string => !!s)
    .map((s) => s.toLowerCase())

  // Extract routine products — distinguish owned vs. planned-only.
  const routineProducts: RoutineProductEntry[] = []
  for (const routine of routineResult.data || []) {
    const products = (routine as Record<string, unknown>).ss_routine_products as
      | Record<string, unknown>[]
      | null
    if (products) {
      for (const rp of products) {
        const product = rp.ss_products as Record<string, string> | null
        const productId = (rp.product_id as string | null) || null
        if (product) {
          // Owned if product_id is in inventory, OR if a custom_name in
          // inventory matches the product name (handles legacy custom entries).
          const matchesInventoryName = ownedNameTokens.some((tok) =>
            product.name_en.toLowerCase().includes(tok) ||
            (product.brand_en && product.brand_en.toLowerCase().includes(tok))
          )
          const ownership: RoutineProductEntry['ownership'] =
            (productId && ownedProductIds.has(productId)) || matchesInventoryName
              ? 'owned'
              : 'planned_only'
          routineProducts.push({
            productId,
            display: `${product.name_en} (${product.brand_en}) - ${product.category}`,
            ownership,
          })
        }
      }
    }
  }

  // Extract specialist insights — deduplicate by specialist type (keep most recent)
  const specialistInsights: SpecialistInsightMemory[] = []
  const seenSpecialists = new Set<string>()
  for (const row of specialistInsightsResult.data || []) {
    const r = row as Record<string, unknown>
    const st = r.specialist_type as string
    if (seenSpecialists.has(st)) continue
    seenSpecialists.add(st)
    const data = r.data as Record<string, unknown>
    // Only include insights that have meaningful content (non-empty arrays/values)
    const hasContent = Object.values(data).some((v) =>
      Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== ''
    )
    if (hasContent) {
      specialistInsights.push({
        specialistType: st,
        data,
        createdAt: r.created_at as string,
      })
    }
  }

  // CONDITIONAL: recent excerpts (only for general — these are expensive and mainly used as memory safety net)
  const recentExcerpts = loadAll
    ? await loadRecentConversationExcerpts(db, userId, currentConversationId)
    : []

  // Reverse-geocode user's location from lat/lng if available
  const locationName = await reverseGeocodeUserLocation(skinProfile)

  // Load structured decision memory across recent conversations (always load — cheap and critical)
  const decisionMemory = await loadDecisionMemory(db, userId)

  // Only surface overlap when entries actually exist (worth flagging). An
  // empty result -> null so formatContextForPrompt skips the section cleanly.
  const ingredientOverlap = overlapResult && overlapResult.entries.length > 0
    ? overlapResult
    : null

  // Glass Skin Score history — normalize timestamps + compute days-ago at load
  // time so the formatter doesn't have to. Empty array if user never scored.
  const glassSkinHistory: GlassSkinScoreSummary[] = (glassSkinResult.data || []).map((r) => {
    const row = r as Record<string, unknown>
    const takenAt = row.created_at as string
    const takenDate = takenAt.slice(0, 10)
    const daysAgo = Math.floor((Date.now() - new Date(takenAt).getTime()) / (1000 * 60 * 60 * 24))
    return {
      takenAt,
      takenDate,
      daysAgo,
      overall: Number(row.overall_score) || 0,
      luminosity: Number(row.luminosity_score) || 0,
      smoothness: Number(row.smoothness_score) || 0,
      clarity: Number(row.clarity_score) || 0,
      hydration: Number(row.hydration_score) || 0,
      evenness: Number(row.evenness_score) || 0,
    }
  })

  return {
    skinProfile,
    recentConversations,
    recentExcerpts,
    productReactions,
    knownAllergies: skinProfile?.allergies || [],
    knownPreferences: [],
    routineProducts,
    userProducts,
    learningInsights,
    specialistInsights,
    decisionMemory,
    cyclePhase,
    locationName,
    ingredientOverlap,
    glassSkinHistory,
  }
}

// ---------------------------------------------------------------------------
// Extract specific product recommendations from conversation summaries
// into structured data that Claude can't accidentally dismiss
// ---------------------------------------------------------------------------

interface ProductRecommendation {
  product: string
  context: string
}

function extractProductRecommendations(conversations: ConversationMemory[]): ProductRecommendation[] {
  const recommendations: ProductRecommendation[] = []

  for (const conv of conversations) {
    if (!conv.aiSummary) continue
    const summary = conv.aiSummary
    const conversationLabel = conv.title || 'previous conversation'

    // Match patterns like "**Product Name**" or "Yuri recommended Product Name"
    // Look for bold product names in SECTION 1 (recommendations section)
    const boldProductPattern = /\*\*([A-Z][^*]{3,60})\*\*/g
    let match

    // Extract from SECTION 1 only (the recommendations section)
    const section1Match = summary.match(/SECTION 1[^]*?(?=\*\*SECTION 2|$)/i)
    const section1 = section1Match ? section1Match[0] : ''

    if (section1) {
      while ((match = boldProductPattern.exec(section1)) !== null) {
        const productName = match[1].trim()
        // Filter out section headers and generic terms
        if (
          productName.length > 5 &&
          !productName.startsWith('SECTION') &&
          !productName.startsWith('Key ') &&
          !productName.startsWith('Phase ') &&
          !productName.startsWith('Stop') &&
          !productName.startsWith('WARNING') &&
          !productName.startsWith('NOTE') &&
          !productName.includes('routine') &&
          !productName.includes('Routine')
        ) {
          // Avoid duplicates
          if (!recommendations.some(r => r.product === productName)) {
            // Get a short context snippet around the match
            const idx = section1.indexOf(match[0])
            const snippetStart = Math.max(0, idx - 10)
            const snippetEnd = Math.min(section1.length, idx + match[0].length + 80)
            const snippet = section1.slice(snippetStart, snippetEnd)
              .replace(/\*\*/g, '')
              .replace(/\n/g, ' ')
              .trim()

            recommendations.push({
              product: productName,
              context: `recommended in "${conversationLabel}" — ${snippet.slice(0, 100)}`,
            })
          }
        }
      }
    }
  }

  return recommendations
}

// ---------------------------------------------------------------------------
// Format user context as text for system prompt injection
// ---------------------------------------------------------------------------

export function formatContextForPrompt(context: UserContext): string {
  const sections: string[] = []

  // Skin profile
  if (context.skinProfile) {
    const p = context.skinProfile
    const profileRaw = p as unknown as Record<string, unknown>
    const onboarded = profileRaw.onboarding_completed
    // Location fallback chain: stated location (from onboarding) > GPS reverse-geocode > nothing
    const locationText = profileRaw.location_text as string | null
    const locationLine = locationText
      ? `\n- Location: ${locationText}`
      : context.locationName
        ? `\n- Location: ${context.locationName} (from GPS)`
        : ''
    sections.push(`## User's Skin Profile${onboarded ? ' (built during your onboarding conversation -- you already know this user!)' : ''}
- Skin type: ${p.skin_type}
- Concerns: ${p.skin_concerns?.join(', ') || 'none specified'}
- Allergies: ${p.allergies?.join(', ') || 'none known'}
- Fitzpatrick scale: ${p.fitzpatrick_scale}
- Climate: ${p.climate}${locationLine}
- Age range: ${p.age_range}
- Budget: ${p.budget_range}
- Experience level: ${p.experience_level}`)
  } else {
    sections.push(`## User's Skin Profile\nNot yet created. Encourage them to complete their skin profile for personalized advice. You can suggest they go through the onboarding conversation with you.`)
  }

  // Current routine — explicitly separates "owned" from "planned but not yet
  // owned." Saved routines can include products the user planned to buy but
  // never did. Treating routine membership as ownership produced a real bug
  // (May 3 2026): Yuri said "you have Torriden DIVE-IN" when the user had
  // never bought it. Fix: render ownership inline so Yuri sees the distinction.
  if (context.routineProducts.length > 0) {
    const owned = context.routineProducts.filter((p) => p.ownership === 'owned')
    const planned = context.routineProducts.filter((p) => p.ownership === 'planned_only')
    const lines: string[] = []
    if (owned.length > 0) {
      lines.push('### In their plan AND owned (use these freely):')
      for (const p of owned) lines.push(`- ${p.display}`)
    }
    if (planned.length > 0) {
      lines.push('\n### In their plan but NOT in their inventory (do NOT claim they own these):')
      for (const p of planned) lines.push(`- ${p.display}`)
      lines.push('\nThese are products the user previously planned to use but never confirmed buying. Do not say "you have X" or "since you have X" for these. If relevant, ask whether they ended up buying it before recommending around it.')
    }
    sections.push(`## Current Routine Products\n${lines.join('\n')}`)
  }

  // Ingredient stacking analysis (Feature 16.1) — Surfaces ACTIVE ingredients
  // that appear in 2+ products across the user's routine and inventory. Only
  // active ingredients (is_active=true) — fillers like water, butylene glycol,
  // and 1,2-hexanediol are filtered out at the source. This is raw data; Yuri
  // decides whether to mention it, when, and how. The Quick Reminders section
  // in the system prompt tells her she's allowed to surface this proactively.
  if (context.ingredientOverlap && context.ingredientOverlap.entries.length > 0) {
    const ov = context.ingredientOverlap
    const lines: string[] = []
    for (const entry of ov.entries) {
      const fnPart = entry.ingredientFunction
        ? ` — ${entry.ingredientFunction}`
        : ''
      const productList = entry.productDisplays.join('; ')
      lines.push(
        `- **${entry.ingredientName}** appears in ${entry.productCount} products${fnPart}\n  Products: ${productList}`
      )
    }
    sections.push(`## Active Ingredient Stacking in Their Routine
${ov.totalProducts} products analyzed across their routines + inventory. The actives below appear in multiple products — only active ingredients are listed (humectants, solvents, and fillers like water, butylene glycol, 1,2-hexanediol are filtered out because stacking those is normal and unworthy of attention).

${lines.join('\n')}

This is information about THEIR routine, not advice. Some stacking is fine (a niacinamide cleanser + niacinamide moisturizer at low concentration may be unremarkable). Some is wasteful (4 products driving the same active hard). Some is risky (3 products with sensitizing actives at high concentration). Use your judgment about whether to mention this, when in the conversation, and how. If they ask about adding another product or are wondering if their routine is too heavy, this is the data you'd want to reference.`)
  }

  // User product inventory (products the user owns, with texture data for layering)
  if (context.userProducts.length > 0) {
    const productLines = context.userProducts.map((up) => {
      const parts: string[] = []
      parts.push(up.custom_name || 'Unknown product')
      const meta: string[] = []
      if (up.category) meta.push(up.category)
      if (up.texture_weight) {
        const label = up.texture_weight <= 2 ? 'water-thin' : up.texture_weight <= 4 ? 'light' : up.texture_weight <= 6 ? 'medium' : up.texture_weight <= 8 ? 'thick' : 'heavy cream'
        meta.push(`texture: ${up.texture_weight}/10 — ${label}`)
      }
      if (up.custom_brand) meta.push(`by ${up.custom_brand}`)
      if (meta.length > 0) parts.push(`(${meta.join(', ')})`)
      if (up.notes) parts.push(`— ${up.notes}`)
      return `- ${parts.join(' ')}`
    })
    sections.push(`## Your Product Inventory\nThese are products the user currently owns and uses. Use texture_weight for layering order when building routines:\n${productLines.join('\n')}`)
  }

  // Glass Skin Score history — gives Yuri concrete data points to reference
  // ("you were at 49 on Feb 25") and lets her notice when a baseline is stale
  // mid-treatment so she can suggest a fresh photo organically. Raw dates +
  // dimension scores; let Opus decide when to bring them up.
  if (context.glassSkinHistory.length > 0) {
    const latest = context.glassSkinHistory[0]
    const lines = context.glassSkinHistory.map((s, i) => {
      const ageLabel = s.daysAgo === 0 ? 'today' : s.daysAgo === 1 ? '1 day ago' : `${s.daysAgo} days ago`
      const tag = i === 0 ? ' (most recent)' : ''
      return `- **${s.takenDate}** (${ageLabel})${tag}: overall ${s.overall}/100 — luminosity ${s.luminosity}, smoothness ${s.smoothness}, clarity ${s.clarity}, hydration ${s.hydration}, evenness ${s.evenness}`
    })
    const stalenessNote = latest.daysAgo >= 30
      ? `\nLatest score is ${latest.daysAgo} days old. If they are in an active treatment phase, a fresh score would give you a real comparison point — feel free to suggest taking a new photo when it fits the conversation. One observation, not a lecture.`
      : ''
    sections.push(`## Glass Skin Score History\n${lines.join('\n')}${stalenessNote}`)
  }

  // Product reactions — Phase 15.4 surfaces the recorded date inline so Yuri
  // can calibrate confidence without being told how. A 90-day-old "broke me
  // out" warrants a different response than one from yesterday; let Opus
  // notice the dates and adjust on its own.
  if (context.productReactions.length > 0) {
    const holyGrails = context.productReactions.filter((r) => r.reaction === 'holy_grail')
    const brokeMeOut = context.productReactions.filter((r) => r.reaction === 'broke_me_out')

    const formatReactionLine = (r: ProductReaction) => {
      if (!r.recordedAt) return `- ${r.productName}`
      const date = r.recordedAt.split('T')[0]
      return `- ${r.productName} (recorded ${date})`
    }

    if (holyGrails.length > 0) {
      sections.push(`## Holy Grail Products\nDates show when the user logged each reaction. Older entries may be stale — feel free to ask if it's still working for them before re-recommending.\n${holyGrails.map(formatReactionLine).join('\n')}`)
    }
    if (brokeMeOut.length > 0) {
      sections.push(`## Products That Caused Reactions\nDates show when the user logged each reaction. A reaction from many months ago might not still apply (skin changes, reformulations) — surface the date naturally if you bring it up.\n${brokeMeOut.map(formatReactionLine).join('\n')}`)
    }
  }

  // Known allergies (emphasized)
  if (context.knownAllergies.length > 0) {
    sections.push(`## IMPORTANT: Known Allergies/Sensitivities\nALWAYS check for these before recommending any product:\n${context.knownAllergies.map((a) => `- ${a}`).join('\n')}`)
  }

  // Recent conversation summaries (cross-session memory)
  if (context.recentConversations.length > 0) {
    const withSummaries = context.recentConversations.filter(c => c.aiSummary)
    const withoutSummaries = context.recentConversations.filter(c => !c.aiSummary)

    if (withSummaries.length > 0) {
      // Always include the onboarding conversation summary (foundational recommendations)
      const onboarding = withSummaries.find(c => c.conversationType === 'onboarding')
      const nonOnboarding = withSummaries.filter(c => c.conversationType !== 'onboarding')
      const pinnedSummaries = [
        ...(onboarding ? [onboarding] : []),
        ...nonOnboarding,
      ].slice(0, 7) // Increased from 5 to 7 to ensure onboarding + recent all fit

      const summaryText = pinnedSummaries
        .map((c) => `### ${c.title || 'Conversation'} (${c.specialistType || 'general'})\n${c.aiSummary}`)
        .join('\n\n')
      sections.push(`## Previous Conversations (Your Memory)\nThese are YOUR OWN conversations with this user. The summaries document what YOU said — products you recommended, routines you built, warnings you gave. This is your memory. Own it.\n\n${summaryText}`)

      // Surface the most recent non-current conversation's pre-stored opener
      // (LGAAS pattern). If this conversation is fresh and the user hasn't
      // sent a substantive first message yet, Yuri can use this to pick up
      // naturally from the prior thread instead of starting cold. Otherwise
      // she ignores it. Skip the onboarding opener — that thread is the
      // foundational baseline, not a typical pick-up point.
      const candidateForOpener = nonOnboarding.find((c) => c.nextSessionOpener && c.nextSessionOpener.length > 0)
      if (candidateForOpener?.nextSessionOpener) {
        sections.push(`## Suggested Opener (If This Is a Fresh Conversation)\nFrom your last non-onboarding conversation with this user, the pre-generated natural opener is:\n\n> ${candidateForOpener.nextSessionOpener}\n\nThis is a suggestion, not a script. Use it if the user opens with a greeting or "checking in" type message. If they jump straight into a question or topic, answer that directly instead — don't force the opener.`)
      }

      // Extract specific product recommendations from summaries into a structured section
      // so Claude sees them as clear, undeniable facts rather than buried in prose
      const productRecommendations = extractProductRecommendations(pinnedSummaries)
      if (productRecommendations.length > 0) {
        sections.push(`## YOUR Previous Product Recommendations (You Said These)\nThese are specific products YOU recommended to this user in past conversations. You MUST acknowledge these if the user asks about them:\n${productRecommendations.map(r => `- **${r.product}** — ${r.context}`).join('\n')}`)
      }
    }

    if (withoutSummaries.length > 0) {
      const topics = withoutSummaries
        .slice(0, 3)
        .map((c) => `- ${c.summary} (${c.specialistType || 'general'})`)
        .join('\n')
      sections.push(`## Other Recent Conversation Topics\n${topics}`)
    }
  }

  // Recent conversation excerpts (actual message content from past conversations)
  // This is the safety net — even if summaries missed specific recommendations,
  // Yuri can see what she actually said in the last few messages of recent conversations
  if (context.recentExcerpts.length > 0) {
    const excerptText = context.recentExcerpts
      .map((ex) => {
        const msgs = ex.messages
          .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content}`)
          .join('\n')
        return `### ${ex.title || 'Conversation'}\n${msgs}`
      })
      .join('\n\n')
    sections.push(`## Recent Conversation Excerpts (Your Actual Messages)\nThese are the last few messages from your recent conversations with this user. Use these to remember EXACTLY what you said — specific products you recommended, advice you gave, and commitments you made:\n\n${excerptText}`)
  }

  // Menstrual cycle phase context
  if (context.cyclePhase) {
    const cp = context.cyclePhase
    sections.push(`## Menstrual Cycle Phase (User has opted into cycle tracking)
- Current phase: ${getPhaseLabel(cp.phase)} (Day ${cp.day_in_cycle} of ${cp.cycle_length}-day cycle)
- Days until next phase: ${cp.days_until_next_phase}
- Skin behavior: ${cp.skin_behavior}
- Key recommendations for this phase: ${cp.recommendations.slice(0, 3).join('; ')}
When making skincare recommendations, factor in the user's current cycle phase. This is especially relevant for actives, exfoliation, moisturizer weight, and breakout prevention.`)
  } else if (context.skinProfile) {
    // No cycle tracking enabled. If their concerns include hormonal triggers,
    // give Yuri permission to mention the feature ONCE per conversation when
    // a cycle/hormonal topic comes up. The decision-memory feature-repetition
    // rule (v8.1.2) prevents re-mentioning across sessions.
    const concerns = (context.skinProfile.skin_concerns || []).map((c) => c.toLowerCase())
    const hormonalCues = ['hormonal', 'cycle', 'period', 'menstrual', 'pms', 'breakout']
    const hasHormonalConcern = concerns.some((c) => hormonalCues.some((cue) => c.includes(cue)))
    if (hasHormonalConcern) {
      sections.push(`## Cycle Tracking Available (Not Enabled)
This user has hormonal/cycle-related concerns in their profile but has NOT enabled cycle tracking. If — and only if — the conversation touches on hormonal breakouts, cycle-aware skincare, or "phase of my period," you may briefly mention ONCE that they can log their cycle dates at /profile so you can anticipate hormonal weeks instead of reacting to flare photos. Frame as an offer, not a sales pitch ("if you want, you can…"). Do not mention again in this session if they decline or change topic.`)
    }
  }

  // Learning engine insights (makes Yuri smarter over time)
  if (context.learningInsights.length > 0) {
    const insightLines = context.learningInsights
      .map((i) => `- [${i.type}] ${i.summary}`)
      .join('\n')
    sections.push(`## Learning Engine Insights (From Community Data)\nUse these data-backed insights to personalize your advice. Cite the data when relevant:\n${insightLines}`)
  }

  // Specialist insights from past conversations (accumulated intelligence)
  // Phase 15.4 — surface the createdAt date on each block so Yuri can sense
  // staleness (a routine insight from 6 months ago may not reflect current
  // skin, products, or seasonal needs).
  if (context.specialistInsights.length > 0) {
    const insightLines = context.specialistInsights.map((si) => {
      const data = si.data
      const dateLabel = si.createdAt ? si.createdAt.split('T')[0] : 'unknown date'
      const parts: string[] = [`### ${si.specialistType.replace(/_/g, ' ')} (recorded ${dateLabel})`]
      // Format known data fields from specialist extractions
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          parts.push(`- ${key.replace(/_/g, ' ')}: ${value.join(', ')}`)
        } else if (typeof value === 'string' && value) {
          parts.push(`- ${key.replace(/_/g, ' ')}: ${value}`)
        }
      }
      return parts.join('\n')
    }).join('\n')
    sections.push(`## Past Specialist Intelligence (From Previous Conversations)\nThis user has had specialist conversations before. Use these insights to build on previous advice — don't ask about things you already learned. The recorded date on each block lets you weigh how current the insight is; older insights may need a quick check-in before you act on them.\n${insightLines}`)
  }

  // Decision memory — structured corrections, decisions, preferences, and commitments
  if (context.decisionMemory) {
    const dm = context.decisionMemory
    const dmParts: string[] = []

    const now = new Date()
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000

    // Corrections render FIRST (highest trust — these override training data).
    // Phase 15.1 — K-beauty brands reformulate every 2-3 years; corrections are
    // the durable fix for stale training knowledge.
    if (dm.corrections && dm.corrections.length > 0) {
      const correctionLines = dm.corrections
        .map((cor) => {
          const ageMs = cor.date ? now.getTime() - new Date(cor.date).getTime() : 0
          const ageTag = ageMs > SIXTY_DAYS_MS ? ' [60+ days ago — verify with a tool if still current]' : ''
          const initial = cor.yuri_said ? ` [you had said: "${cor.yuri_said}"]` : ''
          return `- [${cor.topic}] (${cor.category})${ageTag}: ${cor.truth}${initial}`
        })
        .join('\n')
      dmParts.push(
        `### Corrections That Stick (Trust These Over Your Training Data)\nThe user corrected you on these items in past conversations. Treat each correction as ground truth. K-beauty brands reformulate constantly and your training data goes stale fast. If you catch yourself about to repeat the original wrong claim, STOP and use the corrected version. For corrections older than 60 days, verify with a tool (search_products, get_product_details) before quoting — the brand may have changed again.\n${correctionLines}`
      )
    }

    if (dm.decisions.length > 0) {
      const decisionLines = dm.decisions
        .map((d) => {
          const daysAgo = Math.floor((now.getTime() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24))
          return `- **${d.topic}**: ${d.decision} (decided ${d.date}, which was ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago)`
        })
        .join('\n')
      dmParts.push(`### Active Decisions\n${decisionLines}`)
    }

    if (dm.preferences.length > 0) {
      // Phase 15.4 — surface the date the user first stated each preference so
      // Yuri can calibrate. Tastes shift; a "fragrance-free only" from a year
      // ago is probably still load-bearing, but a "I want to try retinol"
      // from 8 months ago may have already been acted on.
      const prefLines = dm.preferences
        .map((p) => {
          const dateLabel = p.date ? ` (stated ${p.date})` : ''
          return `- **${p.topic}**: ${p.preference}${dateLabel}`
        })
        .join('\n')
      dmParts.push(`### User Preferences\n${prefLines}`)
    }

    if (dm.commitments.length > 0) {
      const commitLines = dm.commitments
        .map((c) => {
          const daysAgo = Math.floor((now.getTime() - new Date(c.date).getTime()) / (1000 * 60 * 60 * 24))
          const elapsed = `committed ${c.date}, which was ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`

          // Try to parse duration from commitment text (e.g. "for 2 weeks", "for 14 days")
          const weekMatch = c.item.match(/for\s+(\d+)\s+weeks?/i)
          const dayMatch = c.item.match(/for\s+(\d+)\s+days?/i)
          const totalDays = weekMatch ? parseInt(weekMatch[1]) * 7
            : dayMatch ? parseInt(dayMatch[1]) : null

          if (totalDays !== null) {
            const remaining = totalDays - daysAgo
            const remainingStr = remaining > 0
              ? `${remaining} day${remaining !== 1 ? 's' : ''} remaining`
              : 'duration completed'
            return `- ${c.item} (${elapsed} — ${remainingStr})`
          }
          return `- ${c.item} (${elapsed})`
        })
        .join('\n')
      dmParts.push(`### User Commitments\n${commitLines}`)
    }

    if (dmParts.length > 0) {
      sections.push(`## Your Decisions & Preferences (Structured Memory)\nThese are structured decisions, preferences, and commitments extracted from your conversations with this user. Reference them when relevant — they represent agreed-upon plans and stated preferences.\n\n${dmParts.join('\n\n')}`)
    }
  }

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Conversation persistence
// ---------------------------------------------------------------------------

export async function createConversation(
  userId: string,
  specialistType: SpecialistType | null = null
): Promise<string> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_conversations')
    .insert({
      user_id: userId,
      specialist_type: specialistType,
      message_count: 0,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create conversation: ${error.message}`)
  return data.id
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  specialistType: SpecialistType | null = null,
  imageUrls: string[] = []
): Promise<string> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('ss_yuri_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      specialist_type: specialistType,
      image_urls: imageUrls,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save message: ${error.message}`)

  // Update conversation timestamp (message_count managed via DB trigger or manual increment)
  await db
    .from('ss_yuri_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data.id
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const db = getServiceClient()
  await db
    .from('ss_yuri_conversations')
    .update({ title })
    .eq('id', conversationId)
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  const db = getServiceClient()

  // Verify ownership
  const { data: conv } = await db
    .from('ss_yuri_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single()

  if (!conv || conv.user_id !== userId) {
    throw new Error('Conversation not found')
  }

  // Delete messages first (FK constraint)
  await db
    .from('ss_yuri_messages')
    .delete()
    .eq('conversation_id', conversationId)

  // Delete the conversation
  const { error } = await db
    .from('ss_yuri_conversations')
    .delete()
    .eq('id', conversationId)

  if (error) throw new Error(`Failed to delete conversation: ${error.message}`)
}

export async function saveConversationSummary(
  conversationId: string,
  summary: string,
  nextSessionOpener: string | null = null
): Promise<void> {
  const db = getServiceClient()
  const update: Record<string, unknown> = {
    summary,
    summary_generated_at: new Date().toISOString(),
  }
  // Only update opener when one was extracted — never overwrite a good
  // previous opener with null if the latest run failed to produce one.
  if (nextSessionOpener) {
    update.next_session_opener = nextSessionOpener
  }
  await db
    .from('ss_yuri_conversations')
    .update(update)
    .eq('id', conversationId)
}

// Truncation constants (LGAAS pattern)
const TRUNCATION_THRESHOLD = 50 // Start truncating after this many messages
const HEAD_COUNT = 4 // Keep first N messages (conversation setup)
const TAIL_COUNT = 40 // Keep last N messages (recent flow)

export async function loadConversationMessages(
  conversationId: string,
  limit = 200
): Promise<YuriMessage[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to load messages: ${error.message}`)
  const messages = data as YuriMessage[]

  // If under threshold, return all messages as-is
  if (messages.length <= TRUNCATION_THRESHOLD) {
    return messages
  }

  // Smart truncation: keep head + tail, bridge-summarize the middle
  return await truncateWithBridge(db, conversationId, messages)
}

/**
 * Smart truncation with bridge summary (LGAAS pattern).
 * Keeps first HEAD_COUNT messages (topic setup) + last TAIL_COUNT messages (recent flow).
 * Generates a Sonnet summary of the dropped middle section and injects it as a
 * synthetic assistant message between head and tail.
 * Bridge summaries are cached on the conversation record to avoid regeneration.
 */
async function truncateWithBridge(
  db: ReturnType<typeof getServiceClient>,
  conversationId: string,
  messages: YuriMessage[]
): Promise<YuriMessage[]> {
  const head = messages.slice(0, HEAD_COUNT)
  const tail = messages.slice(-TAIL_COUNT)
  const droppedMessages = messages.slice(HEAD_COUNT, messages.length - TAIL_COUNT)

  if (droppedMessages.length === 0) return messages

  // Check for cached bridge summary
  const { data: conv } = await db
    .from('ss_yuri_conversations')
    .select('truncation_summary, truncation_summary_msg_count')
    .eq('id', conversationId)
    .single()

  let bridgeSummary = conv?.truncation_summary
  const cachedMsgCount = conv?.truncation_summary_msg_count

  // Regenerate if no cached summary or message count has changed significantly
  if (!bridgeSummary || !cachedMsgCount || Math.abs(cachedMsgCount - messages.length) >= 5) {
    try {
      const { getAnthropicClient, MODELS } = await import('@/lib/anthropic')
      const client = getAnthropicClient()

      const droppedTranscript = droppedMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content.slice(0, 400)}`)
        .join('\n')

      const response = await client.messages.create({
        model: MODELS.background,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Summarize these messages from the MIDDLE of a K-beauty advisor conversation. These messages are being dropped due to conversation length, so the summary must preserve all critical information.

Focus on:
1. Specific product recommendations Yuri made (exact names, brands)
2. Advice and reasoning Yuri gave for each recommendation
3. Key decisions or preferences the user expressed
4. Any routine changes discussed or agreed upon

DROPPED MESSAGES (${droppedMessages.length} messages):
${droppedTranscript}

Write a dense, factual summary. Max 400 words. Return ONLY the summary text.`,
        }],
      })

      const block = response.content[0]
      if (block.type === 'text') {
        bridgeSummary = block.text.trim()

        // Cache the bridge summary
        await db
          .from('ss_yuri_conversations')
          .update({
            truncation_summary: bridgeSummary,
            truncation_summary_msg_count: messages.length,
          })
          .eq('id', conversationId)
      }
    } catch {
      // Bridge generation failed — fall back to simple truncation
      return [...head, ...tail]
    }
  }

  // Inject bridge summary as a synthetic assistant message between head and tail
  if (bridgeSummary) {
    const bridgeMessage: YuriMessage = {
      id: 'bridge-summary',
      conversation_id: conversationId,
      role: 'assistant',
      content: `[CONVERSATION CONTEXT — ${droppedMessages.length} earlier messages summarized]\n\n${bridgeSummary}\n\n[End of summary. The ${tail.length} most recent messages follow below.]`,
      specialist_type: null,
      image_urls: [],
      created_at: head[head.length - 1]?.created_at || new Date().toISOString(),
    }
    return [...head, bridgeMessage, ...tail]
  }

  return [...head, ...tail]
}

export async function loadUserConversations(
  userId: string,
  limit = 20
): Promise<YuriConversation[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to load conversations: ${error.message}`)
  return data as YuriConversation[]
}

// ---------------------------------------------------------------------------
// Extract specialist insights post-conversation (background task)
// ---------------------------------------------------------------------------

export async function saveSpecialistInsight(
  conversationId: string,
  specialistType: SpecialistType,
  insightData: Record<string, unknown>
): Promise<void> {
  const db = getServiceClient()
  await db.from('ss_specialist_insights').insert({
    conversation_id: conversationId,
    specialist_type: specialistType,
    insight_type: 'conversation_extraction',
    data: insightData,
  })
}

// ---------------------------------------------------------------------------
// Decision Memory — structured cross-session decisions, preferences, commitments
// ---------------------------------------------------------------------------

const EMPTY_DECISION_MEMORY: DecisionMemory = {
  decisions: [],
  preferences: [],
  commitments: [],
  corrections: [],
  extracted_at: '',
}

/**
 * Merge two DecisionMemory objects. Latest decision per topic wins.
 * Preferences: latest per topic wins. Commitments: append with dedup by item text.
 * Corrections: latest per topic wins (Phase 15.1 — preserves K-beauty factual
 * corrections like reformulations and discontinuations across re-extraction runs).
 */
export function mergeDecisionMemory(
  existing: DecisionMemory | null,
  incoming: DecisionMemory
): DecisionMemory {
  // The DB schema default for decision_memory is JSONB '{}', which means
  // `existing` will be the truthy empty object `{}` for any conversation that
  // has never had memory written before — NOT null. Without explicit array
  // defaults below, every "first write" call into this function threw
  // `TypeError: base.decisions is not iterable` and the fire-and-forget
  // .catch(() => {}) in advisor.ts silently swallowed it. Three months of
  // decision memory was lost in production this way (Feb 23 - May 5 2026).
  // Defensive defaults below ensure a `{}` base, an old row missing fields,
  // and a fully populated row all merge correctly.
  const base = existing || EMPTY_DECISION_MEMORY
  const baseDecisions = base.decisions || []
  const basePreferences = base.preferences || []
  const baseCommitments = base.commitments || []
  const baseCorrections = base.corrections || []

  // Decisions: latest per topic wins
  const decisionMap = new Map<string, { topic: string; decision: string; date: string }>()
  for (const d of baseDecisions) decisionMap.set(d.topic.toLowerCase(), d)
  for (const d of incoming.decisions) decisionMap.set(d.topic.toLowerCase(), d)
  const decisions = Array.from(decisionMap.values())

  // Preferences: latest per topic wins, but preserve the original date when the
  // preference content is unchanged — that lets the rendering layer truthfully
  // say "you told me this on YYYY-MM-DD" rather than resetting the date every
  // time the user mentions the same preference. New or changed content gets
  // today's date.
  const prefMap = new Map<string, { topic: string; preference: string; date: string }>()
  for (const p of basePreferences) {
    // Backwards-compat: older rows may lack `date`. Default to today.
    prefMap.set(p.topic.toLowerCase(), {
      ...p,
      date: p.date || new Date().toISOString().split('T')[0],
    })
  }
  for (const p of incoming.preferences) {
    const key = p.topic.toLowerCase()
    const prev = prefMap.get(key)
    if (prev && prev.preference.trim() === p.preference.trim()) {
      // Same preference content as before — keep the older date so age renders accurately
      continue
    }
    prefMap.set(key, p)
  }
  const preferences = Array.from(prefMap.values())

  // Commitments: append with dedup by lowercase item text
  const commitmentSet = new Set<string>()
  const commitments: Array<{ item: string; date: string }> = []
  for (const c of [...baseCommitments, ...incoming.commitments]) {
    const key = c.item.toLowerCase().trim()
    if (!commitmentSet.has(key)) {
      commitmentSet.add(key)
      commitments.push(c)
    }
  }

  // Corrections: latest per topic wins.
  const correctionMap = new Map<string, DecisionMemory['corrections'][number]>()
  for (const c of baseCorrections) correctionMap.set(c.topic.toLowerCase(), c)
  for (const c of incoming.corrections || []) correctionMap.set(c.topic.toLowerCase(), c)
  const corrections = Array.from(correctionMap.values())

  return {
    decisions,
    preferences,
    commitments,
    corrections,
    extracted_at: incoming.extracted_at || base.extracted_at || '',
  }
}

/**
 * Load and merge decision memory from the 3 most recent conversations
 * that have non-empty decision_memory JSONB.
 */
async function loadDecisionMemory(
  db: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<DecisionMemory | null> {
  try {
    const { data: conversations } = await db
      .from('ss_yuri_conversations')
      .select('decision_memory')
      .eq('user_id', userId)
      .not('decision_memory', 'eq', '{}')
      // created_at, not updated_at: backfill scripts touch updated_at on
      // historical rows en masse, which can evict recent conversations from
      // this 3-row window. created_at is immutable.
      .order('created_at', { ascending: false })
      .limit(3)

    if (!conversations || conversations.length === 0) return null

    let merged: DecisionMemory | null = null
    // Process oldest first so newest overwrites on merge
    for (const conv of conversations.reverse()) {
      const raw = conv.decision_memory as DecisionMemory | null
      if (
        !raw ||
        (!raw.decisions?.length &&
          !raw.preferences?.length &&
          !raw.commitments?.length &&
          !raw.corrections?.length)
      ) {
        continue
      }
      merged = mergeDecisionMemory(merged, raw)
    }

    return merged
  } catch {
    // Decision memory loading is non-critical
    return null
  }
}

/**
 * Extract structured decisions, preferences, and commitments from a conversation
 * via Sonnet, then merge with existing memory and save to the conversation record.
 */
export async function extractAndSaveDecisionMemory(
  userId: string,
  conversationId: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<void> {
  const { getAnthropicClient, MODELS, callAnthropicWithRetry } = await import('@/lib/anthropic')
  const client = getAnthropicClient()

  // Build a condensed transcript from the conversation
  // Use 1200 chars per message (not 400) so Sonnet can see decisions that appear
  // mid-response in Yuri's 1,500-3,000 char replies
  const transcript = conversationHistory
    .slice(-20) // Last 20 messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content.slice(0, 1200)}`)
    .join('\n')

  const response = await callAnthropicWithRetry(
    () =>
      client.messages.create({
        model: MODELS.background,
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Analyze this K-beauty advisor conversation and extract structured data in four categories. Only extract what is EXPLICITLY stated — never infer or assume.

1. **DECISIONS**: Specific skincare decisions the user or Yuri agreed on. Each needs a short topic label and the decision text.
   Examples: { "topic": "barrier_repair", "decision": "3-phase approach starting with ceramides before reintroducing actives" }
   Examples: { "topic": "sunscreen", "decision": "Switched to Beauty of Joseon PA++++" }

2. **PREFERENCES**: User's stated preferences about products, ingredients, or routines. Each needs a topic and the preference.
   Examples: { "topic": "fragrance", "preference": "fragrance-free only" }
   Examples: { "topic": "texture", "preference": "gel-cream over heavy creams" }

3. **COMMITMENTS**: Specific actions the user committed to trying or doing. Each needs the item and today's date.
   Examples: { "item": "Try COSRX Snail Mucin for 2 weeks", "date": "${new Date().toISOString().split('T')[0]}" }

4. **CORRECTIONS**: Moments where Yuri said something FACTUALLY WRONG and the user corrected her. These are the highest-value memory items — they prevent repeating outdated K-beauty claims. K-beauty brands reformulate every 2-3 years, so Yuri's training knowledge goes stale fast. Each correction MUST capture BOTH what Yuri originally said AND the truth (without both, the correction is useless next session).

   Categories:
   - "reformulation": Yuri quoted an old formula spec — e.g., she said "COSRX Snail Mucin is 96% snail secretion filtrate" and user corrected: "they reformulated in 2024 — it's now 92% with added niacinamide"
   - "discontinued": Yuri recommended a product that no longer exists — e.g., "Innisfree Green Tea Seed Serum was discontinued, the replacement is Hyaluronic Acid Cica Serum"
   - "price": Yuri quoted a stale price from training (rare since price tools exist, but capture if it happens)
   - "ingredient": Yuri claimed something about a product's ingredients that contradicts the actual INCI list — e.g., said "fragrance-free" when parfum is listed
   - "brand_identity": Yuri confused two brands or got a brand fact wrong — e.g., said "Anua is owned by Amorepacific" when it's actually independent
   - "other": Anything else factual that should never be repeated

   Look for user phrases like: "actually it's X", "no that's wrong", "you're outdated on this", "they changed that", "that was the old version", "stand corrected", "good catch" — followed by Yuri acknowledging the error.

   Do NOT extract corrections for opinion disagreements ("I prefer the gel texture over the cream") — only for factual errors that should NEVER be gotten wrong again.

   Examples:
   { "topic": "cosrx_snail_concentration", "yuri_said": "96% snail secretion filtrate", "truth": "Reformulated in 2024 — now 92% with added niacinamide", "category": "reformulation" }
   { "topic": "innisfree_green_tea_seed", "yuri_said": "Recommended Green Tea Seed Serum", "truth": "Discontinued — replaced by Hyaluronic Acid Cica Serum", "category": "discontinued" }

CONVERSATION:
${transcript}

Return ONLY valid JSON in this exact format (empty arrays are fine if nothing found):
{
  "decisions": [{ "topic": "...", "decision": "...", "date": "${new Date().toISOString().split('T')[0]}" }],
  "preferences": [{ "topic": "...", "preference": "..." }],
  "commitments": [{ "item": "...", "date": "${new Date().toISOString().split('T')[0]}" }],
  "corrections": [{ "topic": "...", "yuri_said": "...", "truth": "...", "category": "reformulation|discontinued|price|ingredient|brand_identity|other", "date": "${new Date().toISOString().split('T')[0]}" }]
}`,
          },
        ],
      }),
    1 // Non-critical: only 1 retry
  )

  const block = response.content[0]
  if (block.type !== 'text') return

  let extracted: {
    decisions?: unknown[]
    preferences?: unknown[]
    commitments?: unknown[]
    corrections?: unknown[]
  }
  try {
    const text = block.text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '')
    extracted = JSON.parse(text)
  } catch {
    return // Parse failed — skip silently
  }

  const validCategories: ReadonlySet<CorrectionCategory> = new Set([
    'reformulation',
    'discontinued',
    'price',
    'ingredient',
    'brand_identity',
    'other',
  ])

  // Validate and normalize the extracted data
  const incoming: DecisionMemory = {
    decisions: Array.isArray(extracted.decisions)
      ? (extracted.decisions as Array<{ topic?: string; decision?: string; date?: string }>)
          .filter((d) => d.topic && d.decision)
          .map((d) => ({
            topic: String(d.topic),
            decision: String(d.decision),
            date: String(d.date || new Date().toISOString().split('T')[0]),
          }))
      : [],
    preferences: Array.isArray(extracted.preferences)
      ? (extracted.preferences as Array<{ topic?: string; preference?: string; date?: string }>)
          .filter((p) => p.topic && p.preference)
          .map((p) => ({
            topic: String(p.topic),
            preference: String(p.preference),
            // Sonnet prompt doesn't request a date for preferences, so default
            // to today. Merge logic preserves the original date if a preference
            // already exists for this topic (see mergeDecisionMemory).
            date: String(p.date || new Date().toISOString().split('T')[0]),
          }))
      : [],
    commitments: Array.isArray(extracted.commitments)
      ? (extracted.commitments as Array<{ item?: string; date?: string }>)
          .filter((c) => c.item)
          .map((c) => ({
            item: String(c.item),
            date: String(c.date || new Date().toISOString().split('T')[0]),
          }))
      : [],
    corrections: Array.isArray(extracted.corrections)
      ? (extracted.corrections as Array<{
          topic?: string
          yuri_said?: string
          truth?: string
          category?: string
          date?: string
        }>)
          .filter((c) => c.topic && c.yuri_said && c.truth)
          .map((c) => {
            const rawCategory = String(c.category || 'other').toLowerCase()
            const category = (validCategories.has(rawCategory as CorrectionCategory)
              ? rawCategory
              : 'other') as CorrectionCategory
            return {
              topic: String(c.topic),
              yuri_said: String(c.yuri_said),
              truth: String(c.truth),
              category,
              date: String(c.date || new Date().toISOString().split('T')[0]),
            }
          })
      : [],
    extracted_at: new Date().toISOString(),
  }

  // Skip if nothing was extracted
  if (
    incoming.decisions.length === 0 &&
    incoming.preferences.length === 0 &&
    incoming.commitments.length === 0 &&
    incoming.corrections.length === 0
  ) {
    return
  }

  // Load existing decision memory from this conversation and merge
  const db = getServiceClient()
  const { data: conv } = await db
    .from('ss_yuri_conversations')
    .select('decision_memory')
    .eq('id', conversationId)
    .single()

  const existing = (conv?.decision_memory as DecisionMemory | null) || null
  const merged = mergeDecisionMemory(existing, incoming)

  // Save merged decision memory back to the conversation
  await db
    .from('ss_yuri_conversations')
    .update({ decision_memory: merged })
    .eq('id', conversationId)
}

// ---------------------------------------------------------------------------
// Load actual message content from recent conversations (LGAAS pattern)
// Gives Yuri access to what she actually said, even if summaries missed it
// ---------------------------------------------------------------------------

async function loadRecentConversationExcerpts(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  currentConversationId?: string
): Promise<RecentConversationExcerpt[]> {
  try {
    // Find the 3 most recent conversations with 3+ messages (meaningful conversations)
    // Exclude the current conversation since those messages are already in the API history
    let query = db
      .from('ss_yuri_conversations')
      .select('id, title, message_count')
      .eq('user_id', userId)
      .gte('message_count', 3)
      .order('updated_at', { ascending: false })
      .limit(4) // Fetch 4 in case one is the current conversation

    if (currentConversationId) {
      query = query.neq('id', currentConversationId)
    }

    const { data: conversations } = await query
    if (!conversations || conversations.length === 0) return []

    // Load the last 6 messages from each (captures the most recent exchange context)
    const excerpts: RecentConversationExcerpt[] = []
    const targetConversations = conversations.slice(0, 3)

    for (const conv of targetConversations) {
      const { data: messages } = await db
        .from('ss_yuri_messages')
        .select('role, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(6)

      if (messages && messages.length > 0) {
        // Reverse to get chronological order (we fetched descending)
        const chronological = messages.reverse()
        excerpts.push({
          conversationId: conv.id,
          title: conv.title,
          messages: chronological.map((m) => ({
            role: m.role,
            // Generous content per message — product names and recommendations need space
            content: m.content.slice(0, 500),
          })),
        })
      }
    }

    return excerpts
  } catch {
    // Excerpt loading is non-critical
    return []
  }
}

// ---------------------------------------------------------------------------
// Reverse-geocode user location from lat/lng (Open-Meteo, free, no key)
// ---------------------------------------------------------------------------

async function reverseGeocodeUserLocation(
  skinProfile: SkinProfile | null
): Promise<string | null> {
  try {
    const raw = skinProfile as unknown as Record<string, unknown> | null
    const lat = raw?.latitude as string | number | null
    const lng = raw?.longitude as string | number | null
    if (!lat || !lng) return null

    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng
    if (isNaN(latNum) || isNaN(lngNum)) return null

    // BigDataCloud free reverse geocoding (no API key, no rate limit issues)
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latNum}&longitude=${lngNum}&localityLanguage=en`,
      { next: { revalidate: 86400 } } // cache 24h
    )
    if (!res.ok) return null

    const data = await res.json() as {
      city?: string
      locality?: string
      principalSubdivision?: string
      countryName?: string
    }

    const city = data.city || data.locality
    if (!city) return null

    const parts = [city]
    if (data.principalSubdivision) parts.push(data.principalSubdivision)
    if (data.countryName) parts.push(data.countryName)
    return parts.join(', ')
  } catch {
    // Location is non-critical
    return null
  }
}

// ---------------------------------------------------------------------------
// Load learning engine context for Yuri's system prompt
// ---------------------------------------------------------------------------

async function loadLearningContext(
  db: ReturnType<typeof getServiceClient>,
  skinProfile: SkinProfile | null
): Promise<LearningContextData[]> {
  const insights: LearningContextData[] = []

  try {
    if (skinProfile) {
      // Top effective ingredients for user's skin type
      const { data: topIngredients } = await db
        .from('ss_ingredient_effectiveness')
        .select(`
          effectiveness_score,
          sample_size,
          concern,
          ingredient:ss_ingredients(name_en, function)
        `)
        .or(`skin_type.eq.${skinProfile.skin_type},skin_type.eq.__all__`)
        .gte('sample_size', 5)
        .order('effectiveness_score', { ascending: false })
        .limit(5)

      for (const ti of topIngredients || []) {
        const ingredient = ti.ingredient as unknown as Record<string, string>
        if (!ingredient) continue
        const pct = Math.round((ti.effectiveness_score as number) * 100)
        insights.push({
          type: 'effectiveness',
          summary: `Users with ${skinProfile.skin_type} skin report ${pct}% satisfaction with ${ingredient.name_en} (${ingredient.function}) based on ${ti.sample_size} reports${ti.concern && ti.concern !== '__all__' ? ` for ${ti.concern}` : ''}`,
        })
      }

      // Seasonal adjustments for user's climate
      const { data: seasonal } = await db
        .from('ss_learning_patterns')
        .select('data, pattern_description')
        .eq('pattern_type', 'seasonal')
        .eq('skin_type', skinProfile.climate)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (seasonal?.pattern_description) {
        const data = seasonal.data as Record<string, unknown>
        insights.push({
          type: 'seasonal',
          summary: `${seasonal.pattern_description}. ${data.texture_advice || ''} Focus on: ${(data.ingredients_to_emphasize as string[])?.join(', ') || 'hydration'}`,
        })
      }
    }

    // Current trending items (available to all users)
    const { data: trends } = await db
      .from('ss_trend_signals')
      .select('trend_name, status, signal_strength')
      .in('status', ['emerging', 'trending'])
      .order('signal_strength', { ascending: false })
      .limit(3)

    for (const trend of trends || []) {
      if (trend.trend_name) {
        insights.push({
          type: 'trend',
          summary: `${trend.trend_name} is currently ${trend.status} in the K-beauty community`,
        })
      }
    }
  } catch {
    // Learning context is non-critical; don't fail if queries error
  }

  return insights
}
