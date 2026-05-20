import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { resolveProductByNameStrict } from '@/lib/yuri/tools'
import { checkSubstanceInProduct } from '@/lib/intelligence/ingredient-match'

/**
 * POST /api/lgaas/ingredient-check
 *
 * Blueprint 76 endpoint — LGAAS-side constraint cross-check for Reddit
 * response generation. Given a list of product names being recommended and
 * a list of user-stated sensitivities/allergies/reactions, returns any
 * conflicts found by cross-referencing the product INCI lists against the
 * constraint substances.
 *
 * Auth: X-LGAAS-API-Key header, same shared secret env var as the existing
 * /api/admin/products/search and /api/admin/products/prices endpoints
 * (LGAAS_INGEST_API_KEY).
 *
 * Architectural notes:
 * - Pure data query — no AI calls. Target <100ms p99.
 * - Uses resolveProductByNameStrict (no silent substitution onto a wrong
 *   product — false positives erode trust as fast as false negatives).
 * - Unresolved products are returned in products_unresolved array. LGAAS
 *   side decides what to do with those (typically passes the constraint
 *   through to the regen prompt as "user has unspecified reactions to: X").
 * - Empty `conflicts` ≠ all-clear. Could mean unresolved products. LGAAS
 *   side reads `products_unresolved.length` to interpret correctly.
 *
 * See: lgaas/lgaas-blueprint/76-USER-STATED-SENSITIVITY-INGREDIENT-CROSS-CHECK.md
 *      lgaas/lgaas-blueprint/76-IMPLEMENTATION-PLAN.md
 */

const ConstraintTypeEnum = z.enum([
  'stated_sensitivities',
  'stated_allergies',
  'stated_reactions_history',
  'stated_preferences_to_avoid',
])

const ConstraintSchema = z.object({
  type: ConstraintTypeEnum,
  substance: z.string().min(1).max(200),
  supporting_quote: z.string().min(1).max(500),
})

const RequestSchema = z.object({
  product_names: z.array(z.string().min(1).max(300)).min(1).max(20),
  constraints: z.array(ConstraintSchema).min(1).max(20),
  fuzzy_match: z.boolean().optional().default(true),
})

interface Conflict {
  product_name: string
  product_id: string
  constraint_type: string
  constraint_substance: string
  supporting_quote: string
  ingredient_match: string
  ingredient_inci_position: number
  ingredient_concentration_estimate: string
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  try {
    // --- Auth: matches existing LGAAS-facing endpoint pattern exactly ---
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    // --- Parse + validate ---
    const body = await request.json()
    const { product_names, constraints } = RequestSchema.parse(body)

    const supabase = getServiceClient()

    // --- Resolve each product name to an ss_products row ---
    // resolveProductByNameStrict returns null on partial matches, so we
    // never silently substitute a wrong product onto a constraint check.
    // Bailey-tested pattern from v10.7.0 Phase A.3.
    const resolved: Array<{
      product_name: string
      id: string
      ingredients_raw: string | null
    }> = []
    const unresolved: string[] = []

    for (const name of product_names) {
      const match = await resolveProductByNameStrict(supabase, name)
      if (!match) {
        unresolved.push(name)
        continue
      }
      // Pull the full ingredients_raw — resolveProductByNameStrict returns
      // only id/name/brand, not ingredients
      const { data: row } = await supabase
        .from('ss_products')
        .select('ingredients_raw')
        .eq('id', match.id)
        .maybeSingle()
      resolved.push({
        product_name: name,
        id: match.id,
        ingredients_raw: row?.ingredients_raw ?? null,
      })
    }

    // --- Cross-check resolved products against constraints ---
    const conflicts: Conflict[] = []

    for (const product of resolved) {
      if (!product.ingredients_raw) continue // No INCI data, can't check

      for (const constraint of constraints) {
        const match = checkSubstanceInProduct(product.ingredients_raw, constraint.substance)
        if (match) {
          conflicts.push({
            product_name: product.product_name,
            product_id: product.id,
            constraint_type: constraint.type,
            constraint_substance: constraint.substance,
            supporting_quote: constraint.supporting_quote,
            ingredient_match: match.ingredient_match,
            ingredient_inci_position: match.ingredient_inci_position,
            ingredient_concentration_estimate: match.ingredient_concentration_estimate,
          })
        }
      }
    }

    return NextResponse.json({
      conflicts,
      products_checked: product_names.length,
      products_resolved: resolved.length,
      products_unresolved: unresolved,
      constraints_input_count: constraints.length,
      execution_time_ms: Date.now() - startedAt,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

// Explicit dynamic config — auth header check requires per-request handling
export const dynamic = 'force-dynamic'
