/**
 * Guard test — the privacy policy must describe what the code actually does.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (Aug 9 2026)
 *
 * The live privacy policy asserted two things that were false:
 *
 *   1. "Scan images: Processed in real-time by Anthropic's API and not
 *      permanently stored on our servers."
 *      FALSE since Aug 7, when scan-photos.ts shipped at Bailey's request and
 *      began uploading every scan photo to the `user-uploads` bucket. The
 *      feature was correct; nobody updated the policy.
 *
 *   2. "Anonymous widget conversations: Not stored; streamed and discarded
 *      immediately."
 *      FALSE for the life of the widget. ss_widget_messages held 521 rows going
 *      back to 2026-03-11, including a named visitor's full transcript and the
 *      email she handed over.
 *
 * Found only because Bailey looked at a COMPETITOR's privacy notice and asked
 * "do we need a notice that it's not 100% private?" — no test, review, or gate
 * caught it, and a legal document on a health-adjacent product was wrong in
 * production for months.
 *
 * The structural lesson is the repo's own: a claim in prose drifts from the code
 * silently, because nothing executes prose. These tests tie the load-bearing
 * sentences to the modules that make them true or false, so shipping a storage
 * change without touching the policy fails CI.
 *
 * They deliberately assert on BEHAVIOUR-DEFINING SOURCE (does an upload path
 * exist? does the delete path cover that bucket?) rather than on wording — the
 * policy should stay freely editable prose, but it cannot claim non-storage
 * while an uploader exists.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const policy = read('src', 'app', '(legal)', 'privacy', 'page.tsx')
const scanPhotos = read('src', 'lib', 'scanning', 'scan-photos.ts')
const accountDelete = read('src', 'app', 'api', 'account', 'delete', 'route.ts')
const persistence = read('src', 'lib', 'widget', 'persistence.ts')

test('the policy does not claim scan images go unstored while an uploader exists', () => {
  // The uploader is the ground truth. If it exists, the policy may not deny it.
  const uploaderExists =
    /export async function uploadScanPhotos/.test(scanPhotos) &&
    /storage[\s\S]{0,200}\.upload\(/.test(scanPhotos)
  assert.ok(uploaderExists, 'scan-photos.ts no longer uploads — update this test AND the policy together')

  // NOTE the bounded [\s\S] rather than [^<]: the label is wrapped in <strong>,
  // so a `[^<]*` window stops at the closing tag and never reaches the claim.
  // A first version of this test made exactly that mistake and PASSED against
  // the false policy — the failure mode this whole file exists to prevent.
  assert.ok(
    !/Scan images:[\s\S]{0,200}not permanently stored/i.test(policy),
    'the policy claims scan images are not stored, but uploadScanPhotos() persists them'
  )
  assert.ok(
    /Scan images:[\s\S]{0,400}private storage bucket/i.test(policy),
    'the policy must disclose that scan images are saved to a private bucket'
  )
})

test('the policy does not claim widget conversations are discarded while they are persisted', () => {
  const widgetWritesExist = /from\('ss_widget_messages'\)[\s\S]{0,200}\.insert\(/.test(persistence)
  assert.ok(
    widgetWritesExist,
    'widget persistence no longer inserts messages — update this test AND the policy together'
  )

  assert.ok(
    !/widget conversations:[\s\S]{0,200}(not stored|discarded immediately)/i.test(policy),
    'the policy claims anonymous widget conversations are discarded, but they are written to ss_widget_messages'
  )
  assert.ok(
    /Anonymous widget conversations:[\s\S]{0,200}Stored/i.test(policy),
    'the policy must disclose that anonymous widget conversations are stored'
  )
})

test('anonymous visitors are told how to get their conversation deleted', () => {
  // They have no account, so "Settings -> Delete Account" does not reach them.
  // A stored transcript with a captured email and no erasure path is the gap.
  assert.ok(
    /without an account:[\s\S]{0,600}delete the conversation/i.test(policy),
    'the policy must give account-less widget visitors a route to deletion'
  )
})

test('the promise that photos are deleted with the account is backed by the delete path', () => {
  assert.ok(
    /USER_PHOTO_BUCKETS\s*=\s*\[[^\]]*'user-uploads'/.test(accountDelete),
    'the policy says scan photos are deleted with the account — account deletion must purge the user-uploads bucket'
  )
  assert.ok(
    /storage[\s\S]{0,200}\.remove\(/.test(accountDelete),
    'account deletion must actually remove storage objects, not only database rows'
  )
})

test('the policy does not promise a retention window the code cannot keep', () => {
  // Cheap tripwire against the specific phrasing that caused this incident:
  // absolute non-storage claims. If a future edit reintroduces one anywhere in
  // the retention list, this fails regardless of which datum it concerns.
  const retentionSection = policy.slice(
    policy.indexOf('Data Retention'),
    policy.indexOf('Your Rights')
  )
  assert.ok(retentionSection.length > 0, 'retention section not found — was it renamed?')
  assert.ok(
    !/\bdiscarded immediately\b/i.test(retentionSection),
    '"discarded immediately" is the phrasing that was false for months — state the real lifecycle instead'
  )
})
