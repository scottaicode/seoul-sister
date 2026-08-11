/**
 * Guard test — the Scenario Studio gate must be is_demo ONLY, everywhere.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Scenario Mode shipped Jul 5 2026 (78d4d58) with two gates that did not agree:
 *
 *   - src/app/(app)/demo/page.tsx      allowed  is_demo || is_admin
 *   - src/app/api/yuri/chat/route.ts   honored  is_demo only
 *
 * So both admin accounts (Scott, Bailey) could open the studio, pick a persona,
 * and send it — and the API silently dropped the persona on the floor. What came
 * back was ordinary Yuri reasoning over the ADMIN'S OWN profile, persisted to
 * their account, under a page that states in its own copy: "Responses are real
 * and verified, and nothing here is saved to your profile or the learning
 * system." Every clause of that promise was false for them.
 *
 * Bailey found the page five weeks later and asked where it came from. She is
 * the one filming TikTok content from it, and her account is the worst possible
 * substrate: the per-turn scenario override in advisor.ts replaces the loaded
 * skin profile, but it does NOT clear accumulated memory, corrections, or
 * decision memory. A persona demo rendered through her account is Yuri talking
 * to Bailey in a costume — not the persona the screenshot claims to show.
 *
 * This is the silent-failure class: an ignored persona and an honored persona
 * produced the same-looking answer on screen. Nothing surfaced the difference.
 *
 * These tests EXECUTE the real gate expressions rather than grepping for
 * "is_demo". A source-regex test passes against the broken code — is_admin and
 * is_demo both appear in the file whether the gate is `||` or not.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const page = read('src', 'app', '(app)', 'demo', 'page.tsx')
const route = read('src', 'app', 'api', 'yuri', 'chat', 'route.ts')
const header = read('src', 'components', 'layout', 'Header.tsx')

/**
 * Pull a boolean expression out of source and turn it into a real function of
 * the profile row, so we can run it against every flag combination.
 */
function compileGate(src, pattern, label) {
  const m = src.match(pattern)
  assert.ok(m, `could not locate the ${label} gate expression`)
  const expr = m[1].trim()
  // `data?.x` / `prof?.x` both read from the single profile-row argument.
  const body = expr.replace(/\b(data|prof)\?\./g, 'row.')
  return new Function('row', `return Boolean(${body})`)
}

// setAllowed(<expr>) in the demo page
const pageGate = compileGate(page, /setAllowed\(([^;]*?)\)\s*\n/, 'demo page')
// if (<expr>) { scenario = parsed.scenario } in the chat route
const routeGate = compileGate(route, /if\s*\((prof\?\.is_demo[^)]*)\)\s*\{\s*\n\s*scenario\s*=/, 'chat route')

const ROWS = [
  { label: 'demo account', row: { is_demo: true, is_admin: false }, expect: true },
  { label: 'admin (Scott/Bailey)', row: { is_demo: false, is_admin: true }, expect: false },
  { label: 'ordinary subscriber', row: { is_demo: false, is_admin: false }, expect: false },
  { label: 'missing profile row', row: {}, expect: false },
]

test('the demo page allows is_demo and nothing else', () => {
  for (const { label, row, expect } of ROWS) {
    assert.equal(pageGate(row), expect, `demo page gate wrong for: ${label}`)
  }
})

test('the chat route honors the persona for is_demo and nothing else', () => {
  for (const { label, row, expect } of ROWS) {
    assert.equal(routeGate(row), expect, `chat route gate wrong for: ${label}`)
  }
})

test('page and API agree on every flag combination', () => {
  // The two gates disagreeing IS the defect. A page that renders a persona the
  // API will ignore produces a persisted, non-persona turn under a promise of
  // ephemerality.
  for (const { label, row } of ROWS) {
    assert.equal(
      pageGate(row),
      routeGate(row),
      `gate parity broken for: ${label} — the page and the API must agree`
    )
  }
})

test('an admin flag can never re-widen the demo entry points', () => {
  // Both header render sites (desktop "More" menu + mobile menu) key on isDemo
  // alone. `(isDemo || isAdmin)` here is what put the link in front of Bailey.
  const demoLinks = header.match(/\{[^{}]*&&\s*\(\s*<Link[\s\S]{0,120}?href="\/demo"/g) ?? []
  assert.equal(demoLinks.length, 2, 'expected exactly two /demo link render sites in Header.tsx')
  for (const site of demoLinks) {
    assert.ok(
      !/isAdmin/.test(site),
      'a /demo link is gated on isAdmin — admins get a studio whose persona the API ignores'
    )
    assert.ok(/isDemo/.test(site), 'a /demo link is not gated on isDemo')
  }
})
