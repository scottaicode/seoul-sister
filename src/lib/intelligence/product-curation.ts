/**
 * v10.8.0 Path B — Products as Yuri's Shortlist
 *
 * Two-layer architecture (see PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md):
 *
 *   Layer 1 — Deterministic SQL/JS filter
 *     Splits candidate products into `fits` and `skip` based on declared user
 *     state: allergens, decision_memory exclusions, active treatment phase
 *     `watch_for` items. Pure structural filtering, no AI, no rule engine.
 *
 *   Layer 2 — On-demand Opus 4.7 reasoning
 *     When a subscriber expands "Why Yuri would skip this" on a specific
 *     product card, this module generates a 2-3 sentence reasoning in Yuri's
 *     voice. Cached in ss_product_curation_reasoning, keyed by user-state hash
 *     so it auto-invalidates when phase or decision_memory changes.
 *
 * AI-First compliance:
 *   - Layer 1 is structural data filtering (substring matching against
 *     declared user-state arrays), NOT a rule engine that judges product
 *     quality.
 *   - Layer 2's Opus prompt is a creative brief, NOT a template string.
 *     Opus reasons dynamically about the specific product × user-state
 *     intersection and articulates the result in Yuri's voice.
 *
 * Yuri Sole Authority compliance:
 *   - This module does not produce "recommendations." It surfaces structured
 *     reasoning that Yuri would otherwise need to be asked for in chat.
 *   - The single recommendation surface in Seoul Sister remains Yuri's chat.
 */

import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { getServiceClient } from '@/lib/supabase'
import { getAnthropicClient, callAnthropicWithRetry } from '@/lib/anthropic'
import { AI_CONTEXTS } from '@/lib/ai-config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CurationVerdict = 'fits' | 'skip' | 'neutral'

export interface CurationContext {
  userId: string
  skinType: string | null
  skinConcerns: string[]
  allergies: string[]
  /** Active treatment phase, if one is in progress. */
  activePhase: {
    id: string
    phaseNumber: number
    name: string
    goal: string | null
    watchFor: string[]
    /**
     * v10.8.1: pre-extracted substances from watch_for items that have
     * exclusion intent at the clause level. Replaces v10.8.0's
     * tokenize-everything approach which produced false positives like
     * "fitzpatrick" and "danger" as substance names. Empty array means
     * the watch_for items are observational, not exclusion-imperative.
     */
    watchForExcludedSubstances: string[]
  } | null
  /** Substances the user's decision memory has flagged to skip in current phase. */
  excludedSubstances: string[]
  /** Ingredient name tokens currently in any active routine product. */
  routineIngredientTokens: string[]
}

export interface MatchedItem {
  type: 'watch_for' | 'allergen' | 'decision_memory'
  /** The user-state item that triggered (e.g. "BHA on cheeks 6+ days/wk"). */
  item: string
  /** Which ingredient on the product matched. */
  matchedIngredient: string
}

export interface CurationVerdictResult {
  productId: string
  verdict: CurationVerdict
  /** Populated when verdict is 'skip'. Empty for 'fits' / 'neutral'. */
  matchedItems: MatchedItem[]
}

export interface ReasoningResult {
  verdict: CurationVerdict
  reasoningText: string
  matchedItems: MatchedItem[]
  cached: boolean
  generatedAt: string
  model: string
}

// ---------------------------------------------------------------------------
// Exclusion-intent extraction from decision_memory (v10.8.1 — tight version)
// ---------------------------------------------------------------------------
//
// Bug fix history. v10.8.0 shipped an over-greedy extractor that tokenized
// the entirety of any decision_memory entry containing a phase-marker keyword
// (skip / phase 2 / defer / etc.) and added every 3+ char token as an
// "excluded substance." Result against Bailey's real decision_memory: an
// entry like "If needed in Phase 3 or 4 for textural PIH marks, would use
// gentle PHA (gluconolactone or lactobionic acid) instead of glycolic"
// produced exclusions for gluconolactone, lactobionic, glycolic, pha — when
// Yuri was actually RECOMMENDING gluconolactone and lactobionic for a future
// phase. The extractor flipped recommendations into exclusions.
//
// The fix: structured exclusion-intent parsing rather than token soup.
//
// Rules:
//   1. Only consider decision_memory.decisions[] and .corrections[] entries
//      whose `decision`/`truth` field contains an EXCLUSION VERB at the
//      clause level (not anywhere in the entry).
//   2. Within an exclusion-intent entry, extract substances by matching
//      against a known-substance dictionary built from ss_ingredients, NOT by
//      tokenizing every word. Token soup over chemistry vocabulary is what
//      let Phase 1's centella recommendation become an exclusion.
//   3. NEVER_EXCLUDE allowlist as defense-in-depth: even if the parser thinks
//      a barrier-safe / ubiquitous ingredient should be excluded (panthenol,
//      hyaluronic acid, vitamin e, etc.), refuse. These are the load-bearing
//      ingredients of K-beauty and false-flagging them is the highest-cost
//      failure mode for trust.
//   4. The "replacing X with Y" pattern excludes X, NOT Y. Yuri uses this
//      idiom constantly ("replacing Medicube PDRN with Isntree Yam Root").
//      Without this rule, the replacement product Yuri RECOMMENDED gets
//      flagged as excluded.

