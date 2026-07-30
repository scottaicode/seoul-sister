/**
 * Guard test — a signed-in visitor must not be shown the signup pitch.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 30 2026)
 *
 * Bailey reported being logged out on every launch of the installed home-screen
 * app. THREE fixes chased session persistence — manifest origin, cold-launch
 * retryable errors, a cookie mirror — and a fourth found a real bug (signOut
 * defaulting to scope:'global'). None of them was what she was looking at.
 *
 * The PWA manifest's `start_url` is `https://www.seoulsister.com/` — the
 * MARKETING page — and src/app/page.tsx had NO auth awareness at all. It
 * rendered "Get Started" / "Start Your Journey" / "Talk to Yuri Free. 12
 * messages, no signup" unconditionally, to everyone, including paying
 * subscribers holding a valid session. Every launch LOOKED like a logout.
 *
 * What finally settled it, after two wrong diagnoses of my own:
 *   - every request from her device carried `referer: https://www.seoulsister.com/`
 *     → she was already on the correct origin; the re-install advice was wrong
 *   - `GET /user` → 200 right after each login → the server accepted her session
 *   - her sessions ACCUMULATED (5 live rows) → the global-revoke bug was fixed
 *   - her screenshot had no browser chrome → standalone PWA at start_url
 *   - the log showed her own POST /logout taps and a POST /signup → 422
 *     user_repeated_signup → someone trying every door, not a broken session
 *
 * The lesson worth keeping: "I'm being logged out" is a report about what the
 * user SEES. It is not a diagnosis, and three rounds were spent treating it as
 * one. Check what the screen actually renders before instrumenting the session.
 *
 * These tests execute the real module's decision logic against fakes, so
 * deleting a branch fails a behavioural assertion rather than a text match.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

/**
 * Run the component's effect body with a fake session + URL and report whether it
 * redirected. The effect is extracted and executed rather than reimplemented, so
 * the test exercises the shipped decision.
 */
async function runEffect({ session, search = '', hash = '' }) {
  const src = read('src', 'components', 'auth', 'SignedInRedirect.tsx')

  // Pull the effect body out of the real source.
  const start = src.indexOf('let cancelled = false')
  const end = src.indexOf('return () => {', start)
  assert.ok(start > 0 && end > start, 'Could not locate the effect body — has the component been restructured?')
  const body = src.slice(start, end)

  const calls = []
  const router = { replace: (to) => calls.push(to) }
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session } }),
    },
  }
  const window = { location: { search, hash } }

  // The body uses `return` for early exits, so wrap it in an async function.
  const fn = new Function(
    'router',
    'supabase',
    'window',
    'URLSearchParams',
    `return (async () => { ${body} })()`
  )
  await fn(router, supabase, window, URLSearchParams)
  // getSession is awaited internally via .then; flush the microtask queue.
  await new Promise((r) => setTimeout(r, 0))
  return calls
}

const SIGNED_IN = { user: { id: '551569d3-aed0-4feb-a340-47bfb146a835' } }

// ---------------------------------------------------------------------------
// The bug itself
// ---------------------------------------------------------------------------

test('a signed-in visitor is sent to the app, not shown the signup pitch', async () => {
  const calls = await runEffect({ session: SIGNED_IN })
  assert.deepEqual(
    calls,
    ['/dashboard'],
    'A visitor with a valid session landing on / must be routed to /dashboard. ' +
      'Without this, the PWA start_url renders "Get Started" and "Talk to Yuri ' +
      'Free — no signup" to a paying subscriber, which is indistinguishable from ' +
      'being logged out. Three session fixes were spent on this symptom.'
  )
})

// ---------------------------------------------------------------------------
// It must not break the public marketing page — the SEO/GEO surface and the
// Yuri widget's front door.
// ---------------------------------------------------------------------------

test('an anonymous visitor is left on the marketing page', async () => {
  const calls = await runEffect({ session: null })
  assert.deepEqual(
    calls,
    [],
    'No session must mean NO redirect. / is the public surface behind ~525 Bing ' +
      'citations a week and the anonymous Yuri widget lives on it.'
  )
})

test('a session with no user does not redirect', async () => {
  const calls = await runEffect({ session: {} })
  assert.deepEqual(calls, [], 'Only a real session (session.user) may redirect.')
})

test('a feeder ?ask= prefill stays on the landing page', async () => {
  const calls = await runEffect({ session: SIGNED_IN, search: '?ask=is+this+fake' })
  assert.deepEqual(
    calls,
    [],
    'Feeder CTAs (?ask=/?from=) target the hero widget ON this page. Redirecting ' +
      'them to /dashboard would break links the app deliberately ships.'
  )
})

test('a ?from= attribution link stays on the landing page', async () => {
  const calls = await runEffect({ session: SIGNED_IN, search: '?from=blog' })
  assert.deepEqual(calls, [], 'Source attribution links must reach the widget.')
})

test('a #pricing anchor stays on the landing page', async () => {
  const calls = await runEffect({ session: SIGNED_IN, hash: '#pricing' })
  assert.deepEqual(
    calls,
    [],
    'A subscriber following a link to the pricing section should land there, not ' +
      'be bounced to the dashboard.'
  )
})

// ---------------------------------------------------------------------------
// Wiring — the component has to actually be on the page, and must not gate it.
// ---------------------------------------------------------------------------

test('the landing page renders the redirect component', () => {
  const page = read('src', 'app', 'page.tsx')
  assert.match(
    page,
    /import SignedInRedirect from '@\/components\/auth\/SignedInRedirect'/,
    'The landing page must import the redirect.'
  )
  assert.match(
    page,
    /<SignedInRedirect \/>/,
    'The redirect must be RENDERED on the landing page — importing it is not enough. ' +
      'This page is the PWA start_url; without it the installed app shows a ' +
      'subscriber the signup pitch on every launch.'
  )
})

test('the redirect renders nothing and cannot gate the page', () => {
  const src = read('src', 'components', 'auth', 'SignedInRedirect.tsx')
  assert.match(
    src,
    /return null/,
    'The component must render null. It must never spinner-cover or delay the ' +
      'public homepage while it checks auth — that would put an auth round-trip ' +
      'in front of the GEO surface and the Yuri widget.'
  )
  assert.ok(
    !/useState/.test(src),
    'No loading state — a "checking..." render would flash on the marketing page ' +
      'for every anonymous visitor.'
  )
})

test('the landing page itself still has no auth gate', () => {
  const page = read('src', 'app', 'page.tsx')
  // The marketing content must not become conditional on a session; only the
  // redirect is allowed to know about auth.
  assert.ok(
    !/if \(user\)|user \?|!user &&/.test(page),
    'The marketing page must render unconditionally for anonymous visitors. Gate ' +
      'via the redirect component, never by hiding the public content.'
  )
})
