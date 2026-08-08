import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

/**
 * DELETE /api/account/delete — GDPR right-to-erasure
 * Deletes all user data: reviews, conversations, routines, scans, PHOTOS, profile,
 * and the auth account.
 *
 * PHOTOS (added Aug 7 2026). This route deleted 22 tables of rows and NOT ONE
 * storage object, so every Glass Skin selfie survived the account deletion of the
 * person who uploaded it — on an endpoint whose docstring says right-to-erasure.
 * Rows are not the data; the photographs are the data. Found while adding scan
 * photo retention, which would have quietly joined the same leak.
 *
 * Buckets are cleared BEFORE the rows, because the rows are what tell us the
 * objects exist. Delete the row first and an orphaned file has nothing pointing
 * at it and will never be found again.
 *
 * A storage failure is logged and does NOT abort the erasure: a user who asked
 * to be deleted must not stay deletable-only-in-part because a bucket 500'd.
 * The log line is the record that a residue needs sweeping.
 */

/** Private buckets holding per-user objects, all pathed `${user.id}/...`. */
const USER_PHOTO_BUCKETS = ['glass-skin-photos', 'user-uploads'] as const

async function purgeUserPhotos(
  db: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<number> {
  let removed = 0

  for (const bucket of USER_PHOTO_BUCKETS) {
    try {
      // Objects live at ${userId}/<file> (glass-skin) or ${userId}/<scanId>/<file>
      // (scans), so walk one level down to catch both shapes.
      const { data: top, error: topError } = await db.storage.from(bucket).list(userId)
      if (topError) {
        console.error('[account/delete] list failed', { bucket, userId, error: topError.message })
        continue
      }
      if (!top?.length) continue

      const paths: string[] = []
      for (const entry of top) {
        // A Storage "folder" has no id; a file does. This is how supabase-js
        // distinguishes them from a list() result.
        const isFolder = entry.id === null
        if (!isFolder) {
          paths.push(`${userId}/${entry.name}`)
          continue
        }
        const { data: nested, error: nestedError } = await db.storage
          .from(bucket)
          .list(`${userId}/${entry.name}`)
        if (nestedError) {
          console.error('[account/delete] nested list failed', {
            bucket,
            userId,
            folder: entry.name,
            error: nestedError.message,
          })
          continue
        }
        for (const file of nested ?? []) {
          paths.push(`${userId}/${entry.name}/${file.name}`)
        }
      }

      if (!paths.length) continue

      const { error: removeError } = await db.storage.from(bucket).remove(paths)
      if (removeError) {
        console.error('[account/delete] remove failed', {
          bucket,
          userId,
          count: paths.length,
          error: removeError.message,
        })
        continue
      }
      removed += paths.length
    } catch (err) {
      console.error('[account/delete] purge threw', {
        bucket,
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return removed
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    // Photos FIRST — the rows are the only map to these objects.
    const photosRemoved = await purgeUserPhotos(db, user.id)

    // Delete in dependency order (children first)
    const tables = [
      'ss_review_helpfulness',
      'ss_reviews',
      'ss_yuri_messages',
      'ss_yuri_conversations',
      'ss_specialist_insights',
      'ss_onboarding_progress',
      'ss_routine_products',
      'ss_user_routines',
      'ss_user_scans',
      'ss_user_wishlists',
      'ss_user_product_reactions',
      'ss_user_products',
      'ss_user_product_tracking',
      'ss_user_cycle_tracking',
      'ss_glass_skin_scores',
      'ss_counterfeit_reports',
      'ss_counterfeit_scans',
      'ss_user_dismissed_alerts',
      'ss_routine_outcomes',
      'ss_affiliate_clicks',
      'ss_subscriptions',
      'ss_user_profiles',
    ]

    for (const table of tables) {
      await db.from(table).delete().eq('user_id', user.id)
    }

    // Delete the auth user (requires service role)
    await db.auth.admin.deleteUser(user.id)

    return NextResponse.json({ success: true, photos_removed: photosRemoved })
  } catch (error) {
    return handleApiError(error)
  }
}
