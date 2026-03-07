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
}

/**
 * Scan HTML content and link ingredient mentions to their guide pages.
 *
 * @param html - The rendered HTML string
 * @param ingredients - Map of ingredient display name → slug
 * @returns HTML with first occurrence of each ingredient wrapped in <a>
 */
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

  for (const { name, slug } of sorted) {
    if (!name || !slug) continue

    // Escape regex special chars in ingredient name
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Match the ingredient name as a whole word, case-insensitive,
    // but NOT inside an existing <a> tag (check for no < before closing >)
    // Strategy: split HTML into "inside tags" and "text" segments
    const regex = new RegExp(`\\b(${escaped})\\b`, 'i')

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

    links.push({ name, slug })

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
