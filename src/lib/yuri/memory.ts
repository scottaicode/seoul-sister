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
  /**
   * v10.10.0 — things Yuri left UNRESOLVED in the conversation: a next step she
   * named but the user didn't take, a question she asked that went unanswered, a
   * follow-up she said she'd do. Distinct from `commitments` (what the USER
   * committed to). The proactive-nudge engine reads these to fire on the right
   * unfinished thing instead of raw inactivity. An open loop disappears when a
   * later extraction no longer surfaces it (Sonnet judges resolution).
   * Adapted from LGAAS's handoff-summary `unfinished_items`.
   */
  open_loops: Array<{
    topic: string
    summary: string
    opened_date: string
    /**
     * v11.23.0 — the date Yuri said she'd check back, when she named one.
     *
     * WHY: the honest clinical answer is often "give this four to six weeks
     * before you judge it," and that is correct dermatology — barrier repair is
     * slow. But an open interval decays into never. Both of the July 2026
     * subscribers were last told to wait 4-6 weeks and neither returned.
     *
     * The fix is to separate two different clocks. A PROGRESS check-in (is it
     * stinging, are you sticking with it) is useful within days. An OUTCOME
     * verdict (is it working) genuinely needs weeks. Yuri picks the check-in
     * date herself based on the protocol — a post-Accutane barrier and an acne
     * routine want different rhythms — and the nudge engine fires on the date
     * SHE chose rather than a hardcoded interval. That keeps the judgment with
     * Yuri (Sole Authority) instead of a rule engine picking a cadence.
     *
     * Optional and nullable: when Yuri didn't name a date, the engine falls
     * back to its own staleness threshold. Never inferred or defaulted.
     */
    check_back_date?: string | null
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
  /**
   * How this entry entered the library. `conversation` means a fuzzy matcher
   * inferred it from something the user said (often a routine STEP, not a
   * product) — it is NOT a confirmation of ownership. Rendered as a provenance
   * hedge so Yuri can tell a guess from a fact.
   */
  learned_from: string | null
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
  /**
   * 'catalog' = joined to a real ss_products row, so its INCI is available to
   * every ingredient-keyed check. 'custom' = product_id IS NULL; the step's
   * identity lives in free-text notes and NO catalog-keyed check can see it.
   * Custom steps used to be dropped from context entirely (the `if (product)`
   * gate), which is how a subscriber's prescription ADAPALENE step became
   * invisible to Yuri while the COSRX BHA beside it stayed visible.
   */
  kind: 'catalog' | 'custom'
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

// Kill switch for the prompt-cache volatile-composition fix (default ON).
//
// THE BUG (measured Jul 13 2026, byte-diffed against Bailey's real conversations):
// the intent-based conditional loading below (Feature 13.4) made the CONTENT of the
// cache_control'd system block a function of the CURRENT USER MESSAGE. `loadAll` is
// true only when classifyIntent() returns 'general' — which happens when the message
// matches NO keywords ("Great!", "Sounds good!!"). So a vague turn loaded every
// section (~88K chars) and a specific turn loaded a subset (~80K chars), and the
// prompt oscillated turn to turn. Prompt caching is a PREFIX match: sections blinking
// in and out mid-prefix invalidated everything after them.
//
// Measured on conv 7e3abe74: 9 of 11 turns broke the cache, first diff as early as
// char 36,469 (41% in) — rewriting 59% of a ~24.5K-token prompt at cache-WRITE rates
// (1.25x) instead of reading it at cache-READ rates (0.1x). A 12x penalty.
//
// The economics of the "optimization" it was performing: skipping the conditional
// sections saves ~8K tokens of cache READ (~$0.004/turn at Opus rates) but forces a
// ~24K-token cache WRITE (~$0.150/turn). It cost ~37x more than it saved.
//
// THE FIX: always load the full context, so the cached prefix is byte-identical
// across turns regardless of what the user typed. The gated loads are parallel
// Supabase queries inside one Promise.all — loading them all always costs a little
// DB concurrency, not tokens, and they were already being loaded on every 'general'
// turn anyway.
//
// Set YURI_VOLATILE_SPLIT_ENABLED=false to restore per-message intent gating
// (byte-identical to the pre-fix behavior) without a deploy.
export const VOLATILE_SPLIT_ENABLED = process.env.YURI_VOLATILE_SPLIT_ENABLED !== 'false'

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
  // When the volatile-split fix is enabled, the cached block's COMPOSITION must not
  // depend on the current message (see VOLATILE_SPLIT_ENABLED above). Forcing loadAll
  // leaves every `loadAll || topics.has(...)` gate below untouched while making them
  // all resolve the same way on every turn — a stable prefix.
  const loadAll = VOLATILE_SPLIT_ENABLED || topics.has('general')

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
            notes,
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
        // `learned_from` is LOAD-BEARING, not decoration (July 27 2026). It is the
        // product-side equivalent of `fitzpatrick_source`: it distinguishes a product
        // the user actually confirmed from one a fuzzy matcher inferred. It existed
        // and was populated on every insert, but was never SELECTed — so an inferred
        // row reached Yuri byte-identical to a confirmed one, under a header saying
        // "products the user currently owns." That is how a routine step literally
        // named "Shower / cleanse" became "your nightly cleanser" in Bailey's face.
        // `ingredients_inci`/`ingredients_source` are load-bearing for the same
        // reason `learned_from` is: without them every custom entry renders as a
        // product Yuri knows nothing about, indistinguishable from one whose
        // label the user actually photographed — and a safety check across a
        // shelf she cannot see returns clean.
        .select('product_id, custom_name, custom_brand, category, texture_weight, notes, status, learned_from, ingredients_inci, ingredients_source')
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
      learned_from: (r.learned_from as string | null) || null,
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
            kind: 'catalog',
          })
        } else {
          // Custom step (product_id IS NULL). These were SILENTLY DROPPED here,
          // so a step Yuri herself wrote into the routine vanished from her own
          // memory of it. Bailey's "ADAPALENE NIGHTS ... NEVER same night as
          // BHA" step was invisible while the BHA it warns about was visible —
          // she could not reason about an interaction she could not see.
          // The identity lives in `notes`, written as "<name> — <detail>" or
          // just "<name>" by save_routine. Show the whole string rather than
          // splitting it: the separator is not guaranteed (one real row is a
          // bare instruction with no name), and a wrong split invents a product
          // name, which is the failure this repo already paid for once.
          const rawNotes = (rp.notes as string | null)?.trim()
          if (rawNotes) {
            routineProducts.push({
              productId: null,
              display: rawNotes,
              ownership: 'unknown',
              kind: 'custom',
            })
          }
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
  let decisionMemory = await loadDecisionMemory(db, userId)

  // v10.10.0 — union durable corrections (per-user store that never ages) into the
  // windowed corrections. A correction the user made many conversations ago has
  // aged out of the recent-3-conversation window above, but corrections are ground
  // truth and must survive. The weekly rollup cron promotes them into ss_user_memory;
  // here we merge them back in (durable wins on topic conflict — it's the canonical
  // record). Non-critical: empty/missing store just leaves windowed corrections as-is.
  try {
    const { loadDurableCorrections } = await import('./durable-memory')
    const durable = await loadDurableCorrections(db, userId)
    if (durable.length > 0) {
      const corrMap = new Map<string, DecisionMemory['corrections'][number]>()
      for (const c of decisionMemory?.corrections ?? []) corrMap.set(c.topic.toLowerCase(), c)
      for (const c of durable) corrMap.set(c.topic.toLowerCase(), c) // durable is canonical
      const mergedCorrections = Array.from(corrMap.values())
      if (decisionMemory) {
        decisionMemory.corrections = mergedCorrections
      } else {
        // No windowed memory but durable corrections exist — surface them anyway.
        decisionMemory = {
          decisions: [],
          preferences: [],
          commitments: [],
          corrections: mergedCorrections,
          open_loops: [],
          extracted_at: '',
        }
      }
    }
  } catch (err) {
    console.error('[memory] durable corrections union failed (non-critical):', err)
  }

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
    // Clinical fields render UNKNOWN honestly (July 21 2026). They used to be
    // silently defaulted at onboarding (fitzpatrick=3, age='25-30') and printed
    // here as bare fact, so Yuri could not tell a stated value from an invented
    // one. Fitzpatrick drives retinoid strength, acid aggressiveness, PIH risk
    // in deeper tones and cancer caution in fair ones — asserting a guess is the
    // v10.2.1 fake-confidence failure with clinical consequences.
    const fitz = p.fitzpatrick_scale
    const fitzSource = (profileRaw.fitzpatrick_source as string | null) || null
    const fitzLine = fitz
      ? `${fitz}${fitzSource === 'estimated' ? ' (ESTIMATED, never confirmed by them — if it matters for what you\'re about to recommend, confirm it: "do you burn or tan?")' : ''}`
      : 'NOT ESTABLISHED — you have never been told. Do not guess or state one. Ask ("do you burn, tan, or both?") whenever it affects what you recommend, which it does for any acid or retinoid.'

    const medical = (profileRaw.medical_history as string[] | null) || []
    const sunHistory = (profileRaw.sun_history as string | null) || null

    // Their name, when they gave one. Rapport, not clinical data — so it is
    // simply absent when unknown, with no instruction to go fishing for it.
    const firstName = (profileRaw.first_name as string | null) || null

    sections.push(`## User's Skin Profile${onboarded ? ' (built during your onboarding conversation -- you already know this user!)' : ''}${
      firstName
        ? `\n- Name: ${firstName} — use it the way you'd use a friend's name: naturally, occasionally, never in every message and never as a sales tic.`
        : ''
    }
- Skin type: ${p.skin_type || 'not established'}
- Concerns: ${p.skin_concerns?.join(', ') || 'none specified'}
- Allergies (ingredients to AVOID): ${p.allergies?.length ? p.allergies.join(', ') : 'none known'}${p.allergies?.length ? ' — NOTE: some entries are whole PRODUCTS rather than ingredients, because the extractor accepted product names. A product here means that formula broke them out; the culprit ingredient is unknown, so do not extrapolate the ban to everything sharing an ingredient with it. Ask what specifically went wrong when it matters.' : ''}
- Fitzpatrick scale: ${fitzLine}
- Climate: ${p.climate || 'not established'}${locationLine}
- Age range: ${p.age_range || 'not established — ask if it changes your answer (retinoid strength, pigment timelines, collagen)'}
- Budget: ${p.budget_range}
- Experience level: ${p.experience_level}${
      sunHistory ? `\n- Lifetime sun exposure: ${sunHistory}` : ''
    }`)

    // Medical history is NOT an allergy list and must not be read as one. A
    // real profile stored "skin cancer history" under allergies, so Yuri saw a
    // 25-excision history as something not to put on his face rather than the
    // fact that should reframe every recommendation she makes for him.
    if (medical.length) {
      sections.push(`## Medical History (standing facts — these REFRAME your advice, they are not allergens)
- ${medical.join('\n- ')}

This is not a list of things to avoid applying; it is who you are advising. Let it change your actual reasoning: a skin cancer or precancer history makes daily sun protection the treatment rather than a footnote, makes photosensitizing actives (retinoids, AHAs) something to introduce with explicit sun-exposure framing, and lowers your threshold for saying plainly "that's a dermatologist question, not mine." Rosacea, eczema, or psoriasis change what a "gentle" routine even means. You are not being cautious for its own sake — you are giving the advice a specialist who knew this would give.`)
    } else {
      // An EMPTY medical history rendered nothing at all, which is the silent
      // failure this codebase keeps paying for: "asked, and there is none" and
      // "never asked" produced the identical context, and the second is far more
      // common (4 of 6 real subscriber profiles, Aug 9 2026). Onboarding is
      // instructed to ask (onboarding.ts) but a user can skip it, finish early,
      // or have registered before that instruction existed — so a blank field is
      // evidence about OUR record, not about their health.
      //
      // Stated as a FACT about her own knowledge, with the decision handed back.
      // Deliberately NOT a pre-ask gate: "ask when it bears on what you're about
      // to recommend" and never a condition of helping them. A standing
      // instruction to interrogate before every actives recommendation is the
      // regression risk here — Bailey has already objected to unnecessary
      // preamble ("just makes it confusing", Aug 1 2026).
      sections.push(`## Medical History (not on file)
No standing medical history is recorded for this user. That means it was never captured — NOT that there is none. Skin cancer or precancers, rosacea, eczema, psoriasis, current dermatologist care, and prescriptions like tretinoin or isotretinoin all change the approach, and an allergy list does not capture any of them.

Ask when it bears on what you're about to recommend — plainly, the way a specialist would, and never as a condition of helping them. If they'd rather not say, don't stall: start gentler and ramp slower, which is the right call for unknown skin anyway.`)
    }
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

    // Custom steps + conflict-check coverage, as FACTS.
    //
    // These rows have no catalog product, so every ingredient-keyed check
    // (conflict detection, overlap, effectiveness) contributes nothing for
    // them. That silence used to be indistinguishable from an all-clear, and
    // the steps themselves were dropped from this block entirely. Same
    // discipline as the shelf-visibility block: state what is and is not
    // covered, then hand the judgment back. This blocks nothing and prescribes
    // nothing — Yuri already owns the remedy, because check_ingredient_conflicts
    // accepts raw ingredient_names and can check a custom step by name.
    const custom = context.routineProducts.filter((p) => p.kind === 'custom')
    if (custom.length > 0) {
      const total = context.routineProducts.length
      const covered = total - custom.length
      lines.push('\n### Steps saved without a catalog product (written as free text):')
      for (const p of custom) lines.push(`- ${p.display}`)
      lines.push(
        `\nCONFLICT-CHECK COVERAGE: ${covered} of ${total} routine steps are catalog products whose ingredients the automatic checks can read. The ${custom.length} above are not, so a clean automatic conflict result does NOT cover them — it means they were not checked, not that they are safe. Some are genuinely not products (a shower step, a device); others are real actives, including prescription ones. If one of them matters for what you are about to say, you can read its name here and check it directly with check_ingredient_conflicts using ingredient names, or ask them what is in it. This is a fact about your coverage, not a rule about what to say.`
      )
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
    // Each entry carries its OWN product alongside its rendered line. The split
    // into confirmed/inferred below used to re-pair a flat string[] against
    // context.userProducts BY INDEX, which silently assumed the two arrays stayed
    // the same length. The visibility block below appends narrative lines to that
    // same array, so every index past it ran off the end of userProducts and
    // `up.learned_from` threw on undefined — taking down authenticated Yuri for
    // every user who owned a product with no ingredients on file (Bailey,
    // July 30 2026). Pairing at construction makes the desync unrepresentable.
    const productEntries = context.userProducts.map((up) => {
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

      // Whether you can actually SEE what is in this product. A catalog match
      // carries full INCI; a custom entry carries whatever we captured, or
      // nothing at all. Rendered per-row because the answer differs per row,
      // and a blank row is precisely the one that silently passes a safety check.
      const raw = up as unknown as Record<string, unknown>
      const inci = raw.ingredients_inci as string[] | null
      if (up.product_id) {
        // Catalog product — full INCI is available via the ingredient tools.
      } else if (inci?.length) {
        const src = raw.ingredients_source === 'label_scan' ? 'from their label photo' : 'from a web lookup'
        parts.push(`[INGREDIENTS ON FILE (${inci.length}, ${src}): ${inci.join(', ')}]`)
      } else {
        parts.push('[NO INGREDIENTS ON FILE — not in our catalog and never captured]')
      }
      return { product: up, line: `- ${parts.join(' ')}` }
    })

    // How much of this shelf you can actually see, as a FACT.
    //
    // ss_ingredient_conflicts holds a HIGH-severity Retinol + Glycolic Acid rule.
    // A subscriber running exactly that on a post-Accutane barrier got
    // { safe: true, conflicts: [] } — because both products were custom entries
    // and every catalog-keyed check contributes nothing for them. The silence
    // was indistinguishable from an all-clear.
    //
    // This does not block anything, filter anything, or tell her what to say. It
    // is the cumulative-give instrument applied to safety: surface the state and
    // hand the judgment back. A guard test fails if it becomes a command.
    const blindProducts = context.userProducts.filter((up) => {
      const raw = up as unknown as Record<string, unknown>
      return !up.product_id && !(raw.ingredients_inci as string[] | null)?.length
    })
    // Narrative lines that belong to NO single product. Kept in their own array
    // and appended after the per-product split — never mixed into productEntries.
    const visibilityLines: string[] = []
    if (blindProducts.length > 0) {
      const total = context.userProducts.length
      const seen = total - blindProducts.length
      visibilityLines.push(
        '',
        `INGREDIENT VISIBILITY: you have ingredients for ${seen} of ${total} of their products. You CANNOT see what is in: ${blindProducts
          .map((p) => p.custom_name || 'unnamed product')
          .join(', ')}.`,
        `This matters most when you are checking interactions, allergies, or actives. An interaction check across this shelf is only as good as what you can see, and a clean result on a product whose ingredients are blank means you did not check it — it does not mean it is safe. Say so plainly rather than implying a full review. If it affects what you are about to recommend, ask them to photograph the ingredients panel (the back of the bottle, not the front) and you can read it and record it; you can also look a named product up. This is a fact about your own visibility, not a rule about what to say.`
      )
    }

    // Split confirmed from inferred (July 27 2026). Same discipline the clinical
    // fields got on July 21 and the routine block got on May 3 — a value the
    // system GUESSED must never render identically to one the user CONFIRMED.
    //
    // This header used to read "products the user currently owns and uses" for
    // every row, including rows a fuzzy matcher invented. Bailey's library
    // contained a step instruction ("Shower / cleanse") joined to a real catalog
    // cleanser, so Yuri called it "your nightly cleanser, the one I keep telling
    // you to reach for" about a product Bailey had never heard of. Yuri was not
    // overconfident — the context told her it was fact. This gives her the
    // instrument to doubt it. It does NOT filter rows out or forbid using them:
    // Yuri decides what to do with a low-confidence entry (Sole Authority).
    const isInferred = (up: UserProduct) =>
      up.learned_from === 'conversation' || up.learned_from === 'conversation_inferred'
    // Each entry already carries its own product, so the line and the row it
    // describes cannot drift apart — no index arithmetic, no indexOf() (which
    // would collapse on duplicate-shaped entries).
    const confirmedLines = productEntries.filter((e) => !isInferred(e.product)).map((e) => e.line)
    const inferredLines = productEntries.filter((e) => isInferred(e.product)).map((e) => e.line)

    const blocks: string[] = []
    if (confirmedLines.length > 0) {
      blocks.push(`### Confirmed — they told you about these directly\n${confirmedLines.join('\n')}`)
    }
    if (inferredLines.length > 0) {
      blocks.push(
        `### Inferred from conversation — NOT confirmed, and some are wrong\n` +
          `These were auto-matched to catalog products from things the user said, sometimes from a routine STEP rather than a product they own. Known failure shapes: an instruction ("Cool water rinse"), a device ("LED mask", "Ice roller"), or a placeholder ("Moisturizer (TBD)") matched to an unrelated leave-on product. **Do not say "your X" or claim they own these.** If one matters for what you're about to recommend, ask ("are you actually using X, or did I pick that up wrong?") — that question costs you nothing and asserting a wrong product costs you their trust.\n` +
          inferredLines.join('\n')
      )
    }
    // The visibility fact describes the shelf as a whole, so it trails both
    // blocks rather than sitting inside whichever one happened to render last.
    if (visibilityLines.length > 0) {
      blocks.push(visibilityLines.join('\n').trimStart())
    }
    sections.push(
      `## Your Product Inventory\nUse texture_weight for layering order when building routines.\n${blocks.join('\n\n')}`
    )
  }

  // Glass Skin Score history — gives Yuri concrete data points to reference
  // ("you were at 49 on Feb 25") and lets her notice when a baseline is stale
  // mid-treatment so she can suggest a fresh photo organically. Raw dates +
  // dimension scores; let Opus decide when to bring them up.
  //
  // v10.7.0 Phase H (photo cadence lite) — Bailey explicitly asked for Yuri to
  // proactively prompt photos on a weekly cadence: "Currently, Yuri hasn't
  // asked for many photos, seems like every time it's me just sending them...
  // I think Yuri should be asking for a weekly photo the start of each week."
  // The strategic vision is weekly Sunday/Monday nudges; the lite version just
  // gives Yuri awareness — she already knows the day of week from the RIGHT
  // NOW block, so combined with staleness she can naturally suggest a photo
  // at the right moment. No cron, no notifications — Opus decides when it
  // lands. The threshold drops from 30 days to 7 to match Bailey's cadence ask.
  if (context.glassSkinHistory.length > 0) {
    const latest = context.glassSkinHistory[0]
    // Render the raw score date only, NOT a computed "N days ago" bucket — the
    // bucket ticks daily and invalidates the cached prefix. takenDate is already
    // YYYY-MM-DD; Yuri computes recency from it against ## RIGHT NOW.
    const lines = context.glassSkinHistory.map((s, i) => {
      const tag = i === 0 ? ' (most recent)' : ''
      return `- **${s.takenDate}**${tag}: overall ${s.overall}/100 — luminosity ${s.luminosity}, smoothness ${s.smoothness}, clarity ${s.clarity}, hydration ${s.hydration}, evenness ${s.evenness}`
    })

    // The >= 7 gate is real behavior (fires at most once per photo, not a
    // per-render tick), but do NOT embed "${daysAgo} days old" — that number
    // ticks daily and invalidates the cached prefix. The latest score's raw
    // date is already in `lines` above; Yuri reads staleness from it.
    let cadenceNote = ''
    if (latest.daysAgo >= 7) {
      cadenceNote =
        `\nThe latest score (dated ${latest.takenDate}) is over a week old. Photos are the platform's strongest signal of real progress — when 5-12 weeks of phased treatment pass without a fresh score, the user loses the felt-sense of how their skin has changed. ` +
        `If a momentum-positive moment surfaces in the conversation (a phase milestone, a routine adjustment they're committing to, an off-handed "I think my skin is calming down"), suggest a new Glass Skin Score photo at /glass-skin and frame it as their journey, not a chore. ` +
        `Weekly is a natural cadence — if today is a Sunday or Monday and they haven't checked in this week, that's an organic opening. Don't ask if they just took one or if they're in distress about a flare-up; lean in if they're celebrating. One observation, not a lecture.`
    } else if (context.glassSkinHistory.length === 1) {
      cadenceNote =
        `\nThey have a baseline score but no comparison points yet. As they progress through treatment phases, a fresh score every 7-14 days becomes the comparison data — when a natural opening surfaces, suggest one.`
    }
    sections.push(`## Glass Skin Score History\n${lines.join('\n')}${cadenceNote}`)
  } else {
    // No history at all — strongest cadence signal. Bailey said visible progress
    // is "what continues to sell the app"; without a baseline there's nothing
    // to progress AGAINST. Make sure Yuri knows.
    sections.push(
      `## Glass Skin Score History\nNo Glass Skin Score photos taken yet. If the user is actively treating skin or in a phased protocol, a baseline photo at /glass-skin is the single most valuable thing they can do next — without it, there's no comparison point as their skin changes. Surface it naturally when the conversation hits a "starting point" moment (kicking off a new phase, committing to a routine change, asking "how will I know it's working?").`
    )
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
    // Heading and framing corrected Jul 28 2026. This said "Known
    // Allergies/Sensitivities" and "ALWAYS check for these", but the field also
    // holds whole PRODUCTS ("Anua Oil Cleanser", "innisfree green tea
    // moisturizer") because the extractor accepted product names. Reading a
    // product as an allergen bans a formula outright and can spread to anything
    // sharing an ingredient with it — the mirror of the v11.10.0 defect where a
    // skin cancer history was stored as an allergy. The reaction is REAL and
    // must be respected; what it implies is narrower than "allergy".
    sections.push(`## IMPORTANT: Things their skin reacted badly to\nCheck these before recommending any product:\n${context.knownAllergies.map((a) => `- ${a}`).join('\n')}\n\nEntries may be single INGREDIENTS or whole PRODUCTS. An ingredient means avoid it. A product means that formula broke them out — the culprit ingredient may be unknown, so do not extrapolate a ban to every product that shares an ingredient with it. When it matters, ask what specifically went wrong.`)
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

    // Corrections render FIRST (highest trust — these override training data).
    // Phase 15.1 — K-beauty brands reformulate every 2-3 years; corrections are
    // the durable fix for stale training knowledge.
    if (dm.corrections && dm.corrections.length > 0) {
      // Render the raw correction date, NOT a computed "60+ days ago" tag. The
      // tag flips at a day boundary, which invalidates the cached prefix; the
      // raw date is byte-stable. The instruction below already tells Yuri to
      // verify corrections older than 60 days — she applies that against ##
      // RIGHT NOW using the date, no per-render bucket needed.
      const correctionLines = dm.corrections
        .map((cor) => {
          const dateLabel = cor.date ? ` (noted ${new Date(cor.date).toISOString().slice(0, 10)})` : ''
          const initial = cor.yuri_said ? ` [you had said: "${cor.yuri_said}"]` : ''
          return `- [${cor.topic}] (${cor.category})${dateLabel}: ${cor.truth}${initial}`
        })
        .join('\n')
      dmParts.push(
        `### Corrections That Stick (Trust These Over Your Training Data)\nThe user corrected you on these items in past conversations. Treat each correction as ground truth. K-beauty brands reformulate constantly and your training data goes stale fast. If you catch yourself about to repeat the original wrong claim, STOP and use the corrected version. For corrections older than 60 days, verify with a tool (search_products, get_product_details) before quoting — the brand may have changed again.\n${correctionLines}`
      )
    }

    if (dm.decisions.length > 0) {
      // Render the raw decision date only — NOT a computed "N days ago" bucket.
      // A relative-age string ticks daily, which invalidates the cached system
      // prefix; a fixed ISO date is byte-stable until the row changes. Yuri
      // computes elapsed time from this date against the ## RIGHT NOW block, and
      // does it more accurately than a floor()'d bucket. (Cache-cost + correctness.)
      const decisionLines = dm.decisions
        .map((d) => `- **${d.topic}**: ${d.decision} (decided ${d.date})`)
        .join('\n')
      // One static framing line — NOT a per-row classifier.
      //
      // A decision and the correction that invalidates it are extracted in the
      // same pass and stamped with the same date, so nothing here can order
      // them. On July 27 2026 Yuri was handed the correction "she does not own
      // the Beplain Makiol" alongside the still-active decision "Beplain Makiol
      // once at night", kept recommending it, and the user bought it.
      //
      // The durable fix is at extraction time (see 4b in the extraction prompt),
      // where the model sees the whole conversation and can rewrite or drop the
      // stale decision. This line just makes the precedence explicit for rows
      // written before that fix. A fuzzy matcher was measured first and
      // discarded: 23% precision historically, 0% at render time — it fired only
      // false alarms, which teaches Yuri to ignore the signal.
      dmParts.push(
        `### Active Decisions\nIf a correction above concerns the same product or fact as a decision here, the correction wins — decisions are extracted alongside corrections, so a stale one can outlive the belief it was built on. Judge it and say so rather than acting on it.\n${decisionLines}`
      )
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
      // Render the raw commitment date and (when present) the parsed duration,
      // NOT a computed "N days ago / M days remaining" bucket. Those tick daily
      // and invalidate the cached prefix. Yuri computes elapsed and remaining
      // from the start date + duration against ## RIGHT NOW — more accurately
      // than a floor()'d bucket, and byte-stable until the row changes.
      const commitLines = dm.commitments
        .map((c) => {
          // Try to parse duration from commitment text (e.g. "for 2 weeks", "for 14 days")
          const weekMatch = c.item.match(/for\s+(\d+)\s+weeks?/i)
          const dayMatch = c.item.match(/for\s+(\d+)\s+days?/i)
          const totalDays = weekMatch ? parseInt(weekMatch[1]) * 7
            : dayMatch ? parseInt(dayMatch[1]) : null

          if (totalDays !== null) {
            return `- ${c.item} (committed ${c.date}, duration ${totalDays} days — compute remaining from today's date)`
          }
          return `- ${c.item} (committed ${c.date})`
        })
        .join('\n')
      dmParts.push(`### User Commitments\n${commitLines}`)
    }

    // v10.10.0 — open loops: things you left unresolved. Surfacing these lets you
    // close them naturally without the user having to re-raise them. The proactive
    // nudge engine also reads these, but rendering them here means an engaged user
    // who returns on their own gets the loop closed in-conversation too.
    if (dm.open_loops && dm.open_loops.length > 0) {
      // Render the raw open-loop date only, NOT a "N days ago" bucket (ticks
      // daily → invalidates the cached prefix). Yuri gauges staleness from this
      // date against ## RIGHT NOW.
      const loopLines = dm.open_loops
        .map((l) => {
          // Surface the check-in date Yuri named, as a raw date (never an "N days
          // ago" bucket — that ticks daily and would invalidate the cached prefix).
          // She gauges it against ## RIGHT NOW, same as opened_date.
          const checkBack = l.check_back_date
            ? `, you said you'd check back ${l.check_back_date.slice(0, 10)}`
            : ''
          return `- **${l.topic}**: ${l.summary} (opened ${l.opened_date.slice(0, 10)}${checkBack})`
        })
        .join('\n')
      dmParts.push(
        `### Open Loops (Things You Left Unresolved)\nThese are threads from past conversations that never got closed — a next step you named, a question you asked, a plan waiting on the user. If the moment is right, pick one back up naturally ("hey, did you ever get a chance to..."). Don't force all of them; read the room. If the user already resolved one, just let it go.\n${loopLines}`
      )
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

/** One tool invocation, mirroring the widget's ToolCallLog shape. */
export interface YuriToolCallLog {
  name: string
  input: Record<string, unknown>
  result_summary: string
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  specialistType: SpecialistType | null = null,
  imageUrls: string[] = [],
  toolCalls: YuriToolCallLog[] = []
): Promise<string> {
  const db = getServiceClient()

  const baseRow = {
    conversation_id: conversationId,
    role,
    content,
    specialist_type: specialistType,
    image_urls: imageUrls,
  }

  // Tool-call observability (July 27 2026). The free widget has logged tool
  // calls since Phase 14; the PAID surface logged none, so when save_routine
  // mis-matched a routine step into a user's library the only trace was Yuri's
  // prose. Diagnosing it took forensics instead of one query.
  //
  // The insert degrades gracefully when the `tool_calls` column is absent
  // (migration not yet applied): a schema-cache error retries WITHOUT the
  // column rather than failing the message save. Losing a log line is
  // acceptable; losing the user's message is not.
  let data: { id: string } | null = null
  let error: { message: string; code?: string } | null = null

  if (toolCalls.length > 0) {
    const withTools = await db
      .from('ss_yuri_messages')
      .insert({ ...baseRow, tool_calls: toolCalls })
      .select('id')
      .single()
    data = withTools.data
    error = withTools.error
    if (error && /tool_calls/.test(error.message)) {
      console.warn('[yuri/saveMessage] tool_calls column missing — apply migration 20260727000001; saving without tool log')
      const fallback = await db.from('ss_yuri_messages').insert(baseRow).select('id').single()
      data = fallback.data
      error = fallback.error
    }
  } else {
    const plain = await db.from('ss_yuri_messages').insert(baseRow).select('id').single()
    data = plain.data
    error = plain.error
  }

  if (error) throw new Error(`Failed to save message: ${error.message}`)
  if (!data) throw new Error('Failed to save message: no row returned')

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
  open_loops: [],
  extracted_at: '',
}

/**
 * Normalize an extracted `check_back_date` to a bare ISO date (YYYY-MM-DD), or null.
 *
 * This is the date Yuri NAMED in conversation ("I'll check in Sunday"), and the nudge
 * engine fires on it directly — so a malformed value here would schedule a follow-up
 * at the wrong time, or throw off the daysBetween math silently. Anything that is not
 * a real calendar date becomes null, which falls back to generic staleness: late is
 * recoverable, wrong-day is not.
 *
 * Deliberately does NOT reject past dates. An extraction re-run on an older
 * conversation legitimately yields a date that has already arrived, and the engine
 * treats "date >= today" as due — clamping it here would suppress the exact
 * follow-up that is most overdue.
 */
export function normalizeCheckBackDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Accept a bare ISO date or a full ISO timestamp; take the date portion.
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/.exec(trimmed)
  if (!match) return null
  const isoDate = match[1]
  // Reject calendar-invalid dates (2026-02-30 parses loosely in some paths).
  const parsed = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.toISOString().slice(0, 10) !== isoDate) return null
  return isoDate
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
  const baseOpenLoops = base.open_loops || []

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

  // Open loops: union by topic, latest opened_date wins. Resolution is handled at
  // EXTRACTION time (Sonnet won't re-surface a loop the conversation closed), and
  // aging/staleness is handled at READ time by the nudge engine. Preserve the
  // earliest opened_date so "stale for N days" math is honest — a loop that keeps
  // reappearing is still the same unresolved loop, not a fresh one.
  const openLoopMap = new Map<string, DecisionMemory['open_loops'][number]>()
  for (const l of baseOpenLoops) openLoopMap.set(l.topic.toLowerCase(), l)
  for (const l of incoming.open_loops || []) {
    const key = l.topic.toLowerCase()
    const prev = openLoopMap.get(key)
    // Keep the earliest opened_date so the loop's true age is preserved; take the
    // newer summary (Yuri's most recent phrasing of what's still unresolved).
    //
    // check_back_date: the NEWER value wins when the extraction provides one
    // (Yuri may have rescheduled), but an extraction that simply didn't mention
    // a follow-up must not ERASE a date she named earlier — that would silently
    // drop the scheduled check-in and send the loop back to generic staleness.
    // Only an explicit null clears it.
    openLoopMap.set(key, {
      ...l,
      opened_date:
        prev?.opened_date && prev.opened_date < l.opened_date ? prev.opened_date : l.opened_date,
      check_back_date:
        l.check_back_date !== undefined ? l.check_back_date : (prev?.check_back_date ?? null),
    })
  }
  const open_loops = Array.from(openLoopMap.values())

  return {
    decisions,
    preferences,
    commitments,
    corrections,
    open_loops,
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
          !raw.corrections?.length &&
          !raw.open_loops?.length)
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
  conversationHistory: Array<{ role: string; content: string }>,
  /**
   * v11.25.0 — the user's IANA timezone, so a weekday Yuri named ("I'll check in
   * Sunday") resolves against THEIR calendar rather than the server's UTC one.
   * Optional: omitted/unknown falls back to UTC, same posture as advisor.ts.
   *
   * Why this parameter exists: Bailey messaged at 9:26 PM CT on Aug 8 (= 02:26
   * UTC Aug 9). The extractor's "today" was already Sunday on the server while
   * still Saturday for her, so Yuri's promised "Sunday" resolved forward to
   * Monday Aug 10. She said Sunday; the DB said Monday; the nudge said "Sunday's
   * here" on a Tuesday. See NUDGE-DATE-HONESTY-FIX.md.
   */
  timezone?: string | null
): Promise<void> {
  const { getAnthropicClient, MODELS, callAnthropicWithRetry } = await import('@/lib/anthropic')
  const { getLocalClock } = await import('./clock')
  const client = getAnthropicClient()

  // The user's local calendar — every date this extractor writes is anchored here,
  // never to raw server UTC.
  const clock = getLocalClock(timezone)
  const today = clock.isoDate

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
   Examples: { "item": "Try COSRX Snail Mucin for 2 weeks", "date": "${today}" }

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

4b. **RECONCILE DECISIONS AGAINST THE CORRECTIONS YOU JUST EXTRACTED**: A correction does not only record a wrong fact — it usually invalidates the plan that was built on that fact. Before you return, re-read your own decisions[] against your own corrections[] and do not leave a decision standing that the correction kills.

   For each decision, ask: was this decision only true because of the thing the user just corrected? If yes, either REWRITE it under the same topic so it reflects the corrected truth, or DROP it. Keep the topic string identical when rewriting — memory merges by topic, so a rewritten decision replaces the stale one automatically.

   This is judgment, not string matching. A decision that MENTIONS a corrected product is often perfectly fine — "removed X from her routine because she doesn't own it" is the remediation, not a contradiction, and must be KEPT as-is. What must not survive is an instruction that still tells Yuri to act on the false belief.

   Real failure this prevents (July 27 2026): a user told Yuri she had never heard of the "Beplain Makiol" cleanser Yuri kept prescribing. The correction was extracted correctly — and the decisions "Beplain Makiol once at night" and "use Beplain Makiol instead of the Medicube foam" were left untouched. Yuri kept reading them as active instructions and kept recommending the cleanser. The user eventually bought a product she never needed. The correct output there was to drop both decisions, or rewrite cleansing_protocol to name the cleansers she actually owns.

5. **CLEANUP ACTIONS (correction feedback loop)**: When a correction reveals that the SYSTEM made a mistake about a specific product — most commonly an auto-extracted reaction tag the user never agreed to (e.g. "I never owned that product", "I've never used X", "system glitch tagged X as my holy grail") — include the specific data-cleanup action needed. This closes the loop: corrections aren't just memory, they drive cleanup of the underlying bad data.

   Supported actions:
   { "action": "clear_reaction", "product_name": "exact product name", "brand": "exact brand name" }

   Include cleanup_actions ONLY when the correction's truth field unambiguously indicates a data error tied to a specific product. Do NOT include cleanup actions for:
   - General factual corrections (reformulations, brand identity, ingredient list errors) — those are handled by memory alone
   - Hypothetical complaints ("I wish it weren't tagged")
   - Vague references without specific product names

   Example: Bailey said "Skin&Lab Retinol Lifting Roller Cream is shown as a holy grail but I don't own it and never have." That correction implies cleanup_actions: [{ "action": "clear_reaction", "product_name": "Skin&Lab Retinol Lifting Roller Cream", "brand": "Skin&Lab" }]

6. **OPEN LOOPS**: Things Yuri left UNRESOLVED in this conversation — a next step she named that the user didn't take yet, a question Yuri asked that the user never answered, a follow-up Yuri said she'd do, or a plan that's waiting on the user. These are distinct from COMMITMENTS (what the USER actively committed to). Open loops are what's hanging, unfinished, at the end of the conversation. Each needs a short topic slug, a plain-language summary of what's unresolved, and the date it was opened (today).

   Be CONSERVATIVE: only genuinely unresolved threads, and only if you can point to where Yuri raised it. If the conversation reached a clean stopping point with nothing pending, return an empty array.

   If a previously-open thread got RESOLVED in this conversation (the user answered the question, took the step, made the decision), do NOT include it — leaving it out is how a loop closes.

   **check_back_date** (optional): if Yuri named a specific time she'd follow up or check in ("I'll check in around Friday", "let's look at this again next week", "give it ten days and tell me how it feels"), resolve it to a concrete ISO date (YYYY-MM-DD) relative to today, ${today}, which is a **${clock.weekday}** in the user's local calendar (${clock.timezone}). This is what she SAID, not what you think would be good — if she named no follow-up time, omit the field or set it null. Never invent one, and never derive it from how long a treatment takes to work: "give it four to six weeks before you judge results" is an OUTCOME horizon, not a check-in date. Only a check-in she actually offered counts.

   When she named a WEEKDAY, resolve it to the NEXT occurrence of that weekday on or after today, counting from the fact that today is a ${clock.weekday}. If she said "${clock.weekday}", she means today. Do not skip ahead a week, and do not shift by a day — a follow-up that lands on the wrong weekday reads to the user as Yuri forgetting what she said, which is worse than no follow-up at all.

   Examples:
   { "topic": "phase_3_routine", "summary": "Yuri moved the user to Phase 3 (brightening) but hasn't built the new AM/PM routine yet — user is still running the Phase 2 routine", "opened_date": "${today}" }
   { "topic": "under_eye_plan", "summary": "Yuri ran the press test and identified pigmented + structural under-eye darkness; said to treat the pigmented part with the brightening active but the user hasn't started it", "opened_date": "${today}" }
   { "topic": "sleeping_mask_pick", "summary": "Yuri offered to pull a couple of hydrating sleeping masks for menstrual week; user hasn't said yes/no yet", "opened_date": "${today}" }

CONVERSATION:
${transcript}

Return ONLY valid JSON in this exact format (empty arrays are fine if nothing found):
{
  "decisions": [{ "topic": "...", "decision": "...", "date": "${today}" }],
  "preferences": [{ "topic": "...", "preference": "..." }],
  "commitments": [{ "item": "...", "date": "${today}" }],
  "corrections": [{ "topic": "...", "yuri_said": "...", "truth": "...", "category": "reformulation|discontinued|price|ingredient|brand_identity|other", "date": "${today}", "cleanup_actions": [ { "action": "clear_reaction", "product_name": "...", "brand": "..." } ] }],
  "open_loops": [{ "topic": "...", "summary": "...", "opened_date": "${today}", "check_back_date": null }]
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
    open_loops?: unknown[]
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
            date: String(d.date || today),
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
            date: String(p.date || today),
          }))
      : [],
    commitments: Array.isArray(extracted.commitments)
      ? (extracted.commitments as Array<{ item?: string; date?: string }>)
          .filter((c) => c.item)
          .map((c) => ({
            item: String(c.item),
            date: String(c.date || today),
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
              date: String(c.date || today),
            }
          })
      : [],
    open_loops: Array.isArray(extracted.open_loops)
      ? (
          extracted.open_loops as Array<{
            topic?: string
            summary?: string
            opened_date?: string
            check_back_date?: string | null
          }>
        )
          .filter((l) => l.topic && l.summary)
          .map((l) => ({
            topic: String(l.topic),
            summary: String(l.summary),
            opened_date: String(l.opened_date || today),
            // The date Yuri actually named ("I'll check in Sunday"). This is what
            // lets the nudge engine keep her word on the day SHE chose instead of
            // falling back to generic staleness. Dropping it here silently reverts
            // every promised follow-up to the 5-day default — invisible, because
            // null is a legitimate value for a loop with no promised date.
            // Normalized to a bare ISO date; anything unparseable becomes null so a
            // malformed value can never schedule a nudge at the wrong time.
            check_back_date: normalizeCheckBackDate(l.check_back_date),
          }))
      : [],
    extracted_at: new Date().toISOString(),
  }

  // Skip if nothing was extracted
  if (
    incoming.decisions.length === 0 &&
    incoming.preferences.length === 0 &&
    incoming.commitments.length === 0 &&
    incoming.corrections.length === 0 &&
    incoming.open_loops.length === 0
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

  // v10.7.0 Phase E — Correction feedback loop.
  // Per Principle 3 (Moat Through Learning), corrections aren't just memory; they
  // drive cleanup of the underlying bad data that caused them. When a correction
  // names a specific product and the cleanup intent is unambiguous (Sonnet
  // emitted a cleanup_action), execute the cleanup so the bad row doesn't
  // survive future Library views.
  //
  // Bailey's Feb 14 Skin&Lab Retinol Lifting Roller Cream false-positive is the
  // canonical case: she corrected Yuri ("I don't own it and never have"), and
  // Phase 15.1 corrections memory has been recording that correction — but the
  // underlying ss_user_product_reactions row never got scrubbed, so the holy
  // grail tag survived. This loop now scrubs it on the very next extraction
  // cycle after the correction is captured.
  try {
    const cleanupActions: Array<{ action: string; product_name?: string; brand?: string }> =
      Array.isArray(extracted.corrections)
        ? (extracted.corrections as Array<{ cleanup_actions?: unknown[] }>)
            .flatMap((c) => (Array.isArray(c.cleanup_actions) ? c.cleanup_actions : []))
            .filter(
              (a): a is { action: string; product_name?: string; brand?: string } =>
                !!a && typeof a === 'object' && typeof (a as Record<string, unknown>).action === 'string'
            )
        : []

    if (cleanupActions.length > 0) {
      // Lazy import to avoid pulling tools surface into the memory hot path.
      const { resolveProductByNameStrict } = await import('./tools')

      for (const action of cleanupActions) {
        if (action.action !== 'clear_reaction' || !action.product_name) continue

        // Strict resolution — never substitute a wrong product when scrubbing.
        // Better to leave a bad row in place than to delete a good one for a
        // different product the user actually does have a reaction for.
        const fullName = action.brand
          ? `${action.brand} ${action.product_name}`
          : action.product_name
        const match = await resolveProductByNameStrict(db, fullName)
        if (!match) {
          console.warn(
            `[memory/cleanup] No confident catalog match for "${fullName}" — skipping clear_reaction cleanup`
          )
          continue
        }

        const { error: deleteError } = await db
          .from('ss_user_product_reactions')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', match.id)

        if (deleteError) {
          console.error(
            `[memory/cleanup] Failed to clear reaction for "${match.brand_en} ${match.name_en}":`,
            deleteError.message
          )
        } else {
          console.log(
            `[memory/cleanup] Cleared reaction for "${match.brand_en} ${match.name_en}" (correction feedback loop)`
          )
        }
      }
    }
  } catch (err) {
    // Non-critical: cleanup failure must not break the main memory save above.
    console.error('[memory/cleanup] Correction cleanup loop error:', err)
  }
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