/** Exclusion verbs anchored to clauses — must appear near the substance. */
const EXCLUSION_VERB_PATTERNS: RegExp[] = [
  /\bnot adding\b/i,
  /\bdon'?t add\b/i,
  /\bavoid(?:ing)?\b/i,
  /\bskip(?:ping)?\b/i,
  /\bskip\b/i,
  /\bexclud(?:e|ed|ing)\b/i,
  /\breject(?:ed|ing)?\b/i,
  /\bnot using\b/i,
  /\bdon'?t use\b/i,
  /\bholding off (?:on )?\b/i,
  /\bhold off (?:on )?\b/i,
  /\bpaused?\b/i,
  /\bdiscontinu(?:e|ed|ing)\b/i,
  /\bremov(?:e|ed|ing)\b/i,
  /\bno (?:more )?(?:additional )?\b/i,
  /\bdroppe?d?\b/i,
  /\bstopped\b/i,
  /\bcut(?:ting)?\b/i,
] as const

/**
 * Ingredients that should NEVER be auto-extracted as excluded substances,
 * even if the parser thinks they were. These are barrier-safe, ubiquitous,
 * or load-bearing K-beauty ingredients where a false positive would visibly
 * misrepresent Yuri's voice on the user's curated browse.
 *
 * Bailey-class incident: v10.8.0 had panthenol / hyaluronic acid / vitamin e /
 * asiatic acid / gluconolactone / lactobionic acid / centella all appearing
 * on her "Yuri would skip this" chips when Yuri has actively recommended
 * every one of them.
 */
const NEVER_EXCLUDE_SUBSTANCES = new Set<string>([
  // Humectants — ubiquitous, virtually always recommended
  'glycerin', 'glycerine',
  'hyaluronic acid', 'sodium hyaluronate', 'hydrolyzed hyaluronic acid',
  'butylene glycol', 'propanediol', 'propylene glycol',
  'betaine',

  // Barrier-repair ingredients — Yuri recommends these by default
  'panthenol', 'pro-vitamin b5', 'd-panthenol',
  'allantoin',
  'madecassoside', 'asiaticoside', 'asiatic acid', 'madecassic acid',
  'centella asiatica', 'centella', 'centella asiatica extract',
  'ceramide', 'ceramide np', 'ceramide ap', 'ceramide eop',
  'cholesterol',
  'squalane', 'squalene',
  'beta-glucan', 'oat beta glucan',

  // Antioxidants — broadly recommended unless user has a specific allergy
  'vitamin e', 'tocopherol', 'tocopheryl acetate', 'vitamin e acetate',
  'green tea extract', 'camellia sinensis leaf extract',
  'rosemary leaf extract',

  // Gentle barrier-friendly acids that Yuri OFTEN recommends
  // (these are the ones v10.8.0 wrongly flagged for Bailey)
  'gluconolactone', 'lactobionic acid',
  'pha',

  // Bases
  'water', 'aqua',
  'sea water',

  // Other K-beauty staples
  'niacinamide', 'nicotinamide',
  // Note: niacinamide is in NEVER_EXCLUDE not because it's always safe for
  // every user, but because Yuri recommends it widely; Bailey's actual
  // niacinamide exclusion ("additional niacinamide serum" from rejected
  // Glass Skin recs) is about STACKING, not avoidance. The right place to
  // capture stacking limits is Layer 2 reasoning, not Layer 1 hard skip.

  // Common emollients/textures that aren't actives
  'stearic acid', 'palmitic acid', 'linoleic acid', 'oleic acid',
  'caprylic/capric triglyceride', 'caprylic triglyceride',
  'cetyl alcohol', 'cetearyl alcohol', 'stearyl alcohol',
  'dimethicone', 'cyclopentasiloxane',

  // pH/buffer/preservation
  'citric acid',
  'phenoxyethanol', 'ethylhexylglycerin',
  'sodium citrate', 'sodium hydroxide',

  // Korean botanical extracts Yuri actively recommends
  'schisandra chinensis fruit extract', 'schisandra',
  'rice extract', 'rice ferment filtrate', 'rice water',
  'mugwort', 'artemisia',
  'heartleaf', 'houttuynia cordata',
  'snail mucin', 'snail secretion filtrate',
  'propolis', 'propolis extract',
  'ginseng', 'panax ginseng',
  'birch sap', 'birch juice',
])

