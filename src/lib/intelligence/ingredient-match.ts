/**
 * Shared ingredient-match library — single source of truth for constraint
 * checking, INCI position lookup, concentration estimation, and synonym
 * resolution. Used by:
 *
 *   1. /api/lgaas/ingredient-check (Blueprint 76 — LGAAS Reddit response gate)
 *   2. Yuri's check_ingredient_conflicts tool (existing in-app advisor)
 *
 * Decision authority: LGAAS Blueprint 76 §3 question #5 — "extract a shared
 * internal function so both call sites benefit from the same ingredient-alias
 * map, same fuzzy-matching tolerance, same INCI position logic."
 *
 * Architecture notes:
 *
 * - Pure functions: no Supabase client, no auth, no HTTP. Caller provides
 *   the ingredients_raw string (already fetched from ss_products). This
 *   keeps the library reusable and lets the caller batch DB reads however
 *   it wants.
 *
 * - Synonym map is INCI-canonical: the keys are the INCI names (or the most
 *   common English variant when the INCI is obscure). Values are arrays of
 *   alternate names users say in posts/conversations. When the LGAAS
 *   constraint extractor returns a colloquial form, this map resolves it to
 *   the canonical key so substring matching is consistent.
 *
 * - Position heuristic for concentration is intentionally rough — INCI order
 *   is concentration-descending only above 1%. Below 1%, ingredients can be
 *   listed in any order. So position 1-3 is reliably high-concentration,
 *   4-10 is medium, 11+ is functional/trace. The heuristic returns ranges,
 *   not exact percentages.
 */

// ---------------------------------------------------------------------------
// Synonym map: colloquial / alternate names → canonical INCI form
// ---------------------------------------------------------------------------
//
// Keys are lowercase. Values are lowercase aliases. When a constraint comes
// in with substance = "vitamin b3", we resolve it to "niacinamide" before
// substring-matching against the product's INCI.
//
// Conservative addition policy: only add a synonym if it's unambiguously the
// same molecule or its widely-recognized cosmetic-grade form. Don't add
// loose category terms ("retinoid" → "retinol") because users distinguish
// between retinol, retinal, retinoic acid, and adapalene — collapsing them
// loses meaningful information.

export const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  // Niacinamide
  niacinamide: ['nicotinamide', 'vitamin b3', 'vitamin b-3', 'vit b3', 'niacin amide'],

  // Salicylic acid — the BHA family
  'salicylic acid': ['bha', 'beta hydroxy acid', 'betaine salicylate', 'capryloyl salicylic acid', 'willow bark', 'salix alba'],

  // Hyaluronic acid family
  'hyaluronic acid': ['ha', 'hyaluronan', 'sodium hyaluronate', 'hydrolyzed hyaluronic acid', 'sodium acetylated hyaluronate'],

  // Vitamin C family (the parent term — variants are deliberately separate)
  'ascorbic acid': ['l-ascorbic acid', 'vitamin c', 'pure vitamin c'],
  'ethyl ascorbic acid': ['3-o-ethyl ascorbic acid', 'eaa'],
  'magnesium ascorbyl phosphate': ['map'],
  'sodium ascorbyl phosphate': ['sap'],
  'ascorbyl glucoside': ['ag'],
  'tetrahexyldecyl ascorbate': ['thd ascorbate', 'thda'],

  // Retinoid family — kept separate by efficacy/conversion step
  retinol: [],
  retinal: ['retinaldehyde'],
  'retinoic acid': ['tretinoin'],
  bakuchiol: [],

  // AHA family
  'glycolic acid': ['aha', 'alpha hydroxy acid'],
  'lactic acid': ['ammonium lactate'],
  'mandelic acid': [],

  // Common K-beauty allergen / sensitivity flags
  fragrance: ['parfum', 'perfume', 'aroma'],
  'tea tree': ['melaleuca alternifolia', 'melaleuca', 'tea tree oil', 'tea tree leaf oil'],
  'essential oil': ['essential oils'],
  'denatured alcohol': ['alcohol denat', 'sd alcohol', 'ethanol'],
  centella: ['centella asiatica', 'cica', 'asiaticoside', 'madecassoside'],

  // Surfactants commonly flagged by sensitive-skin users
  sls: ['sodium lauryl sulfate', 'sodium laureth sulfate'],

  // Preservatives commonly flagged
  paraben: ['methylparaben', 'propylparaben', 'butylparaben', 'ethylparaben'],
  formaldehyde: ['quaternium-15', 'dmdm hydantoin', 'imidazolidinyl urea'],
}

/**
 * Resolve a user-stated substance name to the canonical INCI key + an
 * expanded list of all aliases to search for.
 *
 * If the input doesn't match any canonical key OR alias, return the input
 * lowercased as the only search term (best-effort match against whatever
 * the INCI string contains).
 */
export function resolveSubstance(input: string): {
  canonical: string
  search_terms: string[]
} {
  const lower = input.trim().toLowerCase()

  // Direct canonical hit
  if (INGREDIENT_SYNONYMS[lower]) {
    return {
      canonical: lower,
      search_terms: [lower, ...INGREDIENT_SYNONYMS[lower]],
    }
  }

  // Search through aliases
  for (const [canonical, aliases] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (aliases.includes(lower)) {
      return {
        canonical,
        search_terms: [canonical, ...aliases],
      }
    }
  }

  // No match in synonym map — return as-is, search for the literal substring
  return {
    canonical: lower,
    search_terms: [lower],
  }
}

