import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { deleteScanPhotos, signScanPhotos } from '@/lib/scanning/scan-photos'

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

    // The photographed label, signed for an hour. This is the EVIDENCE for the
    // ingredients and safety score above — a scan that read badly is
    // self-evident once you can see the photo, where "1 ingredient" alone is
    // just a confusing number. Scans before Aug 7 2026 have no stored photos and
    // correctly return an empty array.
    const storedPaths = Array.isArray(result.image_paths)
      ? (result.image_paths as unknown[]).filter((p): p is string => typeof p === 'string')
      : []
    const photos = await signScanPhotos(db, storedPaths)

    return NextResponse.json({
      scan: {
        id: data.id,
        scanned_at: data.created_at,
        scan_type: data.scan_type,
        product_id: data.product_id,
        product: data.product ?? null,
        analysis,
        conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
        photos,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/scans/:id — remove a scan AND the photos it stored.
 *
 * Photos are deleted BEFORE the row, and by storage prefix rather than from the
 * row's `image_paths` list. Both choices are deliberate:
 *
 *   - Row first would mean a storage failure orphans the objects with nothing
 *     left pointing at them. Deleting the photos first makes the worst case a
 *     retryable no-op (row still there, user taps delete again) instead of a
 *     permanent leak.
 *   - Prefix rather than list catches an object whose path never reached the row
 *     (a crash between upload and insert), which a list-driven delete would miss
 *     forever.
 *
 * If the photo delete fails we do NOT delete the row and we do NOT report
 * success — telling someone their photos are gone while the files remain is the
 * false-write-claim class with a privacy consequence.
 *
 * Ownership is enforced in the WHERE clause; a scan belonging to someone else
 * 404s rather than 403s, matching GET so ids can't be probed.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()
    const { id } = await context.params

    // Confirm ownership before touching storage — otherwise a prefix built from
    // the caller's own id plus someone else's scan id could delete nothing but
    // would still report success.
    const { data: scan, error: readError } = await db
      .from('ss_user_scans')
      .select('id, analysis_result')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (readError) {
      throw new AppError('Could not load that scan', 500)
    }
    if (!scan) {
      throw new AppError('Scan not found', 404)
    }

    const stored = (scan.analysis_result ?? {}) as Record<string, unknown>
    const expected = Array.isArray(stored.image_paths) ? stored.image_paths.length : 0

    const removed = await deleteScanPhotos(db, user.id, id)

    // Only a genuine failure blocks the row delete: we expected photos and
    // removed none. Zero-expected/zero-removed is a pre-Aug-2026 scan with no
    // photos, which deletes cleanly.
    if (expected > 0 && removed === 0) {
      console.error('[scans] refusing to delete row — photo delete removed nothing', {
        userId: user.id,
        scanId: id,
        expected,
      })
      throw new AppError(
        'Could not remove the stored photos, so the scan was kept. Please try again.',
        500
      )
    }

    const { error: deleteError } = await db
      .from('ss_user_scans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      throw new AppError('Could not delete that scan', 500)
    }

    return NextResponse.json({ success: true, photos_removed: removed })
  } catch (error) {
    return handleApiError(error)
  }
}
