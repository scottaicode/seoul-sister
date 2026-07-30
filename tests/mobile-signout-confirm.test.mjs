/**
 * Guard test — the mobile menu's Sign Out must not fire on a single stray tap.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 30 2026)
 *
 * Bailey was repeatedly landing back on the login screen. The root cause was
 * `signOut()` defaulting to `scope: 'global'` (fixed separately — see
 * AuthContext.tsx), which made ONE tap revoke her session on every device. But
 * the reason a tap happened at all is this control's geometry:
 *
 *   - It is the LAST item in the scrollable mobile menu.
 *   - It is FULL WIDTH (`w-full px-4 py-3`) — the entire row is a hit target.
 *   - The fixed BottomNav is `z-50 fixed bottom-0` while the menu overlay is
 *     `z-40`, so the nav bar renders ON TOP of the menu's bottom edge, and the
 *     `pb-24` that fixes that overlap parks Sign Out right at the boundary.
 *
 * So a thumb aimed at a BottomNav icon or at the last nav link that lands a few
 * pixels off hits an irreversible action. Bailey had already reported a
 * scrolling bug in this exact region (see the pb-24 comment in Header.tsx).
 *
 * Worth recording what was RULED OUT, so nobody re-chases it: the theory that
 * she was a paying user bounced to /subscribe and tapping its "Log out" escape
 * hatch is FALSE. `ss_user_profiles.paywall_reached_at` is set-once and is NULL
 * for her — she has never been shown the paywall.
 *
 * These tests assert on the component source. That is a real limitation: there
 * is no DOM harness in this repo, so they cannot prove the rendered flow works.
 * They exist to catch the specific regression of the confirm step being removed
 * or bypassed. Verified to fail when the confirm is reverted.
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
const header = readFileSync(join(root, 'src', 'components', 'layout', 'Header.tsx'), 'utf8')
const bottomNav = readFileSync(
  join(root, 'src', 'components', 'layout', 'BottomNav.tsx'),
  'utf8'
)

/** Strip comments so prose describing the hazard never satisfies a test. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
}

const code = stripComments(header)

// ---------------------------------------------------------------------------
// The geometry that makes a mistap likely. If this changes, the confirm step
// may no longer be needed — but that should be a decision, not a side effect.
// ---------------------------------------------------------------------------

test('the BottomNav still overlaps the mobile menu (the reason for the confirm)', () => {
  assert.match(
    bottomNav,
    /fixed bottom-0[^"'`]*z-50|z-50[^"'`]*fixed bottom-0/,
    'BottomNav is expected to be fixed bottom-0 at z-50.'
  )
  assert.match(
    code,
    /fixed inset-0 z-40 md:hidden/,
    'The mobile menu overlay is expected at z-40 — BENEATH the BottomNav. If ' +
      'this stacking was fixed, revisit whether the two-step confirm is still ' +
      'the right protection rather than silently leaving both.'
  )
})

// ---------------------------------------------------------------------------
// The confirm step itself.
// ---------------------------------------------------------------------------

test('the mobile Sign Out arms a confirm instead of signing out', () => {
  // The first tap must only set state — never call handleSignOut directly.
  assert.match(
    code,
    /onClick=\{\(\) => setConfirmSignOut\(true\)\}/,
    'The mobile menu Sign Out button must open a confirm (setConfirmSignOut(true)), ' +
      'not sign out on the first tap. A full-width button in the BottomNav ' +
      'overlap zone is one stray thumb away from ending the session.'
  )
})

test('no mobile menu button calls handleSignOut on a first tap', () => {
  // Find the mobile overlay block and assert handleSignOut only appears inside
  // the confirmed branch (i.e. alongside setConfirmSignOut(false)).
  const overlayStart = code.indexOf('fixed inset-0 z-40 md:hidden')
  assert.ok(overlayStart > 0, 'Could not locate the mobile menu overlay.')
  const overlay = code.slice(overlayStart)

  for (const m of overlay.matchAll(/onClick=\{\(\) => \{([^}]*)\}\}/g)) {
    const body = m[1]
    if (/handleSignOut\(\)/.test(body)) {
      assert.match(
        body,
        /setConfirmSignOut\(false\)/,
        'A mobile-menu handler calls handleSignOut() without passing through the ' +
          `confirm step. Offending handler body: ${body.trim()}`
      )
    }
  }
})

test('the confirm offers an explicit Cancel', () => {
  assert.match(
    code,
    /setConfirmSignOut\(false\)/,
    'There must be a way to back out of the confirm.'
  )
  assert.match(
    header,
    /Cancel/,
    'The confirm needs a visible Cancel affordance — the whole point is that the ' +
      'recovery path is obvious to someone who tapped by accident.'
  )
})

test('closing the menu discards a half-answered confirm', () => {
  assert.match(
    code,
    /if \(!mobileMenuOpen\) setConfirmSignOut\(false\)/,
    'Reopening the menu must not show a stale "Sign out?" prompt the user did ' +
      'not just ask for — that is its own mistap risk.'
  )
})

// ---------------------------------------------------------------------------
// Scope: the confirm is a MOBILE fix. Don't let it silently change the desktop
// menu, and don't let the underlying scope fix regress from this file either.
// ---------------------------------------------------------------------------

test('the desktop profile menu keeps its direct Sign Out', () => {
  // The desktop dropdown is a small, deliberate target that is not overlapped by
  // anything — a confirm there would be friction with no hazard to justify it.
  assert.match(
    code,
    /onClick=\{handleSignOut\}/,
    'The desktop profile-menu Sign Out is expected to call handleSignOut directly.'
  )
})

test('Header never calls the raw client signOut', () => {
  assert.ok(
    !/supabase\.auth\.signOut/.test(code),
    'Header must sign out through the AuthContext helper, which is the single ' +
      'place the local scope is applied.'
  )
})
