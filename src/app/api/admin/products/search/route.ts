import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { secureCompare } from '@/lib/utils/secure-compare'
import { sanitizeSearchTerm } from '@/lib/utils/sanitize-search'

const searchSchema = z.object({
  query: z.string().max(200).optional(),
  categories: z.array(z.string()).optional(),
  skin_types: z.array(z.string()).optional(),
  skin_concerns: z.array(z.string()).optional(),
  price_max: z.number().positive().optional(),
  brands: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).optional().default(10),
  // When true, only return products with a known US price. Defaults to false so
  // ingredient/scent/safety queries can still ground responses in real INCI data
  // for products that lack US pricing (~14% of catalog as of Apr 2026). Price
  // comparison and dupe-finder flows should pass `require_price: true` to keep
  // the previous strict behavior. Implicitly enabled when `price_max` is set.
  require_price: z.boolean().optional().default(false),
  // LGAAS Blueprint 130 — when true, return the COMPLETE mapped INCI list per
  // product instead of the top-15 cap. Used by LGAAS's post-generation
  // ingredient-claim checker, where a claim missing from a truncated list can
  // only ever be an advisory flag; the full list makes verdicts definitive.
  // Default false keeps every existing consumer's payload byte-identical.
  full_inci: z.boolean().optional().default(false),
})

// Relevance over-fetch (Aug 2026). A text query fetches this multiple of the
// caller's limit so ranking happens over a real candidate window instead of a
// rating-ordered prefix. MIN_OVERFETCH keeps small caps usable: LGAAS's
// grounding pre-flight calls with limit 3, and 3*8=24 is too narrow a window for
// a product buried under a dozen rated siblings.
const RELEVANCE_OVERFETCH = 8
const MIN_OVERFETCH = 60

/**
 * Relevance score for a text-query match. HIGHER IS BETTER.
 *
 * Exists because ordering by `rating_avg DESC NULLS LAST` made an EXACT-name
 * match lose to its own siblings whenever the product was unrated — 642 products
 * (10.5% of catalog), 572 of them carrying INCI, 355 with rated siblings able to
 * bury them.
 *
 * That is a safety problem, not a UX one: LGAAS's grounding pre-flight uses
 * small limits, and a product it cannot find yields NO contradiction and NO
 * abstention — silence byte-identical to "checked and clean". It is also how the
 * original Atobarrier work order came to assert a present product was missing.
 *
 * Tiers are separated by wide margins so a lower tier can never sum its way past
 * a higher one. `rating_avg` survives only as a sub-1 tiebreak within a tier —
 * popularity breaks ties, it never decides relevance.
 */
function scoreRelevance(
  product: { name_en: string | null; brand_en: string | null; rating_avg: number | null },
  rawQuery: string,
  terms: string[]
): number {
  const name = (product.name_en || '').toLowerCase().trim()
  const brand = (product.brand_en || '').toLowerCase().trim()
  const q = rawQuery.toLowerCase().trim()
  const haystack = `${brand} ${name}`.trim()

  let score = 0

  // Tier 1 — the whole query IS the product name, or the brand-qualified name
  // ("Aestura Atobarrier 365 Cream" vs name "Atobarrier 365 Cream"). Nothing
  // outranks this.
  if (name === q || haystack === q) score += 10_000
  // Tier 2 — the query is the complete name modulo a leading brand the caller
  // supplied, or vice versa.
  else if (q.endsWith(name) && name.length > 0) score += 5_000
  // Tier 3 — name starts with the query ("Atobarrier 365 Cream" for a query of
  // "Atobarrier 365"). Prefix beats mid-string containment.
  else if (name.startsWith(q)) score += 2_500
  else if (name.includes(q)) score += 1_000

  // Tier 4 — token coverage. Each query term found in the name is worth more
  // than in the brand, since brand terms match every SKU a brand sells and so
  // carry little discriminating power.
  for (const t of terms) {
    const term = t.toLowerCase()
    if (!term) continue
    if (name.includes(term)) score += 100
    else if (brand.includes(term)) score += 25
  }

  // Penalty — extra words beyond the query are how a SIBLING outranks the
  // product. "Atobarrier 365 Cream Mist" and "...Cream Special Set" both
  // contain every term of "Atobarrier 365 Cream"; the shorter, exact one is the
  // intended answer. Capped so a long legitimate name is never pushed below a
  // genuinely worse match.
  const extraChars = Math.max(0, name.length - q.length)
  score -= Math.min(extraChars * 2, 400)

  // Tiebreak ONLY — bounded under 1 so it can never cross a tier boundary.
  score += Math.min(product.rating_avg ?? 0, 5) / 10

  return score
}

