/**
 * Guard test — OAuth sign-ups go to Yuri onboarding, not the paywall.
 *
 * Oct 14 2026: 13 of 14 Google sign-ups since the Jul 15 "paywall at the
 * value moment" change hit /subscribe 3 seconds after account creation and
 * never spoke to Yuri. /auth/callback sent every free user to /subscribe
 * regardless of onboarding. Executes the real function (transpiled), and the
 * callback page must actually use it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
// post-sign-in.ts imports one pure function; its module is inlined so the two load as one.
const src = readFileSync(join(root, 'src', 'lib', 'yuri', 'setup-requirements.ts'), 'utf8') + '\n' +
  readFileSync(join(root, 'src', 'lib', 'auth', 'post-sign-in.ts'), 'utf8').replace("import { stillInSetup } from '@/lib/yuri/setup-requirements'\n", '')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { postSignInDestination, appGateDestination } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)

test('new free OAuth user (the failing shape) goes to onboarding', () => {
  assert.equal(postSignInDestination({ plan: 'free', onboarding_completed: false }), '/onboarding')
})

test('missing profile row goes to onboarding, not the wall', () => {
  assert.equal(postSignInDestination(null), '/onboarding')
  assert.equal(postSignInDestination({ plan: null, onboarding_completed: null }), '/onboarding')
})

test('onboarded but unpaid goes to the paywall', () => {
  assert.equal(postSignInDestination({ plan: 'free', onboarding_completed: true }), '/subscribe')
})

test('paid users are unchanged', () => {
  assert.equal(postSignInDestination({ plan: 'pro_monthly', onboarding_completed: true }), '/dashboard')
  assert.equal(postSignInDestination({ plan: 'pro_monthly', onboarding_completed: false }), '/onboarding')
})

test('the callback page routes through postSignInDestination and nothing else', () => {
  const page = readFileSync(join(root, 'src', 'app', 'auth', 'callback', 'page.tsx'), 'utf8')
  // Nov 7 2026: wrapped in afterSignIn so a member returning from a check-in
  // email lands on /yuri?ask=... — afterSignIn replaces ONLY the '/dashboard'
  // result (tests/weekly-checkin.test.mjs), so onboarding/subscribe still win.
  assert.match(page, /router\.replace\(afterSignIn\(postSignInDestination\(profile\), next\)\)/)
  assert.doesNotMatch(page, /router\.replace\('\/subscribe'\)/)
})

// Nov 14 2026: the in-app gate checked the plan first, so a new free account
// that left the setup chat through the menu was sent to the pricing page 29
// seconds after signing up. A second-model review then found the profile flag
// turns true as soon as a skin type is known, so the gate needs the setup
// status too, and that a finished setup must never be sent back to the setup
// chat (that page sends it on again: a loop).
//
// Closed world: every plan x profile flag x setup status, and the exact answer.
test('app gate: every account state has exactly one destination', () => {
  const FREE = ['free', null]
  const PAID = ['monthly', 'pro_monthly']
  const expected = (paid, flag, status) => {
    const finished = status === 'completed' || status === 'skipped'
    // Still in setup goes to setup, member or not (Nov 17 2026). No setup row,
    // or one that could not be read: a profile stands in for it.
    const inSetup = status === 'in_progress' || (!finished && !flag)
    if (inSetup) return '/onboarding'
    return paid ? null : '/subscribe'
  }
  let n = 0
  for (const plan of [...FREE, ...PAID]) {
    for (const flag of [true, false, null]) {
      for (const status of [null, undefined, 'in_progress', 'completed', 'skipped']) {
        const got = appGateDestination({ plan, onboarding_completed: flag }, status)
        assert.equal(got, expected(PAID.includes(plan), !!flag, status), `${plan} / ${flag} / ${status}`)
        n++
      }
    }
  }
  assert.equal(n, 60)
})

test('app gate: the shapes that failed, spelled out', () => {
  // The Nov 14 visitor: free, no profile yet, greeting shown.
  assert.equal(appGateDestination({ plan: 'free', onboarding_completed: false }, 'in_progress'), '/onboarding')
  // Two answers in: the flag is already true, setup is not finished.
  assert.equal(appGateDestination({ plan: 'free', onboarding_completed: true }, 'in_progress'), '/onboarding')
  // No profile row at all.
  assert.equal(appGateDestination(null, null), '/onboarding')
  // Finished or skipped setup, unpaid: the pricing page, never back to setup.
  assert.equal(appGateDestination({ plan: 'free', onboarding_completed: true }, 'completed'), '/subscribe')
  assert.equal(appGateDestination({ plan: 'free', onboarding_completed: false }, 'completed'), '/subscribe')
  assert.equal(appGateDestination({ plan: null, onboarding_completed: true }, 'skipped'), '/subscribe')
  // A member mid-setup is held there, even with a skin type on file. This
  // used to be `null`: creating an account starts the free week, so it let
  // every new person out after their first message (Nov 17 2026).
  assert.equal(appGateDestination({ plan: 'monthly', onboarding_completed: true }, 'in_progress'), '/onboarding')
  // A member whose setup is marked finished is never sent back to it.
  assert.equal(appGateDestination({ plan: 'monthly', onboarding_completed: false }, 'completed'), null)
})

test('the app gate decides only through appGateDestination', () => {
  const shell = readFileSync(join(root, 'src', 'components', 'layout', 'AppShell.tsx'), 'utf8')
  assert.match(shell, /destination = appGateDestination\(data, setupStatus\)/)
  assert.match(shell, /if \(destination\) \{\s*router\.replace\(destination\)/)
  // No hand-written route to either page, in any quoting, by push or replace.
  assert.doesNotMatch(shell, /router\.(replace|push)\(\s*['"`]\/(subscribe|onboarding)/)
  // The setup chat must stay reachable without passing the gate.
  assert.match(shell, /const ALWAYS_ALLOWED = pathname === '\/onboarding' \|\| pathname\.startsWith\('\/settings'\)/)
  // A failed profile read lets the page through instead of reading as "no profile".
  assert.match(shell, /if \(profileRes\.error\) \{[\s\S]{0,200}setReady\(true\)\s*return/)
})
