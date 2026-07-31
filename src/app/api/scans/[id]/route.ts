import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/scans/:id — a single past scan, as it was recorded.
 *
 * This returns a HISTORICAL RECORD, not a live re-analysis. It deliberately
 * does NOT return the stored `enrichment` blob. That blob is a snapshot of
 * pricing/community/ownership/trending as they were at scan time — one stored
 * scan quotes Soko Glam at $20.90 from July 26. Replaying a months-old price
 * as though it were current is the fake-confidence failure this codebase keeps
 * paying for, and the stored pricing also names retailers we no longer
 * recommend. Anything time-sensitive belongs on a live surface (the product
 * page or Yuri), so we hand back the catalog link instead of stale numbers.
 *
 * What IS returned describes the photographed label itself — ingredients,
 * safety score, warnings — which does not go stale.
 *
 * A scan belonging to another user 404s rather than 403s, so scan ids can't be
 * probed for existence.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()
    const { id } = await context.params

    const { data, error } = await db
      .from('ss_user_scans')
      .select(`
        id,
        product_id,
        scan_type,
        ingredients_found,
        analysis_result,
        created_at,
        product:ss_products (id, name_en, brand_en, category)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      throw new AppError('Scan not found', 404)
    }

    const result = (data.analysis_result ?? {}) as Record<string, unknown>
    const analysis = (result.analysis ?? null) as Record<string, unknown> | null

    // A scan row with no analysis is a broken record, not an empty one. Say so
    // rather than rendering a confident-looking page with nothing in it.
    if (!analysis) {
      throw new AppError('This scan has no stored analysis', 404)
    }

    return NextResponse.json({
      scan: {
        id: data.id,
        scanned_at: data.created_at,
        scan_type: data.scan_type,
        product_id: data.product_id,
        product: data.product ?? null,
        analysis,
        conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
