import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { linkBatch } from '@/lib/pipeline/ingredient-linker'
import { autoPromoteVerified } from '@/lib/pipeline/auto-promote-verified'

/**
 * POST /api/cron/link-ingredients
 *
 * Runs daily at 7:30 AM UTC (via vercel.json), after translate-and-index (7 AM).
 *
 * Two responsibilities (sequential — order matters):
 * 1. Link products to ingredients (linkBatch). Parses INCI strings, matches
 *    or creates ingredients in ss_ingredients, inserts ss_product_ingredients
 *    rows. Uses Sonnet for new ingredient enrichment (~$0.01-0.05/run).
 * 2. Auto-promote products to is_verified=true (autoPromoteVerified). Newly
 *    linked products may now meet the verified criteria; this step flips them
 *    so Yuri's tools can find them on the next conversation. Without this,
 *    new products would silently stay invisible (the May 5 P1 audit finding).
 *
 * Order matters: linking happens first because newly-linked products need
 * the link rows to exist before they can pass the ≥8 links auto-promote
 * threshold.
 *
 * Processes up to 50 products per run (conservative for 60s timeout).
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

    // Auto-promote newly linked products to is_verified=true if they meet
    // the hardened criteria. Non-critical — log on failure, don't break the cron.
    let promoteResult = { promoted: 0, checked: 0 }
    try {
      promoteResult = await autoPromoteVerified(db)
    } catch (error) {
      console.error('[cron:link-ingredients] Auto-promote error:', error)
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
      auto_promote: {
        promoted: promoteResult.promoted,
        checked: promoteResult.checked,
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

// Vercel cron jobs send GET requests
export { POST as GET }
