import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { productSearchSchema } from '@/lib/utils/validation'
import { handleApiError } from '@/lib/utils/error-handler'

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
      sort_by: (searchParams.get('sort_by') as 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'trending') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const hasIngredientFilters =
      params.include_ingredients ||
      params.exclude_ingredients ||
      params.fragrance_free ||
      params.comedogenic_max !== undefined

    if (hasIngredientFilters) {
      const result = await handleIngredientFilteredQuery(supabase, params)
      return NextResponse.json(result)
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
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'trending'
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
    query = query.or(`name_en.ilike.%${params.query}%,brand_en.ilike.%${params.query}%`)
  }
  if (params.category) {
    query = query.eq('category', params.category)
  }
  if (params.brand) {
    query = query.ilike('brand_en', `%${params.brand}%`)
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

  return NextResponse.json({
    products: data ?? [],
    total: count ?? 0,
    page: params.page,
    total_pages: Math.ceil((count ?? 0) / params.limit),
  })
}

/**
 * Ingredient-filtered query: fetches candidate products matching basic filters,
 * loads their ingredient links in bulk, then filters client-side by ingredient
 * criteria (include/exclude/fragrance-free/comedogenic max).
 *
 * This approach avoids raw SQL and works with the Supabase JS client.
 * With ~55 products and ~130 ingredient links, the in-memory filtering is fast.
 */
async function handleIngredientFilteredQuery(supabase: SupabaseClient, params: SearchParams) {
  // Step 1: Get candidate product IDs matching basic filters
  let candidateQuery = supabase.from('ss_products').select('id')
  if (params.query) {
    candidateQuery = candidateQuery.or(`name_en.ilike.%${params.query}%,brand_en.ilike.%${params.query}%`)
  }
  if (params.category) {
    candidateQuery = candidateQuery.eq('category', params.category)
  }
  if (params.brand) {
    candidateQuery = candidateQuery.ilike('brand_en', `%${params.brand}%`)
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

  // Step 2: Bulk-fetch ingredient links and ingredient details
  const [piResult, ingResult] = await Promise.all([
    supabase
      .from('ss_product_ingredients')
      .select('product_id, ingredient_id')
      .in('product_id', candidateIds),
    supabase
      .from('ss_ingredients')
      .select('id, name_en, name_inci, is_fragrance, comedogenic_rating'),
  ])

  if (piResult.error) throw piResult.error
  if (ingResult.error) throw ingResult.error

  // Build ingredient lookup
  type IngredientInfo = { name_en: string; name_inci: string; is_fragrance: boolean; comedogenic_rating: number }
  const ingredientMap = new Map<string, IngredientInfo>()
  for (const ing of ingResult.data ?? []) {
    ingredientMap.set(ing.id, ing)
  }

  // Build product -> ingredients mapping
  const productIngredients = new Map<string, IngredientInfo[]>()
  for (const pi of piResult.data ?? []) {
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
