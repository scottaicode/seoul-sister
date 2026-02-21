import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { linkBatch } from '@/lib/pipeline/ingredient-linker'

/**
 * POST /api/cron/link-ingredients
 *
 * Runs daily at 7:30 AM UTC (via vercel.json), after translate-and-index (7 AM).
 *
 * SINGLE responsibility: Link products to ingredients.
 * Finds products that have ingredients_raw but no ss_product_ingredients rows,
 * parses INCI strings, matches/creates ingredients, and inserts links.
 *
 * Previously this was crammed into the translate-and-index cron sharing a
 * 60-second window. Now it gets its own full 60-second budget so ingredient
 * linking never gets skipped due to Sonnet extraction running long.
 *
 * Processes up to 50 products per run (conservative for 60s timeout).
 * Uses Sonnet for new ingredient enrichment (~$0.01-0.05 per run).
 *
 * Secured with CRON_SECRET header.
 */

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const startedAt = Date.now()

    let linkingResult = {
      products_linked: 0,
      products_skipped: 0,
      products_failed: 0,
      ingredients_created: 0,
      ingredients_matched: 0,
      remaining: 0,
      cost: { calls: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 },
      errors: [] as string[],
    }

    try {
      linkingResult = await linkBatch(db, 50)
    } catch (error) {
      console.error('[cron:link-ingredients] Linking error:', error)
    }

    return NextResponse.json({
      success: true,
      linking: {
        products_linked: linkingResult.products_linked,
        products_skipped: linkingResult.products_skipped,
        products_failed: linkingResult.products_failed,
        ingredients_created: linkingResult.ingredients_created,
        ingredients_matched: linkingResult.ingredients_matched,
        remaining: linkingResult.remaining,
        cost_usd: linkingResult.cost.estimated_cost_usd,
        errors: linkingResult.errors.slice(0, 5),
      },
      duration_ms: Date.now() - startedAt,
      processed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron:link-ingredients] Error:', error)
    return NextResponse.json(
      { error: 'Failed to link ingredients' },
      { status: 500 }
    )
  }
}