/**
 * Build a canonical substance dictionary from ss_ingredients. Used to match
 * substance mentions in decision_memory entries against the actual K-beauty
 * chemistry vocabulary, instead of tokenizing every word and hoping for
 * the best.
 *
 * Loaded lazily on first call within a request, cached for the request's
 * lifetime via module-level Map. Not request-scoped (the dictionary doesn't
 * vary by user), so this is safe.
 */
let SUBSTANCE_DICT_CACHE: Set<string> | null = null
let SUBSTANCE_DICT_LOADED_AT = 0
const SUBSTANCE_DICT_TTL_MS = 5 * 60 * 1000 // 5-min refresh

async function loadSubstanceDictionary(): Promise<Set<string>> {
  const now = Date.now()
  if (SUBSTANCE_DICT_CACHE && now - SUBSTANCE_DICT_LOADED_AT < SUBSTANCE_DICT_TTL_MS) {
    return SUBSTANCE_DICT_CACHE
  }
  const db = getServiceClient()
  const dict = new Set<string>()

  // Pull only known actives + barrier-relevant ingredients (~ couple thousand
  // rows). Substring matches against this dictionary are dramatically more
  // accurate than tokenize-everything.
  const { data } = await db
    .from('ss_ingredients')
    .select('name_en, name_inci, is_active')

  for (const row of data || []) {
    const r = row as { name_en: string | null; name_inci: string | null; is_active: boolean }
    if (r.name_en) dict.add(r.name_en.toLowerCase().trim())
    if (r.name_inci) dict.add(r.name_inci.toLowerCase().trim())
  }

  SUBSTANCE_DICT_CACHE = dict
  SUBSTANCE_DICT_LOADED_AT = now
  return dict
}

/**
 * Find canonical substance names in a free-text clause by checking against
 * the substance dictionary. Returns only multi-character substance phrases
 * that actually appear in ss_ingredients — NOT tokenized words.
 */
function findSubstancesInClause(clause: string, dict: Set<string>): string[] {
  const lower = clause.toLowerCase()
  const found: string[] = []
  for (const substance of dict) {
    // Skip very short dictionary entries (false positive risk: "tea" in
    // "matcha tea", "oil" in "essential oil"). Real substance names are
    // ≥4 chars in our catalog.
    if (substance.length < 4) continue
    // Word-boundary match so "vita c" doesn't match "vitality" etc.
    if (lower.includes(substance)) {
      found.push(substance)
    }
  }
  return found
}

/**
 * Detect exclusion intent at the CLAUSE level, not the entry level. Returns
 * true only if at least one exclusion verb appears in the entry. Then the
 * caller does substance extraction on the same clause.
 */
function entryHasExclusionIntent(text: string): boolean {
  return EXCLUSION_VERB_PATTERNS.some((re) => re.test(text))
}

/**
 * Handles the "replacing X with Y" idiom specifically. Yuri uses this
 * constantly: "Replacing Medicube PDRN with Isntree Yam Root." In v10.8.0
 * both X AND Y got flagged because the entry contained "replacing" and the
 * extractor tokenized everything. Fix: when this pattern matches, extract
 * X (the thing being removed) and explicitly skip Y (the new one).
 *
 * Returns the substance(s) being REPLACED OUT. Returns empty array if the
 * pattern doesn't match — caller falls back to full-clause substance scan.
 */
