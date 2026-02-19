import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/reformulations/:id
 * Get formulation history for a product.
 * The :id here is the product_id.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params

    const serviceClient = getServiceClient()
    const { data: history, error } = await serviceClient
      .from('ss_product_formulation_history')
      .select('*')
      .eq('product_id', productId)
      .order('version_number', { ascending: false })

    if (error) throw new AppError('Failed to fetch formulation history', 500)

    return NextResponse.json({ history: history ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/reformulations/:id
 * Dismiss a reformulation alert.
 * The :id here is the alert_id.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(request)
    const { id: alertId } = await params

    const serviceClient = getServiceClient()
    const { error } = await serviceClient
      .from('ss_user_reformulation_alerts')
      .update({ dismissed: true })
      .eq('id', alertId)
      .eq('user_id', user.id)

    if (error) throw new AppError('Failed to dismiss alert', 500)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
