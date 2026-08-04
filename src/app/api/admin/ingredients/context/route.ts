import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { secureCompare } from '@/lib/utils/secure-compare'
import { sanitizeSearchTerm } from '@/lib/utils/sanitize-search'
import { toSlug } from '@/lib/utils/slug'

const contextSchema = z.object({
  pain_points: z.array(z.string()).optional(),
  skin_types: z.array(z.string()).optional(),
  ingredient_names: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).optional().default(10),
})

/**
 * Pain point → ingredient function/concern mapping.
 * Used to find relevant ingredients when LGAAS provides pain points
 * from Reddit posts or blog topics.
 */
const PAIN_POINT_MAP: Record<string, string[]> = {
  acne: ['exfoliant', 'antibacterial', 'sebum', 'bha', 'salicylic', 'benzoyl', 'acne'],
  breakout: ['exfoliant', 'antibacterial', 'sebum', 'bha', 'salicylic', 'acne'],
  oily: ['sebum', 'mattifying', 'oil control', 'niacinamide', 'oily'],
  dry: ['humectant', 'emollient', 'moisturizing', 'hyaluronic', 'ceramide', 'dry'],
  dehydrated: ['humectant', 'hyaluronic', 'hydrating', 'moisture barrier'],
  wrinkles: ['anti-aging', 'retinol', 'peptide', 'collagen', 'firming', 'wrinkle'],
  'anti-aging': ['anti-aging', 'retinol', 'peptide', 'collagen', 'firming'],
  hyperpigmentation: ['brightening', 'whitening', 'vitamin c', 'arbutin', 'niacinamide', 'tranexamic'],
  'dark spots': ['brightening', 'whitening', 'vitamin c', 'arbutin', 'niacinamide'],
  redness: ['soothing', 'calming', 'centella', 'cica', 'anti-inflammatory', 'sensitive'],
  sensitive: ['soothing', 'calming', 'centella', 'cica', 'gentle', 'sensitive'],
  'sun protection': ['uv filter', 'sunscreen', 'spf', 'antioxidant'],
  pores: ['pore', 'bha', 'niacinamide', 'astringent', 'sebum'],
  barrier: ['ceramide', 'barrier', 'moisturizing', 'cholesterol', 'fatty acid'],
  dull: ['brightening', 'exfoliant', 'aha', 'vitamin c', 'glow'],
  texture: ['exfoliant', 'aha', 'bha', 'retinol', 'smoothing'],
}

