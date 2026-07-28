/**
 * Guard test — CAPTCHA gate on the auth surfaces + the ss_real_users exposure fix.
 *
 * Context (2026-07-28): a scripted attacker signed up as harvested victim
 * addresses from Tor exit nodes (185.220.101.53/.14, 171.25.193.78), waited
 * ~60s, then fired three /recover calls in 15 seconds from a SEPARATE hosting
 * range (45.84.107.x) so signup and recovery IPs never correlated. Four accounts
 * in 21 hours, zero product engagement. The goal was never an account — it was
 * making seoulsister.com mail strangers, i.e. using us as a free spam relay.
 * Supabase's rate limiter held (24/24 recover attempts got 429), but that is the
 * last line of defense, not the first.
 *
 * The same audit found ss_real_users — a Jul 23 analytics view over auth.users —
 * readable by the `anon` role over PostgREST. Verified live against production:
 * `GET /rest/v1/ss_real_users?select=email` with the PUBLISHABLE key returned
 * real subscriber emails, HTTP 200. That is a worse defect than the bot signups.
 *
 * Each assertion locks a property that, if reverted, reintroduces a specific
 * real failure mode. Verified by reintroducing each bug and watching the
 * corresponding test fail.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(join(__dirname, '..', ...p), 'utf8')

const captchaSrc = read('src', 'components', 'auth', 'AuthCaptcha.tsx')
const authCtxSrc = read('src', 'contexts', 'AuthContext.tsx')
const registerSrc = read('src', 'app', '(auth)', 'register', 'page.tsx')
const loginSrc = read('src', 'app', '(auth)', 'login', 'page.tsx')
const forgotSrc = read('src', 'app', '(auth)', 'forgot-password', 'page.tsx')
const fixSql = read('scripts', 'migrations', 'fix_ss_real_users_exposure.sql')
const nextConfig = read('next.config.js')
const swSrc = read('public', 'sw.js')

// ---------------------------------------------------------------------------
// Coverage: ALL THREE endpoints Supabase's Bot and Abuse Protection guards
// ---------------------------------------------------------------------------

const SURFACES = [
  ['register', registerSrc],
  ['login', loginSrc],
  ['forgot-password', forgotSrc],
]

for (const [name, src] of SURFACES) {
  test(`${name} renders the captcha and gates submit on a token`, () => {
    assert.ok(
      src.includes('<AuthCaptcha'),
      `${name} must render <AuthCaptcha> or the token is never obtained`
    )
    assert.ok(
      src.includes('requireCaptchaToken(captchaToken)'),
      `${name} must gate submit on requireCaptchaToken`
    )
  })

  test(`${name} resets the captcha after a failed attempt (tokens are single-use)`, () => {
    // Without this, a retry reuses a spent token, Supabase rejects it, and the
    // user watches correct credentials fail for no visible reason.
    assert.ok(
      src.includes('captchaRef.current?.reset()'),
      `${name} must reset the widget in its catch block`
    )
  })

  test(`${name} forwards the token to Supabase, not just to local state`, () => {
    // Holding a token client-side while never sending it would pass the local
    // gate and still be rejected server-side once the dashboard toggle is on.
    assert.ok(
      /captchaToken\s*(\?\?|\|\|)\s*undefined/.test(src),
      `${name} must pass captchaToken through to the Supabase call`
    )
  })
}

test('forgot-password passes captchaToken to resetPasswordForEmail specifically', () => {
  // /recover is THE abused endpoint. A token that reaches signup but not
  // recovery would leave the actual attack path wide open.
  const call = forgotSrc.match(/resetPasswordForEmail\([\s\S]*?\n\s*\}\)/)?.[0] ?? ''
  assert.ok(
    call.includes('captchaToken'),
    'resetPasswordForEmail must receive captchaToken — this is the abused endpoint'
  )
})

// ---------------------------------------------------------------------------
// AuthContext must actually hand the token to Supabase
// ---------------------------------------------------------------------------

test('signUp and signIn forward captchaToken into the Supabase options object', () => {
  const signUpCall = authCtxSrc.match(/supabase\.auth\.signUp\([\s\S]*?\n\s*\}\)/)?.[0] ?? ''
  assert.ok(signUpCall.includes('captchaToken'), 'signUp must forward captchaToken')

  const signInCall =
    authCtxSrc.match(/supabase\.auth\.signInWithPassword\([\s\S]*?\n\s*\}\)/)?.[0] ?? ''
  assert.ok(signInCall.includes('captchaToken'), 'signInWithPassword must forward captchaToken')
})

test('signUp still forwards attribution alongside the captcha token', () => {
  // The captcha wiring edits the same options object attribution rides in.
  // Clobbering it would silently break first-touch signup attribution.
  const signUpCall = authCtxSrc.match(/supabase\.auth\.signUp\([\s\S]*?\n\s*\}\)/)?.[0] ?? ''
  assert.ok(
    signUpCall.includes('getAttribution()'),
    'signUp must still carry attribution — captcha must not displace it'
  )
})

// ---------------------------------------------------------------------------
// Graceful degradation: unconfigured captcha must not lock anyone out
// ---------------------------------------------------------------------------

test('captcha is a no-op until the site key exists', () => {
  // This is what lets the code ship before the Cloudflare/Supabase dashboard
  // steps are done, and what keeps a Cloudflare outage from bricking login.
  assert.ok(
    captchaSrc.includes('if (!SITE_KEY) return null'),
    'AuthCaptcha must render nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset'
  )
  assert.ok(
    /if \(!captchaEnabled\) return null/.test(captchaSrc),
    'requireCaptchaToken must pass through when captcha is not configured'
  )
})

test('requireCaptchaToken blocks a missing token ONCE enabled', () => {
  // The degradation path must not swallow the enabled path — otherwise the
  // gate is decorative and bots submit with no token at all.
  const fn = captchaSrc.match(/export function requireCaptchaToken[\s\S]*?\n\}/)?.[0] ?? ''
  assert.ok(fn.includes('if (!token)'), 'must reject a null token when enabled')
})

test('expiry and error clear the held token', () => {
  // A stale token left in state submits and fails server-side.
  assert.ok(captchaSrc.includes('onExpire={() => onToken(null)}'), 'onExpire must clear the token')
  assert.ok(captchaSrc.includes('onError={() => onToken(null)}'), 'onError must clear the token')
})

// ---------------------------------------------------------------------------
// CSP must admit Turnstile on ALL THREE directives it uses
// ---------------------------------------------------------------------------

test('CSP allows challenges.cloudflare.com in script-src, frame-src and connect-src', () => {
  // Caught on the live production header before the site key was ever set: the
  // CSP allowed only GTM/Vercel scripts and Stripe frames, so Turnstile would
  // have failed SILENTLY — no widget, no token, and once Supabase's Bot and
  // Abuse Protection is enabled, nobody can log in with no visible cause.
  // Missing any ONE of the three is enough to break it, so assert each.
  for (const directive of ['script-src', 'frame-src', 'connect-src']) {
    const line = nextConfig
      .split('\n')
      .find((l) => l.includes(`"${directive} `) || l.trimStart().startsWith(`"${directive}`))
    assert.ok(line, `${directive} must exist in the CSP`)
    assert.ok(
      line.includes('https://challenges.cloudflare.com'),
      `${directive} must allow challenges.cloudflare.com or Turnstile fails silently`
    )
  }
})

// ---------------------------------------------------------------------------
// The service worker must never serve a stale auth page
// ---------------------------------------------------------------------------

test('service worker serves auth routes network-first, never from cache', () => {
  // A REAL USER WAS LOCKED OUT by this on Jul 28 2026: `/_next/static/` is
  // cache-first, so her browser replayed the pre-captcha login chunk. No widget
  // rendered, no token could exist, and the submit guard refused with "Please
  // complete the verification check below" — a check with nothing to check.
  // The server was correct the entire time.
  const authBlock = swSrc.match(/\/\/ Auth surfaces[\s\S]*?\n  \}/)?.[0] ?? ''
  assert.ok(authBlock, 'sw.js must special-case auth routes before the cache-first branch')
  for (const route of ['/login', '/register', '/forgot-password']) {
    assert.ok(
      authBlock.includes(route),
      `${route} must bypass the service worker cache — a stale auth bundle locks users out`
    )
  }
  assert.ok(
    /event\.respondWith\(fetch\(event\.request\)\)/.test(authBlock),
    'auth routes must go straight to the network with no cache fallback'
  )
})

test('the auth bypass is registered BEFORE the cache-first static branch', () => {
  // Order is the whole fix. Service worker fetch handlers return on first
  // match, so an auth check placed after the `/_next/static/` branch never runs
  // for the chunk that actually matters.
  const authIdx = swSrc.indexOf('// Auth surfaces')
  const staticIdx = swSrc.indexOf("url.pathname.startsWith('/_next/static/')")
  assert.ok(authIdx > -1 && staticIdx > -1, 'both branches must exist')
  assert.ok(
    authIdx < staticIdx,
    'the auth bypass must come first, or the cache-first branch wins and the bug returns'
  )
})

// ---------------------------------------------------------------------------
// The existing Gmail dot-abuse gate must survive the captcha edit
// ---------------------------------------------------------------------------

test('register still enforces the Jul 23 signup email gate', () => {
  // Two independent defenses against different attacks — the captcha stops
  // scripted Tor signups, the email gate stops one-inbox dot-abuse farming.
  // Neither replaces the other.
  assert.ok(
    registerSrc.includes('signupEmailRejection(email)'),
    'the Gmail dot-abuse gate must remain — captcha does not supersede it'
  )
})

// ---------------------------------------------------------------------------
// ss_real_users must never be readable by anon again
// ---------------------------------------------------------------------------

test('the view is revoked from anon and authenticated', () => {
  assert.ok(/REVOKE ALL ON ss_real_users FROM anon/.test(fixSql), 'must revoke from anon')
  assert.ok(
    /REVOKE ALL ON ss_real_users FROM authenticated/.test(fixSql),
    'must revoke from authenticated — a logged-in user reading every email is also a leak'
  )
})

test('the view runs security_invoker, not as its owner', () => {
  // Defense in depth: even if a future migration re-grants SELECT, running as
  // the CALLER means anon hits the auth.users lockdown and still gets nothing.
  // Match the DDL clause specifically, not the word appearing in a comment —
  // an earlier version of this assertion passed on the prose alone.
  assert.ok(
    /CREATE OR REPLACE VIEW ss_real_users\s+WITH \(security_invoker = on\)/.test(fixSql),
    'view must be declared WITH (security_invoker = on) so it stops bypassing auth.users protection'
  )
})

test('only the service role may read it', () => {
  assert.ok(
    /GRANT SELECT ON ss_real_users TO service_role/.test(fixSql),
    'service_role is the correct access level for an owner-facing analytics view'
  )
})

test('the dot-abuse row filter is unchanged by the security fix', () => {
  // This migration is about WHO can read the view, not WHICH rows it returns.
  // Silently changing the filter would corrupt real-signup analytics.
  assert.ok(
    fixSql.includes("lower(split_part(au.email, '@', 2)) IN ('gmail.com', 'googlemail.com')"),
    'row filter must still mirror email-normalize.ts isGmailDotAbuse()'
  )
  assert.ok(fixSql.includes('>= 3'), 'the 3-dot threshold must be preserved')
})
