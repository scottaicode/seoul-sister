/**
 * Guard test — a cold PWA launch must not read as a logout.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Bailey, July 29 2026, on the freshly-installed home-screen app:
 *   "I will say it didn't keep me logged in tho..."
 *   "As soon as I closed everything out and clicked the app it was back to
 *    main login page"
 *
 * The same-day fix had pinned `persistSession: true` / `autoRefreshToken: true`
 * on the browser client. Those were ALREADY the library defaults, so that
 * change could not have altered any behaviour. The database proved persistence
 * was never broken: her session 24b13d70 was created at 13:57 and successfully
 * REFRESHED at 20:11, six hours later. She was still shown /login.
 *
 * The real cause was in AuthContext. Verified against the installed
 * @supabase/auth-js 2.95.3 source:
 *
 *   - On a cold launch the stored access token is normally past the 90s
 *     EXPIRY_MARGIN_MS, so `__loadSession` refreshes it INLINE inside
 *     `getSession()` (GoTrueClient.js:1235) — this path is not even gated on
 *     the autoRefreshToken flag.
 *   - When iOS restores a home-screen app the network is typically not up yet.
 *     The refresh throws AuthRetryableFetchError (lib/fetch.js:106) and
 *     `getSession()` resolves `{ data: { session: null }, error }`
 *     (GoTrueClient.js:1237).
 *   - auth-js DELIBERATELY does not delete the stored session for a retryable
 *     error (the `!isAuthRetryableFetchError` guard at :1994 / :1925) and
 *     recovers on its own via the visibility handler and the 30s refresh tick.
 *
 * AuthContext read only `session?.user`, threw `error` away, and reported a
 * logged-out user — so AppShell bounced her to /login while valid credentials
 * sat untouched in localStorage. Hence FIVE sessions in one day: every bounce
 * made her sign in again instead of reusing the good session.
 *
 * These tests execute the real reducer logic rather than grepping for strings.
 * The previous guard tests for this area asserted only source text, which is
 * why they passed while the bug was live.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const authSrc = read('src', 'contexts', 'AuthContext.tsx')
const swSrc = read('public', 'sw.js')

// ---------------------------------------------------------------------------
// These execute the REAL reducers the provider calls, transpiled from
// src/lib/auth/session-state.ts. An earlier draft of this file reimplemented
// the logic locally — which meant the behavioural tests kept passing when the
// real branches were deleted, exactly the weakness that let this bug ship past
// the previous guard tests. Do not inline a copy of the logic here.
// ---------------------------------------------------------------------------

const { reduceGetSession, reduceAuthEvent, isTransientAuthError } =
  await loadSessionState()

const RETRYABLE = { name: 'AuthRetryableFetchError', message: 'Failed to fetch' }
const FATAL = { name: 'AuthApiError', message: 'Invalid Refresh Token' }
const BAILEY = { id: '551569d3-aed0-4feb-a340-47bfb146a835' }

/**
 * Compile the real TS module with the project's own TypeScript and import it,
 * so these tests run the exact code the provider runs.
 */
async function loadSessionState() {
  const ts = await import('typescript')
  const src = read('src', 'lib', 'auth', 'session-state.ts')
  const { outputText } = (ts.default ?? ts).transpileModule(src, {
    compilerOptions: { module: 99 /* ESNext */, target: 99 /* ESNext */ },
  })
  const url = 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  return import(url)
}

// ---------------------------------------------------------------------------
// The exact scenario Bailey hit
// ---------------------------------------------------------------------------

test('offline cold launch does NOT resolve to a logged-out user', () => {
  // getSession() → { session: null, error: AuthRetryableFetchError }
  const outcome = reduceGetSession({ session: null, error: RETRYABLE })

  assert.equal(
    outcome.kind,
    'wait',
    'A retryable network error must leave `user` UNTOUCHED and stay loading. ' +
      'Resolving it to null is what bounced Bailey to /login while valid ' +
      'credentials sat in localStorage — AppShell redirects on `!loading && !user`.'
  )
})

test('the null INITIAL_SESSION that follows a failed refresh is not a logout', () => {
  // auth-js surfaces the __loadSession throw as INITIAL_SESSION(null)
  // (GoTrueClient.js:1639), which would otherwise re-trigger the same bounce.
  assert.equal(
    reduceAuthEvent('INITIAL_SESSION', null).kind,
    'wait',
    'INITIAL_SESSION(null) must not resolve to logged-out.'
  )
})

test('the session is adopted once the retry succeeds', () => {
  // auth-js recovers via _onVisibilityChanged / _autoRefreshTokenTick and
  // emits TOKEN_REFRESHED or SIGNED_IN. That must log her straight in.
  for (const event of ['TOKEN_REFRESHED', 'SIGNED_IN']) {
    const outcome = reduceAuthEvent(event, { user: BAILEY })
    assert.equal(outcome.kind, 'resolve', `${event} must resolve, not keep waiting.`)
    assert.equal(outcome.user, BAILEY, `${event} must adopt the recovered session.`)
  }
})

test('a live session on a warm launch is adopted immediately', () => {
  const outcome = reduceGetSession({ session: { user: BAILEY }, error: null })
  assert.equal(outcome.kind, 'resolve')
  assert.equal(outcome.user, BAILEY)
})

