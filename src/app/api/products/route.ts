import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/supabase'
import { productSearchSchema } from '@/lib/utils/validation'
import { handleApiError } from '@/lib/utils/error-handler'

/** Escape SQL LIKE/ILIKE wildcard characters to prevent pattern injection */
function sanitizeLikeInput(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Stop-words to strip from multi-term product searches */
const SEARCH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'by', 'with', 'in', 'of', 'to',
  'my', 'me', 'is', 'it', 'do', 'you', 'have', 'this', 'that',
  'product', 'products', 'skincare', 'kbeauty', 'k-beauty', 'korean',
])

/**
 * Smart search: for multi-term queries like "cosrx snail", builds an OR filter
 * matching each term against both name_en and brand_en. For single-term queries,
 * uses standard ilike on both columns.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySmartSearch<T extends { or: (...args: any[]) => any }>(query: T, rawQuery: string): T {
  const cleaned = sanitizeLikeInput(rawQuery.trim())
  const terms = rawQuery.trim().toLowerCase().split(/\s+/)
    .filter(t => t.length > 1 && !SEARCH_STOP_WORDS.has(t))
    .map(t => sanitizeLikeInput(t))

  if (terms.length >= 2) {
    // Multi-term: match ANY term against either column (post-filter ranks best matches)
    const orClauses = terms
      .slice(0, 6)
      .flatMap(t => [`name_en.ilike.%${t}%`, `brand_en.ilike.%${t}%`])
      .join(',')
    return query.or(orClauses)
  }

  // Single term or after stop-word removal
  return query.or(`name_en.ilike.%${cleaned}%,brand_en.ilike.%${cleaned}%`)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = productSearchSchema.parse({
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      min_price: searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined,
      max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
      min_rating: searchParams.get('min_rating') ? Number(searchParams.get('min_rating')) : undefined,
      include_ingredients: searchParams.get('include_ingredients') || undefined,
      exclude_ingredients: searchParams.get('exclude_ingredients') || undefined,
      fragrance_free: searchParams.get('fragrance_free') === 'true' ? true : undefined,
      comedogenic_max: searchParams.get('comedogenic_max') ? Number(searchParams.get('comedogenic_max')) : undefined,
      sort_by: (searchParams.get('sort_by') as SearchParams['sort_by']) || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Soft auth — extract user ID from token if present (for recommended sort)
    let userId: string | null = null
    if (params.sort_by === 'recommended') {
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      if (token) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token)
          userId = user?.id ?? null
        } catch {
          // Auth is non-critical — fall back to rating sort
        }
      }
    }

    const hasIngredientFilters =
      params.include_ingredients ||
      params.exclude_ingredients ||
      params.fragrance_free ||
      params.comedogenic_max !== undefined

    if (hasIngredientFilters) {
      const result = await handleIngredientFilteredQuery(supabase, params)
      return NextResponse.json(result)
    }

    if (params.sort_by === 'recommended' && userId) {
      // Use service client for recommended query — it reads ss_user_profiles
      // and ss_ingredient_effectiveness which are blocked by RLS on the anon
      // client. 7th instance of the recurring anon-client + RLS pattern.
      return handleRecommendedQuery(getServiceClient(), params, userId)
    }

    return handleStandardQuery(supabase, params)
  } catch (error) {
    return handleApiError(error)
  }
}

type SearchParams = {
  query?: string
  category?: string
  brand?: string
  min_price?: number
  max_price?: number
  min_rating?: number
  include_ingredients?: string
  exclude_ingredients?: string
  fragrance_free?: boolean
  comedogenic_max?: number
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'trending' | 'recommended'
  page: number
  limit: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySorting<T extends { order: (...args: any[]) => any }>(query: T, sortBy?: string): T {
  switch (sortBy) {
    case 'price_asc':
      return query.order('price_usd', { ascending: true, nullsFirst: false })
    case 'price_desc':
      return query.order('price_usd', { ascending: false, nullsFirst: false })
    case 'rating':
      return query.order('rating_avg', { ascending: false, nullsFirst: false })
    case 'newest':
      return query.order('created_at', { ascending: false })
    default:
      return query.order('rating_avg', { ascending: false, nullsFirst: false })
  }
}

async function handleStandardQuery(supabase: SupabaseClient, params: SearchParams) {
  let query = supabase.from('ss_products').select('*', { count: 'exact' })

  if (params.query) {
    query = applySmartSearch(query, params.query)
  }
  if (params.category) {
    query = query.eq('category', params.category)
  }
  if (params.brand) {
    query = query.ilike('brand_en', `%${sanitizeLikeInput(params.brand)}%`)
  }
  if (params.min_price !== undefined) {
    query = query.gte('price_usd', params.min_price)
  }
  if (params.max_price !== undefined) {
    query = query.lte('price_usd', params.max_price)
  }
  if (params.min_rating !== undefined) {
    query = query.gte('rating_avg', params.min_rating)
  }

  query = applySorting(query, params.sort_by)

  const offset = (params.page - 1) * params.limit
  query = query.range(offset, offset + params.limit - 1)

  const { data, error, count } = await query

  if (error) throw error

  // Post-filter for multi-term queries: when query has multiple terms spanning
  // brand + product name, the OR filter over-fetches; re-rank best matches first
  let products = data ?? []
  if (params.query && params.query.trim().includes(' ')) {
    const terms = params.query.toLowerCase().split(/\s+/).filter(t => t.length > 1 && !SEARCH_STOP_WORDS.has(t))
    if (terms.length >= 2) {
      products = products.sort((a, b) => {
        const aCombined = `${a.brand_en || ''} ${a.name_en || ''}`.toLowerCase()
        const bCombined = `${b.brand_en || ''} ${b.name_en || ''}`.toLowerCase()
        const aMatches = terms.filter(t => aCombined.includes(t)).length
        const bMatches = terms.filter(t => bCombined.includes(t)).length
        return bMatches - aMatches
      })
    }
  }

  return NextResponse.json({
    products,
    total: count ?? 0,
    page: params.page,
    total_pages: Math.ceil((count ?? 0) / params.limit),
  })
}

/**
 * Recommended sort: scores products by ingredient effectiveness for user's skin type.
 * Fetches candidates, cross-references ss_ingredient_effectiveness, sorts by match score.
 */
