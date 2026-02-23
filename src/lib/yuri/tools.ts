import { getServiceClient } from '@/lib/supabase'
import type Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Tool definitions for Yuri's database access
// ---------------------------------------------------------------------------

type ToolDef = Anthropic.Messages.Tool

export const YURI_TOOLS: ToolDef[] = [
  {
    name: 'search_products',
    description:
      'Search the Seoul Sister product database by name, brand, category, or ingredients. Returns matching products with prices and ratings. Use when a user asks about specific products, needs recommendations, or wants to find products matching criteria.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (product name, brand, or keyword)',
        },
        category: {
          type: 'string',
          enum: [
            'cleanser', 'toner', 'essence', 'serum', 'ampoule', 'moisturizer',
            'sunscreen', 'mask', 'exfoliator', 'lip_care', 'eye_care', 'oil',
            'mist', 'spot_treatment',
          ],
          description: 'Filter by product category',
        },
        include_ingredients: {
          type: 'array',
          items: { type: 'string' },
          description: 'Must contain these ingredients',
        },
        exclude_ingredients: {
          type: 'array',
          items: { type: 'string' },
          description: 'Must NOT contain these ingredients',
        },
        max_price_usd: {
          type: 'number',
          description: 'Maximum price in USD',
        },
        min_rating: {
          type: 'number',
          description: 'Minimum average rating (0-5)',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
    },
  },
  {
    name: 'get_product_details',
    description:
      'Get full details for a specific product including all ingredients, prices across retailers, community ratings, and counterfeit markers. Use when a user asks about a specific product by name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        product_name: {
          type: 'string',
          description: 'Product name to search for (if ID not known)',
        },
      },
    },
  },
  {
    name: 'check_ingredient_conflicts',
    description:
      'Check if products or ingredients have known conflicts. Also checks against the user\'s known allergies. Use when a user asks about layering products, combining actives, or safety of ingredient combinations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product UUIDs to check',
        },
        product_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product names to search and check (if IDs not known)',
        },
        ingredient_names: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Individual ingredient names to check against each other or user allergies',
        },
      },
    },
  },
  {
    name: 'get_trending_products',
    description:
      'Get currently trending K-beauty products from Korean sales data (Olive Young bestsellers) and Reddit community mentions. Use when a user asks what\'s trending, popular, or new in K-beauty.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          enum: ['all', 'olive_young', 'reddit'],
          description: 'Filter by trend source',
        },
        category: {
          type: 'string',
          description: 'Filter by product category',
        },
        limit: { type: 'number', description: 'Max results (default 5)' },
        emerging_only: {
          type: 'boolean',
          description:
            'Only show products trending in Korea but not yet known in the US (high gap score)',
        },
      },
    },
  },
  {
    name: 'compare_prices',
    description:
      'Compare prices for a product across all tracked retailers. Shows best deal, savings, and authorized retailer status. Use when a user asks about prices, where to buy, or wants the best deal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        product_name: {
          type: 'string',
          description: 'Product name to search (if ID not known)',
        },
      },
    },
  },
  {
    name: 'get_personalized_match',
    description:
      'Check how well a product matches the current user\'s skin profile. Flags allergens, comedogenic ingredients, and beneficial ingredients for their skin type. Use when a user asks if a product is right for them.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'Product UUID' },
        product_name: {
          type: 'string',
          description: 'Product name to search (if ID not known)',
        },
      },
    },
  },
  {
    name: 'web_search',
    description:
      'Search the web for current K-beauty information, latest product reviews, ingredient research, brand news, or Korean skincare trends. Use when the question requires information more recent than your training data, or when you need to verify current product availability, reformulations, or pricing from sources outside the Seoul Sister database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        focus: {
          type: 'string',
          enum: ['general', 'reddit', 'research', 'news'],
          description: 'Focus area for search results. Use "reddit" to search K-beauty communities, "research" for scientific/dermatological sources, "news" for recent brand news.',
        },
      },
      required: ['query'],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

