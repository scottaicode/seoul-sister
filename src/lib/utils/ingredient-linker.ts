import { toSlug } from './slug'

/**
 * Ingredient linker: scans HTML for known ingredient names and wraps
 * the first occurrence of each in a link to /ingredients/[slug].
 *
 * Only links ingredients that have enriched content (rich_content IS NOT NULL).
 * Case-insensitive matching, first occurrence only per ingredient.
 * Skips text already inside <a> tags.
 */

export interface IngredientLink {
  name: string
  slug: string
  /**
   * Extra prose common-names that resolve to the same encyclopedia page.
   * Hand-curated allowlist only (see ALIAS_MAP) — NEVER substrings of generic
   * tokens like "acid"/"water"/"oil", which would over-link. Matched whole-word.
   */
  aliases?: string[]
}

/**
 * Curated common-name → canonical-ingredient aliases.
 *
 * Blog prose uses friendly names ("cica", "centella", "snail secretion filtrate",
 * "ceramides") that the exact `name_en` matcher misses. Keys are matched
 * case-insensitively against the canonical `name_en` from the encyclopedia; the
 * values are additional whole-word phrases that should link to the SAME page.
 *
 * Discipline: every entry is a specific, unambiguous skincare name. Do NOT add
 * generic fragments ("acid", "extract", "oil", "water", "seed") — those cause
 * the "matching water as an ingredient" over-extraction failure mode.
 */
/**
 * Encyclopedia entries that are also everyday English words. They exist as real
 * ingredient pages, but auto-linking them from prose ("add a little sugar",
 * "honey is soothing", "clay masks") produces noise chips. Skipped from prose
 * auto-linking only — an explicit LGAAS-authored link to one still renders.
 * Matched case-insensitively against the canonical name.
 */
const PROSE_LINK_STOPLIST = new Set(['sugar', 'honey', 'clay'])

const ALIAS_MAP: Record<string, string[]> = {
  'Centella Asiatica Extract': ['centella asiatica', 'centella', 'cica', 'gotu kola'],
  'Snail Mucin': ['snail secretion filtrate', 'snail secretion', 'snail mucin'],
  'Ceramide': ['ceramides'],
  'Ceramide NP': ['ceramides'],
  'Sodium Hyaluronate': ['sodium hyaluronate'],
  'Niacinamide': ['vitamin b3', 'nicotinamide'],
}

/**
 * Scan HTML content and link ingredient mentions to their guide pages.
 *
 * @param html - The rendered HTML string
 * @param ingredients - Map of ingredient display name → slug
 * @returns HTML with first occurrence of each ingredient wrapped in <a>
 */
/**
 * True if any of the given ingredient phrases already appears as the anchor text
 * of an existing /ingredients/ link in `html`. Used to avoid double-linking the
 * same concept when the upstream author linked it under a different slug.
 */
function isConceptAlreadyLinked(html: string, phrases: string[]): boolean {
  const anchorRe = /<a\b[^>]*\bhref=["'][^"']*\/ingredients\/[a-z0-9-]+["'][^>]*>(.*?)<\/a>/gi
  for (const match of html.matchAll(anchorRe)) {
    const text = match[1].replace(/<[^>]+>/g, ' ')
    for (const p of phrases) {
      const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(text)) return true
    }
  }
  return false
}

