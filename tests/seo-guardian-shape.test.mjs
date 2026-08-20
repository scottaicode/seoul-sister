/**
 * Guard test — SEO Guardian cron structural shape (v11.11.0).
 *
 * Locks the load-bearing choices against regression:
 *   1. The cron is scheduled in vercel.json and the route authenticates via
 *      verifyCronAuth + exports BOTH GET (Vercel cron) and POST (manual).
 *   2. Missing GSC credentials fail SOFT (not_configured row + warn), never a
 *      crash — the cron must stay green pre-setup.
 *   3. AI-First guardrail: the prompt disclosure of unshown remainder rows
 *      exists (no silent truncation), and the strategist system prompt keeps
 *      the "convenience, not constraints" framing — computed facts must not
 *      become a boundary on what the AI may bet on.
 *   4. The raw GSC snapshot is stored (gsc_snapshot) — required for Phase 3
 *      grading; without it bets can never be audited.
 *
 * Pure structural assertions — no DB, no network. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const routeSrc = readFileSync(join(root, 'src', 'app', 'api', 'cron', 'seo-guardian', 'route.ts'), 'utf8')
const libSrc = readFileSync(join(root, 'src', 'lib', 'seo', 'seo-guardian.ts'), 'utf8')
const vercelJson = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))

test('grades actually REACH the strategist prompt (consumer link)', () => {
  // A bet needs ~28 days before a clean grading window exists, but reports are
  // WEEKLY. At the original limit(3) every grade aged out of the prompt before
  // it was ever written — grades sat in the database and reached no consumer,
  // the loop's third question failing inside the fix for that same failure.
  const limitMatch = libSrc.match(/\.limit\((\d+)\)/)
  assert.ok(limitMatch, 'prior-run query must have an explicit limit')
  assert.ok(
    Number(limitMatch[1]) >= 8,
    `prior-run window is ${limitMatch[1]} weeks — too narrow to ever contain a graded bet (needs >= 8)`
  )
  // And the verdict must carry execution + power, or "miss" is ambiguous
  // between "theory wrong" and "work never shipped".
  assert.ok(/execution=\$\{grade\.execution_status\}/.test(libSrc), 'execution status must reach the prompt')
  assert.ok(/NOT statistically powered/.test(libSrc), 'unpowered abstentions must be labelled in the prompt')
})

test('the grader cron runs BEFORE the strategist each week', () => {
  const grader = vercelJson.crons.find((c) => c.path === '/api/cron/seo-grade-bets')
  const strategist = vercelJson.crons.find((c) => c.path === '/api/cron/seo-guardian')
  assert.ok(grader, 'grader cron must be scheduled')
  const hour = (c) => Number(c.schedule.split(' ')[1])
  assert.ok(
    hour(grader) < hour(strategist),
    'grader must run before the strategist so the same morning report sees fresh verdicts'
  )
})

test('cron is scheduled weekly in vercel.json', () => {
  const entry = vercelJson.crons.find((c) => c.path === '/api/cron/seo-guardian')
  assert.ok(entry, 'seo-guardian cron entry must exist')
  assert.equal(entry.schedule, '0 10 * * 0', 'weekly Sunday 10:00 UTC')
})

test('route authenticates and exports GET + POST', () => {
  assert.ok(/verifyCronAuth\(request\)/.test(routeSrc), 'must call verifyCronAuth')
  assert.ok(/export \{ handler as GET, handler as POST \}/.test(routeSrc), 'must export both methods')
})

test('missing GSC credentials fail soft with a not_configured record', () => {
  assert.ok(/status: 'not_configured'/.test(libSrc), 'not_configured row must be written')
  assert.ok(
    /console\.warn\(\s*\n?\s*'\[seo-guardian\] GSC_CLIENT_EMAIL/.test(libSrc),
    'must warn loudly describing what it would have done'
  )
})

test('AI-First: remainder disclosure exists and facts are framed as non-binding', () => {
  assert.ok(
    /full disclosure of what you are not seeing/.test(libSrc),
    'unshown query rows must be disclosed, never silently truncated'
  )
  assert.ok(
    /a convenience, not a boundary/.test(libSrc),
    'striking-distance list must stay framed as non-binding on the strategist'
  )
})

test('raw GSC snapshot is stored for future bet grading', () => {
  assert.ok(/gsc_snapshot: \{ rows \}/.test(libSrc), 'full rows must be persisted')
})
