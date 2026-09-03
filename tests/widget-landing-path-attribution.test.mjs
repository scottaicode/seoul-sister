/**
 * Guard tests — ss_widget_sessions.landing_path.
 *
 * WHY IT EXISTS
 * `source` is page-TYPE granular ('blog', 'product', 'ingredient_cta'), so it
 * can say a conversation came from "a blog post" and never WHICH one. The blog
 * earns ~674 Google clicks / 28 days and yields ~4 widget conversations a month,
 * while blog visitors are the best traffic on the site (6.4 avg messages vs 3.7
 * from the landing page; 37.5% give an email). "Which post converts" was
 * unanswerable.
 *
 * THE TWO PROPERTIES THAT MUST NOT REGRESS
 * 1. PATH ONLY. A feeder link carries `?ask=<whatever the visitor typed>`, and
 *    an external referrer's query can carry a search term. Storing a full URL
 *    would put a visitor's own words into an analytics column.
 * 2. IT MUST NOT LET CRAWLERS MINT SESSIONS. The honest denominator for this
 *    project is `ss_widget_visitors WHERE total_messages > 0`. An earlier
 *    feeder-CTA proposal was rejected precisely because auto-sending would have
 *    let crawlers create sessions. landing_path is written only by
 *    createSession(), on a real first message — it adds a FIELD to sessions
 *    that already exist and creates none.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const client = readFileSync(join(root, 'src/components/widget/TryYuriSection.tsx'), 'utf8')
const route = readFileSync(join(root, 'src/app/api/widget/chat/route.ts'), 'utf8')
const session = readFileSync(join(root, 'src/lib/widget/session.ts'), 'utf8')

// Scope client assertions to the capture block so they cannot accidentally
// match the unrelated referrer-host code above it.
function captureBlock() {
  const start = client.indexOf('WHICH page, not just which KIND of page')
  assert.ok(start > 0, 'landing_path capture block not found')
  return client.slice(start, start + 2000)
}

test('the client stores the PATH, never the full URL or querystring', () => {
  const block = captureBlock()
  assert.match(block, /\.pathname/, 'must read .pathname')
  // What matters is what gets ASSIGNED to the ref. Parsing document.referrer
  // into a URL is fine and necessary; storing .href or .search is not.
  const assigned = block.match(/landingPathRef\.current\s*=\s*([^\n]+)/g) || []
  assert.ok(assigned.length > 0, 'landing_path must actually be assigned')
  for (const a of assigned) {
    assert.ok(
      !/\.href|\.search|document\.referrer\b(?!\))/.test(a),
      `must never store href or search — a feeder ?ask= carries the visitor's own typed words. Saw: ${a}`
    )
  }
})

test('only a SAME-ORIGIN referrer is recorded', () => {
  const block = captureBlock()
  assert.match(
    block,
    /seoulsister\.com/,
    'must check the referrer host — an external referrer can carry a search term in its query'
  )
})

test('the server REJECTS a non-path value rather than truncating it', () => {
  // Truncating a full URL would still store part of a querystring. A regex that
  // rejects is the only version that cannot leak.
  assert.match(
    route,
    /landing_path[\s\S]{0,400}?\.regex\(/,
    'landing_path must be validated with a regex, not just a max length'
  )
  const m = route.match(/landing_path[\s\S]{0,400}?\.regex\(([^)]+)\)/)
  assert.ok(m && m[1].includes('^\\/'), 'the pattern must anchor to a leading slash')
  assert.ok(!m[1].includes('?'), 'the pattern must not admit a querystring')
})

test('landing_path is written ONLY when a session row is created', () => {
  // This is the crawler protection. If it were written on any other path, a
  // renderer that never types could produce a row and inflate the one honest
  // denominator.
  assert.match(
    session,
    /export async function createSession[\s\S]{0,900}?landing_path/,
    'landing_path must be set inside createSession, which runs on a real first message'
  )
  const writesElsewhere = route.match(/landing_path\s*:/g) || []
  assert.ok(
    writesElsewhere.length <= 1,
    `landing_path should be threaded through, not written from multiple places (found ${writesElsewhere.length})`
  )
})

test('a missing column degrades gracefully instead of breaking a conversation', () => {
  // Same pattern `source` already uses: the migration is applied by hand, so the
  // app must survive running ahead of it.
  assert.match(
    session,
    /source\|landing_path/,
    'the missing-column retry must match landing_path too, or a conversation breaks until the migration lands'
  )
})

test('the landing page itself is not recorded as its own referrer', () => {
  const block = captureBlock()
  assert.match(block, /!==\s*['"]\/['"]/, '"/" is already what `source` says — recording it would just add noise')
})

test('the migration exists, is forward-only, and says why', () => {
  const sql = readFileSync(join(root, 'scripts/migrations/widget_session_landing_path.sql'), 'utf8')
  assert.match(sql, /add column if not exists landing_path/i)
  assert.match(sql, /BACKFILL: NOT ATTEMPTED/i, 'the backfill decision must be recorded, not silent')
  // Historical rows are only PARTIALLY reconstructable from the ?ask= prefill;
  // a half-populated column would make "no referrer" and "we could not
  // reconstruct it" indistinguishable.
  assert.match(sql, /partially/i)
})
