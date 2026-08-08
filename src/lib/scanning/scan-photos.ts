/**
 * Persistence for the photos a user scans.
 *
 * Bailey, Aug 7 2026: the scanner should retain both sides of the product, not
 * just read them. Before this the images were analyzed and thrown away, so
 * /scan/[id] rendered a safety score with no evidence behind it — and a scan
 * that came back thin (her backlit Manyo shot returned 1 ingredient) gave no way
 * to see WHY. The photo is the receipt for what Yuri claimed.
 *
 * Follows the proven glass-skin-photos pattern exactly (src/app/api/skin-score):
 *   - PRIVATE bucket, never public. Label photos include hands, rooms, windows.
 *   - path `${user.id}/${scanId}/${slot}.${ext}` — user-scoped so a signed-URL
 *     mistake can't leak across accounts, and scan-scoped so deletion is a
 *     single prefix removal.
 *   - store the PATH, sign on read (1h). Never store a URL: signed URLs expire,
 *     and a stored one is a dead link by design.
 *   - upload failure is NON-CRITICAL. A scan must never fail because storage
 *     hiccuped; the analysis is the product, the photo is the receipt.
 *
 * Reuses the existing `user-uploads` bucket (private, 10MB, jpeg/png/webp),
 * created Oct 2025 and never wired up — rather than adding a fifth bucket.
 * NOTE the bucket forbids gif, so gif scans are analyzed but not retained, the
 * same concession skin-score makes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const SCAN_PHOTO_BUCKET = 'user-uploads'

/** Signed-URL lifetime. Matches phase-photos so the two surfaces behave alike. */
const SIGNED_URL_TTL_SECONDS = 3600

export interface ScanPhotoInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  base64: string
}

function extFor(mediaType: string): string | null {
  if (mediaType === 'image/jpeg') return 'jpg'
  if (mediaType === 'image/png') return 'png'
  if (mediaType === 'image/webp') return 'webp'
  return null // gif — bucket policy excludes it
}

/**
 * Upload every view of one scan. Returns the storage PATHS that succeeded, in
 * the same order as the input.
 *
 * Never throws: a rejected or failed upload yields a shorter array (or an empty
 * one), and the caller records what it got. A partial result is honest — three
 * of four photos retained is better than failing the scan.
 */
export async function uploadScanPhotos(
  db: SupabaseClient,
  userId: string,
  scanId: string,
  images: ScanPhotoInput[]
): Promise<string[]> {
  const paths: string[] = []

  for (const [i, img] of images.entries()) {
    const ext = extFor(img.mediaType)
    if (!ext) {
      console.warn('[scan-photos] skipping unsupported type for storage', {
        userId,
        scanId,
        mediaType: img.mediaType,
      })
      continue
    }

    // Slot names carry meaning for a merged scan: the FIRST photo is the one the
    // user framed as the identifying view. Keeping the index makes the ordering
    // recoverable from the path alone.
    const path = `${userId}/${scanId}/view-${i + 1}.${ext}`

    try {
      const buffer = Buffer.from(img.base64, 'base64')
      const { error } = await db.storage
        .from(SCAN_PHOTO_BUCKET)
        .upload(path, buffer, { contentType: img.mediaType, upsert: false })

      if (error) {
        console.error('[scan-photos] upload failed', { userId, scanId, path, error: error.message })
        continue
      }
      paths.push(path)
    } catch (err) {
      console.error('[scan-photos] upload threw', {
        userId,
        scanId,
        path,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return paths
}

/**
 * Sign stored paths for display. Returns only the URLs that signed successfully,
 * so a missing object degrades to "no photo" rather than a broken image.
 */
export async function signScanPhotos(
  db: SupabaseClient,
  paths: string[]
): Promise<string[]> {
  if (!paths.length) return []

  const signed: string[] = []
  for (const path of paths) {
    try {
      const { data, error } = await db.storage
        .from(SCAN_PHOTO_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      if (error) {
        console.error('[scan-photos] sign failed', { path, error: error.message })
        continue
      }
      if (data?.signedUrl) signed.push(data.signedUrl)
    } catch (err) {
      console.error('[scan-photos] sign threw', {
        path,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return signed
}

/**
 * Delete every stored photo for one scan.
 *
 * WHY THIS EXISTS AT ALL: glass-skin-photos has no deletion path, so its objects
 * outlive the rows that reference them and an account deletion leaves the photos
 * behind. Shipping a second bucket with the same gap would double a known
 * liability. Retention is a promise; a delete button that leaves the file on disk
 * is the same class of lie as a write claim for a write that never happened.
 *
 * Removes by PREFIX (`${userId}/${scanId}/`) rather than by a stored path list,
 * so an object whose path never made it into the row is still cleaned up —
 * otherwise a crash between upload and insert orphans a file permanently.
 *
 * Returns the number of objects removed. Never throws.
 */
export async function deleteScanPhotos(
  db: SupabaseClient,
  userId: string,
  scanId: string
): Promise<number> {
  const prefix = `${userId}/${scanId}`
  try {
    const { data: objects, error: listError } = await db.storage
      .from(SCAN_PHOTO_BUCKET)
      .list(prefix)

    if (listError) {
      console.error('[scan-photos] list for delete failed', { prefix, error: listError.message })
      return 0
    }
    if (!objects?.length) return 0

    const toRemove = objects.map((o) => `${prefix}/${o.name}`)
    const { error: removeError } = await db.storage
      .from(SCAN_PHOTO_BUCKET)
      .remove(toRemove)

    if (removeError) {
      console.error('[scan-photos] remove failed', { prefix, error: removeError.message })
      return 0
    }
    return toRemove.length
  } catch (err) {
    console.error('[scan-photos] delete threw', {
      prefix,
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}
