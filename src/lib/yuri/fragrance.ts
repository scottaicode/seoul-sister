/**
 * What "without fragrance" means in Yuri's product search (Nov 14 2026).
 *
 * The exclusion filter matched the word a person typed. "fragrance" therefore
 * left in every product that lists it as Parfum, and every product scented with
 * linalool, limonene or an essential oil, which is most of what a person
 * avoiding fragrance is avoiding.
 *
 * Two sources decide, and neither is a hand-written allergen list:
 *   1. `ss_ingredients.is_fragrance`, the table's own flag (744 rows on the day
 *      this was written, including Parfum, linalool, limonene, citronellol,
 *      geraniol, citral, eugenol and coumarin).
 *   2. The ingredient's NAME, for what the flag has not reached: the words
 *      fragrance, parfum, perfume, flavor and aroma, and plant oils named for
 *      the scented part (peel, flower, leaf, wood). Measured: that reaches
 *      dozens of unflagged names, among them chamomile flower oil (46
 *      products) and the tea tree and citrus peel oils.
 * A name that says the fragrance was left OUT ("Synthetic Fragrance and
 * Allergens (Excluded from Final Process)") is not fragrance, whatever its
 * flag says. Twelve sheet masks were being dropped on that row alone.
 *
 * Not covered, and Yuri is not told otherwise: an essential oil named only by
 * its plant (Artemisia Vulgaris Oil, in 97 products, is the known case: its
 * row should be flagged in the table); menthol, camphor and benzyl alcohol (a
 * preservative that also smells); flower WATERS and extracts.
 *
 * No imports, so the test runs this file as it is.
 */

const CORE = new Set(['fragrance', 'fragrances', 'fragranced', 'parfum', 'parfums', 'perfume', 'perfumes', 'scent', 'scents', 'scented', 'unscented'])
const FILLER = new Set(['no', 'not', 'non', 'free', 'added', 'synthetic', 'artificial', 'any', 'all', 'product', 'products', 'without', 'of', 'allergen', 'allergens', 'oil', 'oils'])

/** True when an exclusion term is a person's way of saying "no fragrance". */
export function isFragranceTerm(term: string): boolean {
  const words = term.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return false
  return words.some((w) => CORE.has(w)) && words.every((w) => CORE.has(w) || FILLER.has(w))
}

// "Parfum (free of 26 allergens)" is still parfum, so "free of" and "without" do not count.
const SAYS_LEFT_OUT = /\b(excluded|not added|not included|removed)\b/i
const FRAGRANCE_WORD = /\b(parfum|fragrance|perfume|flavor|flavour|flavoring|flavouring|aroma)\b/i
const SCENTED_PLANT_OIL = /\b(peel|flower|leaf|herb|blossom|petal|bark|wood|needle|rind)\s+oil\b|\bessential oil\b/i

/** Does this ingredient NAME denote fragrance, going by the name alone? */
export function nameSaysFragrance(name: string): boolean {
  if (SAYS_LEFT_OUT.test(name)) return false
  return FRAGRANCE_WORD.test(name) || SCENTED_PLANT_OIL.test(name)
}

/**
 * "fragrance, alcohol" or "perfumes and dyes" as one term is several requests.
 * Split so each part is read on its own.
 */
export function splitExclusionTerms(terms: readonly string[]): string[] {
  return terms
    .flatMap((t) => String(t).split(/\s*(?:,|;|\/|&|\band\b|\bor\b)\s*/i))
    .map((t) => t.trim())
    .filter(Boolean)
}

/** One linked ingredient: the table's flag, corrected by what the name says. */
export function ingredientIsFragrance(name: string, flagged: boolean): boolean {
  if (SAYS_LEFT_OUT.test(name)) return false
  return flagged || nameSaysFragrance(name)
}

/**
 * Does raw INCI text contain fragrance? `flaggedNames` are the lower-cased
 * names of ingredients the table marks as fragrance. Names shorter than 5
 * characters are skipped: as substrings they match unrelated words.
 */
export function rawInciHasFragrance(rawLower: string, flaggedNames: readonly string[]): boolean {
  const parts = rawLower.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)
  if (parts.some(nameSaysFragrance)) return true
  return flaggedNames.some((n) => n.length >= 5 && !SAYS_LEFT_OUT.test(n) && rawLower.includes(n))
}

export interface ExclusionSubject {
  /** Lower-cased names of the linked ingredients; empty when the product has none. */
  names: readonly string[]
  /** True when any linked ingredient counts as fragrance (see ingredientIsFragrance). */
  hasFragrance: boolean
  /** Lower-cased raw INCI text, for a product with no linked ingredients. */
  raw?: string | null
}

/**
 * The whole exclusion decision for one product.
 *   'keep'      nothing asked about was found in a list we could read
 *   'drop'      something asked about was found
 *   'unchecked' there is no ingredient list at all, so it cannot be offered as
 *               "without X" (it used to pass: `!some([])` is true)
 */
export function exclusionVerdict(
  subject: ExclusionSubject,
  otherTermsLower: readonly string[],
  wantsNoFragrance: boolean,
  flaggedNames: readonly string[] = []
): 'keep' | 'drop' | 'unchecked' {
  if (subject.names.length === 0) {
    const raw = subject.raw
    if (!raw) return 'unchecked'
    if (otherTermsLower.some((term) => raw.includes(term))) return 'drop'
    return wantsNoFragrance && rawInciHasFragrance(raw, flaggedNames) ? 'drop' : 'keep'
  }
  if (otherTermsLower.some((term) => subject.names.some((name) => name.includes(term)))) return 'drop'
  return wantsNoFragrance && subject.hasFragrance ? 'drop' : 'keep'
}

/** What Yuri is told whenever a fragrance exclusion ran, so she knows what it covered. */
export const FRAGRANCE_FILTER_NOTE =
  'For "fragrance", products were left out if they list fragrance, parfum, flavor or aroma, a plant oil named for its peel, flower, leaf or wood, or any ingredient our database marks as a fragrance component (linalool and limonene among them).'
