/**
 * Phase 9.3 — Ingredient Parser
 *
 * Parses raw INCI (International Nomenclature of Cosmetic Ingredients) strings
 * into structured arrays of ingredient names with position ordering.
 * INCI order corresponds to concentration order (highest first).
 */

export interface ParsedIngredient {
  name_inci: string
  position: number
}

/**
 * Longest plausible real INCI name.
 *
 * Verified against the live catalog (July 12 2026 audit): real names run up to
 * 76 chars — e.g. "Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate
 * Copolymer" (63 chars, 511 product links) and "Drometrizole Trisiloxane
 * Methylene Bis-Benzotriazolyl Tetramethylbutylphenol" (76 chars). The
 * previous value (60) was silently dropping those on ingest and hiding them
 * from the read path. Actual unsplit dumps run to hundreds/thousands of chars,
 * so 100 keeps a wide margin on both sides. If you change this, re-verify with:
 * SELECT name_inci, length(name_inci) FROM ss_ingredients
 * WHERE length(name_inci) > <new value> AND name_inci NOT LIKE '%@%' ...
 */
export const MAX_INCI_NAME_LENGTH = 100

/**
 * True if a parsed name is clearly not a single ingredient but an unsplit INCI
 * dump — the failure that put 6,000-char makeup ingredient lists into
 * ss_ingredients as individual "ingredients" and onto public /ingredients pages.
 *
 * Signals: an "@" delimiter (multi-shade products use it instead of commas),
 * bracketed shade blocks ("[#03 Concealer: ...]"), or a name longer than any
 * real INCI name.
 *
 * NOTE: a comma is deliberately NOT a signal. "1,2-Hexanediol" and
 * concentration-annotated names like "Niacinamide (20,000 ppm)" are legitimate
 * and among the most-linked ingredients in the catalog.
 */
export function isPollutedIngredientName(name: string): boolean {
  return (
    name.includes('@') ||
    name.includes('[') ||
    name.includes(']') ||
    name.length > MAX_INCI_NAME_LENGTH
  )
}

/**
 * Apply the pollution guard to a Supabase query over ss_ingredients so no
 * read path can serve an unsplit INCI dump, even if a bad row slips past the
 * parser again. This is the ONE place the read-side filter lives — every
 * route/tool that lists or searches ss_ingredients must go through it (the
 * July 12 audit found the filter hand-rolled on one route while three other
 * read paths served dump rows).
 *
 * The length guard uses a LIKE pattern of (MAX_INCI_NAME_LENGTH + 1)
 * underscores: in SQL, `_` matches exactly one char, so any longer name
 * matches. Keeping the filter server-side keeps `count` and pagination
 * correct (filtering the fetched page in JS would leave holes).
 *
 * NOTE: distinct from `is_active`, which means "is an active skincare
 * ingredient" (a solvent like 1,2-Hexanediol is legitimately is_active=false).
 */
export function excludePollutedIngredientRows<
  T extends { not(column: string, operator: string, value: string): T },
>(query: T, column = 'name_inci'): T {
  const tooLong = '_'.repeat(MAX_INCI_NAME_LENGTH + 1) + '%'
  return query
    .not(column, 'ilike', '%@%')
    .not(column, 'ilike', '%[%')
    .not(column, 'ilike', '%]%')
    .not(column, 'like', tooLong)
}

/**
 * Parse a raw INCI string into an ordered array of ingredient names.
 *
 * Handles common INCI patterns:
 * - Comma-separated lists
 * - Parenthetical sub-ingredients: "Water (Aqua)"
 * - Slash alternatives: "Fragrance/Parfum"
 * - CI color numbers: "CI 77891"
 * - Concentration annotations: "[+/- ...]"
 * - Nested parentheses for complex ingredients
 */
export function parseInciString(inciString: string): ParsedIngredient[] {
  if (!inciString || inciString.trim().length === 0) {
    return []
  }

  // Pre-clean: normalize whitespace, remove leading/trailing cruft
  let cleaned = inciString
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim()

  // Remove common prefixes like "Ingredients:", "INCI:", "Full Ingredients List:"
  cleaned = cleaned.replace(/^(ingredients\s*:|inci\s*:|full\s+ingredients?\s*(list)?\s*:)/i, '').trim()

  // Remove trailing period if present
  if (cleaned.endsWith('.')) {
    cleaned = cleaned.slice(0, -1).trim()
  }

  // Multi-shade makeup products delimit with "@" instead of commas, and run
  // shade blocks together ("...Caprylyl Glycol[#03 Concealer: Titanium Dioxide").
  // Normalize both into commas BEFORE splitting, or the whole list parses as one
  // giant "ingredient" (the bug that polluted 2,614 rows).
  cleaned = cleaned
    .replace(/@/g, ',')
    // A "[" that opens a shade/variant block ends the previous ingredient.
    .replace(/\[/g, ',')
    .replace(/\]/g, ',')

  // Protect commas that are INSIDE a chemical name rather than separating two
  // ingredients: "1,2-Hexanediol", "1,3-Butanediol", "20,000" (thousands
  // separator). Without this, the catalog's most-linked ingredient
  // (1,2-Hexanediol, 504 links) is split in half.
  //
  // NOT every digit-comma-digit, though -- scraped lists sometimes omit the
  // space after commas, so "PEG-100,1,2-Hexanediol" has a REAL boundary at the
  // first comma (8 live products hit this). Protect only the two shapes that
  // are verifiably in-name:
  //   \d{1,2}-        locant lists: "1,2-", "1,3-", "1,10-"
  //   \d{3}(?!\d)     thousands groups: "20,000 ppm"
  const COMMA_SENTINEL = '\u0000'
  cleaned = cleaned.replace(/(\d),(?=\d{1,2}-|\d{3}(?!\d))/g, `$1${COMMA_SENTINEL}`)

  // Split by commas, respecting parentheses and brackets — then restore the
  // protected in-name commas.
  const parts = splitByComma(cleaned).map((p) =>
    p.split(COMMA_SENTINEL).join(',')
  )

  const ingredients: ParsedIngredient[] = []
  const seen = new Set<string>()

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i].trim()
    if (raw.length === 0) continue

    const name = normalizeIngredientName(raw)
    if (name.length === 0) continue

    // Skip entries that are clearly not ingredient names
    if (isNonIngredient(name)) continue

    // Final guard: if anything still looks like an unsplit dump, drop it rather
    // than create another 6,000-char "ingredient". Better to lose one entry than
    // to poison the ingredient table and the public /ingredients pages.
    if (isPollutedIngredientName(name)) continue

    // A shade list repeats the same ingredients per shade — dedupe within a product.
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    ingredients.push({
      name_inci: name,
      position: ingredients.length + 1,
    })
  }

  return ingredients
}

