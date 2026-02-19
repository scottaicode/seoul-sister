import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

const createRoutineSchema = z.object({
  name: z.string().min(1).max(100),
  routine_type: z.enum(['am', 'pm', 'weekly']),
})

/** GET /api/routine — List user's routines with products */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const { data, error } = await supabase
      .from('ss_user_routines')
      .select(`
        id, name, routine_type, is_active, created_at, updated_at,
        ss_routine_products (
          id, step_order, frequency, notes, product_id,
          product:product_id (id, name_en, brand_en, category, image_url, price_usd)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('routine_type', { ascending: true })

    if (error) throw error

    const routines = (data ?? []).map((r) => ({
      ...r,
      products: ((r.ss_routine_products ?? []) as Array<Record<string, unknown>>)
        .sort((a, b) => (a.step_order as number) - (b.step_order as number)),
    }))

    return NextResponse.json({ routines })
  } catch (error) {
    return handleApiError(error)
  }
}

/** POST /api/routine — Create a new routine */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { name, routine_type } = createRoutineSchema.parse(body)

    const { data, error } = await supabase
      .from('ss_user_routines')
      .insert({
        user_id: user.id,
        name,
        routine_type,
        is_active: true,
      })
      .select('id, name, routine_type, is_active, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ routine: { ...data, products: [] } }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