// ---------------------------------------------------------------------------
// The fix must not swallow a REAL logout
// ---------------------------------------------------------------------------

test('a genuinely invalid token still logs the user out', () => {
  // Non-retryable: auth-js clears storage (GoTrueClient.js:1994) and emits
  // SIGNED_OUT. Showing /login is correct here — we must not trap someone in
  // a permanent spinner just because we over-corrected.
  const outcome = reduceGetSession({ session: null, error: FATAL })
  assert.equal(outcome.kind, 'resolve', 'A non-retryable auth error IS a logout.')
  assert.equal(outcome.user, null)
})

test('an explicit sign-out is honoured immediately', () => {
  const outcome = reduceAuthEvent('SIGNED_OUT', null)
  assert.equal(
    outcome.kind,
    'resolve',
    'Pressing sign out must never be treated as a transient blip.'
  )
  assert.equal(outcome.user, null)
})

test('a plain absent session with no error is a logout, not a wait', () => {
  // A first-time visitor has no stored session and no error. That must resolve,
  // or brand-new visitors would hang on the spinner instead of seeing /login.
  const outcome = reduceGetSession({ session: null, error: null })
  assert.equal(outcome.kind, 'resolve', 'No session and no error means genuinely signed out.')
  assert.equal(outcome.user, null)
})

test('only AuthRetryableFetchError counts as transient', () => {
  assert.equal(isTransientAuthError(RETRYABLE), true)
  for (const notTransient of [FATAL, null, undefined, 'boom', {}]) {
    assert.equal(
      isTransientAuthError(notTransient),
      false,
      `${JSON.stringify(notTransient)} must not be treated as a network blip — ` +
        'over-broad matching would hide real auth failures behind a spinner.'
    )
  }
})

// ---------------------------------------------------------------------------
// Structural: the real file must carry the branches modelled above
// ---------------------------------------------------------------------------

test('AuthContext inspects the error, not just the session', () => {
  assert.match(
    authSrc,
    /getSession\(\)\.then\(\(\{ data: \{ session \}, error \}\)/,
    'AuthContext must DESTRUCTURE `error` from getSession(). Reading only ' +
      '`session` is the original defect — a recoverable offline blip then ' +
      'reads as a logout.'
  )
  assert.match(
    authSrc,
    /AuthRetryableFetchError/,
    'Lost the retryable-error distinction. Without it, a cold-launch network ' +
      'failure bounces a logged-in subscriber to /login.'
  )
})

test('AuthContext routes both auth paths through the shared reducers', () => {
  // The behavioural tests above execute session-state.ts. They are only
  // meaningful if the provider actually CALLS it rather than keeping its own
  // inline copy of the branching.
  const stateSrc = read('src', 'lib', 'auth', 'session-state.ts')
  assert.match(
    stateSrc,
    /INITIAL_SESSION' && !session/,
    'Lost the INITIAL_SESSION(null) guard — auth-js emits it after a failed ' +
      'cold-launch refresh, which would re-trigger the bounce.'
  )
  for (const fn of ['reduceGetSession', 'reduceAuthEvent']) {
    assert.match(
      authSrc,
      new RegExp(`${fn}\\(`),
      `AuthContext must call ${fn}. If it re-inlines this logic, the ` +
        'behavioural tests above stop covering the code that actually runs.'
    )
  }
  assert.match(
    authSrc,
    /outcome\.kind === 'wait'\)\s*return/,
    'AuthContext must honour the `wait` outcome by returning early. Falling ' +
      'through to setLoading(false) reintroduces the bounce.'
  )
})

test('a permanent spinner is impossible — there is a bounded backstop', () => {
  // Staying in loading forever would be its own outage if the network never
  // returns. The transient path must have a timed fall-through.
  assert.match(
    authSrc,
    /setTimeout/,
    'Lost the backstop timer. Holding `loading` true with no timeout turns a ' +
      'dead network into an infinite spinner.'
  )
  assert.match(
    authSrc,
    /clearTimeout/,
    'The backstop must be cleared on unmount, or it fires against a dead component.'
  )
})

test('the effect cannot write state after unmount', () => {
  assert.match(
    authSrc,
    /cancelled = true/,
    'Lost the cancellation flag — the delayed getSession() and the backstop ' +
      'both resolve asynchronously and must not set state after teardown.'
  )
})

// ---------------------------------------------------------------------------
// The fix has to actually REACH the affected users
// ---------------------------------------------------------------------------

test('CACHE_NAME was bumped so returning PWA users get this fix', () => {
  // The v2 bump exists precisely because a returning visitor keeps replaying
  // the cached bundle. Bailey has the app installed AND the old cache, so
  // without a bump she would keep running the code that bounced her.
  const match = swSrc.match(/const CACHE_NAME = 'seoul-sister-v(\d+)'/)
  assert.ok(match, 'CACHE_NAME must stay in the greppable `seoul-sister-vN` form.')
  assert.ok(
    Number(match[1]) >= 3,
    `CACHE_NAME is still v${match[1]}. An auth fix that does not reach the ` +
      'already-affected users has not shipped.'
  )
})
