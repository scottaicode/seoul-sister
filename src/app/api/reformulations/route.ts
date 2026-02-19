import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { reformulationReportSchema } from '@/lib/utils/validation'
import { detectReformulation, recordReformulation } from '@/lib/intelligence/reformulation-detector'

/**
 * GET /api/reformulations
 * Returns the authenticated user's reformulation alerts (unseen/undismissed).
 *
 * Query params:
 *  - include_dismissed: "true" to include dismissed alerts
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const includeDismissed = searchParams.get('include_dismissed') === 'true'

    const serviceClient = getServiceClient()
    let query = serviceClient
      .from('ss_user_reformulation_alerts')
      .select(`
        id,
        user_id,
        product_id,
        formulation_history_id,
        seen,
        dismissed,
        created_at,
        product:ss_products(id, name_en, brand_en, image_url, category),
        formulation_history:ss_product_formulation_history(
          id, version_number, change_date, change_type,
          ingredients_added, ingredients_removed, ingredients_reordered,
          change_summary, impact_assessment, detected_by, confirmed
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!includeDismissed) {
      query = query.eq('dismissed', false)
    }

    const { data: alerts, error } = await query

    if (error) throw new AppError('Failed to fetch alerts', 500)

    // Mark unseen alerts as seen
    const unseenIds = (alerts ?? [])
      .filter((a) => !a.seen)
      .map((a) => a.id)

    if (unseenIds.length > 0) {
      await serviceClient
        .from('ss_user_reformulation_alerts')
        .update({ seen: true })
        .in('id', unseenIds)
    }

    return NextResponse.json({ alerts: alerts ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/reformulations
 * Manually report a product reformulation.
 * Used by power users or admin when they notice a formula change.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const validated = reformulationReportSchema.parse(body)

    const serviceClient = getServiceClient()

    // If ingredients provided, run detection; otherwise record directly
    if (validated.ingredients_added.length > 0 || validated.ingredients_removed.length > 0 || validated.ingredients_reordered) {
      const detection = {
        changed: true,
        added: validated.ingredients_added,
        removed: validated.ingredients_removed,
        reordered: validated.ingredients_reordered,
        alerts_created: 0,
      }

      const result = await recordReformulation(
        serviceClient,
        validated.product_id,
        detection,
        'manual'
      )

      return NextResponse.json({
        success: true,
        history_id: result.historyId,
        alerts_created: result.alertsCreated,
      })
    }

    // Minimal manual report (no specific ingredient data)
    const { data: product } = await serviceClient
      .from('ss_products')
      .select('current_formulation_version')
      .eq('id', validated.product_id)
      .single()

    if (!product) throw new AppError('Product not found', 404)

    const newVersion = (product.current_formulation_version ?? 1) + 1

    const { data: history, error } = await serviceClient
      .from('ss_product_formulation_history')
      .insert({
        product_id: validated.product_id,
        version_number: newVersion,
        change_date: validated.change_date ?? new Date().toISOString().split('T')[0],
        change_type: validated.change_type,
        change_summary: validated.change_summary ?? null,
        ingredients_added: [],
        ingredients_removed: [],
        detected_by: 'manual',
        confirmed: true,
      })
      .select('id')
      .single()

    if (error || !history) throw new AppError('Failed to record reformulation', 500)

    await serviceClient
      .from('ss_products')
      .update({
        current_formulation_version: newVersion,
        last_reformulated_at: validated.change_date ?? new Date().toISOString().split('T')[0],
      })
      .eq('id', validated.product_id)

    return NextResponse.json({
      success: true,
      history_id: history.id,
      alerts_created: 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
