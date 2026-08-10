/**
 * Guard test — /admin/traffic access control and honesty properties.
 *
 * This page is for Scott and Bailey only. It also deliberately EXCLUDES GA4
 * user/pageview totals: that number is bot-inflated (120 of 265 "active users"
 * from Singapore datacenters on Aug 10 2026; 346 phantom users against 0
 * database rows on Jul 27). Showing it beside a small conversation count would
 * tell Bailey the site is failing to convert traffic that was never human.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'admin', 'traffic', 'route.ts'), 'utf8')
const page = readFileSync(join(ROOT, 'src', 'app', '(app)', 'admin', 'traffic', 'page.tsx'), 'utf8')
const ga4 = readFileSync(join(ROOT, 'src', 'lib', 'analytics', 'ga4-client.ts'), 'utf8')

test('the API route requires admin before touching data', () => {
  assert.match(route, /requireAdmin\(request\)/)
  const idx = route.indexOf('requireAdmin')
  const dbIdx = route.indexOf('getServiceClient()')
  assert.ok(idx > 0 && idx < dbIdx, 'requireAdmin must run before any database access')
})

test('the page gates on is_admin and denies by default', () => {
  assert.match(page, /is_admin/)
  assert.match(page, /setAccessDenied\(true\)/)
  // Denial must be the outcome of anything other than an explicit true.
  assert.match(page, /is_admin !== true/)
})

test('failed queries surface instead of rendering as an empty dashboard', () => {
  // A query that only reads `data` turns an error into "no traffic" — the
  // silent-failure class this codebase keeps paying for.
  assert.match(route, /visitorsRes\.error/)
  assert.match(route, /sessionsRes\.error/)
  assert.match(route, /status: 500/)
})

test('GA4 user and pageview totals are never requested', () => {
  // Only sessions-by-source. If someone adds activeUsers/screenPageViews here,
  // the bot-inflated number lands on Bailey's dashboard.
  assert.doesNotMatch(ga4, /activeUsers|totalUsers|screenPageViews|newUsers/)
  assert.match(ga4, /sessionSource/)
})

test('a missing GA4 credential degrades softly, never breaking the page', () => {
  assert.match(route, /not_configured/)
  assert.match(ga4, /return null/)
  // The DB panels must not depend on GA4 succeeding.
  assert.match(route, /catch \(err\)[\s\S]{0,200}ga4 = \{/)
})

test('the conversation count uses the un-inflatable definition', () => {
  // total_messages > 0 — a row exists only when a human sends a message.
  assert.match(route, /\.gt\('total_messages', 0\)/)
})

test('recent conversations link to their transcript', () => {
  // A list of real conversations that leads nowhere is the Recent Scans defect
  // (v11.19.0) repeated: the card shows genuine data and the tap dead-ends.
  const route2 = readFileSync(join(ROOT, 'src', 'app', 'api', 'admin', 'traffic', 'route.ts'), 'utf8')
  assert.match(route2, /session_id: sessionByVisitor\.get/)
  // The session id must actually be selected, or it is silently always null.
  assert.match(route2, /\.select\('id, visitor_id, source, message_count, started_at'\)/)

  const page2 = readFileSync(join(ROOT, 'src', 'app', '(app)', 'admin', 'traffic', 'page.tsx'), 'utf8')
  assert.match(page2, /\/admin\/widget\?session=\$\{r\.session_id\}/)
})

test('the widget viewer honours the ?session= deep link', () => {
  const widget = readFileSync(join(ROOT, 'src', 'app', '(app)', 'admin', 'widget', 'page.tsx'), 'utf8')
  assert.match(widget, /get\('session'\)/)
  assert.match(widget, /fetchDetail\(sessionId\)/)
})