// ---------------------------------------------------------------------------
// INCI parsing + matching
// ---------------------------------------------------------------------------

/**
 * Parse a raw INCI string into a positioned list. Handles common formatting:
 *
 *   - Comma-separated
 *   - Parenthetical alternates: "Water (Aqua)" → both Water and Aqua at the
 *     same position
 *   - Concentration ppm annotations: "Niacinamide (5,000 ppm)" → name = Niacinamide
 *   - Multi-product strings (e.g. some Olive Young rows concatenate INCI for
 *     a "main + special gift" bundle, separated by " [Special Gift] " or
 *     similar). For BP76 we only parse the first product (everything before
 *     the first `[` or `Original Product]` marker). Users tagged as
 *     niacinamide-reactive aren't going to drill into bundle gifts.
 */
export function parseInciString(inciRaw: string): Array<{ name: string; position: number }> {
  if (!inciRaw) return []

  // Truncate at bundle markers if present
  const cutoff = inciRaw.search(/\[Special Gift\]|\[Original Product\]/i)
  const primary = cutoff > 0 ? inciRaw.slice(0, cutoff) : inciRaw

  const entries: Array<{ name: string; position: number }> = []
  // Split on commas not inside parentheses
  const tokens = primary.split(/,(?![^(]*\))/).map((t) => t.trim()).filter(Boolean)

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    // Strip ppm/% annotations
    const cleaned = token.replace(/\([^)]*?(ppm|%|ppb)[^)]*?\)/gi, '').trim()
    // Split on parenthetical alternates: "Water (Aqua)" → ["Water", "Aqua"]
    const altMatch = cleaned.match(/^(.+?)\s*\((.+?)\)\s*$/)
    if (altMatch) {
      // Only treat as alternate name if the parenthetical doesn't look like a descriptor
      const main = altMatch[1].trim()
      const alt = altMatch[2].trim()
      entries.push({ name: main, position: i + 1 })
      // Add alt as same-position synonym ONLY if it looks like an INCI name
      // (no spaces with descriptor words like "extract", "leaf", etc., is overly
      // restrictive — instead just add it if it has no digits or weird punctuation)
      if (alt && !/[%]/.test(alt) && alt.length < 60) {
        entries.push({ name: alt, position: i + 1 })
      }
    } else {
      entries.push({ name: cleaned, position: i + 1 })
    }
  }

  return entries
}

/**
 * Estimate ingredient concentration from INCI position. INCI ordering is
 * concentration-descending for ingredients ≥1%. Below 1%, order can be
 * arbitrary. The heuristic returns ranges, not exact values.
 *
 * Reference levels (per Blueprint 76 §4 implementation note 5):
 *   - Position 1-3: ~5-15% (often the base + primary actives)
 *   - Position 4-5: ~2-5%   (active ingredient zone)
 *   - Position 6-10: ~0.5-2% (functional / secondary)
 *   - Position 11+: <0.5%   (trace, preservatives, fragrance components)
 */
export function estimateConcentrationFromPosition(position: number): string {
  if (position <= 3) return '5-15%'
  if (position <= 5) return '2-5%'
  if (position <= 10) return '0.5-2%'
  return '<0.5%'
}

// ---------------------------------------------------------------------------
// Constraint checking
// ---------------------------------------------------------------------------

export interface ParsedIngredient {
  name: string
  position: number
}

export interface IngredientMatch {
  ingredient_match: string // The exact INCI string matched (e.g., "Niacinamide")
  ingredient_inci_position: number
  ingredient_concentration_estimate: string
}

/**
 * Check if a substance (with synonyms resolved) appears in a parsed INCI
 * list. Returns the FIRST match with position + concentration estimate.
 *
 * Match strategy: case-insensitive substring match. A token like
 * "Betaine Salicylate" matches the search term "salicylic acid" because
 * "salicylate" appears in the token AND "salicylic acid" is in the synonym
 * list for the BHA family. The synonym expansion is what makes this work.
 *
 * Returns null if no match.
 */
export function findSubstanceInInci(
  parsed: ParsedIngredient[],
  searchTerms: string[]
): IngredientMatch | null {
  const lowerTerms = searchTerms.map((t) => t.toLowerCase())

  for (const ingredient of parsed) {
    const nameLower = ingredient.name.toLowerCase()
    for (const term of lowerTerms) {
      if (!term) continue
      if (nameLower.includes(term)) {
        return {
          ingredient_match: ingredient.name,
          ingredient_inci_position: ingredient.position,
          ingredient_concentration_estimate: estimateConcentrationFromPosition(ingredient.position),
        }
      }
    }
  }

  return null
}

/**
 * Higher-level convenience: given a product's raw INCI string and a substance
 * name (potentially colloquial), return null or a match record.
 *
 * This is the function both BP76 endpoint and Yuri's check_ingredient_conflicts
 * should use as their innermost check.
 */
export function checkSubstanceInProduct(
  inciRaw: string,
  substance: string
): IngredientMatch | null {
  const parsed = parseInciString(inciRaw)
  const { search_terms } = resolveSubstance(substance)
  return findSubstanceInInci(parsed, search_terms)
}
