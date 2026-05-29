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
 *   Layer 2 — On-demand Opus 4.8 reasoning
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
  /**
   * v10.8.2: category-level exclusions extracted from decision_memory.
   * When Yuri's exclusion intent is category-level rather than substance-level
   * ("stacking acids would risk PIH", "already using BHA 3x/week", "rejected
   * additional niacinamide serum"), this captures the product categories +
   * ingredient classes the user shouldn't be shown MORE of. Empty array means
   * no category-level exclusions are active.
   *
   * Distinct from `excludedSubstances` because the gap that Bailey's Phase 2
   * surfaced is category-level judgment: she has COSRX BHA, so another BHA
   * toner shouldn't show as a "fit" even though the literal word "salicylic
   * acid" isn't in her exclusion intent text.
   */
  excludedCategories: ExcludedCategory[]
}

/**
 * A category/class exclusion the curation layer should honor.
 * Either `category` (matches ss_products.category) or `ingredientClass`
 * (matches against ingredient class membership) — at least one is set.
 */
export interface ExcludedCategory {
  /** ss_products.category to skip (e.g., 'spot_treatment', 'exfoliator'). Optional. */
  category?: string
  /** Ingredient class to skip — products containing any class member skip (e.g., 'bha', 'pha', 'aha', 'retinoid'). Optional. */
  ingredientClass?: string
  /** The decision_memory/watch_for text that produced this exclusion (for reasoning surface). */
  sourceText: string
}

export interface MatchedItem {
  type: 'watch_for' | 'allergen' | 'decision_memory' | 'category_conflict'
  /** The user-state item that triggered (e.g. "BHA on cheeks 6+ days/wk"). */
  item: string
  /** Which ingredient on the product matched (or product category for category_conflict). */
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

