import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { trackingCreateSchema } from '@/lib/utils/validation'

// Default PAO months by product category when not specified
const DEFAULT_PAO: Record<string, number> = {
  serum: 6,
  ampoule: 6,
  sunscreen: 6,
  mask: 6,
  mist: 6,
  cleanser: 12,
  toner: 12,
  moisturizer: 12,
  essence: 12,
  oil: 12,
  eye_care: 12,
  lip_care: 12,
  exfoliator: 9,
  spot_treatment: 9,
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const { data, error } = await supabase
      .from('ss_user_product_tracking')
      .select(`
        id, user_id, product_id, custom_product_name,
        opened_date, expiry_date, pao_months,
        purchase_date, manufacture_date, batch_code,
        notes, status, created_at, updated_at,
        product:product_id (id, name_en, brand_en, category, image_url, price_usd)
      `)
      .eq('user_id', user.id)
      .order('expiry_date', { ascending: true, nullsFirst: false })

    if (error) throw error

    return NextResponse.json({ tracked_products: data ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const validated = trackingCreateSchema.parse(body)

    let paoMonths = validated.pao_months
    let expiryDate: string | null = null
    const openedDate = validated.opened_date || new Date().toISOString().split('T')[0]

    // If product_id provided, try to get PAO from product record
    if (validated.product_id && !paoMonths) {
      const { data: product } = await supabase
        .from('ss_products')
        .select('pao_months, category')
        .eq('id', validated.product_id)
        .single()

      if (product) {
        paoMonths = product.pao_months || DEFAULT_PAO[product.category] || 12
      }
    }

    // Calculate expiry date from opened_date + PAO
    if (paoMonths) {
      const opened = new Date(openedDate)
      opened.setMonth(opened.getMonth() + paoMonths)
      expiryDate = opened.toISOString().split('T')[0]
    }

    const { data, error } = await supabase
      .from('ss_user_product_tracking')
      .insert({
        user_id: user.id,
        product_id: validated.product_id || null,
        custom_product_name: validated.custom_product_name || null,
        opened_date: openedDate,
        expiry_date: expiryDate,
        pao_months: paoMonths || null,
        purchase_date: validated.purchase_date || null,
        manufacture_date: validated.manufacture_date || null,
        batch_code: validated.batch_code || null,
        notes: validated.notes || null,
        status: 'active',
      })
      .select(`
        id, user_id, product_id, custom_product_name,
        opened_date, expiry_date, pao_months,
        purchase_date, manufacture_date, batch_code,
        notes, status, created_at, updated_at,
        product:product_id (id, name_en, brand_en, category, image_url, price_usd)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ tracked_product: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
