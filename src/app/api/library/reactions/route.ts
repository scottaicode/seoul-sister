import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { AppError, handleApiError } from '@/lib/utils/error-handler'

/**
 * Library reaction controls (v10.7.0 Phase C)
 *
 * Manual user-facing path to mark or clear product reactions. Before v10.7.0
 * the only write path was Yuri's buggy auto-extraction in advisor.ts, which
 * Bailey hit on Feb 14 (Skin&Lab Retinol Lifting Roller Cream was auto-tagged
 * as her holy grail despite her never owning it). With the auto-extraction
 * hardened in Phase D AND a manual control surface here, users can correct
 * bad tags directly instead of trying to coax Yuri into clearing them.
 *
 * POST /api/library/reactions
 *   body: { product_id: uuid, reaction_type: 'holy_grail' | 'broke_me_out', notes?: string }
 *   Marks the user's reaction on a product they OWN (or have owned). Refuses
 *   if the product isn't in their ss_user_products (any status) — same
 *   ownership requirement Yuri's mark_product_reaction tool enforces.
 *
 * DELETE /api/library/reactions?product_id=<uuid>
 *   Clears any existing reaction on the product. Idempotent — clearing a
 *   product that has no reaction is a no-op, not an error.
 */

const postSchema = z.object({
  product_id: z.string().uuid(),
  reaction_type: z.enum(['holy_grail', 'broke_me_out']),
  notes: z.string().max(1000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const parsed = postSchema.parse(body)

    const db = getServiceClient()

    // Ownership check — only let users tag products they own (or have owned).
    // Mirrors executeMarkProductReaction in tools.ts.
    const { data: ownership } = await db
      .from('ss_user_products')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', parsed.product_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!ownership) {
      throw new AppError(
        'Product not in your library — add it first before tagging a reaction.',
        409
      )
    }

    // Upsert. Unique constraint on (user_id, product_id) means a second tag
    // replaces the prior one — that's intentional for a manual control where
    // user re-tagging overrides previous tags.
    // DB column is `reaction` (not `reaction_type`); no `source` column on this table.
    // The API contract keeps `reaction_type` as the request field for clarity at the
    // boundary; the DB column rename is just a translation here.
    const { error } = await db.from('ss_user_product_reactions').upsert(
      {
        user_id: user.id,
        product_id: parsed.product_id,
        reaction: parsed.reaction_type,
        notes: parsed.notes || 'Tagged manually from Library',
      },
      { onConflict: 'user_id,product_id' }
    )

    if (error) {
      throw new AppError(`Failed to save reaction: ${error.message}`, 500)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Invalid input' }, { status: 400 })
    }
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const url = new URL(request.url)
    const productId = url.searchParams.get('product_id')

    if (!productId) {
      throw new AppError('Missing product_id query param', 400)
    }

    const db = getServiceClient()

    const { error } = await db
      .from('ss_user_product_reactions')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId)

    if (error) {
      throw new AppError(`Failed to clear reaction: ${error.message}`, 500)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