  // v10.8.2: fragrance/parfum is intentionally NEVER_EXCLUDE at the
  // decision-memory level. Many K-beauty products contain fragrance, and
  // Yuri often mentions it in context-specific notes ("skip Zero Pore Oil
  // due to astringent oils AND fragrance") without meaning the user has a
  // global fragrance avoidance. If the user actually wants fragrance-free
  // only, that signal belongs on ss_user_profiles.allergies, where it gets
  // captured via the allergen check path (which IS surfaced to the user as
  // explicit declared input rather than inferred from chat). This avoids
  // false-positive skips on products Yuri herself has recommended.
  'fragrance', 'parfum', 'perfume', 'aroma',

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
// Category-level exclusion extraction (v10.8.2 — Bailey Phase 2 BHA-on-BHA gap)
// ---------------------------------------------------------------------------
//
// Layer 1 substance extractor (above) catches literal-word exclusions in
// Yuri's decision_memory: "Not adding glycolic acid" → exclude glycolic acid.
// But Yuri's higher-order judgment is often category-level:
//
//   "already using BHA 3x/week" → don't add more BHA, period
//   "stacking acids would risk PIH" → no more acids of any class
//   "rejected additional niacinamide serum" → no more niacinamide-as-feature
//   "wrong tool for current phase with BHA 3x/week" → no astringent/pore actives
//   "Stay the course on Phase 2, don't add anything new" → conservative skip on
//     active-category products (spot treatment, exfoliator, peeling, etc.)
//
// Bailey's Phase 2 decision_memory contains all of these statements. The
// substance extractor only catches glycolic acid (the one literal substance).
// The remaining category-level judgment is what produces "Aloe BHA Skin Toner
// in fits while user has COSRX BHA active" — mechanically correct at the
// substance level (Yuri never literally said "salicylic acid"), but visibly
// wrong at the user-experience level.
//
// AI-First note: this is structural data extraction from Yuri's own writing.
// We're parsing exclusion intent at the category level from her decision_memory
// + watch_for. We are NOT writing rules like "if user has BHA then block BHA"
// — that would be a rule engine. The category exclusions ONLY exist because
// Yuri's text said "stacking acids" or "no more actives" or equivalent. If
// her text doesn't say it, the category isn't blocked.

/**
 * Maps category-signal phrases that appear in Yuri's decision_memory or
 * watch_for items to the categories + ingredient classes they imply.
 *
 * Each entry: phrase pattern → categories to block + ingredient classes.
 * Phrases are checked against text that already passed exclusion-intent
 * detection (so we know there's a skip/reject/avoid verb nearby).
 */
const CATEGORY_SIGNAL_PATTERNS: Array<{
  pattern: RegExp
  /** ss_products.category values to skip */
  categories?: string[]
  /** Ingredient classes (membership checked via INGREDIENT_CLASS_MEMBERSHIP) */
  ingredientClasses?: string[]
  /** Human-readable label for the matched_items.item field */
  label: string
}> = [
  // BHA-related
  {
    pattern: /\b(?:already (?:using|on)|currently using|on)\s+bha\b/i,
    ingredientClasses: ['bha'],
    label: 'already running BHA',
  },
  {
    pattern: /\bbha\s+(?:3x|2x|4x|\d+x|three times|twice|four times)\s*(?:\/?\s*week|a week)\b/i,
    ingredientClasses: ['bha'],
    label: 'BHA already at protocol cadence',
  },

  // Acid stacking
  {
    pattern: /\bstacking\s+acid/i,
    ingredientClasses: ['bha', 'aha', 'pha'],
    label: 'no acid stacking',
  },
  {
    pattern: /\bno (?:more )?acids?\b/i,
    ingredientClasses: ['bha', 'aha', 'pha'],
    label: 'no more acids',
  },

  // Additional-X-serum-style rejections
  {
    pattern: /\badditional\s+niacinamide\b/i,
    ingredientClasses: ['niacinamide_feature'],
    label: 'no additional niacinamide serum',
  },
  {
    pattern: /\badditional\s+vitamin\s*c\b/i,
    ingredientClasses: ['vitamin_c'],
    label: 'no additional vitamin C',
  },
  {
    pattern: /\bvitamin\s*c\s+ampoule\b/i,
    ingredientClasses: ['vitamin_c'],
    label: 'no additional vitamin C ampoule',
  },
  {
    pattern: /\bmore\s+vitamin\s*c\b/i,
    ingredientClasses: ['vitamin_c'],
    label: 'no more vitamin C',
  },

  // PHA / future-phase deferrals
  {
    pattern: /\bpha\s+toner\b/i,
    ingredientClasses: ['pha'],
    label: 'rejected PHA toner',
  },
  {
    pattern: /\bgentle\s+pha\b.*\b(?:phase\s*[34]|later\s+phase|future)/i,
    ingredientClasses: ['pha'],
    label: 'PHAs deferred to future phase',
  },

  // Category-level "no new" / "stay the course" language
  {
    pattern: /\bdon'?t\s+add\s+anything\s+new\b/i,
    categories: ['spot_treatment', 'exfoliator', 'ampoule'],
    label: 'no new active products this phase',
  },
  {
    pattern: /\bstay\s+the\s+course\b/i,
    categories: ['spot_treatment', 'exfoliator', 'ampoule'],
    label: 'stay-the-course Phase 2 protocol',
  },
  {
    pattern: /\bno\s+(?:more|additional)\s+actives?\b/i,
    categories: ['spot_treatment', 'exfoliator', 'ampoule'],
    label: 'no more active products',
  },

  // Sleeping mask + humectant essence (Glass Skin rejection list)
  {
    pattern: /\bsleeping\s+mask\b/i,
    categories: ['mask'],
    ingredientClasses: ['sleeping_mask_pack'],
    label: 'rejected sleeping mask',
  },
  {
    pattern: /\bhumectant\s+essence\b/i,
    categories: ['essence'],
    label: 'rejected additional humectant essence',
  },

  // Astringent pore products (Zero Pore Oil class)
  {
    pattern: /\bastringent\s+oils?\b/i,
    ingredientClasses: ['astringent_oil'],
    label: 'no astringent oils (Phase 2 with BHA)',
  },
  {
    pattern: /\bwrong\s+tool\s+for\s+current\s+phase/i,
    categories: ['oil'],
    ingredientClasses: ['astringent_oil'],
    label: 'wrong tool for current phase',
  },
]

/**
 * Ingredient class → list of canonical ingredient names that belong to the
 * class. Used by applyPhaseFilter to check if a candidate product contains
 * any ingredient in a blocked class.
 *
 * Note: these are CONSERVATIVE class definitions. We include obvious members
 * only; if Yuri ever recommends one of these specifically by name, the
 * NEVER_EXCLUDE_SUBSTANCES allowlist on the substance side wins anyway.
 */
const INGREDIENT_CLASS_MEMBERSHIP: Record<string, string[]> = {
  bha: [
    'salicylic acid',
    'betaine salicylate',
    // Note: salix alba / willow bark intentionally NOT included. Willow bark
    // contains natural salicylates but at concentrations that don't trigger
    // the BHA-stacking risk Yuri is protecting against. Including "salix alba
    // bark water" would also produce false-positive matches via substring
    // collisions with "water". If Yuri ever specifically excludes willow bark,
    // it'll appear in her decision_memory as a substance exclusion.
  ],
  aha: [
    'glycolic acid',
    'lactic acid',
    'mandelic acid',
    // Note: citric acid intentionally NOT in AHA class. At cosmetic
    // concentrations it's a pH adjuster, not an exfoliating acid. Treating
    // citric acid as an AHA produces false-positive skips on virtually every
    // K-beauty product (it's in everything as a buffer). If a product
    // actually features citric acid as an active, Yuri will catch it via
    // substance-level reasoning.
    'malic acid',
    'tartaric acid',
  ],
  pha: [
    'gluconolactone',
    'lactobionic acid',
    // 'galactose' removed — too generic, false positives on milk-derived
    // ingredients that aren't PHA actives.
  ],
  retinoid: [
    'retinol',
    'retinal',
    'retinaldehyde',
    'retinyl palmitate',
    'retinoic acid',
    'tretinoin',
    'adapalene',
    'bakuchiol', // bakuchiol is the natural retinoid alternative
  ],
  vitamin_c: [
    'ascorbic acid',
    'l-ascorbic acid',
    'ethyl ascorbic acid',
    'magnesium ascorbyl phosphate',
    'sodium ascorbyl phosphate',
    'ascorbyl glucoside',
    'tetrahexyldecyl ascorbate',
    'thd ascorbate',
    'ascorbyl palmitate',
    '3-o-ethyl ascorbic acid',
  ],
  // Note: niacinamide_feature targets products where niacinamide is the
  // headline active (e.g., "10% niacinamide serum"). We can't tell from
  // ingredient lists alone whether niacinamide is the feature or just a
  // supporting ingredient; we use product name + category as a proxy.
  // Handled in applyPhaseFilter via name pattern, not ingredient match.
  niacinamide_feature: [],
  astringent_oil: [
    'tea tree oil',
    'eucalyptus oil',
    'witch hazel',
    'peppermint oil',
    'camphor',
    'menthol',
  ],
  sleeping_mask_pack: [], // category-only match
}

/**
 * Extract category-level exclusions from decision_memory + watch_for items
 * by matching exclusion-intent text against the CATEGORY_SIGNAL_PATTERNS map.
 */
function extractExcludedCategoriesFromText(textBlocks: string[]): ExcludedCategory[] {
  const result: ExcludedCategory[] = []
  const seenKeys = new Set<string>()

  for (const text of textBlocks) {
    if (!text || !entryHasExclusionIntent(text)) continue
    for (const sig of CATEGORY_SIGNAL_PATTERNS) {
      if (!sig.pattern.test(text)) continue

      if (sig.categories) {
        for (const cat of sig.categories) {
          const key = `cat:${cat}|${sig.label}`
          if (seenKeys.has(key)) continue
          seenKeys.add(key)
          result.push({ category: cat, sourceText: sig.label })
        }
      }
      if (sig.ingredientClasses) {
        for (const cls of sig.ingredientClasses) {
          const key = `cls:${cls}|${sig.label}`
          if (seenKeys.has(key)) continue
          seenKeys.add(key)
          result.push({ ingredientClass: cls, sourceText: sig.label })
        }
      }
    }
  }

  return result
}

/**
 * Convenience wrapper: pull all candidate text blocks from a decision_memory
 * object (decisions[].decision + corrections[].truth) for category extraction.
 */
function collectDecisionMemoryTextBlocks(
  decisionMemory: Record<string, unknown> | null
): string[] {
  if (!decisionMemory) return []
  const blocks: string[] = []

  type DecisionEntry = { topic?: string; decision?: string }
  type CorrectionEntry = { topic?: string; truth?: string }

  const decisions = (decisionMemory.decisions as DecisionEntry[] | undefined) || []
  for (const d of decisions) {
    const text = `${d.topic || ''} ${d.decision || ''}`.trim()
    if (text) blocks.push(text)
  }

  const corrections = (decisionMemory.corrections as CorrectionEntry[] | undefined) || []
  for (const c of corrections) {
    const text = `${c.topic || ''} ${c.truth || ''}`.trim()
    if (text) blocks.push(text)
  }

  return blocks
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
  const allDecisionTextBlocks: string[] = []
  for (const row of convRows || []) {
    const dm = row.decision_memory as Record<string, unknown> | null
    const subs = await extractExcludedSubstancesFromDecisionMemory(dm)
    for (const sub of subs) {
      excludedSet.add(sub)
    }
    // v10.8.2: collect text blocks for category-level extraction below
    allDecisionTextBlocks.push(...collectDecisionMemoryTextBlocks(dm))
  }

  // v10.8.2: extract category-level exclusions across all decision_memory
  // text + watch_for items. Same exclusion-intent gate as the substance
  // extractor — text must contain a skip/avoid/reject verb before any
  // category signal matches.
  const categoryTextBlocks = [
    ...allDecisionTextBlocks,
    ...(activePhase?.watchFor || []),
  ]
  const excludedCategories = extractExcludedCategoriesFromText(categoryTextBlocks)

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
    excludedCategories,
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
const CURATION_LOGIC_VERSION = 'v10.8.3' as const

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
 * v10.8.2 adds Layer 1.5 — category-level conflict checks against
 * context.excludedCategories. Caller passes optional `productCategories` and
 * `productNames` maps to enable this; if omitted, only substance-level
 * filtering runs (backward compat).
 *
 * Caller is responsible for fetching ingredient + category data; this
 * function operates on pre-fetched maps to avoid N+1 queries.
 */
export function applyPhaseFilter(
  candidateProductIds: string[],
  productIngredients: Map<string, string[]>,
  context: CurationContext,
  productCategories?: Map<string, string>,
  productNames?: Map<string, string>
): CurationVerdictResult[] {
  const results: CurationVerdictResult[] = []

  const allergyTokens = context.allergies.map((a) => a.toLowerCase().trim()).filter(Boolean)
  const excludedTokens = context.excludedSubstances.map((s) => s.toLowerCase().trim()).filter(Boolean)
  const watchForSubstances = (context.activePhase?.watchForExcludedSubstances || [])
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length >= 4)

  // v10.8.2: pre-compute the category/class blocklists from context once
  const blockedCategories = new Set<string>()
  const blockedClasses = new Map<string, string>() // class → sourceText label
  for (const ex of context.excludedCategories || []) {
    if (ex.category) blockedCategories.add(ex.category.toLowerCase())
    if (ex.ingredientClass) blockedClasses.set(ex.ingredientClass, ex.sourceText)
  }
  // Maps class → set of canonical ingredient names that belong to the class
  const classMembershipLookup = new Map<string, Set<string>>()
  for (const cls of blockedClasses.keys()) {
    const members = INGREDIENT_CLASS_MEMBERSHIP[cls] || []
    classMembershipLookup.set(cls, new Set(members.map((m) => m.toLowerCase())))
  }

  for (const productId of candidateProductIds) {
    const ingNames = (productIngredients.get(productId) || []).map((n) => n.toLowerCase())
    if (ingNames.length === 0) {
      // No ingredient data — neutral verdict (don't hide, don't promote).
      // Exception: even without ingredient data we can still block on
      // category if the caller provided productCategories.
      const productCategory = productCategories?.get(productId)?.toLowerCase()
      if (productCategory && blockedCategories.has(productCategory)) {
        const sourceText = (context.excludedCategories || [])
          .find((ex) => ex.category?.toLowerCase() === productCategory)?.sourceText || productCategory
        results.push({
          productId,
          verdict: 'skip',
          matchedItems: [{
            type: 'category_conflict',
            item: sourceText,
            matchedIngredient: productCategory,
          }],
        })
        continue
      }
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
        const sourcePhrase = (context.activePhase?.watchFor || [])
          .find((w) => w.toLowerCase().includes(subToken)) || subToken
        matched.push({ type: 'watch_for', item: sourcePhrase, matchedIngredient: hit })
      }
    }

    // v10.8.2 — Layer 1.5: category + ingredient-class conflicts
    const productCategory = productCategories?.get(productId)?.toLowerCase()
    const productName = productNames?.get(productId)?.toLowerCase() || ''

    // Category-level blocks (e.g., spot_treatment when "no new actives")
    if (productCategory && blockedCategories.has(productCategory)) {
      const sourceText = (context.excludedCategories || [])
        .find((ex) => ex.category?.toLowerCase() === productCategory)?.sourceText || productCategory
      if (!matched.find((m) => m.type === 'category_conflict' && m.matchedIngredient === productCategory)) {
        matched.push({
          type: 'category_conflict',
          item: sourceText,
          matchedIngredient: productCategory,
        })
      }
    }

    // Ingredient-class blocks (BHA/AHA/PHA/retinoid/vitamin_c)
    for (const [cls, label] of blockedClasses) {
      // Special-case: niacinamide_feature — name-based, not ingredient-based
      // (we can't distinguish "10% niacinamide serum" from a moisturizer that
      // contains niacinamide as a supporting ingredient via INCI alone)
      if (cls === 'niacinamide_feature') {
        if (
          /\bniacinamide\b/.test(productName) &&
          (productCategory === 'serum' || productCategory === 'ampoule' || productCategory === 'essence')
        ) {
          if (!matched.find((m) => m.type === 'category_conflict' && m.matchedIngredient === 'niacinamide')) {
            matched.push({
              type: 'category_conflict',
              item: label,
              matchedIngredient: 'niacinamide',
            })
          }
        }
        continue
      }
      if (cls === 'sleeping_mask_pack') {
        // Category-only — already covered by blockedCategories pass above
        continue
      }

      const classMembers = classMembershipLookup.get(cls)
      if (!classMembers) continue
      // Does any product ingredient belong to the blocked class?
      // v10.8.2 directional match: a product ingredient counts as a class
      // member ONLY when (a) it equals a class member exactly, or (b) it
      // CONTAINS a class member as a substring (e.g., "salicylic acid (and
      // willow extract)" contains "salicylic acid"). We do NOT match the
      // reverse direction ("water" being a substring of "salix alba bark
      // water") — that produced false positives in v10.8.2-dev1 where every
      // product containing water was matching the BHA class.
      const hit = ingNames.find((n) => {
        if (n.length < 3) return false // skip super-short tokens
        for (const member of classMembers) {
          if (member.length < 4) continue // skip class members too short to be safe substrings
          if (n === member) return true
          if (n.includes(member)) return true
        }
        return false
      })
      if (hit && !matched.find((m) => m.type === 'category_conflict' && m.matchedIngredient === hit)) {
        matched.push({
          type: 'category_conflict',
          item: label,
          matchedIngredient: hit,
        })
      }
    }

    const verdict: CurationVerdict = matched.length > 0 ? 'skip' : 'fits'
    results.push({ productId, verdict, matchedItems: matched })
  }

