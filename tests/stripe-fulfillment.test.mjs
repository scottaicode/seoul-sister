/**
 * Guard test — dual-trigger Stripe fulfillment.
 *
 * Before July 21 2026 fulfillment was WEBHOOK-ONLY. Stripe redirects the buyer
 * back the instant payment succeeds, but `checkout.session.completed` arrives
 * out-of-band a moment later — so `ss_user_profiles.plan` still read 'free'
 * when they landed, and the app showed a paywall to someone who had just paid.
 * A slow webhook is survivable; a delayed or failed one leaves a paying
 * customer being asked to pay twice.
 *
 * Stripe's documented pattern (docs.stripe.com/checkout/fulfillment) is
 * DUAL-TRIGGER: the webhook AND a server-side session retrieval when the buyer
 * returns, both calling the same idempotent fulfillment. Neither alone is
 * enough — the webhook covers the customer who closes the tab, the confirm
 * endpoint covers the customer staring at the screen right now.
 *
 * This was found the night before the first two real humans ever attempted the
 * paid signup. Zero checkout.session.completed events existed in Stripe.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const checkoutSrc = readFileSync(
  join(root, 'src', 'app', 'api', 'stripe', 'checkout', 'route.ts'),
  'utf8'
)
const confirmSrc = readFileSync(
  join(root, 'src', 'app', 'api', 'stripe', 'confirm', 'route.ts'),
  'utf8'
)
const onboardingSrc = readFileSync(
  join(root, 'src', 'app', '(app)', 'onboarding', 'page.tsx'),
  'utf8'
)
const shellSrc = readFileSync(
  join(root, 'src', 'components', 'layout', 'AppShell.tsx'),
  'utf8'
)

test('success_url carries the Checkout session id', () => {
  // Assert on the successUrl VALUE, not the file. The placeholder also appears
  // in the explanatory comment above it, which would mask a real regression.
  const m = checkoutSrc.match(/successUrl:\s*`([^`]*)`/)
  assert.ok(m, 'successUrl not found in the checkout route')
  assert.ok(
    m[1].includes('{CHECKOUT_SESSION_ID}'),
    `successUrl is "${m[1]}" — without {CHECKOUT_SESSION_ID} the app cannot confirm payment on return, and fulfillment silently reverts to webhook-only`
  )
})

test('the confirm endpoint verifies payment with Stripe, not with the URL', () => {
  assert.ok(
    /sessions\.retrieve\(/.test(confirmSrc),
    'must retrieve the session from Stripe — the redirect alone proves nothing'
  )
  assert.ok(
    /payment_status === 'unpaid'/.test(confirmSrc),
    "must check payment_status before granting a plan, or typing the success URL would grant a subscription"
  )
})

test('a checkout session can only upgrade the user it belongs to', () => {
  assert.ok(
    /session\.metadata\?\.user_id !== user\.id/.test(confirmSrc),
    'ownership check missing — a leaked session id could upgrade the wrong account'
  )
  assert.ok(/403/.test(confirmSrc), 'ownership mismatch must be rejected')
})

test('confirm requires authentication', () => {
  assert.ok(
    /authorization.*Bearer|Bearer ', ''/.test(confirmSrc) && /401/.test(confirmSrc),
    'the endpoint must reject unauthenticated callers'
  )
})

test('the plan update happens BEFORE the bookkeeping upsert', () => {
  const planIdx = confirmSrc.indexOf("from('ss_user_profiles')")
  const subIdx = confirmSrc.indexOf("from('ss_subscriptions')")
  assert.ok(planIdx > 0 && subIdx > 0, 'both writes must exist')
  assert.ok(
    planIdx < subIdx,
    'unlock the product first: a failing ss_subscriptions write must never leave a paying customer locked out'
  )
})

test('onboarding calls confirm on arrival and clears the id', () => {
  assert.ok(
    /\/api\/stripe\/confirm/.test(onboardingSrc),
    'the success page must trigger confirmation'
  )
  assert.ok(
    /session_id/.test(onboardingSrc),
    'it must read session_id from the URL'
  )
  assert.ok(
    /replaceState/.test(onboardingSrc),
    'the session id must be stripped from the URL so a refresh cannot replay it'
  )
})

test('AppShell still absorbs webhook lag before showing the paywall', () => {
  const start = shellSrc.indexOf('async function checkAccess()')
  assert.ok(start > 0, 'checkAccess not found')
  const body = shellSrc.slice(start, start + 2200)
  assert.ok(
    /attempt < 3|for \(let attempt/.test(body),
    'the retry window is gone — a customer whose webhook is a second late gets the paywall again'
  )
  // Never grant access without a real paid plan.
  assert.ok(
    /data\.plan === 'free'/.test(body) && /router\.replace\('\/subscribe'\)/.test(body),
    'access must still require a genuine paid plan after the grace window'
  )
})
