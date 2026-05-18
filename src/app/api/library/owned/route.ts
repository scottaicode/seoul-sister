import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { AppError, handleApiError } from '@/lib/utils/error-handler'

/**
 * POST /api/library/owned
 *
 * Mark a product as owned. Inserts a row into ss_user_products for the
 * authenticated user. The Library is the only mutation surface for the
 * subscriber's inventory; same table is also written to by the routine
 * builder and scan flow.
 *
 * Body: { product_id?: string; custom_name?: string; custom_brand?: string;
 *         category?: string; notes?: string; learned_from?: string }
 *
 * At least one of product_id or custom_name must be present.
 */
const postSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    custom_name: z.string().min(1).max(200).optional(),
    custom_brand: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(50).optional(),
    notes: z.string().max(1000).optional(),
    learned_from: z.string().max(100).optional(),
  })
  .refine((data) => Boolean(data.product_id) || Boolean(data.custom_name), {
    message: 'Either product_id or custom_name is required',
  })

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const parsed = postSchema.parse(body)

    const db = getServiceClient()

    // If product_id provided, prevent duplicates for the same user
    if (parsed.product_id) {
      const existing = await db
        .from('ss_user_products')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', parsed.product_id)
        .eq('status', 'active')
        .maybeSingle()
      if (existing.data) {
        return NextResponse.json(
          { error: 'Product already in your collection', id: existing.data.id },
          { status: 409 }
        )
      }
    }

    const insert = await db
      .from('ss_user_products')
      .insert({
        user_id: user.id,
        product_id: parsed.product_id || null,
        custom_name: parsed.custom_name || null,
        custom_brand: parsed.custom_brand || null,
        category: parsed.category || null,
        notes: parsed.notes || null,
        status: 'active',
        learned_from: parsed.learned_from || 'library_manual_add',
      })
      .select('id')
      .single()

    if (insert.error) {
      throw new AppError(`Insert failed: ${insert.error.message}`, 500)
    }

    return NextResponse.json({ success: true, id: insert.data.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Invalid input' }, { status: 400 })
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/library/owned?id=<uuid>
 *
 * Remove a product from the subscriber's collection. Ownership is verified
 * (user_id must match). Does NOT cascade to routines or reactions — those
 * are separate concerns. Soft delete via status='discarded' to preserve
 * history rather than hard delete.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      throw new AppError('Missing id query param', 400)
    }

    const db = getServiceClient()

    // Verify ownership before deletion
    const row = await db
      .from('ss_user_products')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (!row.data) {
      throw new AppError('Not found', 404)
    }
    if (row.data.user_id !== user.id) {
      throw new AppError('Not authorized to remove this item', 403)
    }

    const update = await db
      .from('ss_user_products')
      .update({ status: 'discarded' })
      .eq('id', id)

    if (update.error) {
      throw new AppError(`Delete failed: ${update.error.message}`, 500)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