function extractReplacedSubstances(text: string, dict: Set<string>): string[] | null {
  const m = text.match(/replac(?:e|ing|ed)\s+(.+?)\s+(?:with|by)\s+(.+?)(?:\.|$)/i)
  if (!m) return null
  const [, replacedOut] = m
  return findSubstancesInClause(replacedOut, dict)
}

async function extractExcludedSubstancesFromDecisionMemory(
  decisionMemory: Record<string, unknown> | null
): Promise<string[]> {
  if (!decisionMemory) return []
  const excluded = new Set<string>()
  const dict = await loadSubstanceDictionary()

  type DecisionEntry = { topic?: string; decision?: string }
  type CorrectionEntry = { topic?: string; truth?: string }

  const decisions = (decisionMemory.decisions as DecisionEntry[] | undefined) || []
  for (const d of decisions) {
    const text = `${d.topic || ''} ${d.decision || ''}`.trim()
    if (!text) continue
    if (!entryHasExclusionIntent(text)) continue

    // Handle "replacing X with Y" idiom first — extracts X only
    const replaced = extractReplacedSubstances(text, dict)
    if (replaced !== null) {
      for (const s of replaced) {
        if (!NEVER_EXCLUDE_SUBSTANCES.has(s)) excluded.add(s)
      }
      continue
    }

    // General case: substances in an exclusion-intent entry get flagged
    for (const substance of findSubstancesInClause(text, dict)) {
      if (NEVER_EXCLUDE_SUBSTANCES.has(substance)) continue
      excluded.add(substance)
    }
  }

  const corrections = (decisionMemory.corrections as CorrectionEntry[] | undefined) || []
  for (const c of corrections) {
    const text = `${c.topic || ''} ${c.truth || ''}`.trim()
    if (!text) continue
    if (!entryHasExclusionIntent(text)) continue

    const replaced = extractReplacedSubstances(text, dict)
    if (replaced !== null) {
      for (const s of replaced) {
        if (!NEVER_EXCLUDE_SUBSTANCES.has(s)) excluded.add(s)
      }
      continue
    }

    for (const substance of findSubstancesInClause(text, dict)) {
      if (NEVER_EXCLUDE_SUBSTANCES.has(substance)) continue
      excluded.add(substance)
    }
  }

  return Array.from(excluded)
}

// ---------------------------------------------------------------------------
// Context loader
// ---------------------------------------------------------------------------

/**
 * Builds the full curation context for a user: profile + active phase +
 * excluded substances (from decision_memory) + current routine ingredient
 * tokens. Composes with existing helpers; doesn't duplicate query logic.
 */
