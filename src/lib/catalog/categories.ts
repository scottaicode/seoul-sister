/**
 * Single source of truth for product categories.
 *
 * WHY THIS EXISTS (Aug 4 2026): the DB category and the /best/ URL slug are
 * NOT derivable from each other, and the mapping is irregular —
 *
 *   mask       -> masks           (regular plural)
 *   lip_care   -> lip-care        (hyphenated, SINGULAR)
 *   eye_care   -> eye-care        (hyphenated, SINGULAR)
 *   oil, mist  -> (no /best/ page exists at all)
 *
 * Before this module the list was duplicated FIVE times: the canonical
 * CategoryMeta in best/[category], a second copy in best/page.tsx, bare slug
 * strings in sitemap.ts, a display-label map in products/[id], and a fifth in
 * products/page.tsx whose `slug` field confusingly held DB values, not slugs.
 *
 * The drift between those copies caused a live 404 on ~860 product pages: the
 * href was built as `label.toLowerCase() + 's'`, which turned the display label
 * "Lip Care" into `/best/lip cares` — an un-slugified space AND a wrong plural.
 * Google saw the site linking to its own dead pages while the real category
 * page received zero internal link equity from the products meant to feed it.
 *
 * Derivation is what broke it. An explicit table is the fix. Add a category
 * HERE and every surface picks it up; never re-derive a slug from a label.
 */

export interface ProductCategory {
  /** Value stored in ss_products.category. */
  dbCategory: string
  /** Human display label. NEVER interpolate this into a URL. */
  label: string
  /**
   * URL segment for /best/[category], or null when no such page exists.
   * Null means: render no link. It does not mean "guess one".
   */
  bestOfSlug: string | null
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { dbCategory: 'cleanser', label: 'Cleanser', bestOfSlug: 'cleansers' },
  { dbCategory: 'toner', label: 'Toner', bestOfSlug: 'toners' },
  { dbCategory: 'essence', label: 'Essence', bestOfSlug: 'essences' },
  { dbCategory: 'serum', label: 'Serum', bestOfSlug: 'serums' },
  { dbCategory: 'ampoule', label: 'Ampoule', bestOfSlug: 'ampoules' },
  { dbCategory: 'moisturizer', label: 'Moisturizer', bestOfSlug: 'moisturizers' },
  { dbCategory: 'sunscreen', label: 'Sunscreen', bestOfSlug: 'sunscreens' },
  { dbCategory: 'mask', label: 'Mask', bestOfSlug: 'masks' },
  { dbCategory: 'exfoliator', label: 'Exfoliator', bestOfSlug: 'exfoliators' },
  { dbCategory: 'eye_care', label: 'Eye Care', bestOfSlug: 'eye-care' },
  { dbCategory: 'lip_care', label: 'Lip Care', bestOfSlug: 'lip-care' },
  { dbCategory: 'spot_treatment', label: 'Spot Treatment', bestOfSlug: 'spot-treatments' },
  // Real catalog categories with no /best/ page. Present so the label is known
  // and the absent slug is EXPLICIT rather than a lookup miss.
  { dbCategory: 'oil', label: 'Oil', bestOfSlug: null },
  { dbCategory: 'mist', label: 'Mist', bestOfSlug: null },
]

/** Display label for a DB category, falling back to the raw value. */
export function categoryLabel(dbCategory: string): string {
  return (
    PRODUCT_CATEGORIES.find((c) => c.dbCategory === dbCategory)?.label ??
    dbCategory
  )
}

/**
 * Canonical /best/ slug for a DB category, or null when no page exists.
 * Callers MUST treat null as "render nothing" — never fabricate a slug.
 */
export function bestOfSlugFor(dbCategory: string): string | null {
  return (
    PRODUCT_CATEGORIES.find((c) => c.dbCategory === dbCategory)?.bestOfSlug ??
    null
  )
}

/** Every /best/ slug that resolves to a real page — the sitemap's source. */
export const BEST_OF_SLUGS: string[] = PRODUCT_CATEGORIES.map(
  (c) => c.bestOfSlug
).filter((s): s is string => s !== null)
