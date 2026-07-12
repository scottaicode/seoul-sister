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

/** Longest plausible real INCI name. The longest legit one in the catalog is ~60 chars. */
export const MAX_INCI_NAME_LENGTH = 60

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
  // ingredients: "1,2-Hexanediol", "1,3-Butanediol", "Niacinamide (20,000 ppm)".
  // A digit-comma-digit is never an ingredient boundary. Without this, the
  // catalog's most-linked ingredient (1,2-Hexanediol, 504 links) is split in half.
  const COMMA_SENTINEL = '\u0000'
  cleaned = cleaned.replace(/(\d),(\d)/g, `$1${COMMA_SENTINEL}$2`)

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
  // Only strip a SHORT label ending in ":" — never touch a real name.
  name = name.replace(/^#?\s*[A-Za-z0-9#][\w\s#-]{0,24}:\s*/, '')

  // A shade block can run straight into the next block with no delimiter:
  // "Iron Oxide RedAround: Talc" -> take the part after the label.
  // Detect a lowercase->uppercase seam followed by a label colon.
  const seam = name.match(/^(.*?[a-z])([A-Z][\w\s#-]{0,24}:\s*)(.+)$/)
  if (seam) name = seam[3].trim()

  // Remove leading numbering: "1. Water", "1) Water", "- Water"
  // NOTE: requires a "." or ")" — a bare leading digit must survive, or
  // "1,2-Hexanediol" (the most-linked ingredient in the catalog) is destroyed.
  name = name.replace(/^\d+[\.\)]\s*/, '')
  name = name.replace(/^[-•]\s*/, '')

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