export async function buildCurationContext(userId: string): Promise<CurationContext | null> {
  const db = getServiceClient()

  // Profile
  const { data: profile } = await db
    .from('ss_user_profiles')
    .select('skin_type, skin_concerns, allergies')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return null

  // Active treatment phase (if any)
  const { data: phaseRow } = await db
    .from('ss_treatment_phases')
    .select('id, phase_number, name, goal, watch_for')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('phase_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let activePhase: CurationContext['activePhase'] = null
  if (phaseRow) {
    const rawWatchFor = phaseRow.watch_for as unknown
    let watchFor: string[] = []
    if (Array.isArray(rawWatchFor)) {
      watchFor = rawWatchFor
        .map((w) => {
          if (typeof w === 'string') return w
          if (w && typeof w === 'object' && 'item' in w) return String((w as { item: unknown }).item ?? '')
          return ''
        })
        .filter(Boolean)
    }

    // v10.8.1: pre-extract substances from watch_for items using the same
    // clause-level exclusion-intent parser as decision_memory. Bailey's
    // watch_for items are observational prose ("PIH/PIE marks on chin from
    // picking or BHA over-application (Fitzpatrick 3 is the PIH danger zone)")
    // — they describe risks, not blanket substance exclusions. The previous
    // tokenize-everything approach produced false positives like
    // "fitzpatrick", "marks", "danger" as substance names.
    //
    // The watch_for set here will usually be small (or empty for observational
    // items). True hard skips should come from decision_memory.
    const watchForDict = await loadSubstanceDictionary()
    const watchForExcludedSubstances: string[] = []
    for (const w of watchFor) {
      // Only treat watch_for items as substance exclusions when they contain
      // explicit exclusion intent. Most watch_for items are observational
      // ("PIH marks on chin from picking") and shouldn't gate the catalog.
      if (!entryHasExclusionIntent(w)) continue
      for (const s of findSubstancesInClause(w, watchForDict)) {
        if (NEVER_EXCLUDE_SUBSTANCES.has(s)) continue
        watchForExcludedSubstances.push(s)
      }
    }

    activePhase = {
      id: phaseRow.id as string,
      phaseNumber: phaseRow.phase_number as number,
      name: phaseRow.name as string,
      goal: (phaseRow.goal as string) ?? null,
      watchFor,
      watchForExcludedSubstances,
    }
  }

  // Recent decision memory (latest 5 conversations) — same load pattern as
  // routine-effectiveness.ts v10.3.6 + v10.3.7 created_at ordering fix
  const { data: convRows } = await db
    .from('ss_yuri_conversations')
    .select('decision_memory')
    .eq('user_id', userId)
    .not('decision_memory', 'eq', '{}')
    .order('created_at', { ascending: false })
    .limit(5)

  const excludedSet = new Set<string>()
  for (const row of convRows || []) {
    const dm = row.decision_memory as Record<string, unknown> | null
    const subs = await extractExcludedSubstancesFromDecisionMemory(dm)
    for (const sub of subs) {
      excludedSet.add(sub)
    }
  }

  // Current routine ingredient tokens (so reasoning can flag duplication)
  const { data: routineProducts } = await db
    .from('ss_routine_products')
    .select('product_id')
    .in('routine_id', await getActiveRoutineIds(userId))
    .not('product_id', 'is', null)

  const routineProductIds = (routineProducts || [])
    .map((r) => r.product_id as string | null)
    .filter((id): id is string => !!id)

  const routineIngredientTokens = new Set<string>()
  if (routineProductIds.length > 0) {
    const { data: links } = await db
      .from('ss_product_ingredients')
      .select('ingredient:ss_ingredients(name_en, name_inci, is_active)')
      .in('product_id', routineProductIds)

    // Supabase typed-relations come back as arrays even for one-to-one joins.
    // Same shape as other modules in this codebase (memory.ts, enrich-scan.ts).
    type IngredientLink = {
      ingredient: Array<{ name_en: string | null; name_inci: string | null; is_active: boolean }> | { name_en: string | null; name_inci: string | null; is_active: boolean } | null
    }
    for (const link of (links || []) as IngredientLink[]) {
      const ingRaw = link.ingredient
      const ing = Array.isArray(ingRaw) ? ingRaw[0] : ingRaw
      if (!ing || !ing.is_active) continue
      if (ing.name_en) routineIngredientTokens.add(ing.name_en.toLowerCase())
      if (ing.name_inci) routineIngredientTokens.add(ing.name_inci.toLowerCase())
    }
  }

  return {
    userId,
    skinType: (profile.skin_type as string) || null,
    skinConcerns: (profile.skin_concerns as string[]) || [],
    allergies: (profile.allergies as string[]) || [],
    activePhase,
    excludedSubstances: Array.from(excludedSet),
    routineIngredientTokens: Array.from(routineIngredientTokens),
  }
}

async function getActiveRoutineIds(userId: string): Promise<string[]> {
  const db = getServiceClient()
  const { data } = await db
    .from('ss_user_routines')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
  return (data || []).map((r) => r.id as string)
}

// ---------------------------------------------------------------------------
// Cache key hash
// ---------------------------------------------------------------------------

/**
 * v10.8.1+ — Version salt for cache invalidation on extractor changes.
 *
 * Pattern 4 (Structural Encoding from Single Instances): the v10.8.0 → v10.8.1
 * fix exposed that user-state hashing alone isn't sufficient — if the
 * substance-extraction LOGIC changes, the hash for the same user state stays
 * identical and stale (wrong) cached reasoning continues to serve. Adding a
 * version salt means any future extractor change can bump this constant and
 * auto-invalidate every cache row across all users without manual cleanup.
 *
 * Bump this when:
 *   - The decision_memory exclusion-intent parser changes
 *   - The NEVER_EXCLUDE allowlist changes meaningfully
 *   - The watch_for substance extractor changes
 *   - The substance dictionary loading logic changes in a way that affects
 *     what gets flagged
 *
 * Don't bump for:
 *   - UI changes
 *   - Cost-tracking changes
 *   - Adding new fields to the curation payload that don't affect verdicts
 */
const CURATION_LOGIC_VERSION = 'v10.8.1' as const

/**
 * Deterministic sha256 over the load-bearing inputs. When user state changes
 * meaningfully (new phase, decision memory update, new allergen) OR when the
 * extractor logic itself changes (via CURATION_LOGIC_VERSION bump), the hash
 * changes and stale cache rows become no-match for future lookups.
 *
 * What's hashed (and why):
 *   - logic_version: invalidates whole-cache on extractor changes
 *   - skin_type, allergies (sorted): profile-level state
 *   - active_phase.id + phase_number + watch_for (sorted): treatment context
 *   - excluded_substances (sorted): decision memory exclusions
 *
 * What's NOT hashed (intentionally):
 *   - skin_concerns: stable enough; if they change we want existing reasoning
 *     to remain valid for a while.
 *   - routine_ingredient_tokens: changes too often; would invalidate too
 *     aggressively. Reasoning still references duplication via the prompt.
 *   - product_id: lives in the (user_id, product_id, hash) key itself, not
 *     the hash.
 */
export function computeCacheKeyHash(context: CurationContext): string {
  const payload = {
    logic_version: CURATION_LOGIC_VERSION,
    skin_type: context.skinType,
    allergies: [...context.allergies].sort(),
    active_phase: context.activePhase
      ? {
          id: context.activePhase.id,
          phase_number: context.activePhase.phaseNumber,
          watch_for: [...context.activePhase.watchFor].sort(),
        }
      : null,
    excluded_substances: [...context.excludedSubstances].sort(),
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

// ---------------------------------------------------------------------------
// Layer 1 — Deterministic phase filter
// ---------------------------------------------------------------------------

/**
 * Applies structural skip checks against the user's declared state.
 * Returns verdicts for every candidate product. Pure data filtering — no
 * ranking, no judgment, no rule engine.
 *
 * Caller is responsible for fetching ingredient data; this function operates
 * on a pre-fetched map of product_id → ingredient names to avoid N+1 queries.
 */
export function applyPhaseFilter(
  candidateProductIds: string[],
  productIngredients: Map<string, string[]>,
  context: CurationContext
): CurationVerdictResult[] {
  const results: CurationVerdictResult[] = []

  const allergyTokens = context.allergies.map((a) => a.toLowerCase().trim()).filter(Boolean)
  const excludedTokens = context.excludedSubstances.map((s) => s.toLowerCase().trim()).filter(Boolean)
  // v10.8.1: watch_for excluded substances are pre-extracted at context-build
  // time using the same exclusion-intent parser as decision_memory. Avoids the
  // v10.8.0 bug where every word in a watch_for phrase got treated as a
  // substance ("fitzpatrick", "danger", "marks" all became false-positive
  // exclusion chips).
  const watchForSubstances = (context.activePhase?.watchForExcludedSubstances || [])
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length >= 4)

  for (const productId of candidateProductIds) {
    const ingNames = (productIngredients.get(productId) || []).map((n) => n.toLowerCase())
    if (ingNames.length === 0) {
      // No ingredient data — neutral verdict (don't hide, don't promote)
      results.push({ productId, verdict: 'neutral', matchedItems: [] })
      continue
    }

    const matched: MatchedItem[] = []

    // Allergen check
    for (const allergy of allergyTokens) {
      const hit = ingNames.find((n) => n.includes(allergy) || allergy.includes(n))
      if (hit) {
        matched.push({ type: 'allergen', item: allergy, matchedIngredient: hit })
      }
    }

    // Excluded-substance check (decision memory exclusion-intent parser)
    for (const excl of excludedTokens) {
      if (excl.length < 4) continue
      const hit = ingNames.find((n) => n.includes(excl))
      if (hit && !matched.find((m) => m.matchedIngredient === hit)) {
        matched.push({ type: 'decision_memory', item: excl, matchedIngredient: hit })
      }
    }

    // Active phase watch_for check — uses pre-extracted substances only
    for (const subToken of watchForSubstances) {
      const hit = ingNames.find((n) => n.includes(subToken))
      if (hit && !matched.find((m) => m.matchedIngredient === hit)) {
        // Find the original watch_for phrase that contained this substance
        const sourcePhrase = (context.activePhase?.watchFor || [])
          .find((w) => w.toLowerCase().includes(subToken)) || subToken
        matched.push({ type: 'watch_for', item: sourcePhrase, matchedIngredient: hit })
      }
    }

    const verdict: CurationVerdict = matched.length > 0 ? 'skip' : 'fits'
    results.push({ productId, verdict, matchedItems: matched })
  }

  return results
}

// ---------------------------------------------------------------------------
// Layer 2 — Opus 4.7 reasoning (cached)
// ---------------------------------------------------------------------------

interface ProductForReasoning {
  id: string
  name_en: string
  brand_en: string
  category: string | null
  ingredients_raw: string | null
}

/**
 * Returns cached reasoning if a valid row exists, otherwise null. Caller
 * decides whether to call generateReasoning() on cache miss.
 */
export async function getCachedReasoning(
  userId: string,
  productId: string,
  cacheKeyHash: string
): Promise<ReasoningResult | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('ss_product_curation_reasoning')
    .select('verdict, reasoning_text, matched_items, model, generated_at, expires_at')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('cache_key_hash', cacheKeyHash)
    .maybeSingle()

  if (!data) return null

  // Soft TTL check
  if (new Date(data.expires_at as string) < new Date()) {
    return null
  }

  return {
    verdict: data.verdict as CurationVerdict,
    reasoningText: data.reasoning_text as string,
    matchedItems: (data.matched_items as MatchedItem[]) || [],
    cached: true,
    generatedAt: data.generated_at as string,
    model: data.model as string,
  }
}

export async function saveReasoning(
  userId: string,
  productId: string,
  cacheKeyHash: string,
  result: Omit<ReasoningResult, 'cached' | 'generatedAt' | 'model'> & { inputTokens?: number; outputTokens?: number }
): Promise<void> {
  const db = getServiceClient()
  await db.from('ss_product_curation_reasoning').upsert(
    {
      user_id: userId,
      product_id: productId,
      cache_key_hash: cacheKeyHash,
      verdict: result.verdict,
      reasoning_text: result.reasoningText,
      matched_items: result.matchedItems,
      model: AI_CONTEXTS.PRODUCT_CURATION_REASONING.model,
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'user_id,product_id,cache_key_hash' }
  )
}

/**
 * Generates fresh Opus 4.7 reasoning for a specific product × user-state
 * combination. The prompt is a creative brief (per Principle 2): it gives
 * Opus identity, voice context, and inputs — and trusts Opus to produce
 * Yuri's reasoning in her natural register.
 *
 * Returns the parsed verdict + reasoning_text + matched items. Caller is
 * responsible for persisting via saveReasoning().
 */
export async function generateReasoning(
  product: ProductForReasoning,
  context: CurationContext,
  precomputedVerdict: CurationVerdictResult
): Promise<ReasoningResult> {
  const config = AI_CONTEXTS.PRODUCT_CURATION_REASONING

  const systemPrompt = buildCurationSystemPrompt()
  const userPrompt = buildCurationUserPrompt(product, context, precomputedVerdict)

  const client = getAnthropicClient()
  const response = await callAnthropicWithRetry<Anthropic.Messages.Message>(
    () =>
      client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    3
  )

  const textBlock = response.content.find((c) => c.type === 'text')
  const rawText = textBlock && 'text' in textBlock ? textBlock.text : ''

  // Opus is asked to return strict JSON. Parse, fall back gracefully on shape errors.
  let parsed: {
    verdict: CurationVerdict
    reasoning_text: string
  } = {
    verdict: precomputedVerdict.verdict,
    reasoning_text: rawText.trim(),
  }

  try {
    // Strip code fences if present
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const json = JSON.parse(cleaned)
    if (json.verdict && typeof json.reasoning_text === 'string') {
      parsed = {
        verdict: json.verdict as CurationVerdict,
        reasoning_text: json.reasoning_text,
      }
    }
  } catch {
    // Opus returned prose, not JSON. Use the raw text and trust the precomputed verdict.
  }

  return {
    verdict: parsed.verdict,
    reasoningText: parsed.reasoning_text,
    matchedItems: precomputedVerdict.matchedItems,
    cached: false,
    generatedAt: new Date().toISOString(),
    model: config.model,
  }
}

/**
 * Creative brief for Opus 4.7. Establishes identity, voice, inputs, and
 * output contract. Does NOT script response structure — trusts the model
 * to articulate naturally within Yuri's voice (Principle 2).
 */
function buildCurationSystemPrompt(): string {
  return `You are surfacing Yuri's reasoning into a Seoul Sister subscriber-facing UI.

A subscriber is browsing the product catalog. For this specific product, the deterministic phase filter has already classified whether it FITS or would be a SKIP for them based on their current treatment phase, decision memory, allergens, and watch_for items. Your job is to articulate WHY in Yuri's voice — 2-3 sentences that read like Yuri talking to her, not like an algorithm explaining a filter.

Voice anchors (these come from Yuri's main system prompt — same voice across the app):
- Korean K-beauty insider perspective. Use Korean terms naturally where they land.
- Specific over generic. Name the actual ingredient. Reference the actual phase. Don't say "this might not be great for some people."
- Sharp when something would actually conflict. Soft when the fit is genuine.
- Never claim her skin WILL react a specific way. Speak in terms of what conflicts with what SHE'S TOLD YOU.
- No filler. No "everyone's skin is different" disclaimers. No "I'd be happy to help."
- No em-dashes. Use commas or periods.
- No "Yuri Certified" or stamp language. You are not endorsing; you're explaining.

Hard constraints:
- If the precomputed verdict is 'skip', your reasoning MUST reference the specific matched item (e.g. "her decision memory excluded salicylic acid until Phase 3" or "she's flagged niacinamide as an allergen").
- If the verdict is 'fits', explain the fit briefly — what about the product aligns with her current phase or routine.
- If the verdict is 'neutral' (no ingredient data available), say so honestly: "I don't have a full ingredient read on this one — ask me in chat if you want me to dig."
- Match the precomputed verdict. Do not flip 'skip' to 'fits' or vice versa; the structural filter already made that call.

Output format — return ONLY valid JSON, no markdown fences, no prose wrapper:
{
  "verdict": "fits" | "skip" | "neutral",
  "reasoning_text": "2-3 sentences in Yuri's voice"
}`
}

function buildCurationUserPrompt(
  product: ProductForReasoning,
  context: CurationContext,
  verdict: CurationVerdictResult
): string {
  const lines: string[] = []

  lines.push('## Product')
  lines.push(`Name: ${product.brand_en} ${product.name_en}`)
  if (product.category) lines.push(`Category: ${product.category}`)
  if (product.ingredients_raw) {
    // Truncate to first ~800 chars to keep token cost bounded
    const ingTrunc = product.ingredients_raw.length > 800
      ? product.ingredients_raw.slice(0, 800) + '...'
      : product.ingredients_raw
    lines.push(`INCI: ${ingTrunc}`)
  } else {
    lines.push('INCI: (not available)')
  }

  lines.push('')
  lines.push('## Subscriber state')
  lines.push(`Skin type: ${context.skinType || 'unknown'}`)
  if (context.skinConcerns.length) lines.push(`Concerns: ${context.skinConcerns.join(', ')}`)
  if (context.allergies.length) lines.push(`Declared allergens: ${context.allergies.join(', ')}`)

  if (context.activePhase) {
    lines.push('')
    lines.push(`Active treatment phase: Phase ${context.activePhase.phaseNumber} — ${context.activePhase.name}`)
    if (context.activePhase.goal) lines.push(`Phase goal: ${context.activePhase.goal}`)
    if (context.activePhase.watchFor.length) {
      lines.push('Phase watch_for items (things she told you to flag):')
      for (const w of context.activePhase.watchFor.slice(0, 10)) lines.push(`  - ${w}`)
    }
  }

  if (context.excludedSubstances.length) {
    lines.push('')
    lines.push(`Substances her decision memory has flagged to skip in current phase: ${context.excludedSubstances.slice(0, 20).join(', ')}`)
  }

  lines.push('')
  lines.push('## Structural filter result (already computed)')
  lines.push(`Verdict: ${verdict.verdict}`)
  if (verdict.matchedItems.length > 0) {
    lines.push('Matched items (what triggered the skip):')
    for (const m of verdict.matchedItems) {
      lines.push(`  - [${m.type}] ${m.item} — matched ingredient: ${m.matchedIngredient}`)
    }
  }

  lines.push('')
  lines.push('Now write the reasoning. Return strict JSON only.')

  return lines.join('\n')
}