/**
 * Split a string by commas while respecting parentheses and bracket nesting.
 * "Water (Aqua), Glycerin, Niacinamide" → ["Water (Aqua)", "Glycerin", "Niacinamide"]
 * "[+/- CI 77891, CI 77492]" keeps the bracket group together
 */
function splitByComma(input: string): string[] {
  const parts: string[] = []
  let current = ''
  let parenDepth = 0
  let bracketDepth = 0

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (char === '(') parenDepth++
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
    else if (char === '[') bracketDepth++
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1)

    if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim().length > 0) {
    parts.push(current)
  }

  return parts
}

/**
 * Normalize an ingredient name:
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Preserve parenthetical names: "Water (Aqua)" stays as-is
 * - Strip leading numbers/bullets: "1. Water" → "Water"
 * - Remove asterisks and daggers (organic/fair-trade markers)
 */
function normalizeIngredientName(raw: string): string {
  let name = raw
    .trim()
    .replace(/\s+/g, ' ')

  // Strip a shade/variant label that got glued to the front of an ingredient:
  // "#03 Concealer: Titanium Dioxide" -> "Titanium Dioxide"
  // "As Moon: Calcium Titanium Borosilicate" -> "Calcium Titanium Borosilicate"
  // Only strip a SHORT label ending in ":" — never touch a real name. Two
  // guards protect real names that contain a colon (July 12 audit):
  //  - CI lake pigments: "CI 15850:1" is ONE ingredient (the ":1" is the lake
  //    designation); stripping "CI 15850:" left "1", which then got dropped.
  //  - Any label whose remainder is digits-only is the same shape — keep it.
  const label = name.match(/^#?\s*([A-Za-z0-9#][\w\s#-]{0,24}):\s*(.+)$/)
  if (label && !/^CI\s*\d+$/i.test(label[1].trim()) && !/^\d+$/.test(label[2].trim())) {
    name = label[2].trim()
  }

  // A shade block can run straight into the next block with no delimiter:
  // "Iron Oxide RedAround: Talc" -> take the part after the label.
  // Detect a lowercase->uppercase seam followed by a label colon.
  // Same CI-lake / digits-only-remainder guards as above.
  const seam = name.match(/^(.*?[a-z])([A-Z][\w\s#-]{0,24}):\s*(.+)$/)
  if (seam && !/^CI\s*\d+$/i.test(seam[2].trim()) && !/^\d+$/.test(seam[3].trim())) {
    name = seam[3].trim()
  }

  // Remove leading numbering: "1. Water", "1) Water", "- Water"
  // NOTE: requires a "." or ")" — a bare leading digit must survive, or
  // "1,2-Hexanediol" (the most-linked ingredient in the catalog) is destroyed.
  name = name.replace(/^\d+[\.\)]\s*/, '')
  name = name.replace(/^[-•]\s*/, '')

  // Strip a leading "may contain" marker orphaned by bracket splitting:
  // "[+/- CI 77891, CI 77492]" splits into "+/- CI 77891" + "CI 77492" —
  // keep the colorant, drop the marker. (A bare "+/-" is dropped later by
  // isNonIngredient.)
  name = name.replace(/^\+\/-\s*/, '').trim()

  // Remove organic/certified markers: asterisks, daggers
  name = name.replace(/[*†‡]+/g, '').trim()

  // Remove trailing parenthetical-only entries like "(Aqua)" that got orphaned
  // But keep "Water (Aqua)" — only remove if the entire string is a parenthetical
  if (name.startsWith('(') && name.endsWith(')') && name.length > 2) {
    // This is a sub-ingredient from a split — keep the inner content
    name = name.slice(1, -1).trim()
  }

  // Collapse duplicate spaces again after removals
  name = name.replace(/\s+/g, ' ').trim()

  return name
}

/**
 * Detect entries that aren't actual ingredient names.
 */
function isNonIngredient(name: string): boolean {
  const lower = name.toLowerCase()

  // Too short to be a real ingredient (single letters, numbers)
  if (name.length < 2) return true

  // Common non-ingredient annotations
  const skipPatterns = [
    /^may contain$/i,
    /^\+\/-$/,
    /^and$/i,
    /^or$/i,
    /^with$/i,
    /^contains$/i,
    /^other\s+ingredients?$/i,
    /^inactive\s+ingredients?$/i,
    /^active\s+ingredients?$/i,
    /^\d+(\.\d+)?%$/,  // Pure percentage
  ]

  return skipPatterns.some((pattern) => pattern.test(lower))
}
