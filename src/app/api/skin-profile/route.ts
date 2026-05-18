import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { AppError, handleApiError } from '@/lib/utils/error-handler'
import {
  loadCachedSkinBreakdown,
  isSkinBreakdownStale,
  getOrGenerateSkinBreakdown,
} from '@/lib/intelligence/skin-breakdown'

/**
 * GET /api/skin-profile
 *
 * Consolidated read for the /skin-profile page. Returns:
 *   - skinBreakdown: cached Skin Breakdown text + staleness flag
 *   - profile: ss_user_profiles
 *   - phases: ordered ss_treatment_phases (with conversation + photo counts)
 *   - holyGrails / brokeMeOuts: from ss_user_product_reactions
 *   - currentRoutines: active ss_user_routines + step counts
 *
 * Photos are loaded separately via /api/skin-profile/phase-photos so the page
 * can render the rest immediately while photo URLs are being signed.
 *
 * Query params:
 *   regenerate=true — force synchronous regeneration of the Skin Breakdown
 *                     (used when user explicitly hits a "refresh" button)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const url = new URL(request.url)
    const forceRegen = url.searchParams.get('regenerate') === 'true'

    const db = getServiceClient()

    // Run reads in parallel for instant page load
    const [profileRes, phasesRes, reactionsRes, routinesRes, conversationCountRes] = await Promise.all(
      [
        db
          .from('ss_user_profiles')
          .select(
            'skin_type, skin_concerns, fitzpatrick_scale, climate, location_text, age_range, allergies, cycle_tracking_enabled, timezone, onboarding_completed, updated_at'
          )
          .eq('user_id', user.id)
          .maybeSingle(),
        db
          .from('ss_treatment_phases')
          .select(
            'id, phase_number, name, goal, status, started_at, completed_at, protocol, decisions, watch_for, outcomes, last_yuri_update_at'
          )
          .eq('user_id', user.id)
          .order('phase_number', { ascending: true }),
        db
          .from('ss_user_product_reactions')
          .select('product_id, reaction, notes, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(40),
        db
          .from('ss_user_routines')
          .select(
            'id, name, routine_type, is_active, ss_routine_products(id, step_order, product_id, notes, frequency, ss_products(name_en, brand_en))'
          )
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('routine_type', { ascending: true }),
        db
          .from('ss_yuri_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]
    )

    if (profileRes.error) throw new AppError(`profile load: ${profileRes.error.message}`, 500)
    if (phasesRes.error) throw new AppError(`phases load: ${phasesRes.error.message}`, 500)

    const phases = phasesRes.data || []

    // Count Glass Skin photos per phase
    const phaseIds = phases.map((p) => p.id).filter(Boolean)
    let photosByPhase: Record<string, number> = {}
    if (phaseIds.length > 0) {
      const { data: photoCounts } = await db
        .from('ss_glass_skin_scores')
        .select('treatment_phase_id')
        .eq('user_id', user.id)
        .in('treatment_phase_id', phaseIds)
      if (photoCounts) {
        for (const row of photoCounts) {
          if (row.treatment_phase_id) {
            photosByPhase[row.treatment_phase_id] = (photosByPhase[row.treatment_phase_id] || 0) + 1
          }
        }
      }
    }

    // Resolve product names for holy grails / broke-me-outs
    const reactions = reactionsRes.data || []
    const productIds = Array.from(new Set(reactions.map((r) => r.product_id).filter(Boolean)))
    let productNameMap: Record<string, { name: string; brand: string }> = {}
    if (productIds.length > 0) {
      const { data: prods } = await db
        .from('ss_products')
        .select('id, name_en, brand_en')
        .in('id', productIds)
      if (prods) {
        for (const p of prods) {
          productNameMap[p.id] = { name: p.name_en || '', brand: p.brand_en || '' }
        }
      }
    }
    const holyGrails = reactions
      .filter((r) => r.reaction === 'holy_grail' && productNameMap[r.product_id])
      .map((r) => ({
        product_id: r.product_id,
        name: productNameMap[r.product_id].name,
        brand: productNameMap[r.product_id].brand,
        recorded_at: r.created_at,
      }))
    const brokeMeOuts = reactions
      .filter((r) => r.reaction === 'broke_me_out' && productNameMap[r.product_id])
      .map((r) => ({
        product_id: r.product_id,
        name: productNameMap[r.product_id].name,
        brand: productNameMap[r.product_id].brand,
        recorded_at: r.created_at,
      }))

    // Skin Breakdown — try cache first, regenerate if forced or first-time
    let skinBreakdown
    if (forceRegen) {
      skinBreakdown = await getOrGenerateSkinBreakdown(user.id)
    } else {
      const cached = await loadCachedSkinBreakdown(user.id)
      if (cached) {
        // Check staleness — if stale, kick off regen in background so the
        // NEXT page load gets fresh content. Current request returns cached.
        const isStale = await isSkinBreakdownStale(user.id)
        skinBreakdown = { ...cached, isStale }
        if (isStale) {
          // Fire-and-forget regeneration
          getOrGenerateSkinBreakdown(user.id).catch((err) =>
            console.error('[skin-profile] background regen failed:', err)
          )
        }
      } else {
        // First visit — generate synchronously
        const fresh = await getOrGenerateSkinBreakdown(user.id)
        skinBreakdown = { ...fresh, isStale: false }
      }
    }

    return NextResponse.json({
      profile: profileRes.data || null,
      phases: phases.map((p) => ({
        ...p,
        photo_count: photosByPhase[p.id] || 0,
      })),
      skin_breakdown: skinBreakdown,
      holy_grails: holyGrails,
      broke_me_outs: brokeMeOuts,
      current_routines: routinesRes.data || [],
      conversation_count: conversationCountRes.count || 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
