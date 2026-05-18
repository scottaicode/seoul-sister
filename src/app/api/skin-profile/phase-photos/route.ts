import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { AppError, handleApiError } from '@/lib/utils/error-handler'

/**
 * GET /api/skin-profile/phase-photos
 *
 * Returns the authenticated user's Glass Skin Score photos, optionally
 * filtered by treatment_phase_id. Photos are served via short-lived
 * signed URLs from the private `glass-skin-photos` Storage bucket.
 *
 * Query params:
 *   phase_id (optional) — UUID of a specific treatment phase to filter by
 *   limit (optional, default 50) — max photos returned
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const url = new URL(request.url)
    const phaseId = url.searchParams.get('phase_id')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)

    const db = getServiceClient()

    let query = db
      .from('ss_glass_skin_scores')
      .select(
        'id, created_at, overall_score, treatment_phase_id, photo_url, luminosity_score, smoothness_score, clarity_score, hydration_score, evenness_score, analysis_notes, photo_quality'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (phaseId) query = query.eq('treatment_phase_id', phaseId)

    const { data: scores, error } = await query
    if (error) throw new AppError(`Failed to load phase photos: ${error.message}`, 500)

    // Sign each photo URL (1 hour expiry). Photos without photo_url predate
    // storage (Bailey's two Feb 25 scores) — surface them without a URL so the
    // gallery can show "Score 48 · 2026-02-25" entries even when no image renders.
    const signed = await Promise.all(
      (scores || []).map(async (row) => {
        let signedUrl: string | null = null
        if (row.photo_url) {
          // photo_url stores the storage path (e.g. "user_id/score_id.jpg")
          const { data: signed } = await db.storage
            .from('glass-skin-photos')
            .createSignedUrl(row.photo_url, 3600)
          signedUrl = signed?.signedUrl || null
        }
        return {
          id: row.id,
          taken_at: row.created_at,
          taken_date: row.created_at ? String(row.created_at).slice(0, 10) : null,
          overall_score: row.overall_score,
          treatment_phase_id: row.treatment_phase_id,
          photo_signed_url: signedUrl,
          has_photo: Boolean(signedUrl),
          dimensions: {
            luminosity: row.luminosity_score,
            smoothness: row.smoothness_score,
            clarity: row.clarity_score,
            hydration: row.hydration_score,
            evenness: row.evenness_score,
          },
          analysis_notes: row.analysis_notes,
          photo_quality: row.photo_quality || {},
        }
      })
    )

    return NextResponse.json({ photos: signed })
  } catch (error) {
    return handleApiError(error)
  }
}
