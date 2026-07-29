/**
 * Guard test — the installed PWA must boot on the canonical origin.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Bailey, July 29 2026, reproduced on video: closing and reopening the
 * home-screen app returned her to the login page every time. An earlier fix
 * that day had corrected a real cold-launch bug in AuthContext, but this is a
 * SECOND, INDEPENDENT cause, and it is infrastructural rather than logical.
 *
 * `seoulsister.com` and `www.seoulsister.com` are SEPARATE BROWSER ORIGINS.
 * The apex serves nothing but 307 redirects to www — verified live against
 * every path tested, including `/`, `/dashboard`, `/login`, `/sw.js` and
 * `/manifest.webmanifest`. Two consequences, both invisible in code review:
 *
 *   1. localStorage is partitioned per origin, so the Supabase session written
 *      on www CANNOT BE READ from the apex. An app anchored to the apex boots,
 *      redirects, and finds no session on the way through.
 *   2. `/sw.js` on the apex answers with a redirect, not JavaScript, so
 *      `navigator.serviceWorker.register()` REJECTS. Every apex install has
 *      silently had no service worker at all — which also meant the CACHE_NAME
 *      deploy fence could never reach those users.
 *
 * The manifest had `start_url: '/'` with no `scope` and no `id`. A RELATIVE
 * start_url resolves against whichever origin the user installed from, so an
 * install begun at seoulsister.com produced exactly the broken app above.
 * Absolute values pin it to the origin that actually holds the session.
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

const manifestSrc = read('src', 'app', 'manifest.ts')
const layoutSrc = read('src', 'app', 'layout.tsx')
const swRegSrc = read('src', 'components', 'pwa', 'ServiceWorkerRegistration.tsx')

const CANONICAL = 'https://www.seoulsister.com'

// ---------------------------------------------------------------------------
// start_url / scope / id must be absolute and canonical
// ---------------------------------------------------------------------------

test('start_url is ABSOLUTE, not a bare slash', () => {
  // The entire bug. A relative '/' inherits the installing origin.
  assert.doesNotMatch(
    manifestSrc,
    /start_url: '\/'/,
    "start_url: '/' is RELATIVE — it resolves against whichever origin the user " +
      'installed from. An apex install then boots on an origin that 307s away ' +
      'and cannot see its own session, so the app opens on /login every launch.'
  )
  assert.match(
    manifestSrc,
    /start_url: `\$\{ORIGIN\}\//,
    'start_url must be pinned to the absolute canonical origin.'
  )
})

test('scope keeps the installed app on the canonical origin', () => {
  assert.match(
    manifestSrc,
    /scope: `\$\{ORIGIN\}\//,
    'Without a scope, navigating to the apex drops out of the installed context.'
  )
})

test('id pins app identity so existing installs update in place', () => {
  assert.match(
    manifestSrc,
    /id: `\$\{ORIGIN\}\//,
    'Without an id, changing start_url can register a SECOND app rather than ' +
      'updating the one already on the home screen.'
  )
})

test('the manifest origin is www and matches metadataBase', () => {
  assert.match(
    manifestSrc,
    new RegExp(`const ORIGIN = '${CANONICAL}'`),
    `The canonical origin must be ${CANONICAL} — the origin that serves real ` +
      'responses and therefore holds the session.'
  )
  // A drift between these two is how the split re-opens.
  assert.match(
    layoutSrc,
    new RegExp(`metadataBase: new URL\\('${CANONICAL}'\\)`),
    'metadataBase and the manifest ORIGIN must agree, or canonical URLs and the ' +
      'installed app disagree about which origin is real.'
  )
})

test('no manifest field points at the bare apex', () => {
  // Catches a future edit that reintroduces the redirecting origin.
  const apexRefs = manifestSrc.match(/https:\/\/seoulsister\.com/g) ?? []
  assert.equal(
    apexRefs.length,
    0,
    'The apex serves only 307 redirects — including for /sw.js and the manifest ' +
      'itself. No manifest field may reference it.'
  )
})

// ---------------------------------------------------------------------------
// A failed service-worker registration must not be silent
// ---------------------------------------------------------------------------

test('service-worker registration failure is logged, not swallowed', () => {
  assert.doesNotMatch(
    swRegSrc,
    /\.catch\(\(\) => \{\s*\/\/ Service worker registration is non-critical\s*\}\)/,
    'The empty catch hid the fact that apex installs had NO service worker at ' +
      'all for months. A rejected registration must be reported.'
  )
  assert.match(
    swRegSrc,
    /console\.error\(/,
    'Lost the registration-failure log — this failure class is invisible otherwise.'
  )
})

test('the worker is asked to update on every launch', () => {
  // A returning visitor otherwise sits on a stale worker, which is how a
  // shipped auth fix failed to reach the user it was written for.
  assert.match(
    swRegSrc,
    /registration\.update\(\)/,
    'Lost registration.update() — returning users can stay pinned to an old worker.'
  )
})
