import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { processBatch } from '@/lib/pipeline/batch-processor'
import { linkBatch } from '@/lib/pipeline/ingredient-linker'

/**
 * POST /api/cron/translate-and-index
 *
 * Runs daily at 7 AM UTC (via vercel.json), after scan-korean-products (6 AM).
 *
 * Two-phase processing:
 * 1. Sonnet extraction: Process up to 50 pending staged products (AI categorization,
 *    description generation, metadata normalization)
 * 2. Ingredient linking: Link ingredients for up to 30 products that have
 *    ingredients_raw but no ss_product_ingredients rows
 *
 * These batch sizes are conservative to stay within Vercel's 60s cron timeout.
 * Larger batches can be run via the admin API or CLI scripts.
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

    let extractionResult = {
      processed: 0,
      failed: 0,
      duplicates: 0,
      remaining: 0,
      cost: { calls: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 },
    }
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

    // Phase 1: Sonnet extraction (up to 50 products, ~30s budget)
    const timeoutGuardMs = 55000 // Stop processing at 55s to leave buffer
    try {
      extractionResult = await processBatch(db, 50)
    } catch (error) {
      console.error('[cron:translate-and-index] Extraction error:', error)
    }

    // Phase 2: Ingredient linking (only if we have time left)
    const elapsed = Date.now() - startedAt
    if (elapsed < timeoutGuardMs) {
      try {
        linkingResult = await linkBatch(db, 30)
      } catch (error) {
        console.error('[cron:translate-and-index] Linking error:', error)
      }
    }

    const totalCost =
      extractionResult.cost.estimated_cost_usd +
      linkingResult.cost.estimated_cost_usd

    return NextResponse.json({
      success: true,
      extraction: {
        processed: extractionResult.processed,
        failed: extractionResult.failed,
        duplicates: extractionResult.duplicates,
        remaining: extractionResult.remaining,
        cost_usd: extractionResult.cost.estimated_cost_usd,
      },
      linking: {
        products_linked: linkingResult.products_linked,
        products_skipped: linkingResult.products_skipped,
        products_failed: linkingResult.products_failed,
        ingredients_created: linkingResult.ingredients_created,
        remaining: linkingResult.remaining,
        cost_usd: linkingResult.cost.estimated_cost_usd,
      },
      total_cost_usd: totalCost,
      duration_ms: Date.now() - startedAt,
      processed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron:translate-and-index] Error:', error)
    return NextResponse.json(
      { error: 'Failed to translate and index products' },
      { status: 500 }
    )
  }
}
