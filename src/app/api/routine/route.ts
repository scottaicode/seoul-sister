import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

const createRoutineSchema = z.object({
  name: z.string().min(1).max(100),
  routine_type: z.enum(['am', 'pm', 'weekly']),
})

/** GET /api/routine — List user's routines with products */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const supabase = getServiceClient()

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

    // Cross-reference with ss_user_products for ownership data
    const allProductIds = routines.flatMap((r) =>
      r.products.map((p: Record<string, unknown>) => p.product_id as string)
    ).filter(Boolean)

    let ownershipMap = new Map<string, { custom_name: string | null }>()
    if (allProductIds.length > 0) {
      try {
        const { data: owned } = await supabase
          .from('ss_user_products')
          .select('product_id, custom_name')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('product_id', allProductIds)

        if (owned) {
          ownershipMap = new Map(
            owned.map((o) => [o.product_id, { custom_name: o.custom_name || null }])
          )
        }
      } catch {
        // Non-critical — continue without ownership data
      }
    }

    // Attach ownership data to each product
    const enrichedRoutines = routines.map((r) => ({
      ...r,
      products: r.products.map((p: Record<string, unknown>) => ({
        ...p,
        ownership: ownershipMap.get(p.product_id as string) ?? null,
      })),
    }))

    return NextResponse.json({ routines: enrichedRoutines })
  } catch (error) {
    return handleApiError(error)
  }
}

/** POST /api/routine — Create a new routine */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const supabase = getServiceClient()
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
