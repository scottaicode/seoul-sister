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

// ---------------------------------------------------------------------------
// Recovery path for installs ALREADY anchored to the wrong origin
// ---------------------------------------------------------------------------
//
// The manifest fix only governs NEW installs. An icon already added from the
// apex keeps booting there forever, and — the trap — it really is running
// standalone, so BOTH install surfaces suppress themselves via isStandalone().
// Without an explicit wrong-origin branch, the one user who cannot log in is
// the one user who gets told nothing.

const tipSrc2 = read('src', 'components', 'pwa', 'AddToHomeScreenTip.tsx')
const noticeSrc = read('src', 'components', 'pwa', 'WrongOriginNotice.tsx')
const loginSrc2 = read('src', 'app', '(auth)', 'login', 'page.tsx')

test('the tip card detects a wrong-origin install', () => {
  assert.match(
    tipSrc2,
    /window\.location\.hostname/,
    'Lost the origin read — the card must know which origin it is running on.'
  )
  assert.match(
    tipSrc2,
    /=== 'seoulsister\.com'/,
    'Lost the wrong-origin comparison — a broken install is standalone, so the ' +
      'card suppresses itself and the user is stranded with no way out.'
  )
})

test('the wrong-origin branch is checked BEFORE the standalone suppression', () => {
  // Order is the entire fix: isStandalone() returns true for a broken install,
  // so a wrong-origin check placed after it is DEAD CODE for exactly the users
  // who need it.
  //
  // Scoped to the useEffect body on purpose. An earlier version of this test
  // used indexOf over the whole file, which matched the FUNCTION DEFINITION
  // (declared above the effect) and therefore passed even with the call in the
  // wrong place — it did not fail when the bug was reintroduced.
  const effect = tipSrc2.match(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[\]\)/)
  assert.ok(effect, 'Could not locate the useEffect body — update this test.')
  const body = effect[1]

  const wrongIdx = body.indexOf('if (isWrongOrigin())')
  const standaloneIdx = body.indexOf('if (isStandalone()) return')
  assert.ok(
    wrongIdx > -1,
    'The wrong-origin branch must be CALLED inside the effect, not merely defined.'
  )
  assert.ok(standaloneIdx > -1, 'The standalone suppression must exist.')
  assert.ok(
    wrongIdx < standaloneIdx,
    'isWrongOrigin() must be evaluated first. After the standalone early-return ' +
      'it is unreachable for exactly the users who need it.'
  )
})

test('the re-install card cannot be dismissed away', () => {
  assert.match(
    tipSrc2,
    /\{!reinstall && \(/,
    'The dismiss controls must be withheld on the re-install card — it is the ' +
      'only route out of an app that cannot hold a login.'
  )
})

test('the re-install instructions name the correct origin', () => {
  assert.match(tipSrc2, /www\.seoulsister\.com/, 'The card must tell the user WHERE to re-add from.')
  assert.match(
    tipSrc2,
    /delete it|Delete the/i,
    'Re-adding without deleting the old icon leaves the broken one in place.'
  )
})

test('the login screen also carries the escape route', () => {
  // A user stuck in the loop may never reach the dashboard — that IS the symptom.
  assert.match(
    loginSrc2,
    /<WrongOriginNotice \/>/,
    'The login page must render the notice; the dashboard card sits behind this screen.'
  )
  assert.match(
    noticeSrc,
    /hostname === 'seoulsister\.com'/,
    'The notice must gate on the apex origin.'
  )
  assert.match(
    noticeSrc,
    /www\.seoulsister\.com/,
    'The notice must name the correct origin to re-add from.'
  )
})