/**
 * POST /api/admin/ingredients/context
 *
 * Returns condensed ingredient knowledge for LGAAS content generation.
 * Auth via X-LGAAS-API-Key header (same shared secret as content ingest).
 *
 * Query modes:
 * - By pain_points: maps concerns to ingredient functions/concerns
 * - By skin_types: returns ingredients with good effectiveness for that type
 * - By ingredient_names: direct lookup
 * All modes can be combined. Results are deduplicated and limited.
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || !secureCompare(apiKey, expectedKey)) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    const body = await request.json()
    const params = contextSchema.parse(body)
    const { pain_points, skin_types, ingredient_names, limit } = params

    if (!pain_points?.length && !skin_types?.length && !ingredient_names?.length) {
      throw new AppError('At least one of pain_points, skin_types, or ingredient_names is required', 400)
    }

    const supabase = getServiceClient()
    const seen = new Set<number>()
    const results: IngredientContext[] = []

    // 1. Direct name lookup
    if (ingredient_names?.length) {
      for (const name of ingredient_names.slice(0, 10)) {
        const term = sanitizeSearchTerm(name)

        // `.limit(1)` with NO `.order()` returned an arbitrary substring match:
        // asking for "Niacinamide" produced "Niacinamide (20%)" (13 product
        // links) instead of the canonical "Niacinamide" (2,347), so blog posts
        // linked readers to a niche concentration variant. Same unordered
        // first-match class fixed in ingredients/[slug] on Aug 4 2026.
        //
        // Fetch a window, then rank deliberately: an EXACT name match always
        // wins, otherwise the row carrying the most products — the same
        // "real ingredient vs footnote variant" signal used by the page
        // resolver. `error` is checked so a dead query cannot read as
        // "we have no data for this ingredient".
        const { data, error } = await supabase
          .from('ss_ingredients')
          .select('id, name_inci, name_en, function, description, common_concerns, safety_rating, comedogenic_rating, is_active, rich_content')
          .eq('is_active', true)
          .or(`name_inci.ilike.%${term}%,name_en.ilike.%${term}%`)
          // Order SERVER-SIDE. An unordered .limit(25) is the same defect as
          // the .limit(1) it replaced, just wider: asking for "Niacinamide"
          // fetched 25 arbitrary rows and the real one (2,347 product links)
          // was not among them, so no amount of in-memory ranking could
          // recover it. Shortest name first puts the unqualified canonical row
          // ("Niacinamide") ahead of every "(20,000 ppm)" / "(20%)" variant.
          // In-memory ranking below then decides on product links, which is
          // the signal that actually separates real rows from artifacts.
          .order('name_inci', { ascending: true })
          .limit(40)

        if (error) {
          console.error('[ingredients/context] lookup failed', { name, error: error.message })
          continue
        }

        const candidates = data ?? []
        if (!candidates.length) continue

        // Rank by PRODUCT LINKS, the same "real ingredient vs variant" signal
        // the page resolver uses. A shortest-name tiebreak was tried first and
        // MEASURED WRONG against the live catalog: it picked the Korean-name
        // rows "살리실릭애씨드" (1 link) over "Salicylic Acid" (352) and
        // "판테놀" over Panthenol, because those names are shorter. One
        // batched count keeps this to a single extra query per name.
        const linkCounts = new Map<number, number>()
        const { data: linkRows, error: linkError } = await supabase
          .from('ss_product_ingredients')
          .select('ingredient_id')
          .in('ingredient_id', candidates.map((c) => c.id))

        if (linkError) {
          console.error('[ingredients/context] link count failed', { name, error: linkError.message })
        }
        for (const row of linkRows ?? []) {
          const id = (row as { ingredient_id: number }).ingredient_id
          linkCounts.set(id, (linkCounts.get(id) ?? 0) + 1)
        }

        const lower = name.trim().toLowerCase()
        // An exact name match wins ONLY if the row is substantive. Measured:
        // a stray lowercase "centella asiatica" row with ONE product link was
        // beating "Centella Asiatica Extract" (1,378 links) purely on exact
        // match. A near-zero-link exact match is a data artifact, not the
        // canonical ingredient, so it does not get to override the links
        // signal. 5 is deliberately low — it only excludes artifacts.
        const EXACT_MATCH_MIN_LINKS = 5
        const ranked = candidates.slice().sort((a, b) => {
          const exact = (r: Record<string, unknown>) => {
            const isExact =
              String(r.name_inci ?? '').toLowerCase() === lower ||
              String(r.name_en ?? '').toLowerCase() === lower
            if (!isExact) return 0
            return (linkCounts.get(r.id as number) ?? 0) >= EXACT_MATCH_MIN_LINKS ? 1 : 0
          }
          const byExact = exact(b) - exact(a)
          if (byExact !== 0) return byExact
          // PRODUCT LINKS outrank rich_content. rich_content used to be a hard
          // `.not(...is null)` filter and then a primary sort key; both were
          // measured wrong against the live catalog. It tracks which pages got
          // a generated guide, which is EDITORIAL COVERAGE, not relevance:
          // "Glycerin" carries 4,378 product links and no guide, while the
          // synonym row "Glycerine" carries 279 and has one. Sorting on the
          // guide sent readers to the synonym. Links decide; the guide is only
          // a tiebreak between rows of equal weight.
          const byLinks = (linkCounts.get(b.id) ?? 0) - (linkCounts.get(a.id) ?? 0)
          if (byLinks !== 0) return byLinks
          const rich = (r: Record<string, unknown>) => (r.rich_content ? 1 : 0)
          return rich(b) - rich(a)
        })

        const best = ranked[0]
        if (best && !seen.has(best.id)) {
          seen.add(best.id)
          results.push(toContext(best))
        }
      }
    }

    // 2. Pain point mapping
    if (pain_points?.length && results.length < limit) {
      const searchTerms: string[] = []
      for (const point of pain_points) {
        const mapped = PAIN_POINT_MAP[point.toLowerCase()]
        if (mapped) searchTerms.push(...mapped)
        else searchTerms.push(point.toLowerCase())
      }

      // Search by function and common_concerns fields
      const uniqueTerms = [...new Set(searchTerms)].slice(0, 8)
      for (const term of uniqueTerms) {
        if (results.length >= limit) break
        const { data } = await supabase
          .from('ss_ingredients')
          .select('id, name_inci, name_en, function, description, common_concerns, safety_rating, comedogenic_rating, is_active, rich_content')
          .eq('is_active', true)
          .not('rich_content', 'is', null)
          .or(`function.ilike.%${sanitizeSearchTerm(term)}%,common_concerns.cs.{${sanitizeSearchTerm(term)}}`)
          .limit(3)

        for (const ing of data || []) {
          if (results.length >= limit) break
          if (!seen.has(ing.id)) {
            seen.add(ing.id)
            results.push(toContext(ing))
          }
        }
      }
    }

    // 3. Skin type effectiveness lookup
    if (skin_types?.length && results.length < limit) {
      for (const skinType of skin_types.slice(0, 3)) {
        if (results.length >= limit) break
        const { data } = await supabase
          .from('ss_ingredient_effectiveness')
          .select('ingredient_id, effectiveness_score, concern, ingredient:ss_ingredients!ingredient_id(id, name_inci, name_en, function, description, common_concerns, safety_rating, comedogenic_rating, is_active, rich_content)')
          .eq('skin_type', skinType.toLowerCase())
          .gte('effectiveness_score', 70)
          .not('ingredient.rich_content', 'is', null)
          .order('effectiveness_score', { ascending: false })
          .limit(5)

        for (const row of data || []) {
          if (results.length >= limit) break
          const ing = row.ingredient as unknown as Record<string, unknown> | null
          if (!ing || seen.has(ing.id as number)) continue
          seen.add(ing.id as number)
          results.push(toContext(ing))
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      ingredients: results,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface IngredientContext {
  name: string
  inci_name: string
  /**
   * The AUTHORITATIVE /ingredients/ URL segment for this row.
   *
   * Consumers (LGAAS blog generation) previously had to derive this from a
   * display name, and the derivation is not possible: /ingredients/[slug]
   * resolves on `toSlug(name_inci)` ONLY, and this catalog stores the
   * parenthetical INCI form. So the real page is
   *   /ingredients/melaleuca-alternifolia-tea-tree-leaf-oil
   * while every reasonable guess — `tea-tree-oil`, and even the textbook INCI
   * `melaleuca-alternifolia-leaf-oil` — 404s. Same for `aloe-vera` (the row is
   * "Aloe Barbadensis Leaf Extract") and `vitamin-c` ("Ascorbic Acid").
   *
   * Measured Aug 4 2026: 10 dead ingredient links across 6 of 43 published
   * posts, every one a near-miss on a real ingredient. A prompt rule cannot fix
   * a slug that is not derivable — it has to be SUPPLIED, so we supply it.
   */
  slug: string
  function: string | null
  overview: string | null
  how_it_works: string | null
  skin_types: unknown
  usage_tips: unknown
  safety_rating: string | null
  comedogenic_rating: number | null
}

function toContext(ing: Record<string, unknown>): IngredientContext {
  const rc = ing.rich_content as Record<string, unknown> | null

  return {
    name: (ing.name_en as string) || (ing.name_inci as string),
    inci_name: ing.name_inci as string,
    // Must mirror findIngredientBySlug in src/app/ingredients/[slug]/page.tsx,
    // which matches on toSlug(name_inci). Deriving from name_en would 404.
    slug: toSlug(ing.name_inci as string),
    function: ing.function as string | null,
    overview: rc?.overview ? truncate(rc.overview as string, 300) : null,
    how_it_works: rc?.how_it_works ? truncate(rc.how_it_works as string, 250) : null,
    skin_types: rc?.skin_types || null,
    usage_tips: rc?.usage_tips || null,
    safety_rating: ing.safety_rating as string | null,
    comedogenic_rating: ing.comedogenic_rating as number | null,
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return cut.slice(0, lastSpace > 0 ? lastSpace : max) + '...'
}
