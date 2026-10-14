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
const src = readFileSync(join(root, 'src', 'lib', 'auth', 'post-sign-in.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { postSignInDestination } = await import(
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
  assert.match(page, /router\.replace\(postSignInDestination\(profile\)\)/)
  assert.doesNotMatch(page, /router\.replace\('\/subscribe'\)/)
})