async function handleRecommendedQuery(
  supabase: SupabaseClient,
  params: SearchParams,
  userId: string
) {
  // 1. Load user profile
  const { data: profile } = await supabase
    .from('ss_user_profiles')
    .select('skin_type, skin_concerns, allergies')
    .eq('user_id', userId)
    .single()

  if (!profile?.skin_type) {
    // No profile → fall back to rating sort
    return handleStandardQuery(supabase, { ...params, sort_by: 'rating' })
  }

  // 2. Load ingredient effectiveness for this skin type
  const { data: effectiveness } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, concern, effectiveness_score')
    .eq('skin_type', profile.skin_type)
    .gte('effectiveness_score', 0.50)
    .gte('sample_size', 5)
    .order('effectiveness_score', { ascending: false })
    .limit(50)

  const effectiveIngredientIds = effectiveness?.map(e => e.ingredient_id) ?? []
  const effectivenessMap = new Map(
    (effectiveness ?? []).map(e => [e.ingredient_id, e])
  )

  // 3. Get candidate products matching basic filters
  let candidateQuery = supabase.from('ss_products').select('id')
  if (params.query) {
    const q = sanitizeLikeInput(params.query)
    candidateQuery = candidateQuery.or(`name_en.ilike.%${q}%,brand_en.ilike.%${q}%`)
  }
  if (params.category) {
    candidateQuery = candidateQuery.eq('category', params.category)
  }
  if (params.brand) {
    candidateQuery = candidateQuery.ilike('brand_en', `%${sanitizeLikeInput(params.brand)}%`)
  }
  if (params.min_price !== undefined) {
    candidateQuery = candidateQuery.gte('price_usd', params.min_price)
  }
  if (params.max_price !== undefined) {
    candidateQuery = candidateQuery.lte('price_usd', params.max_price)
  }
  if (params.min_rating !== undefined) {
    candidateQuery = candidateQuery.gte('rating_avg', params.min_rating)
  }

  const { data: candidates, error: candError } = await candidateQuery
  if (candError) throw candError

  const candidateIds = (candidates ?? []).map((p: { id: string }) => p.id)
  if (candidateIds.length === 0) {
    return NextResponse.json({ products: [], total: 0, page: params.page, total_pages: 0 })
  }

  // 4. Fetch ingredient links for candidates × effective ingredients
  // Process in batches of 500 to avoid query size limits
  const allLinks: Array<{ product_id: string; ingredient_id: string }> = []
  if (effectiveIngredientIds.length > 0) {
    for (let i = 0; i < candidateIds.length; i += 500) {
      const batch = candidateIds.slice(i, i + 500)
      const { data: links } = await supabase
        .from('ss_product_ingredients')
        .select('product_id, ingredient_id')
        .in('product_id', batch)
        .in('ingredient_id', effectiveIngredientIds)

      if (links) allLinks.push(...links)
    }
  }

  // 5. Load allergen ingredient IDs
  const allergenIngredientIds = new Set<string>()
  if (profile.allergies?.length) {
    const { data: allergenIngs } = await supabase
      .from('ss_ingredients')
      .select('id, name_inci')

    if (allergenIngs) {
      for (const ing of allergenIngs) {
        const inciLower = ing.name_inci?.toLowerCase() ?? ''
        for (const allergy of profile.allergies) {
          if (inciLower.includes(allergy.toLowerCase()) || allergy.toLowerCase().includes(inciLower)) {
            allergenIngredientIds.add(ing.id)
          }
        }
      }
    }
  }

  // Check allergen presence per product
  const productAllergenHits = new Set<string>()
  if (allergenIngredientIds.size > 0) {
    const allergenIdArr = Array.from(allergenIngredientIds)
    for (let i = 0; i < candidateIds.length; i += 500) {
      const batch = candidateIds.slice(i, i + 500)
      const { data: allergenLinks } = await supabase
        .from('ss_product_ingredients')
        .select('product_id')
        .in('product_id', batch)
        .in('ingredient_id', allergenIdArr)

      if (allergenLinks) {
        for (const link of allergenLinks) {
          productAllergenHits.add(link.product_id)
        }
      }
    }
  }

  // 6. Score each product
  const userConcerns = (profile.skin_concerns ?? []).map((c: string) => c.toLowerCase())
  const productScores = new Map<string, number>()

  for (const id of candidateIds) {
    let score = 0

    // Ingredient effectiveness contribution
    const productLinks = allLinks.filter(l => l.product_id === id)
    for (const link of productLinks) {
      const eff = effectivenessMap.get(link.ingredient_id)
      if (eff) {
        score += eff.effectiveness_score
        // Bonus if the ingredient addresses user's stated concerns
        if (userConcerns.some((c: string) => eff.concern.toLowerCase().includes(c) || c.includes(eff.concern.toLowerCase()))) {
          score += 0.2
        }
      }
    }

    // Allergen penalty
    if (productAllergenHits.has(id)) {
      score -= 2.0
    }

    productScores.set(id, score)
  }

  // 7. Sort candidate IDs by score descending
  const sortedIds = [...candidateIds].sort((a, b) => {
    const sa = productScores.get(a) ?? 0
    const sb = productScores.get(b) ?? 0
    return sb - sa
  })

  // 8. Paginate
  const total = sortedIds.length
  const offset = (params.page - 1) * params.limit
  const pageIds = sortedIds.slice(offset, offset + params.limit)

  if (pageIds.length === 0) {
    return NextResponse.json({ products: [], total, page: params.page, total_pages: Math.ceil(total / params.limit) })
  }

  // 9. Fetch full product records for this page
  const { data: products, error: prodError } = await supabase
    .from('ss_products')
    .select('*')
    .in('id', pageIds)

  if (prodError) throw prodError

  // Re-sort products to match our scored order
  const productMap = new Map((products ?? []).map(p => [p.id, p]))
  const ordered = pageIds.map(id => productMap.get(id)).filter(Boolean)

  return NextResponse.json({
    products: ordered,
    total,
    page: params.page,
    total_pages: Math.ceil(total / params.limit),
  })
}

