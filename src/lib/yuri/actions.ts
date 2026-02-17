import { getServiceClient } from '@/lib/supabase'

/**
 * Yuri can execute actions on behalf of the user during conversations.
 * These actions modify user data (routines, wishlists, alerts).
 */

export type YuriActionType =
  | 'add_to_routine'
  | 'remove_from_routine'
  | 'add_to_wishlist'
  | 'set_price_alert'
  | 'log_reaction'
  | 'search_products'
  | 'check_conflicts'

export interface YuriAction {
  type: YuriActionType
  params: Record<string, unknown>
}

export interface ActionResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

async function addToRoutine(
  userId: string,
  params: { productId: string; routineType: 'am' | 'pm' | 'weekly'; stepOrder?: number }
): Promise<ActionResult> {
  const db = getServiceClient()

  // Find or create the routine
  let { data: routine } = await db
    .from('ss_user_routines')
    .select('id')
    .eq('user_id', userId)
    .eq('routine_type', params.routineType)
    .eq('is_active', true)
    .single()

  if (!routine) {
    const label =
      params.routineType === 'am'
        ? 'Morning Routine'
        : params.routineType === 'pm'
          ? 'Evening Routine'
          : 'Weekly Treatments'

    const { data: newRoutine, error } = await db
      .from('ss_user_routines')
      .insert({
        user_id: userId,
        name: label,
        routine_type: params.routineType,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) return { success: false, message: `Failed to create routine: ${error.message}` }
    routine = newRoutine
  }

  // Get the next step order if not specified
  let stepOrder = params.stepOrder
  if (stepOrder === undefined) {
    const { data: existing } = await db
      .from('ss_routine_products')
      .select('step_order')
      .eq('routine_id', routine.id)
      .order('step_order', { ascending: false })
      .limit(1)

    stepOrder = existing && existing.length > 0 ? existing[0].step_order + 1 : 1
  }

  // Check if product already in routine
  const { data: exists } = await db
    .from('ss_routine_products')
    .select('id')
    .eq('routine_id', routine.id)
    .eq('product_id', params.productId)
    .single()

  if (exists) {
    return { success: false, message: 'This product is already in your routine.' }
  }

  const { error } = await db.from('ss_routine_products').insert({
    routine_id: routine.id,
    product_id: params.productId,
    step_order: stepOrder,
    frequency: 'daily',
  })

  if (error) return { success: false, message: `Failed to add product: ${error.message}` }

  return {
    success: true,
    message: `Added to your ${params.routineType.toUpperCase()} routine at step ${stepOrder}.`,
  }
}

async function addToWishlist(
  userId: string,
  params: { productId: string; targetPrice?: number }
): Promise<ActionResult> {
  const db = getServiceClient()

  const { data: exists } = await db
    .from('ss_user_wishlists')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', params.productId)
    .single()

  if (exists) {
    return { success: false, message: 'This product is already in your wishlist.' }
  }

  const { error } = await db.from('ss_user_wishlists').insert({
    user_id: userId,
    product_id: params.productId,
    price_alert_threshold: params.targetPrice ?? null,
  })

  if (error) return { success: false, message: `Failed to add to wishlist: ${error.message}` }

  return {
    success: true,
    message: params.targetPrice
      ? `Added to wishlist with price alert at $${params.targetPrice}.`
      : 'Added to your wishlist.',
  }
}

async function logReaction(
  userId: string,
  params: {
    productId: string
    reaction: 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'
  }
): Promise<ActionResult> {
  const db = getServiceClient()

  const { error } = await db.from('ss_user_product_reactions').upsert(
    {
      user_id: userId,
      product_id: params.productId,
      reaction: params.reaction,
    },
    { onConflict: 'user_id,product_id' }
  )

  if (error) return { success: false, message: `Failed to log reaction: ${error.message}` }

  const labels: Record<string, string> = {
    holy_grail: 'Holy Grail',
    good: 'Good',
    okay: 'Okay',
    bad: 'Bad',
    broke_me_out: 'Broke Me Out',
  }

  return {
    success: true,
    message: `Logged as "${labels[params.reaction]}". This helps personalize your future recommendations.`,
  }
}

async function searchProducts(
  _userId: string,
  params: { query?: string; category?: string; limit?: number }
): Promise<ActionResult> {
  const db = getServiceClient()

  let query = db
    .from('ss_products')
    .select('id, name_en, brand_en, category, price_usd, rating_avg')

  if (params.query) {
    query = query.or(
      `name_en.ilike.%${params.query}%,brand_en.ilike.%${params.query}%`
    )
  }
  if (params.category) {
    query = query.eq('category', params.category)
  }

  const { data, error } = await query
    .order('rating_avg', { ascending: false })
    .limit(params.limit || 5)

  if (error) return { success: false, message: `Search failed: ${error.message}` }

  return {
    success: true,
    message: `Found ${data.length} products.`,
    data: { products: data },
  }
}

async function checkConflicts(
  _userId: string,
  params: { ingredientIds: string[] }
): Promise<ActionResult> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('ss_ingredient_conflicts')
    .select('*, ingredient_a:ss_ingredients!ingredient_a_id(name_en), ingredient_b:ss_ingredients!ingredient_b_id(name_en)')
    .or(
      params.ingredientIds
        .map((id) => `ingredient_a_id.eq.${id},ingredient_b_id.eq.${id}`)
        .join(',')
    )

  if (error) return { success: false, message: `Conflict check failed: ${error.message}` }

  if (!data || data.length === 0) {
    return { success: true, message: 'No ingredient conflicts detected.', data: { conflicts: [] } }
  }

  return {
    success: true,
    message: `Found ${data.length} potential conflict(s).`,
    data: { conflicts: data },
  }
}

// ---------------------------------------------------------------------------
// Action dispatcher
// ---------------------------------------------------------------------------

export async function executeAction(
  userId: string,
  action: YuriAction
): Promise<ActionResult> {
  switch (action.type) {
    case 'add_to_routine':
      return addToRoutine(userId, action.params as {
        productId: string
        routineType: 'am' | 'pm' | 'weekly'
        stepOrder?: number
      })

    case 'add_to_wishlist':
      return addToWishlist(userId, action.params as {
        productId: string
        targetPrice?: number
      })

    case 'log_reaction':
      return logReaction(userId, action.params as {
        productId: string
        reaction: 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'
      })

    case 'search_products':
      return searchProducts(userId, action.params as {
        query?: string
        category?: string
        limit?: number
      })

    case 'check_conflicts':
      return checkConflicts(userId, action.params as {
        ingredientIds: string[]
      })

    default:
      return { success: false, message: `Unknown action type: ${action.type}` }
  }
}
