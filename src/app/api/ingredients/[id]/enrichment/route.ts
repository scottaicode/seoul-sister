import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { AppError, handleApiError } from '@/lib/utils/error-handler'

/**
 * GET /api/ingredients/[id]/enrichment
 *
 * Phase 13.G — Subscriber-aware ingredient detail enrichment (v10.6.4).
 *
 * Returns subscriber-context for a specific ingredient. Used by the
 * IngredientEnrichmentSection client component to render a "For You"
 * panel on /ingredients/[slug] pages when the user is authenticated.
 *
 * Unauthenticated requests get a 401 — the component checks auth before
 * fetching, so this should only fire for signed-in users.
 *
 * Data returned (all observational, no recommendations generated):
 *   - products_using: products this user owns or has in active routines
 *     that contain this ingredient
 *   - effectiveness: effectiveness score for this ingredient × user's
 *     skin type from ss_ingredient_effectiveness, if available
 *   - current_phase: user's active treatment phase summary (name, day_in_phase,
 *     watch_for items) — observational data for the user, NOT a recommendation
 *     about whether THIS ingredient fits
 *
 * Yuri Sole Authority Principle: this endpoint returns DATA. The
 * "Ask Yuri" CTA on the page surface (component-side) is the only place
 * that turns this data into recommendations, by routing the user into a
 * Yuri conversation with full context.
 */

interface EnrichmentResponse {
  products_using: Array<{
    product_id: string
    name_en: string
    brand_en: string
    ownership: 'owned' | 'in_routine' | 'both'
  }>
  effectiveness: {
    skin_type: string
    score: number
    concern: string
    sample_size: number
  } | null
  current_phase: {
    id: string
    phase_number: number
    name: string
    days_in_phase: number | null
    watch_for: string[]
  } | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id: ingredientId } = await params

    if (!ingredientId) {
      throw new AppError('Ingredient id required', 400)
    }

    const db = getServiceClient()

    // Run all reads in parallel
    const [profileRes, productsContainingRes, ownedRes, routinesRes, activePhaseRes] = await Promise.all([
      db
        .from('ss_user_profiles')
        .select('skin_type')
        .eq('user_id', user.id)
        .maybeSingle(),
      // All products containing this ingredient — we'll filter by user
      // ownership/routine membership client-side using set intersection
      db
        .from('ss_product_ingredients')
        .select('product_id, ss_products(id, name_en, brand_en)')
        .eq('ingredient_id', ingredientId)
        .limit(500),
      // User's owned products
      db
        .from('ss_user_products')
        .select('product_id')
        .eq('user_id', user.id),
      // User's active routine products
      db
        .from('ss_user_routines')
        .select('id, ss_routine_products(product_id)')
        .eq('user_id', user.id)
        .eq('is_active', true),
      // Active treatment phase
      db
        .from('ss_treatment_phases')
        .select('id, phase_number, name, started_at, watch_for')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
    ])

    const skinType = (profileRes.data?.skin_type as string | null) || null

    // Build product ownership set
    const ownedSet = new Set<string>(
      (ownedRes.data || []).map((r) => r.product_id as string)
    )
    const routineSet = new Set<string>()
    for (const routine of routinesRes.data || []) {
      const rps = (routine as { ss_routine_products?: Array<{ product_id: string | null }> })
        .ss_routine_products
      if (!rps) continue
      for (const rp of rps) {
        if (rp.product_id) routineSet.add(rp.product_id)
      }
    }

    // Build products_using list — intersect "products containing ingredient"
    // with "products user owns or has in active routine".
    // Supabase types ss_products as an array (foreign-key relationships could
    // theoretically return multiple), but for a single-row product relation
    // it's always a single object or null. Cast accordingly.
    const productsUsing: EnrichmentResponse['products_using'] = []
    const productRows = (productsContainingRes.data || []) as unknown as Array<{
      product_id: string
      ss_products: { id: string; name_en: string; brand_en: string } | null
    }>
    const seenProducts = new Set<string>()
    for (const row of productRows) {
      if (!row.ss_products || seenProducts.has(row.product_id)) continue
      const isOwned = ownedSet.has(row.product_id)
      const inRoutine = routineSet.has(row.product_id)
      if (!isOwned && !inRoutine) continue
      seenProducts.add(row.product_id)
      const ownership: 'owned' | 'in_routine' | 'both' =
        isOwned && inRoutine ? 'both' : isOwned ? 'owned' : 'in_routine'
      productsUsing.push({
        product_id: row.product_id,
        name_en: row.ss_products.name_en,
        brand_en: row.ss_products.brand_en,
        ownership,
      })
    }

    // Fetch effectiveness for user's skin type
    let effectiveness: EnrichmentResponse['effectiveness'] = null
    if (skinType) {
      const { data: effRows } = await db
        .from('ss_ingredient_effectiveness')
        .select('skin_type, effectiveness_score, concern, sample_size')
        .eq('ingredient_id', ingredientId)
        .eq('skin_type', skinType)
        .gte('sample_size', 5)
        .order('effectiveness_score', { ascending: false })
        .limit(1)
      if (effRows && effRows.length > 0) {
        effectiveness = {
          skin_type: effRows[0].skin_type as string,
          score: effRows[0].effectiveness_score as number,
          concern: effRows[0].concern as string,
          sample_size: effRows[0].sample_size as number,
        }
      }
    }

    // Build current phase summary if active
    let currentPhase: EnrichmentResponse['current_phase'] = null
    if (activePhaseRes.data) {
      const ap = activePhaseRes.data as {
        id: string
        phase_number: number
        name: string
        started_at: string | null
        watch_for: unknown
      }
      const daysInPhase = ap.started_at
        ? Math.floor((Date.now() - new Date(ap.started_at).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : null
      const watchFor = Array.isArray(ap.watch_for)
        ? (ap.watch_for as unknown[]).map((w) => String(w))
        : []
      currentPhase = {
        id: ap.id,
        phase_number: ap.phase_number,
        name: ap.name,
        days_in_phase: daysInPhase,
        watch_for: watchFor,
      }
    }

    const response: EnrichmentResponse = {
      products_using: productsUsing,
      effectiveness,
      current_phase: currentPhase,
    }

    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error)
  }
}
