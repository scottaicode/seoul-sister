import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { requireAdmin } from '@/lib/auth'
import { processBatch, reprocessFailed } from '@/lib/pipeline/batch-processor'

export const maxDuration = 120 // 2 min — batch of 20 at ~3-5s each

const processSchema = z.object({
  batch_size: z.number().int().min(1).max(100).optional().default(20),
  reprocess: z.boolean().optional().default(false),
  run_id: z.string().uuid().optional(),
})

/**
 * POST /api/admin/pipeline/process
 *
 * Processes a batch of pending staged products through Sonnet extraction.
 * Protected by service role key (admin only).
 *
 * Body: {
 *   batch_size?: number (1-100, default 20)
 *   reprocess?: boolean (retry failed rows, default false)
 *   run_id?: string (link results to a pipeline run)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const params = processSchema.parse(body)

    const supabase = getServiceClient()

    let result
    if (params.reprocess) {
      result = await reprocessFailed(supabase, params.batch_size)
    } else {
      result = await processBatch(supabase, params.batch_size, params.run_id)
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      duplicates: result.duplicates,
      remaining: result.remaining,
      cost: result.cost,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/admin/pipeline/process
 *
 * Returns counts of staged products by status.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const supabase = getServiceClient()

    const [pending, processing, processed, failed, duplicate] = await Promise.all(
      (['pending', 'processing', 'processed', 'failed', 'duplicate'] as const).map(
        async (status) => {
          const { count } = await supabase
            .from('ss_product_staging')
            .select('*', { count: 'exact', head: true })
            .eq('status', status)
          return count ?? 0
        }
      )
    )

    return NextResponse.json({
      staging: { pending, processing, processed, failed, duplicate },
      total: pending + processing + processed + failed + duplicate,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
