/**
 * Guard test — lead-recap duplicate-send dedup.
 *
 * Prevents regression of the silent lead-email blacklist found in production
 * on 2026-07-21. A tester gave lrwells2013@gmail.com on Jul 18 (recap
 * delivered). On Jul 21 he returned, got a fresh visitor UUID, gave the SAME
 * address, and had a 14-message consultation. Yuri told him three separate
 * times that his recap was "on its way." It never sent.
 *
 * Cause: `isEmailCapturedByAnotherVisitor()` matched ANY prior visitor row with
 * that address, with NO time bound — so a return visit days later looked
 * identical to a same-conversation duplicate. The chat route then skipped the
 * entire send block with only a console.warn and NO recordRecapStatus() call,
 * so `recap_status` stayed NULL — indistinguishable in our own data from a
 * visitor who never gave an email at all. Two failures compounding: a
 * permanent blacklist, and no trace that it happened.
 *
 * The guard's legitimate purpose is narrow: stop ONE conversation from
 * producing TWO emails when the same human appears as two visitor rows
 * (cleared cookies / switched device mid-consultation). A 48h window serves
 * that purpose; forever does not.
 *
 * Pure logic + source assertions — no compile, no API, no DB. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const visitorSrc = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'widget', 'visitor.ts'),
  'utf8'
)
const routeSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts'),
  'utf8'
)

const WINDOW_HOURS = 48
const HOUR = 60 * 60 * 1000

/** Mirror of the shipped predicate: does a prior capture suppress this send? */
function suppresses(priorCapturedAt, attemptedAt) {
  return priorCapturedAt >= attemptedAt - WINDOW_HOURS * HOUR
}

test('the production failure: a capture 2.7 days earlier no longer blocks the recap', () => {
  // Real timestamps from ss_widget_visitors.
  const priorCapture = Date.parse('2026-07-18T18:08:38.813Z')
  const returnVisit = Date.parse('2026-07-21T02:22:40.924Z')
  assert.equal(
    suppresses(priorCapture, returnVisit),
    false,
    'regressed to the permanent blacklist that silently killed a real lead recap'
  )
})

test('same-conversation duplicate (cleared cookies mid-chat) IS still suppressed', () => {
  const capture = Date.parse('2026-07-21T02:00:00Z')
  const minutesLater = Date.parse('2026-07-21T02:20:00Z')
  assert.equal(suppresses(capture, minutesLater), true)
  // Same evening retry, still inside the window.
  assert.equal(suppresses(capture, capture + 6 * HOUR), true)
})

test('the window boundary behaves at exactly 48h', () => {
  const capture = Date.parse('2026-07-21T02:00:00Z')
  assert.equal(suppresses(capture, capture + 47 * HOUR), true, 'inside window must suppress')
  assert.equal(suppresses(capture, capture + 49 * HOUR), false, 'outside window must send')
})

// ---------------------------------------------------------------------------
// Source assertions — the real code must keep both halves of the fix.
// ---------------------------------------------------------------------------

test('the dedup query is time-bounded, not forever', () => {
  const start = visitorSrc.indexOf('export async function isEmailCapturedByAnotherVisitor(')
  assert.ok(start > 0, 'isEmailCapturedByAnotherVisitor not found — renamed?')
  const body = visitorSrc.slice(start, start + 1800)

  assert.ok(
    /\.gte\('email_captured_at'/.test(body),
    'the dedup query lost its time bound — every returning visitor is silently blacklisted from recaps again'
  )
  assert.ok(
    /RECAP_DEDUP_WINDOW_HOURS/.test(visitorSrc),
    'the dedup window constant is gone'
  )
})

test('a missing email_captured_at column fails open quietly (pre-migration safety)', () => {
  const start = visitorSrc.indexOf('export async function isEmailCapturedByAnotherVisitor(')
  const body = visitorSrc.slice(start, start + 1800)
  assert.ok(
    /captured_email\|email_captured_at/.test(body),
    'the error-tolerance regex must cover BOTH columns the query touches'
  )
})

test('the duplicate-skip path records a status instead of vanishing', () => {
  const start = routeSrc.indexOf('if (alreadyEmailed) {')
  assert.ok(start > 0, 'the duplicate-skip branch not found — renamed?')
  const branch = routeSrc.slice(start, start + 600)

  assert.ok(
    /recordRecapStatus\([^)]*'suppressed_duplicate'\)/.test(branch),
    "the skip path must record 'suppressed_duplicate' — a NULL recap_status is indistinguishable from a lead who never gave an email"
  )
  // The status write must precede the log CALL, so a throw in logging cannot
  // skip it. Strip comments first — the explanatory comment above the fix
  // mentions console.warn and would otherwise match here.
  const code = branch.replace(/\/\/[^\n]*/g, '')
  assert.ok(
    code.indexOf('recordRecapStatus') < code.indexOf('console.warn'),
    'record the status before logging, so a throw in logging cannot skip it'
  )
})

test("'suppressed_duplicate' is a declared RecapStatus", () => {
  assert.ok(
    /'suppressed_duplicate'/.test(visitorSrc),
    'RecapStatus union lost suppressed_duplicate'
  )
})
