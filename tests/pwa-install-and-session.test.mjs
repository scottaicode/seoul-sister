/**
 * Guard test — PWA install discoverability + session persistence.
 *
 * THE DEFECTS THIS PREVENTS FROM RETURNING
 *
 * 1. The install prompt was DEAD CODE ON IPHONE. Every code path lived inside a
 *    `beforeinstallprompt` listener, and that event is Chromium-only — iOS
 *    Safari never fires it. So the prompt could not appear for any iPhone user,
 *    ever. Seoul Sister's founder and its most engaged subscriber both used the
 *    product for months without learning it installs ("I HAD NO IDEA ABOUT THE
 *    APP THING / THAT CHANGES EVERYTHING", July 29 2026), and one had been
 *    retyping the URL every session. For a Gen Z beauty audience that is most
 *    of the user base.
 *
 * 2. The browser Supabase client was built with NO auth options at all —
 *    `createClient(url, key)`. Sessions did not reliably survive, so a
 *    subscriber re-logged in on nearly every launch. That also makes an
 *    installed PWA feel WORSE than a bookmark, so it gates the install push.
 *
 * Source-structural assertions. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const promptSrc = read('src', 'components', 'pwa', 'InstallPrompt.tsx')
const tipSrc = read('src', 'components', 'pwa', 'AddToHomeScreenTip.tsx')
const supabaseSrc = read('src', 'lib', 'supabase.ts')
const dashboardSrc = read('src', 'app', '(app)', 'dashboard', 'page.tsx')

// --- iOS must have a path that does not depend on beforeinstallprompt -------

test('install prompt detects iOS', () => {
  assert.match(
    promptSrc,
    /iPad\|iPhone\|iPod/,
    'Lost iOS detection — the prompt reverts to Chromium-only dead code on iPhone.'
  )
  assert.match(
    promptSrc,
    /maxTouchPoints/,
    'iPadOS 13+ reports as Macintosh; without the touch-point check iPads are missed.'
  )
})

test('the iOS path does NOT wait for beforeinstallprompt', () => {
  // The whole bug: everything lived inside that listener. On iOS the branch
  // must set state directly, because the event never arrives.
  assert.match(
    promptSrc,
    /if \(isIOSSafari\(\)\)[\s\S]{0,200}setIosMode\(true\)/,
    'The iOS branch must show instructions directly, never via beforeinstallprompt.'
  )
})

test('iOS users are shown the actual two taps', () => {
  // Apple exposes no install API. Instructions are the only thing that works.
  assert.match(promptSrc, /Add to Home Screen/, 'Lost the iOS instruction text.')
  assert.match(promptSrc, /Share/, 'Lost the Share-button step.')
})

test('install UI is hidden once actually installed', () => {
  for (const [name, src] of [['prompt', promptSrc], ['tip', tipSrc]]) {
    assert.match(
      src,
      /display-mode: standalone/,
      `${name}: must not nag someone who already installed.`
    )
    assert.match(
      src,
      /standalone\?: boolean/,
      `${name}: lost the iOS-specific navigator.standalone check.`
    )
  }
})

test('iOS-only browsers that cannot install are excluded', () => {
  // Chrome/Firefox/Edge on iOS cannot add to home screen — only Safari can.
  assert.match(
    promptSrc,
    /CriOS\|FxiOS/,
    'Showing Safari instructions inside iOS Chrome sends users to a button that is not there.'
  )
})

// --- The tip sheet Bailey asked for ----------------------------------------

test('the dashboard renders the add-to-home-screen tip', () => {
  assert.match(
    dashboardSrc,
    /<AddToHomeScreenTip \/>/,
    'The tip Bailey asked for is no longer rendered.'
  )
})

test('the tip is dismissible and stays dismissed', () => {
  assert.match(tipSrc, /ss-home-screen-tip-dismissed/, 'Lost the dismissal key.')
  assert.match(
    tipSrc,
    /Don&apos;t show this again/,
    'Lost the explicit permanent-dismiss control.'
  )
})

// --- Session persistence ---------------------------------------------------

test('the browser client explicitly persists sessions', () => {
  assert.match(
    supabaseSrc,
    /persistSession: true/,
    'Sessions must persist explicitly — a re-login on every launch makes the PWA worse than a bookmark.'
  )
  assert.match(
    supabaseSrc,
    /autoRefreshToken: true/,
    'Without refresh, a returning user is bounced to /login holding an expired token.'
  )
})

test('the storage key is pinned to the library default', () => {
  // Pinning protects against a silent library-upgrade logout. Pinning to the
  // DEFAULT value means shipping the fix does not log anyone out either.
  assert.match(
    supabaseSrc,
    /storageKey: `sb-\$\{new URL\(supabaseUrl\)\.hostname\.split\('\.'\)\[0\]\}-auth-token`/,
    'Storage key must stay pinned to supabase-js\'s own derived default — changing it force-logs-out every user.'
  )
})