/**
 * Ingredient-filtered query: fetches candidate products matching basic filters,
 * loads their ingredient links in batches (to avoid PostgREST URL length limits),
 * then filters client-side by ingredient criteria (include/exclude/fragrance-free/comedogenic max).
 */
async function handleIngredientFilteredQuery(supabase: SupabaseClient, params: SearchParams) {
  // Step 1: Get candidate product IDs matching basic filters
  let candidateQuery = supabase.from('ss_products').select('id')
  if (params.query) {
    candidateQuery = applySmartSearch(candidateQuery, params.query)
  }
  if (params.category) {
    candidateQuery = candidateQuery.eq('category', params.category)
  }
  if (params.brand) {
    candidateQuery = candidateQuery.ilike('brand_en', `%${sanitizeLikeInput(params.brand)}%`)
  }
  if (params.min_price !== undefined) {
    candidateQuery = candidateQuery.gte('price_usd', params.min_price)
  }
  if (params.max_price !== undefined) {
    candidateQuery = candidateQuery.lte('price_usd', params.max_price)
  }
  if (params.min_rating !== undefined) {
    candidateQuery = candidateQuery.gte('rating_avg', params.min_rating)
  }

  const { data: candidates, error: candError } = await candidateQuery
  if (candError) throw candError

  const candidateIds = (candidates ?? []).map((p: { id: string }) => p.id)
  if (candidateIds.length === 0) {
    return { products: [], total: 0, page: params.page, total_pages: 0 }
  }

  // Step 2: Bulk-fetch ingredient links (batched to avoid URL length limits)
  // and ingredient details in parallel
  const BATCH_SIZE = 500
  const allPiData: Array<{ product_id: string; ingredient_id: string }> = []

  const piBatchFetches = async () => {
    for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
      const batch = candidateIds.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabase
        .from('ss_product_ingredients')
        .select('product_id, ingredient_id')
        .in('product_id', batch)
      if (error) throw error
      if (data) allPiData.push(...data)
    }
  }

  const [ingResult] = await Promise.all([
    supabase
      .from('ss_ingredients')
      .select('id, name_en, name_inci, is_fragrance, comedogenic_rating'),
    piBatchFetches(),
  ])

  if (ingResult.error) throw ingResult.error

  // Build ingredient lookup
  type IngredientInfo = { name_en: string; name_inci: string; is_fragrance: boolean; comedogenic_rating: number }
  const ingredientMap = new Map<string, IngredientInfo>()
  for (const ing of ingResult.data ?? []) {
    ingredientMap.set(ing.id, ing)
  }

  // Build product -> ingredients mapping
  const productIngredients = new Map<string, IngredientInfo[]>()
  for (const pi of allPiData) {
    const ing = ingredientMap.get(pi.ingredient_id)
    if (!ing) continue
    if (!productIngredients.has(pi.product_id)) {
      productIngredients.set(pi.product_id, [])
    }
    productIngredients.get(pi.product_id)!.push(ing)
  }

  // Step 3: Filter by ingredient criteria
  const includeNames = params.include_ingredients
    ? params.include_ingredients.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : []
  const excludeNames = params.exclude_ingredients
    ? params.exclude_ingredients.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : []

  const matchingIds = candidateIds.filter(id => {
    const ings = productIngredients.get(id) ?? []

    // Include: product must contain ALL listed ingredients
    for (const name of includeNames) {
      const found = ings.some(
        i => i.name_en.toLowerCase().includes(name) || i.name_inci.toLowerCase().includes(name)
      )
      if (!found) return false
    }

    // Exclude: product must contain NONE of the listed ingredients
    for (const name of excludeNames) {
      const found = ings.some(
        i => i.name_en.toLowerCase().includes(name) || i.name_inci.toLowerCase().includes(name)
      )
      if (found) return false
    }

    // Fragrance-free
    if (params.fragrance_free && ings.some(i => i.is_fragrance)) {
      return false
    }

    // Comedogenic max
    if (params.comedogenic_max !== undefined && ings.some(i => i.comedogenic_rating > params.comedogenic_max!)) {
      return false
    }

    return true
  })

  const total = matchingIds.length
  if (total === 0) {
    return { products: [], total: 0, page: params.page, total_pages: 0 }
  }

  // Step 4: Fetch full product records for matching IDs with sorting + pagination
  let productQuery = supabase
    .from('ss_products')
    .select('*')
    .in('id', matchingIds)

  productQuery = applySorting(productQuery, params.sort_by)

  const offset = (params.page - 1) * params.limit
  productQuery = productQuery.range(offset, offset + params.limit - 1)

  const { data: products, error: prodError } = await productQuery
  if (prodError) throw prodError

  return {
    products: products ?? [],
    total,
    page: params.page,
    total_pages: Math.ceil(total / params.limit),
  }
}
