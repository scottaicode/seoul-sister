import { cancelSubscriptionForDeletedAccount, deleteStripeCustomer, findStripeCustomersForUser } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { eraseAccount, EraseError, erasureFailedMessage } from '@/lib/account/erase'
import { logPipelineRun } from '@/lib/pipeline/log-run'
import { CONTACT_EMAIL } from '@/lib/contact'
import { sendEmail, wrapEmailHtml } from '@/lib/email/send'
import { escapeHtml } from '@/lib/email/html'

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
 *
 * THE ERASURE ITSELF (Nov 11 2026) lives in `src/lib/account/erase.ts`, which
 * says what was wrong: this route ignored every error, including the login's
 * own deletion, and answered `success: true`. Now every step is checked, the
 * result is verified, and a failure is (1) told to the person honestly, with
 * the address to write to, (2) written to `ss_pipeline_runs` as a `failed`
 * `account_deletion` run, which the Guardian's pipeline check counts, and
 * (3) emailed to the owner, so a half-finished deletion reaches a human instead
 * of a log nobody opens.
 */

/** Private buckets holding per-user objects, all pathed `${user.id}/...`. */
const USER_PHOTO_BUCKETS = ['glass-skin-photos', 'user-uploads'] as const

/** Storage lists a page at a time (100 by default). Ask for the most it gives and keep going. */
const LIST_PAGE = 1000

interface PurgeResult {
  removed: number
  /** How many list or remove calls failed. Above zero means photos may remain. */
  failures: number
}

async function listAll(
  db: ReturnType<typeof getServiceClient>,
  bucket: string,
  path: string
): Promise<{ entries: Array<{ name: string; id: string | null }>; failed: boolean }> {
  const entries: Array<{ name: string; id: string | null }> = []
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await db.storage.from(bucket).list(path, { limit: LIST_PAGE, offset })
    if (error) {
      console.error('[account/delete] list failed', { bucket, path, error: error.message })
      return { entries, failed: true }
    }
    entries.push(...(data ?? []).map((e) => ({ name: e.name, id: e.id as string | null })))
    if ((data ?? []).length < LIST_PAGE) return { entries, failed: false }
  }
}

async function purgeUserPhotos(
  db: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<PurgeResult> {
  let removed = 0
  let failures = 0

  for (const bucket of USER_PHOTO_BUCKETS) {
    try {
      // Objects live at ${userId}/<file> (glass-skin) or ${userId}/<scanId>/<file>
      // (scans), so walk one level down to catch both shapes.
      const top = await listAll(db, bucket, userId)
      if (top.failed) failures++

      const paths: string[] = []
      for (const entry of top.entries) {
        // A Storage "folder" has no id; a file does. This is how supabase-js
        // distinguishes them from a list() result.
        if (entry.id !== null) {
          paths.push(`${userId}/${entry.name}`)
          continue
        }
        const nested = await listAll(db, bucket, `${userId}/${entry.name}`)
        if (nested.failed) failures++
        for (const file of nested.entries) paths.push(`${userId}/${entry.name}/${file.name}`)
      }

      for (let i = 0; i < paths.length; i += LIST_PAGE) {
        const batch = paths.slice(i, i + LIST_PAGE)
        const { error: removeError } = await db.storage.from(bucket).remove(batch)
        if (removeError) {
          failures++
          console.error('[account/delete] remove failed', { bucket, userId, count: batch.length, error: removeError.message })
          continue
        }
        removed += batch.length
      }
    } catch (err) {
      failures++
      console.error('[account/delete] purge errored', {
        bucket,
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { removed, failures }
}

/** About thirty database calls and a few to Stripe. A timeout part-way would skip the failure report below. */
export const maxDuration = 60

export async function DELETE(request: NextRequest) {
  let user: { id: string; email?: string | null }
  try {
    user = await requireAuth(request)
  } catch (error) {
    return handleApiError(error)
  }
  const db = getServiceClient()

  try {
    let photoFailures = 0
    const result = await eraseAccount(db, { id: user.id, email: user.email }, {
      cancelSubscription: cancelSubscriptionForDeletedAccount,
      deleteStripeCustomer,
      findStripeCustomers: findStripeCustomersForUser,
      purgePhotos: async (userId) => {
        const purged = await purgeUserPhotos(db, userId)
        photoFailures = purged.failures
        return purged.removed
      },
    })
    // The account is gone, which is what the person asked for and is told. But
    // a photo that could not be listed or removed is still in the bucket, and
    // the policy says photos are deleted: that is recorded and sent to the
    // owner to finish by hand, not left in a log.
    if (photoFailures > 0) {
      const detail = `${photoFailures} storage call(s) failed; objects under ${user.id}/ in ${USER_PHOTO_BUCKETS.join(', ')} may remain`
      await logPipelineRun(db, {
        run_type: 'account_deletion',
        status: 'failed',
        source: 'account_delete_route',
        completed_at: new Date().toISOString(),
        metadata: { user_id: user.id, stopped_at: 'photos (account deleted)', detail },
      })
      await tellOwner({ id: user.id }, 'photos (the account itself was deleted)', detail, 'They were told their account was deleted, which it was. The photos named above still need removing by hand.')
    }
    return NextResponse.json({ success: true, photos_removed: result.photosRemoved })
  } catch (error) {
    const step = error instanceof EraseError ? error.step : 'unexpected'
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[account/delete] erasure did not finish', { userId: user.id, step, detail })
    // The run row carries the id only, never the address: it outlives the
    // account. (The owner email below does carry the address, so the owner can
    // answer the person.)
    await logPipelineRun(db, {
      run_type: 'account_deletion',
      status: 'failed',
      source: 'account_delete_route',
      completed_at: new Date().toISOString(),
      metadata: { user_id: user.id, stopped_at: step, detail },
    })
    const told = erasureFailedMessage(step, CONTACT_EMAIL)
    await tellOwner(user, step, detail, `They were told: "${told}" Steps before the one named above have already run; running the erasure again is safe.`)
    return NextResponse.json({ error: told }, { status: 500 })
  }
}

/**
 * A deletion someone asked for and did not get is owed to them, so the owner is
 * emailed directly (the Guardian only emails on `critical`; a failed run is a
 * `warn` there). Never throws: the person still gets their honest answer.
 */
async function tellOwner(user: { id: string; email?: string | null }, step: string, detail: string, outcome: string): Promise<void> {
  const to = process.env.GUARDIAN_ALERT_EMAIL
  if (!to) {
    console.error('[account/delete] GUARDIAN_ALERT_EMAIL unset: the owner was NOT emailed about this failed deletion')
    return
  }
  try {
    const html = wrapEmailHtml(
      `<p>A member asked to delete their account and part of it did not finish.</p>
<p><strong>Account:</strong> ${escapeHtml(user.email ?? '(no address)')} (${escapeHtml(user.id)})<br>
<strong>Stopped at:</strong> ${escapeHtml(step)}<br>
<strong>Detail:</strong> ${escapeHtml(detail)}</p>
<p>${escapeHtml(outcome)}</p>`,
      '<p style="font-size:12px;color:#999;margin:0;">Sent to the owner by the account deletion route.</p>'
    )
    const result = await sendEmail(to, 'Seoul Sister: an account deletion did not finish', html)
    if (!result.sent) console.error('[account/delete] owner email not sent:', result.error || result.reason)
  } catch (err) {
    console.error('[account/delete] owner email threw:', err)
  }
}
