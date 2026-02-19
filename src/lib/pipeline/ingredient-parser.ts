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

  // Split by commas, respecting parentheses and brackets
  const parts = splitByComma(cleaned)

  const ingredients: ParsedIngredient[] = []

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i].trim()
    if (raw.length === 0) continue

    const name = normalizeIngredientName(raw)
    if (name.length === 0) continue

    // Skip entries that are clearly not ingredient names
    if (isNonIngredient(name)) continue

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

  // Remove leading numbering: "1. Water", "1) Water", "- Water"
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
