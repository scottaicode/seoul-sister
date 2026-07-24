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