export async function executeYuriTool(
  toolName: string,
  input: Record<string, unknown>,
  userId: string
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_products':
        return await executeSearchProducts(input, userId)
      case 'get_product_details':
        return await executeGetProductDetails(input)
      case 'check_ingredient_conflicts':
        return await executeCheckIngredientConflicts(input, userId)
      case 'get_trending_products':
        return await executeGetTrendingProducts(input)
      case 'compare_prices':
        return await executeComparePrices(input)
      case 'get_personalized_match':
        return await executeGetPersonalizedMatch(input, userId)
      case 'web_search':
        return await executeWebSearch(input)
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    console.error(`[yuri/tools] Error executing ${toolName}:`, err)
    return JSON.stringify({
      error: `Tool execution failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    })
  }
}

// ---------------------------------------------------------------------------
// Tool: search_products
// ---------------------------------------------------------------------------

async function executeSearchProducts(
  input: Record<string, unknown>,
  _userId: string
): Promise<string> {
  const db = getServiceClient()
  const query = input.query as string | undefined
  const category = input.category as string | undefined
  const includeIngredients = input.include_ingredients as string[] | undefined
  const excludeIngredients = input.exclude_ingredients as string[] | undefined
  const maxPriceUsd = input.max_price_usd as number | undefined
  const minRating = input.min_rating as number | undefined
  const limit = Math.min((input.limit as number) || 5, 10)

  // Base query: products with optional filters
  let dbQuery = db
    .from('ss_products')
    .select('id, name_en, brand_en, category, subcategory, description_en, rating_avg, review_count, price_usd, image_url')
    .eq('is_verified', true)

  if (query) {
    dbQuery = dbQuery.or(
      `name_en.ilike.%${query}%,brand_en.ilike.%${query}%,description_en.ilike.%${query}%`
    )
  }
  if (category) {
    dbQuery = dbQuery.eq('category', category)
  }
  if (minRating) {
    dbQuery = dbQuery.gte('rating_avg', minRating)
  }
  dbQuery = dbQuery.order('rating_avg', { ascending: false, nullsFirst: false })
  dbQuery = dbQuery.limit(limit * 3) // Fetch extra for post-filtering

  const { data: products, error } = await dbQuery
  if (error) return JSON.stringify({ error: error.message })
  if (!products?.length) return JSON.stringify({ products: [], message: 'No products found matching your criteria.' })

  // Post-filter by price if needed
  let filtered = products
  if (maxPriceUsd) {
    // Check product prices table for USD prices
    const productIds = products.map((p: Record<string, unknown>) => p.id as string)
    const { data: prices } = await db
      .from('ss_product_prices')
      .select('product_id, price_usd')
      .in('product_id', productIds)
      .lte('price_usd', maxPriceUsd)
    const affordableIds = new Set(
      (prices || []).map((p: Record<string, unknown>) => p.product_id as string)
    )
    // Also check inline price_usd on product
    filtered = filtered.filter(
      (p: Record<string, unknown>) =>
        affordableIds.has(p.id as string) ||
        (p.price_usd && (p.price_usd as number) <= maxPriceUsd)
    )
  }

  // Post-filter by ingredient include/exclude
  if (includeIngredients?.length || excludeIngredients?.length) {
    const productIds = filtered.map((p: Record<string, unknown>) => p.id as string)
    const { data: ingredientLinks } = await db
      .from('ss_product_ingredients')
      .select('product_id, ingredient:ss_ingredients(name_inci, name_en)')
      .in('product_id', productIds)

    const productIngredientMap = new Map<string, string[]>()
    for (const link of ingredientLinks || []) {
      const pid = (link as Record<string, unknown>).product_id as string
      const ing = (link as Record<string, unknown>).ingredient as Record<string, string> | null
      if (!ing) continue
      const names = productIngredientMap.get(pid) || []
      names.push((ing.name_inci || ing.name_en || '').toLowerCase())
      productIngredientMap.set(pid, names)
    }

    if (includeIngredients?.length) {
      filtered = filtered.filter((p: Record<string, unknown>) => {
        const ings = productIngredientMap.get(p.id as string) || []
        return includeIngredients.every((inc) =>
          ings.some((i) => i.includes(inc.toLowerCase()))
        )
      })
    }
    if (excludeIngredients?.length) {
      filtered = filtered.filter((p: Record<string, unknown>) => {
        const ings = productIngredientMap.get(p.id as string) || []
        return !excludeIngredients.some((exc) =>
          ings.some((i) => i.includes(exc.toLowerCase()))
        )
      })
    }
  }

  // Get prices for final results
  const finalProducts = filtered.slice(0, limit)
  const finalIds = finalProducts.map((p: Record<string, unknown>) => p.id as string)

  const { data: allPrices } = await db
    .from('ss_product_prices')
    .select('product_id, price_usd, retailer:ss_retailers(name)')
    .in('product_id', finalIds)
    .order('price_usd', { ascending: true })

  // Get top active ingredients for each product
  const { data: topIngredients } = await db
    .from('ss_product_ingredients')
    .select('product_id, position, ingredient:ss_ingredients(name_en, is_active)')
    .in('product_id', finalIds)
    .lte('position', 10)
    .order('position', { ascending: true })

  // Build response
  const results = finalProducts.map((p: Record<string, unknown>) => {
    const pid = p.id as string
    const prices = (allPrices || [])
      .filter((pr: Record<string, unknown>) => pr.product_id === pid)
      .map((pr: Record<string, unknown>) => ({
        retailer: (pr.retailer as Record<string, string>)?.name || 'Unknown',
        price_usd: pr.price_usd,
      }))
    const ingredients = (topIngredients || [])
      .filter((i: Record<string, unknown>) => i.product_id === pid)
      .map((i: Record<string, unknown>) => {
        const ing = i.ingredient as Record<string, unknown> | null
        return ing?.name_en || 'Unknown'
      })
      .filter((name: unknown) => name !== 'Unknown')
      .slice(0, 5)

    return {
      id: pid,
      name: p.name_en,
      brand: p.brand_en,
      category: p.category,
      subcategory: p.subcategory,
      description: (p.description_en as string || '').slice(0, 200),
      rating: p.rating_avg,
      review_count: p.review_count,
      prices: prices.length > 0 ? prices : p.price_usd ? [{ retailer: 'Retail', price_usd: p.price_usd }] : [],
      key_ingredients: ingredients,
    }
  })

  return JSON.stringify({ products: results, total_found: filtered.length })
}

// ---------------------------------------------------------------------------
// Tool: get_product_details
// ---------------------------------------------------------------------------

async function executeGetProductDetails(
  input: Record<string, unknown>
): Promise<string> {
  const db = getServiceClient()
  let productId = input.product_id as string | undefined
  const productName = input.product_name as string | undefined

  // Find by name if no ID
  if (!productId && productName) {
    const { data: matches } = await db
      .from('ss_products')
      .select('id, name_en')
      .ilike('name_en', `%${productName}%`)
      .limit(1)
    if (matches?.length) {
      productId = (matches[0] as Record<string, unknown>).id as string
    } else {
      return JSON.stringify({ error: `No product found matching "${productName}"` })
    }
  }
  if (!productId) return JSON.stringify({ error: 'No product_id or product_name provided' })

  // Fetch product, ingredients, prices, reviews summary, counterfeit markers
  const [productRes, ingredientsRes, pricesRes, reviewsRes, markersRes] = await Promise.all([
    db.from('ss_products')
      .select('*')
      .eq('id', productId)
      .single(),
    db.from('ss_product_ingredients')
      .select('position, ingredient:ss_ingredients(name_inci, name_en, function, is_active, safety_rating, comedogenic_rating)')
      .eq('product_id', productId)
      .order('position', { ascending: true })
      .limit(30),
    db.from('ss_product_prices')
      .select('price_usd, url, in_stock, last_checked, retailer:ss_retailers(name, trust_score, is_authorized)')
      .eq('product_id', productId)
      .order('price_usd', { ascending: true }),
    db.from('ss_reviews')
      .select('rating, reaction, skin_type')
      .eq('product_id', productId),
    db.from('ss_counterfeit_markers')
      .select('marker_type, description, severity')
      .or(`brand.ilike.%${productName || ''}%,brand.eq.generic`)
      .limit(5),
  ])

  if (!productRes.data) return JSON.stringify({ error: 'Product not found' })
  const product = productRes.data as Record<string, unknown>

  const ingredients = (ingredientsRes.data || []).map((i: Record<string, unknown>) => {
    const ing = i.ingredient as Record<string, unknown> | null
    return {
      name: ing?.name_en || ing?.name_inci || 'Unknown',
      function: ing?.function,
      is_active: ing?.is_active,
      position: i.position,
    }
  })

  const prices = (pricesRes.data || []).map((p: Record<string, unknown>) => {
    const r = p.retailer as Record<string, unknown> | null
    return {
      retailer: r?.name || 'Unknown',
      price_usd: p.price_usd,
      in_stock: p.in_stock,
      trust_score: r?.trust_score,
      is_authorized: r?.is_authorized,
      url: p.url,
    }
  })

  const reviews = reviewsRes.data || []
  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? Math.round((reviews.reduce((s: number, r: Record<string, unknown>) => s + ((r.rating as number) || 0), 0) / totalReviews) * 10) / 10
    : null
  const holyGrailCount = reviews.filter((r: Record<string, unknown>) => r.reaction === 'holy_grail').length
  const brokeOutCount = reviews.filter((r: Record<string, unknown>) => r.reaction === 'broke_me_out').length

  return JSON.stringify({
    product: {
      id: product.id,
      name: product.name_en,
      brand: product.brand_en,
      category: product.category,
      subcategory: product.subcategory,
      description: product.description_en,
      volume: product.volume_display,
      rating: product.rating_avg,
      review_count: product.review_count,
      spf: product.spf_rating,
      pa_rating: product.pa_rating,
      pao_months: product.pao_months,
    },
    ingredients: ingredients.slice(0, 20),
    prices,
    community: {
      total_reviews: totalReviews,
      avg_rating: avgRating,
      holy_grail_count: holyGrailCount,
      broke_me_out_count: brokeOutCount,
    },
    counterfeit_markers: markersRes.data || [],
  })
}

// ---------------------------------------------------------------------------
// Tool: check_ingredient_conflicts
// ---------------------------------------------------------------------------

async function executeCheckIngredientConflicts(
  input: Record<string, unknown>,
  userId: string
): Promise<string> {
  const db = getServiceClient()
  const productIds = input.product_ids as string[] | undefined
  const productNames = input.product_names as string[] | undefined
  const ingredientNames = input.ingredient_names as string[] | undefined

  // Resolve product names to IDs if needed
  const resolvedIds: string[] = [...(productIds || [])]
  if (productNames?.length) {
    for (const name of productNames) {
      const { data: matches } = await db
        .from('ss_products')
        .select('id')
        .ilike('name_en', `%${name}%`)
        .limit(1)
      if (matches?.length) resolvedIds.push((matches[0] as Record<string, unknown>).id as string)
    }
  }

  // Gather all ingredient names from products
  const allIngredientNames: string[] = [...(ingredientNames || [])]
  const productIngredientSets = new Map<string, string[]>()

  if (resolvedIds.length > 0) {
    const { data: links } = await db
      .from('ss_product_ingredients')
      .select('product_id, ingredient:ss_ingredients(id, name_inci, name_en)')
      .in('product_id', resolvedIds)

    for (const link of links || []) {
      const l = link as Record<string, unknown>
      const pid = l.product_id as string
      const ing = l.ingredient as Record<string, string> | null
      if (!ing) continue
      const set = productIngredientSets.get(pid) || []
      set.push(ing.name_en || ing.name_inci)
      productIngredientSets.set(pid, set)
      allIngredientNames.push((ing.name_en || ing.name_inci).toLowerCase())
    }
  }

  // Check known conflicts from ss_ingredient_conflicts
  const { data: conflicts } = await db
    .from('ss_ingredient_conflicts')
    .select(`
      severity, description, recommendation,
      ingredient_a:ss_ingredients!ingredient_a_id(name_en, name_inci),
      ingredient_b:ss_ingredients!ingredient_b_id(name_en, name_inci)
    `)

  const foundConflicts: Array<{
    ingredient_a: string
    ingredient_b: string
    severity: string
    description: string
    recommendation: string
  }> = []

  const lowerNames = new Set(allIngredientNames.map((n) => n.toLowerCase()))

  for (const conflict of conflicts || []) {
    const c = conflict as Record<string, unknown>
    const a = c.ingredient_a as Record<string, string> | null
    const b = c.ingredient_b as Record<string, string> | null
    if (!a || !b) continue

    const aName = (a.name_en || a.name_inci).toLowerCase()
    const bName = (b.name_en || b.name_inci).toLowerCase()

    if (lowerNames.has(aName) && lowerNames.has(bName)) {
      foundConflicts.push({
        ingredient_a: a.name_en || a.name_inci,
        ingredient_b: b.name_en || b.name_inci,
        severity: c.severity as string,
        description: c.description as string,
        recommendation: c.recommendation as string,
      })
    }
  }

  // Check user allergies
  const { data: profile } = await db
    .from('ss_user_profiles')
    .select('allergies')
    .eq('user_id', userId)
    .maybeSingle()

  const allergyWarnings: string[] = []
  if (profile?.allergies?.length) {
    for (const allergy of profile.allergies as string[]) {
      const allergyLower = allergy.toLowerCase()
      const match = allIngredientNames.find((n) => n.toLowerCase().includes(allergyLower))
      if (match) {
        allergyWarnings.push(`Contains "${match}" — user has listed "${allergy}" as an allergy`)
      }
    }
  }

  return JSON.stringify({
    conflicts: foundConflicts,
    allergy_warnings: allergyWarnings,
    safe: foundConflicts.length === 0 && allergyWarnings.length === 0,
    products_checked: resolvedIds.length,
    ingredients_checked: lowerNames.size,
  })
}

// ---------------------------------------------------------------------------
// Tool: get_trending_products
// ---------------------------------------------------------------------------

async function executeGetTrendingProducts(
  input: Record<string, unknown>
): Promise<string> {
  const db = getServiceClient()
  const source = input.source as string | undefined
  const category = input.category as string | undefined
  const limit = Math.min((input.limit as number) || 5, 15)
  const emergingOnly = input.emerging_only as boolean | undefined

  let query = db
    .from('ss_trending_products')
    .select(`
      trend_score, source, mention_count, sentiment_score,
      rank_position, rank_change, days_on_list, gap_score,
      source_product_name, source_product_brand,
      product:ss_products(id, name_en, brand_en, category, rating_avg)
    `)
    .order('trend_score', { ascending: false })
    .limit(limit)

  if (source && source !== 'all') {
    query = query.eq('source', source)
  }
  if (emergingOnly) {
    query = query.gt('gap_score', 50)
  }

  const { data: trends, error } = await query
  if (error) return JSON.stringify({ error: error.message })

  let results = (trends || []).map((t: Record<string, unknown>) => {
    const product = t.product as Record<string, unknown> | null
    return {
      name: product?.name_en || t.source_product_name || 'Unknown',
      brand: product?.brand_en || t.source_product_brand || 'Unknown',
      category: (product?.category as string) || null,
      trend_score: t.trend_score,
      source: t.source,
      rank_position: t.rank_position,
      rank_change: t.rank_change,
      mention_count: t.mention_count,
      sentiment: t.sentiment_score,
      gap_score: t.gap_score,
      days_on_list: t.days_on_list,
      product_id: product?.id || null,
    }
  })

  // Post-filter by category if needed (through the joined product)
  if (category) {
    results = results.filter(
      (r) => r.category?.toLowerCase() === category.toLowerCase()
    )
  }

  return JSON.stringify({ trending: results })
}

// ---------------------------------------------------------------------------
// Tool: compare_prices
// ---------------------------------------------------------------------------

async function executeComparePrices(
  input: Record<string, unknown>
): Promise<string> {
  const db = getServiceClient()
  let productId = input.product_id as string | undefined
  const productName = input.product_name as string | undefined

  if (!productId && productName) {
    const { data: matches } = await db
      .from('ss_products')
      .select('id, name_en, brand_en')
      .ilike('name_en', `%${productName}%`)
      .limit(1)
    if (matches?.length) {
      productId = (matches[0] as Record<string, unknown>).id as string
    } else {
      return JSON.stringify({ error: `No product found matching "${productName}"` })
    }
  }
  if (!productId) return JSON.stringify({ error: 'No product_id or product_name provided' })

  const { data: prices } = await db
    .from('ss_product_prices')
    .select(`
      price_usd, url, in_stock, last_checked,
      retailer:ss_retailers(name, trust_score, is_authorized, website)
    `)
    .eq('product_id', productId)
    .order('price_usd', { ascending: true })

  if (!prices?.length) {
    return JSON.stringify({
      message: 'No price data available for this product in our database.',
      prices: [],
    })
  }

  const formatted = prices.map((p: Record<string, unknown>) => {
    const r = p.retailer as Record<string, unknown> | null
    return {
      retailer: r?.name || 'Unknown',
      price_usd: p.price_usd,
      in_stock: p.in_stock,
      url: p.url || r?.website || null,
      trust_score: r?.trust_score,
      is_authorized: r?.is_authorized,
      last_checked: p.last_checked,
    }
  })

  const inStockPrices = formatted.filter((p) => p.in_stock)
  const cheapest = inStockPrices[0] || formatted[0]
  const maxPrice = Math.max(...formatted.map((p) => p.price_usd as number))

  return JSON.stringify({
    prices: formatted,
    best_deal: {
      retailer: cheapest.retailer,
      price_usd: cheapest.price_usd,
      savings_pct: maxPrice > (cheapest.price_usd as number)
        ? Math.round(((maxPrice - (cheapest.price_usd as number)) / maxPrice) * 100)
        : 0,
    },
    total_retailers: formatted.length,
  })
}

// ---------------------------------------------------------------------------
// Tool: get_personalized_match
// ---------------------------------------------------------------------------

async function executeGetPersonalizedMatch(
  input: Record<string, unknown>,
  userId: string
): Promise<string> {
  const db = getServiceClient()
  let productId = input.product_id as string | undefined
  const productName = input.product_name as string | undefined

  if (!productId && productName) {
    const { data: matches } = await db
      .from('ss_products')
      .select('id, name_en, brand_en')
      .ilike('name_en', `%${productName}%`)
      .limit(1)
    if (matches?.length) {
      productId = (matches[0] as Record<string, unknown>).id as string
    } else {
      return JSON.stringify({ error: `No product found matching "${productName}"` })
    }
  }
  if (!productId) return JSON.stringify({ error: 'No product_id or product_name provided' })

  // Get user profile
  const { data: profile } = await db
    .from('ss_user_profiles')
    .select('skin_type, skin_concerns, allergies, fitzpatrick_scale')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) {
    return JSON.stringify({
      message: 'No skin profile found. Encourage user to complete their profile for personalized analysis.',
      match: null,
    })
  }

  // Get product ingredients
  const { data: ingredientLinks } = await db
    .from('ss_product_ingredients')
    .select('position, ingredient:ss_ingredients(name_inci, name_en, function, is_active, is_fragrance, safety_rating, comedogenic_rating)')
    .eq('product_id', productId)
    .order('position', { ascending: true })
    .limit(30)

  const warnings: string[] = []
  const benefits: string[] = []
  const ingredientNames: string[] = []

  for (const link of ingredientLinks || []) {
    const l = link as Record<string, unknown>
    const ing = l.ingredient as Record<string, unknown> | null
    if (!ing) continue
    const name = (ing.name_en || ing.name_inci || '') as string
    const nameLower = name.toLowerCase()
    ingredientNames.push(name)

    // Check allergies
    if (profile.allergies?.length) {
      for (const allergy of profile.allergies as string[]) {
        if (nameLower.includes(allergy.toLowerCase())) {
          warnings.push(`⚠️ ALLERGY ALERT: Contains ${name} — matches your allergy: "${allergy}"`)
        }
      }
    }

    // Comedogenic check for oily/combo
    if ((profile.skin_type === 'oily' || profile.skin_type === 'combination') &&
        (ing.comedogenic_rating as number) >= 3) {
      warnings.push(`Contains ${name} (comedogenic rating ${ing.comedogenic_rating}/5) — may clog pores for ${profile.skin_type} skin`)
    }

    // Fragrance check for sensitive
    if (profile.skin_type === 'sensitive' && ing.is_fragrance) {
      warnings.push(`Contains ${name} (fragrance) — may irritate sensitive skin`)
    }

    // Beneficial ingredients based on concerns
    const concernBenefits: Record<string, string[]> = {
      acne: ['salicylic acid', 'niacinamide', 'tea tree', 'zinc', 'centella'],
      aging: ['retinol', 'peptide', 'vitamin c', 'adenosine', 'collagen'],
      hyperpigmentation: ['vitamin c', 'arbutin', 'niacinamide', 'tranexamic acid'],
      dryness: ['hyaluronic acid', 'ceramide', 'squalane', 'panthenol'],
      redness: ['centella', 'madecassoside', 'allantoin', 'cica'],
      pores: ['niacinamide', 'salicylic acid', 'clay', 'bha'],
    }
    if (profile.skin_concerns?.length) {
      for (const concern of profile.skin_concerns as string[]) {
        const helpfulList = concernBenefits[concern.toLowerCase()] || []
        if (helpfulList.some((h) => nameLower.includes(h))) {
          benefits.push(`${name} targets your concern: ${concern}`)
        }
      }
    }
  }

  // Skin type beneficial check
  const skinTypeBenefits: Record<string, string[]> = {
    dry: ['hyaluronic acid', 'ceramide', 'squalane', 'glycerin', 'panthenol'],
    oily: ['niacinamide', 'salicylic acid', 'zinc', 'tea tree'],
    combination: ['niacinamide', 'hyaluronic acid', 'centella'],
    sensitive: ['centella', 'allantoin', 'panthenol', 'madecassoside'],
  }
  const beneficials = skinTypeBenefits[profile.skin_type || ''] || []
  for (const name of ingredientNames) {
    if (beneficials.some((b) => name.toLowerCase().includes(b))) {
      benefits.push(`${name} — beneficial for ${profile.skin_type} skin`)
    }
  }

  return JSON.stringify({
    skin_type: profile.skin_type,
    concerns: profile.skin_concerns,
    allergies: profile.allergies,
    warnings: [...new Set(warnings)],
    benefits: [...new Set(benefits)].slice(0, 8),
    ingredients_analyzed: ingredientNames.length,
    overall: warnings.length === 0 ? 'Good match' : `${warnings.length} warning(s) found`,
  })
}

// ---------------------------------------------------------------------------
// Tool: web_search (Brave Search API)
// ---------------------------------------------------------------------------

// In-memory cache with 1-hour TTL
const webSearchCache = new Map<string, { result: string; expiry: number }>()
const WEB_SEARCH_CACHE_TTL = 60 * 60 * 1000 // 1 hour

// Per-conversation rate limiting: track calls per advisor invocation
// Reset externally by the advisor loop (or use a simple counter here)
let webSearchCallCount = 0
const WEB_SEARCH_MAX_PER_TURN = 3

/** Reset the per-turn web search counter. Called at the start of each advisor response. */
export function resetWebSearchCounter(): void {
  webSearchCallCount = 0
}

async function executeWebSearch(
  input: Record<string, unknown>
): Promise<string> {
  const query = input.query as string | undefined
  const focus = (input.focus as string) || 'general'

  if (!query) {
    return JSON.stringify({ error: 'No search query provided' })
  }

  // Rate limit: max 3 web searches per conversation turn
  if (webSearchCallCount >= WEB_SEARCH_MAX_PER_TURN) {
    return JSON.stringify({
      error: 'Web search limit reached for this response (max 3). Answer with available information.',
    })
  }
  webSearchCallCount++

  // Build the effective query based on focus
  let effectiveQuery = query
  switch (focus) {
    case 'reddit':
      effectiveQuery = `${query} site:reddit.com`
      break
    case 'research':
      effectiveQuery = `${query} (pubmed OR dermatology OR clinical study)`
      break
    case 'news':
      effectiveQuery = `${query} (news OR announcement OR launch)`
      break
    // 'general' — use query as-is
  }

  // Check cache
  const cacheKey = effectiveQuery.toLowerCase().trim()
  const cached = webSearchCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    return cached.result
  }

  // Check for API key
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) {
    return JSON.stringify({
      error: 'Web search is not configured. BRAVE_SEARCH_API_KEY is missing.',
      fallback: 'Answer based on your training knowledge instead.',
    })
  }

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search')
    url.searchParams.set('q', effectiveQuery)
    url.searchParams.set('count', '5')
    url.searchParams.set('safesearch', 'moderate')
    url.searchParams.set('text_decorations', 'false')

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    if (!response.ok) {
      const statusText = response.statusText || response.status
      console.error(`[yuri/tools] Brave Search API error: ${statusText}`)
      return JSON.stringify({
        error: `Web search failed (${statusText}). Answer from your knowledge instead.`,
      })
    }

    const data = await response.json() as {
      web?: {
        results?: Array<{
          title?: string
          url?: string
          description?: string
          age?: string
        }>
      }
    }

    const results = (data.web?.results || []).slice(0, 5).map((r) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
      age: r.age || null,
    }))

    if (results.length === 0) {
      const noResults = JSON.stringify({
        results: [],
        message: 'No web results found for this query.',
      })
      webSearchCache.set(cacheKey, { result: noResults, expiry: Date.now() + WEB_SEARCH_CACHE_TTL })
      return noResults
    }

    const resultJson = JSON.stringify({
      query: effectiveQuery,
      results,
      result_count: results.length,
    })

    // Cache the result
    webSearchCache.set(cacheKey, { result: resultJson, expiry: Date.now() + WEB_SEARCH_CACHE_TTL })

    // Evict expired cache entries periodically (every 20 entries)
    if (webSearchCache.size > 100) {
      const now = Date.now()
      for (const [key, val] of webSearchCache) {
        if (val.expiry < now) webSearchCache.delete(key)
      }
    }

    return resultJson
  } catch (err) {
    console.error('[yuri/tools] Web search error:', err)
    return JSON.stringify({
      error: `Web search failed: ${err instanceof Error ? err.message : 'unknown error'}. Answer from your knowledge instead.`,
    })
  }
}
