import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { checkRoutineConflicts } from '@/lib/intelligence/conflict-detector'
import { getCategoryPosition } from '@/lib/intelligence/layering-order'

const addProductSchema = z.object({
  product_id: z.string().uuid(),
  step_order: z.number().int().min(1).optional(),
  frequency: z.enum(['daily', 'every_other_day', 'twice_week', 'weekly']).optional(),
})

const reorderSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/** POST /api/routine/:id/products — Add product to routine */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const { id: routineId } = await context.params
    const body = await request.json()
    const { product_id, step_order, frequency } = addProductSchema.parse(body)

    // Verify ownership
    const { data: routine } = await supabase
      .from('ss_user_routines')
      .select('id, routine_type')
      .eq('id', routineId)
      .eq('user_id', user.id)
      .single()

    if (!routine) {
      throw new AppError('Routine not found', 404)
    }

    // Check if product is already in this routine
    const { data: existing } = await supabase
      .from('ss_routine_products')
      .select('id')
      .eq('routine_id', routineId)
      .eq('product_id', product_id)
      .maybeSingle()

    if (existing) {
      throw new AppError('Product is already in this routine', 409)
    }

    // Check for ingredient conflicts
    const conflictResult = await checkRoutineConflicts(supabase, routineId, product_id)

    // Determine step order: use provided value, or auto-assign based on category
    let finalStepOrder = step_order
    if (!finalStepOrder) {
      // Get product category for auto-ordering
      const { data: product } = await supabase
        .from('ss_products')
        .select('category')
        .eq('id', product_id)
        .single()

      finalStepOrder = product ? getCategoryPosition(product.category) : 5

      // Shift existing products if needed
      const { data: currentProducts } = await supabase
        .from('ss_routine_products')
        .select('id, step_order')
        .eq('routine_id', routineId)
        .gte('step_order', finalStepOrder)
        .order('step_order', { ascending: false })

      if (currentProducts?.length) {
        // Recalculate: count existing products and place the new one at the end of its position group
        const { data: allProducts } = await supabase
          .from('ss_routine_products')
          .select('step_order')
          .eq('routine_id', routineId)
          .order('step_order', { ascending: true })

        finalStepOrder = (allProducts?.length ?? 0) + 1
      }
    }

    const { data: added, error } = await supabase
      .from('ss_routine_products')
      .insert({
        routine_id: routineId,
        product_id,
        step_order: finalStepOrder,
        frequency: frequency ?? 'daily',
      })
      .select(`
        id, step_order, frequency, notes, product_id,
        product:product_id (id, name_en, brand_en, category, image_url, price_usd)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({
      product: added,
      conflicts: conflictResult.conflicts,
      has_conflicts: !conflictResult.safe,
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

/** DELETE /api/routine/:id/products?product_id=xxx — Remove product from routine */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const { id: routineId } = await context.params
    const productId = request.nextUrl.searchParams.get('product_id')

    if (!productId) {
      throw new AppError('product_id query parameter is required', 400)
    }

    // Verify ownership
    const { data: routine } = await supabase
      .from('ss_user_routines')
      .select('id')
      .eq('id', routineId)
      .eq('user_id', user.id)
      .single()

    if (!routine) {
      throw new AppError('Routine not found', 404)
    }

    const { error } = await supabase
      .from('ss_routine_products')
      .delete()
      .eq('routine_id', routineId)
      .eq('product_id', productId)

    if (error) throw error

    // Re-number remaining products
    const { data: remaining } = await supabase
      .from('ss_routine_products')
      .select('id, step_order')
      .eq('routine_id', routineId)
      .order('step_order', { ascending: true })

    if (remaining) {
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].step_order !== i + 1) {
          await supabase
            .from('ss_routine_products')
            .update({ step_order: i + 1 })
            .eq('id', remaining[i].id)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}

/** PUT /api/routine/:id/products — Reorder products */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const { id: routineId } = await context.params
    const body = await request.json()
    const { product_ids } = reorderSchema.parse(body)

    // Verify ownership
    const { data: routine } = await supabase
      .from('ss_user_routines')
      .select('id')
      .eq('id', routineId)
      .eq('user_id', user.id)
      .single()

    if (!routine) {
      throw new AppError('Routine not found', 404)
    }

    // Update step_order for each product
    for (let i = 0; i < product_ids.length; i++) {
      await supabase
        .from('ss_routine_products')
        .update({ step_order: i + 1 })
        .eq('routine_id', routineId)
        .eq('product_id', product_ids[i])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
