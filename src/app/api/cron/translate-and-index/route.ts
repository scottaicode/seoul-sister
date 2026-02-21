import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { processBatch } from '@/lib/pipeline/batch-processor'

/**
 * POST /api/cron/translate-and-index
 *
 * Runs daily at 7 AM UTC (via vercel.json), after scan-korean-products (6 AM).
 *
 * SINGLE responsibility: Sonnet extraction of pending staged products.
 * Processes up to 50 pending products through AI categorization,
 * description generation, and metadata normalization.
 *
 * Ingredient linking is now handled by a SEPARATE cron job
 * (/api/cron/link-ingredients at 7:30 AM UTC) so each phase gets
 * a full 60-second window instead of sharing one.
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

    // Process up to 50 pending staged products via Sonnet extraction
    try {
      extractionResult = await processBatch(db, 50)
    } catch (error) {
      console.error('[cron:translate-and-index] Extraction error:', error)
    }

    return NextResponse.json({
      success: true,
      extraction: {
        processed: extractionResult.processed,
        failed: extractionResult.failed,
        duplicates: extractionResult.duplicates,
        remaining: extractionResult.remaining,
        cost_usd: extractionResult.cost.estimated_cost_usd,
      },
      total_cost_usd: extractionResult.cost.estimated_cost_usd,
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
