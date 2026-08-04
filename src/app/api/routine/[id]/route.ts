import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { checkAllRoutineConflicts } from '@/lib/intelligence/conflict-detector'

const updateRoutineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/** GET /api/routine/:id — Get single routine with full product details */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const supabase = getServiceClient()
    const { id } = await context.params

    const { data, error } = await supabase
      .from('ss_user_routines')
      .select(`
        id, name, routine_type, is_active, created_at, updated_at,
        ss_routine_products (
          id, step_order, frequency, notes, product_id,
          product:product_id (id, name_en, brand_en, category, image_url, price_usd)
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      throw new AppError('Routine not found', 404)
    }

    const routine = {
      ...data,
      products: ((data.ss_routine_products ?? []) as Array<Record<string, unknown>>)
        .sort((a, b) => (a.step_order as number) - (b.step_order as number)),
    }

    // Optionally check conflicts
    const checkConflicts = request.nextUrl.searchParams.get('check_conflicts')
    let conflicts = null
    // `conflicts: []` means "checked, found none". This records the other case.
    // A bare `catch {}` here previously discarded the throws that
    // checkAllRoutineConflicts raises on a failed query — so the July 30
    // instrumentation was NEUTRALIZED on this path: the library logged to
    // console and the user still saw a routine with no warnings. Instrumenting
    // a library without fixing the swallowing call site ships nothing.
    let conflictCheckFailed = false
    if (checkConflicts === 'true') {
      try {
        const result = await checkAllRoutineConflicts(supabase, id)
        conflicts = result.conflicts
      } catch (conflictError) {
        // Still non-fatal — the routine itself is worth returning — but the
        // client must be able to say "we couldn't check" instead of nothing.
        conflictCheckFailed = true
        console.error('[routine] conflict check failed', {
          routineId: id,
          error: conflictError instanceof Error ? conflictError.message : String(conflictError),
        })
      }
    }

    return NextResponse.json({ routine, conflicts, conflict_check_failed: conflictCheckFailed })
  } catch (error) {
    return handleApiError(error)
  }
}

/** PUT /api/routine/:id — Update routine (name, is_active) */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const supabase = getServiceClient()
    const { id } = await context.params
    const body = await request.json()
    const updates = updateRoutineSchema.parse(body)

    // Verify ownership
    const { data: existing } = await supabase
      .from('ss_user_routines')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      throw new AppError('Routine not found', 404)
    }

    const { data, error } = await supabase
      .from('ss_user_routines')
      .update(updates)
      .eq('id', id)
      .select('id, name, routine_type, is_active, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ routine: data })
  } catch (error) {
    return handleApiError(error)
  }
}

/** DELETE /api/routine/:id — Soft delete (deactivate) routine */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const supabase = getServiceClient()
    const { id } = await context.params

    const { error } = await supabase
      .from('ss_user_routines')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
