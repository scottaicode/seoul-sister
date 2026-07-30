/**
 * Guard test — signing out one device must NOT sign out every other device.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 30 2026)
 *
 * Bailey was sent back to the login screen almost every time she opened the
 * home-screen app. Scott, on the same build and the same origin, stayed signed
 * in. Three prior fixes chased this: the manifest origin pin, the cold-launch
 * retryable-error fix, and a localStorage→cookie mirror. Each was a real bug,
 * none was THIS bug, and all three shared one wrong assumption — that the two
 * iPhones were independent, so "works here, breaks there" had to mean a
 * per-device cause (iOS storage eviction was the leading theory).
 *
 * They are not independent. `supabase.auth.signOut()` with NO argument defaults
 * to `scope: 'global'` (installed @supabase/auth-js 2.95.3,
 * GoTrueClient.js:1572 — `async signOut(options = { scope: 'global' })`). That
 * issues POST /logout?scope=global, and GoTrue deletes EVERY auth.sessions row
 * for that user — every device, and the whole history.
 *
 * So any sign-out by either of them, on any surface, silently ended the other
 * person's session. The live Supabase auth log showed it directly:
 *
 *   00:16:46  POST /token   login   vibetrendai@gmail.com     (Scott signs in)
 *   00:16:50  POST /logout  logout  baileydonmartin@gmail.com (Bailey killed)
 *   00:18:59  POST /token   login   baileydonmartin@gmail.com (password again)
 *
 * Four seconds apart. Every one of her 4 token calls in 24h was
 * grant_type=password and NOT ONE was grant_type=refresh_token, and she held
 * exactly one session row with all older rows gone — the precise fingerprint of
 * repeated global revocation followed by a fresh password login. The earlier
 * "iOS evicted her storage" reading could not have been right: storage eviction
 * is silent on the server and produces no POST /logout at all.
 *
 * These tests assert on the SOURCE of the sign-out call sites. That is a
 * deliberate choice and worth being honest about: the ideal test would execute
 * the real handler against a fake GoTrueClient and assert the scope it receives,
 * but `signOut` lives inside a React context module that pulls in the browser
 * Supabase client at import time. A previous round of guard tests in this repo
 * passed while the bug stayed live precisely because they only checked source
 * text, so treat these as a tripwire against the specific regression (dropping
 * the scope argument), NOT as proof the flow is correct.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

// ---------------------------------------------------------------------------
// The library default is the hazard. Verify it still IS the default, so this
// whole file stops being necessary if upstream ever changes it.
// ---------------------------------------------------------------------------

test('supabase-js still defaults signOut to global scope', () => {
  const src = read(
    'node_modules',
    '@supabase',
    'auth-js',
    'dist',
    'module',
    'GoTrueClient.js'
  )
  assert.match(
    src,
    /async signOut\(options = \{ scope: 'global' \}\)/,
    'The installed auth-js no longer defaults signOut to global scope. If the ' +
      'default became "local", the explicit scope in our code is now belt-and-' +
      'braces rather than load-bearing — re-read this test before relaxing it.'
  )
})

// ---------------------------------------------------------------------------
// Our own sign-out paths must be explicitly local.
// ---------------------------------------------------------------------------

test('AuthContext signs out THIS DEVICE only', () => {
  const src = read('src', 'contexts', 'AuthContext.tsx')
  assert.match(
    src,
    /supabase\.auth\.signOut\(\{\s*scope:\s*'local'\s*\}\)/,
    'AuthContext.signOut must pass { scope: "local" }. Without it the library ' +
      'default (global) revokes every session on every device — the bug that ' +
      "made Scott's sign-out log Bailey's iPhone out four seconds later."
  )
})

test('the lib/auth helper signs out THIS DEVICE only', () => {
  const src = read('src', 'lib', 'auth.ts')
  assert.match(
    src,
    /supabase\.auth\.signOut\(\{\s*scope:\s*'local'\s*\}\)/,
    'src/lib/auth.ts exports a second signOut. Nothing imports it today, but ' +
      'this module IS live (~30 API routes import requireAuth from it), so an ' +
      'un-scoped signOut here is a loaded gun for the next caller.'
  )
})

// ---------------------------------------------------------------------------
// The real regression risk is a NEW call site added later without the scope.
// Sweep the whole tree rather than naming the five known files.
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Blank out comments before scanning for call sites.
 *
 * Necessary because the fix itself documents the hazard by quoting the bad call
 * (`supabase.auth.signOut()` appears in the explanatory comment in
 * AuthContext.tsx). Without this the sweep flags its own documentation — which
 * it did on the first run. Replacing comment bodies with spaces rather than
 * deleting them keeps line numbers accurate for the offender report.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
}

test('NO sign-out anywhere in src/ omits an explicit scope', () => {
  const offenders = []

  for (const file of walk(join(root, 'src'))) {
    const src = stripComments(readFileSync(file, 'utf8'))
    // Match `.signOut(` and capture what is inside the parens (non-greedy, one
    // level deep is enough — the argument is always an object literal or empty).
    for (const m of src.matchAll(/\.signOut\(([^)]*)\)/g)) {
      const args = m[1].trim()
      if (args === '' || !/scope\s*:/.test(args)) {
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${relative(root, file)}:${line} → .signOut(${args})`)
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'These sign-out calls pass no explicit scope, so they inherit the library ' +
      'default of "global" and will revoke the session on EVERY device the user ' +
      'owns:\n  ' +
      offenders.join('\n  ') +
      '\nPass { scope: "local" } unless you genuinely mean "sign out everywhere",' +
      ' and if you do, say so in a comment at the call site.'
  )
})

// ---------------------------------------------------------------------------
// The user-facing sign-out buttons must route through the scoped helper rather
// than reaching for the raw client.
// ---------------------------------------------------------------------------

test('sign-out buttons use the AuthContext helper, not the raw client', () => {
  const surfaces = [
    ['src', 'components', 'layout', 'Header.tsx'],
    ['src', 'app', '(app)', 'settings', 'page.tsx'],
    ['src', 'app', '(app)', 'profile', 'page.tsx'],
    ['src', 'app', '(auth)', 'subscribe', 'page.tsx'],
  ]

  for (const parts of surfaces) {
    const src = stripComments(read(...parts))
    const name = parts.join('/')
    assert.ok(
      !/supabase\.auth\.signOut/.test(src),
      `${name} calls supabase.auth.signOut directly. Every sign-out must go ` +
        'through the AuthContext helper so the local scope is applied in exactly ' +
        'one place — four surfaces each remembering to pass the scope is how ' +
        'this regresses.'
    )
  }
})
