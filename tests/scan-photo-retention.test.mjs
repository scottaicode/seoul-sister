/**
 * Guards for scan-photo retention + deletion (Bailey, Aug 7 2026: the scanner
 * should keep both sides of the product, not just read them).
 *
 * The lifecycle itself was verified end-to-end against REAL Supabase Storage —
 * upload, sign, fetch bytes, unsigned-access refused (HTTP 400), delete by
 * prefix, idempotent re-delete. That probe is not repeated here: it needs the
 * service-role key and would create objects on every CI run. These tests guard
 * the invariants that a future edit could silently break.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PHOTOS = readFileSync('src/lib/scanning/scan-photos.ts', 'utf8')
const SCAN_ROUTE = readFileSync('src/app/api/scan/route.ts', 'utf8')
const DETAIL_ROUTE = readFileSync('src/app/api/scans/[id]/route.ts', 'utf8')
const ACCOUNT_DELETE = readFileSync('src/app/api/account/delete/route.ts', 'utf8')

// ── Storage never holds a URL ────────────────────────────────────────────────
test('scan rows store storage PATHS, never signed URLs', () => {
  // A signed URL expires (1h), so persisting one guarantees a dead link. The
  // insert must carry the path array and sign only on read.
  assert.ok(/image_paths: imagePaths/.test(SCAN_ROUTE), 'image_paths not persisted')
  assert.ok(
    !/createSignedUrl/.test(SCAN_ROUTE),
    'scan route signs at write time — signed URLs expire and must be generated on read'
  )
  assert.ok(/signScanPhotos/.test(DETAIL_ROUTE), 'detail route does not sign stored paths')
})

// ── Paths are user-scoped ───────────────────────────────────────────────────
test('photo paths are prefixed by user id, then scan id', () => {
  // storage.foldername(name)[1] is the owning user in the RLS policy, so the
  // user id MUST be the first path segment or the read policy breaks.
  assert.ok(
    /\$\{userId\}\/\$\{scanId\}\/view-/.test(PHOTOS),
    'path shape changed — RLS keys on the first segment being the user id'
  )
})

// ── Upload failure must never fail a scan ───────────────────────────────────
test('upload failures are non-critical and never throw', () => {
  assert.ok(
    /Never throws/i.test(PHOTOS),
    'the never-throws contract was removed from uploadScanPhotos docs'
  )
  // Each failure path continues rather than rethrowing.
  const uploadFn = PHOTOS.slice(
    PHOTOS.indexOf('export async function uploadScanPhotos'),
    PHOTOS.indexOf('export async function signScanPhotos')
  )
  assert.ok(!/\bthrow\b/.test(uploadFn), 'uploadScanPhotos throws — a storage blip would fail the scan')
})

// ── Deletion: photos before row, by prefix ──────────────────────────────────
test('deleteScanPhotos removes by PREFIX, not from a stored path list', () => {
  // A list-driven delete misses objects whose path never reached the row (crash
  // between upload and insert), orphaning them permanently.
  const delFn = PHOTOS.slice(PHOTOS.indexOf('export async function deleteScanPhotos'))
  assert.ok(/\.list\(prefix\)/.test(delFn), 'delete no longer enumerates by prefix')
  assert.ok(/\.remove\(toRemove\)/.test(delFn), 'delete does not remove enumerated objects')
})

test('DELETE /api/scans/:id removes photos BEFORE the row', () => {
  const del = DETAIL_ROUTE.slice(DETAIL_ROUTE.indexOf('export async function DELETE'))
  const photoIdx = del.indexOf('deleteScanPhotos')
  const rowIdx = del.indexOf(".from('ss_user_scans')\n      .delete()")
  assert.ok(photoIdx > -1, 'scan DELETE does not delete photos')
  assert.ok(rowIdx > -1, 'scan DELETE does not delete the row')
  assert.ok(
    photoIdx < rowIdx,
    'row is deleted before the photos — a storage failure would orphan the files with nothing pointing at them'
  )
})

test('a failed photo delete does NOT report success', () => {
  const del = DETAIL_ROUTE.slice(DETAIL_ROUTE.indexOf('export async function DELETE'))
  assert.ok(
    /expected > 0 && removed === 0/.test(del),
    'the guard that refuses to delete the row when photos survived was removed — ' +
      'telling a user their photos are gone while the files remain is a false write claim'
  )
})

test('scan DELETE enforces ownership (404, not 403, so ids cannot be probed)', () => {
  const del = DETAIL_ROUTE.slice(DETAIL_ROUTE.indexOf('export async function DELETE'))
  assert.ok(/\.eq\('user_id', user\.id\)/.test(del), 'ownership not enforced in the query')
  assert.ok(/'Scan not found', 404/.test(del), 'a foreign scan must 404, not 403')
})

// ── Account deletion must purge storage ─────────────────────────────────────
test('account deletion purges photo buckets, not just rows', () => {
  // This route deleted 22 tables and zero storage objects, so every Glass Skin
  // selfie survived the deletion of the account that uploaded it — on an
  // endpoint documented as GDPR right-to-erasure.
  assert.ok(/purgeUserPhotos/.test(ACCOUNT_DELETE), 'account deletion no longer purges photos')
  assert.ok(
    /glass-skin-photos/.test(ACCOUNT_DELETE) && /user-uploads/.test(ACCOUNT_DELETE),
    'a per-user photo bucket is missing from the erasure list'
  )
})

test('account deletion purges photos BEFORE deleting rows', () => {
  const purgeIdx = ACCOUNT_DELETE.indexOf('await purgeUserPhotos(')
  const tablesIdx = ACCOUNT_DELETE.indexOf('for (const table of tables)')
  assert.ok(purgeIdx > -1 && tablesIdx > -1)
  assert.ok(
    purgeIdx < tablesIdx,
    'rows are deleted first — the rows are the only map to the storage objects'
  )
})

test('a storage failure does not abort account erasure', () => {
  const purge = ACCOUNT_DELETE.slice(
    ACCOUNT_DELETE.indexOf('async function purgeUserPhotos'),
    ACCOUNT_DELETE.indexOf('export async function DELETE')
  )
  assert.ok(
    !/\bthrow\b/.test(purge),
    'purgeUserPhotos throws — a bucket 500 would leave a user who asked to be deleted half-deleted'
  )
})

// ── The bucket must stay private ────────────────────────────────────────────
test('scan photos target a private bucket', () => {
  assert.ok(
    /SCAN_PHOTO_BUCKET = 'user-uploads'/.test(PHOTOS),
    'bucket changed — verify the new bucket is PRIVATE before shipping'
  )
  assert.ok(/PRIVATE bucket, never public/i.test(PHOTOS), 'the private-bucket requirement was removed')
})