export function linkIngredients(
  html: string,
  ingredients: IngredientLink[]
): { html: string; linked: string[] } {
  if (!html || !ingredients.length) return { html, linked: [] }

  const linked: string[] = []

  // Sort by name length descending so longer names match first
  // (e.g., "Hyaluronic Acid" before "Acid")
  const sorted = [...ingredients].sort((a, b) => b.name.length - a.name.length)

  let result = html

  for (const { name, slug, aliases } of sorted) {
    if (!name || !slug) continue
    // Skip everyday-word ingredients from prose auto-linking (see stoplist).
    if (PROSE_LINK_STOPLIST.has(name.toLowerCase())) continue

    const variants = Array.from(new Set([name, ...(aliases || [])])).filter(Boolean)

    // Don't add a second link for an ingredient the upstream author already linked.
    // LGAAS-authored links may use a different slug than ours for the same concept
    // (e.g. /ingredients/centella-asiatica vs our centella-asiatica-extract), so
    // dedup by anchor TEXT: if any of this entry's names/aliases already appears as
    // the text of an existing /ingredients/ link, skip — otherwise the chip list
    // would show the same ingredient twice under two slugs.
    if (isConceptAlreadyLinked(result, variants)) continue

    // Build the set of phrases that link to this page: canonical name + curated
    // aliases. Longest-first so multi-word phrases win over their substrings
    // (e.g. "centella asiatica" before "centella"). Regex-escaped.
    const phrases = variants
      .sort((a, b) => b.length - a.length)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    // Match any phrase as a whole word, case-insensitive, but NOT inside an
    // existing <a> tag. Strategy: split HTML into "inside tags" and "text" segments.
    const regex = new RegExp(`\\b(${phrases.join('|')})\\b`, 'i')

    // Process only text nodes (not inside HTML tags or existing links)
    const segments = result.split(/(<a\s[^>]*>.*?<\/a>|<[^>]+>)/gi)
    let found = false

    const processed = segments.map((segment) => {
      // Skip if this is an HTML tag or already a link
      if (found || segment.startsWith('<')) return segment

      const match = segment.match(regex)
      if (match) {
        found = true
        const link = `<a href="/ingredients/${slug}" class="ingredient-link text-amber-400 hover:text-amber-300 underline decoration-amber-400/30 hover:decoration-amber-400 transition-colors">${match[0]}</a>`
        return segment.replace(regex, link)
      }
      return segment
    })

    if (found) {
      result = processed.join('')
      linked.push(name)
    }
  }

  return { html: result, linked }
}

/**
 * Extract "Key Ingredients Mentioned" chips from rendered blog HTML.
 *
 * Scans the FINAL HTML for every anchor pointing at an /ingredients/<slug> page —
 * both links authored upstream by LGAAS in the markdown body AND links added by
 * linkIngredients(). Sourcing chips from linkIngredients()'s `linked` set alone
 * under-counts badly, because LGAAS pre-links most ingredients in the body and
 * the linker deliberately skips text already inside <a> tags (so those never
 * enter `linked`).
 *
 * The display label is the anchor's own text — exactly what the reader sees —
 * so we don't depend on the slug round-tripping through a name_en-keyed map
 * (LGAAS sometimes slugs from INCI, e.g. /ingredients/centella-asiatica).
 *
 * Only surfaces links already present in the HTML, so there is no
 * over-extraction risk (nothing generic like "acid"/"water" gets invented here).
 *
 * @returns Deduped chips (by slug), in first-appearance order.
 */
export function extractIngredientChips(
  html: string
): Array<{ name: string; slug: string }> {
  if (!html) return []

  // Match <a ... href="[.../]ingredients/<slug>" ...>anchor text</a>
  // Accepts relative (/ingredients/...) and absolute (https://…/ingredients/...) hrefs.
  const anchorRe =
    /<a\b[^>]*\bhref=["'][^"']*\/ingredients\/([a-z0-9-]+)["'][^>]*>(.*?)<\/a>/gi

  const bySlug = new Map<string, string>()

  for (const match of html.matchAll(anchorRe)) {
    const slug = match[1]
    // Strip any nested tags from the anchor text, collapse whitespace.
    const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!slug || !text) continue
    if (!bySlug.has(slug)) bySlug.set(slug, text)
  }

  return Array.from(bySlug, ([slug, name]) => ({ name, slug }))
}

/**
 * Build the ingredient link map from a Supabase query result.
 */
export function buildIngredientMap(
  ingredients: Array<{ name_en: string | null; name_inci: string }>
): IngredientLink[] {
  const seen = new Set<string>()
  const links: IngredientLink[] = []

  for (const ing of ingredients) {
    // Prefer English name, fall back to INCI
    const name = ing.name_en || ing.name_inci
    if (!name) continue

    const slug = toSlug(name)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)

    // Attach curated common-name aliases keyed on the canonical English name.
    const aliases = ALIAS_MAP[name]
    links.push(aliases ? { name, slug, aliases } : { name, slug })

    // Also add INCI name if different from English name
    if (ing.name_en && ing.name_inci && ing.name_en !== ing.name_inci) {
      const inciSlug = toSlug(ing.name_inci)
      if (inciSlug && !seen.has(inciSlug)) {
        // Link INCI name to the same slug as English name
        links.push({ name: ing.name_inci, slug })
      }
    }
  }

  return links
}
