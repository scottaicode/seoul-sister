import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { trackingUpdateSchema } from '@/lib/utils/validation'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    const body = await request.json()
    const validated = trackingUpdateSchema.parse(body)

    // Recalculate expiry_date if opened_date or pao_months changed
    const updates: Record<string, unknown> = { ...validated }

    if (validated.opened_date || validated.pao_months) {
      // Fetch current record to merge changes
      const { data: current } = await supabase
        .from('ss_user_product_tracking')
        .select('opened_date, pao_months')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (current) {
        const openedDate = validated.opened_date || current.opened_date
        const pao = validated.pao_months || current.pao_months

        if (openedDate && pao) {
          const opened = new Date(openedDate)
          opened.setMonth(opened.getMonth() + pao)
          updates.expiry_date = opened.toISOString().split('T')[0]
        }
      }
    }

    const { data, error } = await supabase
      .from('ss_user_product_tracking')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        id, user_id, product_id, custom_product_name,
        opened_date, expiry_date, pao_months,
        purchase_date, manufacture_date, batch_code,
        notes, status, created_at, updated_at,
        product:product_id (id, name_en, brand_en, category, image_url, price_usd)
      `)
      .single()

    if (error) throw error
    if (!data) throw new AppError('Tracked product not found', 404)

    return NextResponse.json({ tracked_product: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id } = await params

    const { error } = await supabase
      .from('ss_user_product_tracking')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