// Skin concern → product category mapping (lowercase to match ss_products.category)
const CONCERN_CATEGORY_MAP: Record<string, string[]> = {
  acne: ['cleanser', 'toner', 'serum', 'spot treatment'],
  dry: ['moisturizer', 'essence', 'ampoule'],
  dryness: ['moisturizer', 'essence', 'ampoule'],
  wrinkles: ['serum', 'essence', 'eye care'],
  aging: ['serum', 'essence', 'eye care'],
  hyperpigmentation: ['serum', 'ampoule'],
  'dark spots': ['serum', 'ampoule'],
  redness: ['toner', 'moisturizer', 'essence'],
  sensitive: ['toner', 'moisturizer', 'essence'],
  pores: ['toner', 'serum', 'exfoliator'],
  oily: ['cleanser', 'toner', 'sunscreen'],
  'sun protection': ['sunscreen'],
  'barrier damage': ['moisturizer', 'essence'],
}

/**
 * POST /api/admin/products/search
 *
 * Returns product recommendations for LGAAS content generation.
 * Auth via X-LGAAS-API-Key header (same shared secret as ingredients context).
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || !secureCompare(apiKey, expectedKey)) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    const body = await request.json()
    const params = searchSchema.parse(body)
    const { query, categories, skin_types, skin_concerns, price_max, brands, limit, require_price, full_inci } = params
    // Real INCI labels top out around ~150 entries (longest in-catalog is 112);
    // 200 is an effectively-uncapped ceiling that still bounds a runaway query.
    const inciCap = full_inci ? 200 : 15

    if (!query && !categories?.length && !skin_types?.length && !skin_concerns?.length && !brands?.length) {
      throw new AppError('At least one filter is required', 400)
    }

    const supabase = getServiceClient()

    // Merge explicit categories with concern-derived categories (lowercase to match DB)
    const allCategories = new Set<string>((categories || []).map(c => c.toLowerCase()))
    if (skin_concerns?.length) {
      for (const concern of skin_concerns) {
        const mapped = CONCERN_CATEGORY_MAP[concern.toLowerCase().trim()]
        if (mapped) mapped.forEach(c => allCategories.add(c))
      }
    }

    // Build query
    // Include `id` so we can fetch ingredient lists per product (LGAAS Blueprint 44).
    const selectFields = 'id, name_en, brand_en, category, price_usd, rating_avg, description_en, image_url, sunscreen_type, white_cast, finish'

    // Blueprint 44 follow-up (Gap 3c, Apr 21) — text-query ranking.
    //
    // Previously a multi-word query like "Purito bamboo cream" built an OR
    // of ilike matches across name+brand and ranked results by rating_avg.
    // A highly-rated product matching only ONE word (e.g., Eucerin Volume
    // Lift Night *Cream*) would outrank the actual target product that
    // matched all three words. LGAAS then saw contaminated PRODUCT KNOWLEDGE
    // for Reddit response generation, which left Opus to confabulate
    // ingredients from adjacent SKUs.
    //
    // Fix: two-pass search for multi-word queries.
    //   Pass 1 — AND semantics: require every term to appear in name OR
    //            brand. Best precision when OP writes a real product name.
    //   Pass 2 — OR fallback: if Pass 1 returns zero (typo, close-but-not-
    //            exact casual phrasing), fall back to OR ranking. Preserves
    //            the pre-fix behavior as a safety net.
    //
    // Single-word queries skip Pass 1 (AND == OR for one term).
    const runSearch = async (useAndSemantics: boolean) => {
      let q = supabase.from('ss_products').select(selectFields)

      if (query) {
        const terms = query.trim().split(/\s+/).map(sanitizeSearchTerm).filter(t => t.length > 1)
        if (terms.length > 0) {
          if (useAndSemantics && terms.length >= 2) {
            // AND across terms: each term must appear in name OR brand.
            // PostgREST chains .or() calls as AND-of-OR-groups, so each
            // term becomes its own OR group (match-in-name OR match-in-brand),
            // and all groups must match together.
            for (const t of terms) {
              q = q.or(`name_en.ilike.%${t}%,brand_en.ilike.%${t}%`)
            }
          } else {
            // Original OR semantics — any term matches.
            const nameFilters = terms.map(t => `name_en.ilike.%${t}%`).join(',')
            const brandFilters = terms.map(t => `brand_en.ilike.%${t}%`).join(',')
            q = q.or(`${nameFilters},${brandFilters}`)
          }
        }
      } else {
        // Structured search: categories, skin types (brands handled below, regardless of query)
        if (allCategories.size > 0) {
          q = q.in('category', Array.from(allCategories))
        }
        if (skin_types?.length) {
          q = q.or(skin_types.map(t => `description_en.ilike.%${t}%`).join(','))
        }
      }

      // Blueprint 44 Gap 3b — brands filter is a constraint, not an alternative to query.
      // Previously this lived inside the `else` branch so query+brands silently dropped brands.
      // Now it applies in both modes: with a text query, it narrows the text matches to the
      // requested brand(s); without a text query, it behaves as before.
      if (brands?.length) {
        q = q.or(brands.map(b => `brand_en.ilike.%${b}%`).join(','))
      }

      if (price_max !== undefined) {
        q = q.lte('price_usd', price_max)
      }

      // Only require a known US price when the caller opts in or when a price
      // ceiling was specified (a price ceiling is meaningless without a price).
      // Defaulting to `false` lets ingredient/scent/safety queries reach the
      // ~14% of products that have full INCI data but lack US pricing.
      if (require_price || price_max !== undefined) {
        q = q.not('price_usd', 'is', null)
      }

      // Aug 2026 — for TEXT queries, over-fetch and rank by RELEVANCE in code
      // (see scoreRelevance). Ordering by rating_avg and trimming server-side
      // discarded the right row BEFORE relevance was ever computed: an unrated
      // product sorts last under NULLS LAST, so `"Atobarrier 365 Cream"` at
      // limit 5 returned five siblings and not the product itself. Same shape as
      // the v11.20.0/v11.21.0 resolver bugs — rank, THEN trim.
      //
      // Structured (non-text) searches keep pure rating_avg ordering: with no
      // query string there is no relevance signal, and popularity is the right
      // proxy for "best matches for this category/skin type".
      q = query
        ? q.limit(Math.max(limit * RELEVANCE_OVERFETCH, MIN_OVERFETCH))
        : q.order('rating_avg', { ascending: false, nullsFirst: false }).limit(limit)

      return q
    }

    // Pass 1 — AND semantics for multi-word queries
    let { data: products, error } = await runSearch(true)
    if (error) {
      console.error('Product search error (AND pass):', error)
      throw new AppError('Database query failed', 500)
    }

    // Pass 2 — OR fallback if AND returned empty (typo-tolerance)
    const queryTermCount = query ? query.trim().split(/\s+/).filter(t => t.length > 1).length : 0
    if ((!products || products.length === 0) && queryTermCount >= 2) {
      const fallback = await runSearch(false)
      if (fallback.error) {
        console.error('Product search error (OR fallback):', fallback.error)
        throw new AppError('Database query failed', 500)
      }
      products = fallback.data
    }

    if (error) {
      console.error('Product search error:', error)
      throw new AppError('Database query failed', 500)
    }

    // Rank by relevance, THEN trim to the caller's limit. The DB over-fetched
    // (unordered) for text queries precisely so this ranking sees a real window;
    // trimming server-side by rating_avg is what buried unrated exact matches.
    // Structured searches are already rating-ordered and correctly limited.
    if (query && products && products.length > 0) {
      const terms = query.trim().split(/\s+/).map(sanitizeSearchTerm).filter(t => t.length > 1)
      products = [...products]
        .map(p => ({ p, s: scoreRelevance(p, query, terms) }))
        // Stable, deterministic: ties fall back to name so repeated identical
        // queries cannot return different orderings run to run.
        .sort((a, b) => b.s - a.s || (a.p.name_en || '').localeCompare(b.p.name_en || ''))
        .slice(0, limit)
        .map(x => x.p)
    }

    // Blueprint 44 Gap 3a — batch-fetch ingredient lists for all returned products
    // so LGAAS-style consumers can ground ingredient claims in real data instead of
    // training-knowledge-extending from adjacent SKUs. Top 15 ingredients per product
    // by INCI position (position 1 = highest concentration). Fast single query using
    // PostgREST's .in() over the product ID list; costs one extra round-trip.
    const productIds = (products || []).map(p => p.id).filter(Boolean)
    const ingredientsByProductId = new Map<string, Array<Record<string, unknown>>>()
    if (productIds.length > 0) {
      const { data: pi, error: piError } = await supabase
        .from('ss_product_ingredients')
        .select('product_id, position, ingredient:ss_ingredients(name_inci, name_en, function, is_active, safety_rating)')
        .in('product_id', productIds)
        .order('position')
        .limit(productIds.length * inciCap)
      if (piError) {
        console.warn('Product ingredient fetch failed (non-fatal):', piError.message)
      } else if (pi) {
        // Supabase's typegen infers the embedded `ingredient` relation as an
        // array even for a single-row relationship, so normalize defensively.
        for (const row of pi as unknown as Array<{
          product_id: string
          position: number
          ingredient:
            | { name_inci: string; name_en: string | null; function: string | null; is_active: boolean | null; safety_rating: number | null }
            | Array<{ name_inci: string; name_en: string | null; function: string | null; is_active: boolean | null; safety_rating: number | null }>
            | null
        }>) {
          if (!row.product_id || !row.ingredient) continue
          const ing = Array.isArray(row.ingredient) ? row.ingredient[0] : row.ingredient
          if (!ing) continue
          if (!ingredientsByProductId.has(row.product_id)) {
            ingredientsByProductId.set(row.product_id, [])
          }
          const existing = ingredientsByProductId.get(row.product_id)!
          if (existing.length >= inciCap) continue
          existing.push({
            position: row.position,
            inci_name: ing.name_inci,
            common_name: ing.name_en,
            function: ing.function,
            is_active: ing.is_active,
            safety_rating: ing.safety_rating,
          })
        }
      }
    }

    const formatted = (products || []).map(p => {
      const product: Record<string, unknown> = {
        name: p.name_en,
        brand: p.brand_en,
        category: p.category,
        us_price: p.price_usd,
        rating: p.rating_avg,
        description: p.description_en,
        image_url: p.image_url,
      }
      // Include sunscreen-specific fields when available
      if (p.sunscreen_type) product.sunscreen_type = p.sunscreen_type
      if (p.white_cast) product.white_cast = p.white_cast
      if (p.finish) product.finish = p.finish
      // Blueprint 44 Gap 3a — expose ingredient list (top 15 by INCI position) when
      // available. Empty array if no ingredient linkage exists for this product
      // (not all products in ss_products have been INCI-mapped into
      // ss_product_ingredients yet).
      product.ingredients = ingredientsByProductId.get(p.id) || []
      // BP130 — explicit completeness marker so consumers never have to infer
      // "was this list truncated?" from its length. Only stamped on full_inci
      // requests, keeping the default response shape byte-identical.
      //
      // Aug 2026 — `true` used to be unconditional here, which made a product
      // with NO ingredient linkage (bundles/Sets, un-mapped products) report an
      // EMPTY list as a COMPLETE one. That is the negative-claim failure
      // direction: "free of X" is only confirmable against a complete label, and
      // an empty-but-complete list confirms every such claim vacuously. A missing
      // label must read as missing, never as "contains nothing".
      if (full_inci) {
        product.inci_complete = (product.ingredients as unknown[]).length > 0
      }
      return product
    })

    return NextResponse.json({
      products: formatted,
      total: formatted.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
