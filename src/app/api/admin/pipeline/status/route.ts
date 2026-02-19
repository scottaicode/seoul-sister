import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

function verifyAdminAuth(request: NextRequest): void {
  const key = request.headers.get('x-service-key')
    ?? request.headers.get('authorization')?.replace('Bearer ', '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey || !key || key !== serviceKey) {
    throw new AppError('Unauthorized: admin access required', 401)
  }
}

/**
 * GET /api/admin/pipeline/status
 *
 * Returns pipeline run history and staging table counts.
 * Protected by service role key (admin only).
 *
 * Query params:
 *   run_id?: string — Get specific run details
 *   limit?: number — Number of recent runs to return (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50)

    const supabase = getServiceClient()

    // If specific run requested, return its details
    if (runId) {
      const { data: run, error: runError } = await supabase
        .from('ss_pipeline_runs')
        .select('*')
        .eq('id', runId)
        .single()

      if (runError || !run) {
        throw new AppError('Pipeline run not found', 404)
      }

      // Get staging counts for this run's source
      const { data: stagingCounts } = await supabase
        .rpc('count_staging_by_status', { p_source: run.source })

      return NextResponse.json({ run, staging_counts: stagingCounts })
    }

    // Return recent runs and aggregate staging stats
    const [runsResult, stagingResult, productCountResult] = await Promise.all([
      supabase
        .from('ss_pipeline_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit),

      supabase
        .from('ss_product_staging')
        .select('status', { count: 'exact', head: false }),

      supabase
        .from('ss_products')
        .select('id', { count: 'exact', head: true }),
    ])

    // Calculate staging counts by status from raw data
    const stagingRows = stagingResult.data ?? []
    const stagingCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      processed: 0,
      failed: 0,
      duplicate: 0,
      total: stagingRows.length,
    }
    for (const row of stagingRows) {
      const status = (row as { status: string }).status
      if (status in stagingCounts) {
        stagingCounts[status]++
      }
    }

    return NextResponse.json({
      runs: runsResult.data ?? [],
      staging_counts: stagingCounts,
      product_count: productCountResult.count ?? 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
