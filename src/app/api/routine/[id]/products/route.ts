import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { checkRoutineConflicts } from '@/lib/intelligence/conflict-detector'
import { getProductPosition } from '@/lib/intelligence/layering-order'

const addProductSchema = z.object({
  product_id: z.string().uuid(),
  step_order: z.number().int().min(1).optional(),
  frequency: z.enum(['daily', 'every_other_day', 'twice_week', 'weekly']).optional(),
})

// Reorder accepts step_ids (ss_routine_products.id) — the addressing that works
// for EVERY row. product_ids is kept for one release because a cached SPA bundle
// may still send it; it cannot address custom steps (product_id IS NULL), which
// is why those rows were unreorderable and undeletable (July 30 2026).
const reorderSchema = z
  .object({
    step_ids: z.array(z.string().uuid()).min(1).optional(),
    product_ids: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine((v) => !!v.step_ids || !!v.product_ids, {
    message: 'step_ids (preferred) or product_ids is required',
  })

interface RouteContext {
  params: Promise<{ id: string }>
}

/** POST /api/routine/:id/products — Add product to routine */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const supabase = getServiceClient()
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

    // Determine step order: use provided value, or auto-assign based on layering order
    let finalStepOrder = step_order
    if (!finalStepOrder) {
      // Get product category + name for device-aware ordering
      const { data: product } = await supabase
        .from('ss_products')
        .select('category, name_en')
        .eq('id', product_id)
        .single()

      const layeringPosition = product
        ? getProductPosition(product.category, product.name_en)
        : 5

      // Get ALL existing products with their categories and names for proper re-ordering
      const { data: allRoutineProducts } = await supabase
        .from('ss_routine_products')
        .select('id, step_order, product:product_id (category, name_en)')
        .eq('routine_id', routineId)
        .order('step_order', { ascending: true })

      if (allRoutineProducts?.length) {
        // Find the correct insertion point based on layering order.
        // Insert AFTER the last product whose layering position <= new product's position.
        let insertAt = 1
        for (const rp of allRoutineProducts) {
          const rpProduct = rp.product as unknown as { category: string; name_en: string } | null
          const rpPosition = rpProduct
            ? getProductPosition(rpProduct.category, rpProduct.name_en)
            : 5
          if (rpPosition <= layeringPosition) {
            insertAt = rp.step_order + 1
          }
        }
        finalStepOrder = insertAt

        // Shift products at or above the insertion point up by 1
        const toShift = allRoutineProducts.filter((rp) => rp.step_order >= finalStepOrder!)
        for (const rp of toShift.reverse()) {
          await supabase
            .from('ss_routine_products')
            .update({ step_order: rp.step_order + 1 })
            .eq('id', rp.id)
        }
      } else {
        finalStepOrder = 1
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

/**
 * DELETE /api/routine/:id/products?step_id=xxx — Remove a step from the routine.
 *
 * Addressed by the ROW id so custom steps are reachable. Keying on product_id
 * made every product_id IS NULL row (a device, a shower step, a product we don't
 * carry) permanently undeletable — Bailey could not remove her own adapalene
 * step, and the UI had to hide the button rather than call an API that could not
 * express the request. `product_id` is still accepted for one release so a
 * cached client bundle keeps working.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const supabase = getServiceClient()
    const { id: routineId } = await context.params
    const stepId = request.nextUrl.searchParams.get('step_id')
    const productId = request.nextUrl.searchParams.get('product_id')

    if (!stepId && !productId) {
      throw new AppError('step_id (preferred) or product_id query parameter is required', 400)
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

    // Ownership was verified above via routineId; both branches stay scoped to
    // that routine so a step id belonging to someone else cannot be deleted.
    const deleteQuery = supabase.from('ss_routine_products').delete().eq('routine_id', routineId)
    const { error } = stepId
      ? await deleteQuery.eq('id', stepId)
      : await deleteQuery.eq('product_id', productId as string)

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
    const supabase = getServiceClient()
    const { id: routineId } = await context.params
    const body = await request.json()
    const { step_ids, product_ids } = reorderSchema.parse(body)

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

    // step_ids is the full ordered list INCLUDING custom steps, so the resulting
    // step_order is contiguous across the whole routine. The product_ids path
    // renumbers only the catalog rows it was given, which is how a custom step
    // could end up sharing a step_order with a real product — it is kept solely
    // for one release of client-bundle compatibility.
    if (step_ids) {
      for (let i = 0; i < step_ids.length; i++) {
        const { error } = await supabase
          .from('ss_routine_products')
          .update({ step_order: i + 1 })
          .eq('routine_id', routineId)
          .eq('id', step_ids[i])
        if (error) throw error
      }
    } else {
      for (let i = 0; i < (product_ids as string[]).length; i++) {
        await supabase
          .from('ss_routine_products')
          .update({ step_order: i + 1 })
          .eq('routine_id', routineId)
          .eq('product_id', (product_ids as string[])[i])
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