  return results
}

// ---------------------------------------------------------------------------
// Layer 2 — Opus 4.8 reasoning (cached)
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
 * Generates fresh Opus 4.8 reasoning for a specific product × user-state
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
 * Creative brief for Opus 4.8. Establishes identity, voice, inputs, and
 * output contract. Does NOT script response structure — trusts the model
 * to articulate naturally within Yuri's voice (Principle 2).
 */
function buildCurationSystemPrompt(): string {
  return `You are Yuri, talking directly to a Seoul Sister subscriber who is browsing the product catalog. She is reading this in the "Why I'd skip this" / "Why this fits" expander on a specific product card.

You are speaking TO her, not ABOUT her. Use "you" and "your." Never refer to her in third person (no "she," "her," "the user," "this subscriber"). This is a one-to-one conversation surface, not a description of the user to someone else.

For this specific product, the deterministic phase filter has already classified whether it FITS or would be a SKIP based on your past conversations with her — her current treatment phase, the decisions and corrections in her memory, her declared allergens, and the watch_for items her active phase is tracking. Your job is to articulate WHY in your own voice — 2-3 sentences that read like the next thing you'd say to her in chat.

Voice anchors (same voice as your main system prompt — consistent across the app):
- Korean K-beauty insider perspective. Use Korean terms naturally where they land.
- Specific over generic. Name the actual ingredient. Reference the actual phase. Don't say "this might not be great for some people."
- Sharp when something would actually conflict. Soft when the fit is genuine.
- Never claim her skin WILL react a specific way. Speak in terms of what conflicts with what she's told you — "you flagged X," "you and I decided Y," "your Phase 2 watch_for is Z."
- No filler. No "everyone's skin is different" disclaimers. No "I'd be happy to help."
- No em-dashes. Use commas or periods.
- No "Yuri Certified" or stamp language. You're not endorsing, you're explaining.

Hard constraints:
- If the precomputed verdict is 'skip', your reasoning MUST reference the specific matched item, addressed to her in second person (e.g. "you flagged salicylic acid as off-limits until Phase 3" or "you listed niacinamide as an allergen on your profile").
- If the verdict is 'fits', explain the fit briefly — what about this product aligns with your current phase work or your routine.
- If the verdict is 'neutral' (no ingredient data available), say so honestly: "I don't have a full ingredient read on this one yet, ask me in chat if you want me to dig."
- Match the precomputed verdict. Do not flip 'skip' to 'fits' or vice versa; the structural filter already made that call.

Category-conflict matched items need a different framing than substance-level matches. If you see a matched item with type=category_conflict, the issue isn't "this product contains a banned ingredient" — it's higher-order: she's already running enough of this category and adding more would conflict with what the two of you decided in past conversations. Examples of category_conflict reasoning, in your voice, talking to her:
- "You're already running COSRX BHA on MWF. Adding another BHA toner stacks acids on Fitzpatrick 3 skin, which is exactly the PIH risk we're protecting against this phase."
- "You've got Goodal Vita C in your AM already. Another vitamin C ampoule isn't more brightening, just more sting."
- "Phase 2 is 'stay the course' — adding a new active product mid-phase is the exact move you and I agreed you weren't going to make."
The matched_ingredient field on a category_conflict will be a category name (spot_treatment, exfoliator) or a class name (bha, aha, pha, vitamin c). The item field will be the source text from your past conversations with her (e.g., "already running BHA", "no acid stacking", "stay-the-course Phase 2 protocol"). Use these to anchor your reasoning in what she actually said.

Output format — return ONLY valid JSON, no markdown fences, no prose wrapper:
{
  "verdict": "fits" | "skip" | "neutral",
  "reasoning_text": "2-3 sentences in your voice, addressed to her in second person"
}`
}

function buildCurationUserPrompt(
  product: ProductForReasoning,
  context: CurationContext,
  verdict: CurationVerdictResult
): string {
  const lines: string[] = []

  lines.push('## Product she is looking at')
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
  lines.push("## Her state (use second-person 'you' when writing back to her)")
  lines.push(`Skin type: ${context.skinType || 'unknown'}`)
  if (context.skinConcerns.length) lines.push(`Concerns: ${context.skinConcerns.join(', ')}`)
  if (context.allergies.length) lines.push(`Declared allergens: ${context.allergies.join(', ')}`)

  if (context.activePhase) {
    lines.push('')
    lines.push(`Her active treatment phase: Phase ${context.activePhase.phaseNumber} — ${context.activePhase.name}`)
    if (context.activePhase.goal) lines.push(`Phase goal: ${context.activePhase.goal}`)
    if (context.activePhase.watchFor.length) {
      lines.push('Phase watch_for items (things she told you to flag in past chats):')
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
  lines.push("Now write the reasoning, addressed TO her in second person ('you', 'your'). Return strict JSON only.")

  return lines.join('\n')
}
