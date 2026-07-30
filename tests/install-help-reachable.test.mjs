/**
 * Guard test — install instructions must be reachable WITHOUT logging in.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Scott and Bailey deleted their home-screen icons in order to re-add them from
 * the canonical origin (the apex-vs-www session fix), then could not find any
 * instructions: "Neither of us have this card on our landing page to help us
 * install the icon."
 *
 * Every copy of the install help lived on /dashboard, which is:
 *   - behind login — and someone who just deleted their icon may be signed out,
 *     which was the ORIGINAL bug being fixed
 *   - behind the paywall
 *   - DISMISSIBLE, so "Don't show this again" destroyed the only route forever
 *
 * Installing is a PRE-login action. The help has to live somewhere public and
 * permanent, and it has to be linked from the surfaces a stranded user actually
 * reaches: the landing page and the login screen.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const installPath = join(root, 'src', 'app', 'install', 'page.tsx')
const landingSrc = read('src', 'app', 'page.tsx')
const loginSrc = read('src', 'app', '(auth)', 'login', 'page.tsx')
const tipSrc = read('src', 'components', 'pwa', 'AddToHomeScreenTip.tsx')

// ---------------------------------------------------------------------------
// The page must exist and be public
// ---------------------------------------------------------------------------

test('/install exists', () => {
  assert.ok(
    existsSync(installPath),
    'The public install page is gone. Install help that only lives behind login ' +
      'is unreachable for the exact user who needs it — someone signed out with ' +
      'no icon.'
  )
})

const installSrc = existsSync(installPath) ? read('src', 'app', 'install', 'page.tsx') : ''

test('/install is NOT inside the authenticated route group', () => {
  // Anything under src/app/(app)/ is wrapped by AppShell, which redirects to
  // /login and then gates on a paid plan.
  assert.ok(
    !installPath.includes(join('app', '(app)')),
    '/install must not live under (app) — AppShell would bounce a signed-out user ' +
      'to /login, which is where they already are.'
  )
})

// ---------------------------------------------------------------------------
// It must be linked from where a stranded user actually lands
// ---------------------------------------------------------------------------

test('the public landing page links to /install', () => {
  assert.match(
    landingSrc,
    /href="\/install"/,
    'The landing page must link to the install page — it is the one surface ' +
      'everybody can reach, and it is literally where they looked for it.'
  )
})

test('the login page links to /install unconditionally', () => {
  // A user who just deleted their icon is on www with no icon, so an
  // apex-only notice does not fire. The link must not be conditional.
  assert.match(
    loginSrc,
    /href="\/install"/,
    'The login screen must offer install help. Every other copy sits BEHIND this ' +
      'screen, which is how Scott and Bailey got stranded.'
  )
})

test('the dashboard tip offers the permanent page too', () => {
  assert.match(
    tipSrc,
    /href="\/install"/,
    'Dismissing the card used to destroy the only instructions in the product. ' +
      'It must always link to the permanent page.'
  )
})

// ---------------------------------------------------------------------------
// The instructions have to be correct per browser, or they send people hunting
// for a button that does not exist
// ---------------------------------------------------------------------------

test('iOS-only browsers that cannot install are called out', () => {
  // Chrome/Firefox/Edge on iOS cannot add to home screen. Showing them the
  // Safari Share steps is a dead end — the same class of bug as the original
  // Chromium-only install prompt.
  assert.match(
    installSrc,
    /CriOS\|FxiOS/,
    'Lost the iOS-non-Safari detection — those users would be told to tap a ' +
      'button their browser does not have.'
  )
})

test('iPadOS is detected despite reporting as a Mac', () => {
  assert.match(
    installSrc,
    /maxTouchPoints/,
    'iPadOS 13+ reports a Macintosh UA; without the touch-point check iPads get ' +
      'desktop instructions.'
  )
})

test('the page names the canonical origin, not the apex', () => {
  // Asserted via the constant rather than every interpolation site, so moving the
  // value into a variable (which is what the code does) still passes while
  // pointing it at the apex fails.
  assert.match(
    installSrc,
    /const CANONICAL_HOST = 'www\.seoulsister\.com'/,
    'The canonical host must be www — an icon added from the apex cannot hold a ' +
      'session, which is the whole bug being fixed.'
  )
  assert.match(
    installSrc,
    /window\.location\.hostname/,
    'The page must read the origin it is actually running on.'
  )
  assert.match(
    installSrc,
    /=== 'seoulsister\.com'/,
    'The page must DETECT being on the apex and redirect first, or it will happily ' +
      'walk someone through installing the broken version.'
  )
})

test('it tells returning users to delete the old icon first', () => {
  // Adding without deleting leaves the broken icon in place.
  assert.match(
    installSrc,
    /[Dd]elete/,
    'Must tell a returning user to remove the old icon — otherwise they end up ' +
      'with two, one of which still cannot sign in.'
  )
})

test('the install page has no dismiss mechanism', () => {
  // It is a permanent reference page. A dismissible one recreates the bug.
  assert.ok(
    !/localStorage\.setItem\([^)]*dismiss/i.test(installSrc),
    'The permanent install page must never be dismissible.'
  )
})
