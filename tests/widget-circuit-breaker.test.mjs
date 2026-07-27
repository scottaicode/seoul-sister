/**
 * Guard test — global widget spend circuit breaker.
 *
 * Context (2026-07-27): every widget limit that existed was scoped to ONE
 * visitor or ONE IP — 12/visitor lifetime, 40/IP/30d, 25/IP/day. None bounded
 * TOTAL spend, so a traffic surge across many IPs (each individually legal)
 * was unbounded Opus cost with no circuit anywhere. This module is the only
 * ceiling covering the whole surface.
 *
 * Each assertion below locks a property that, if reverted, reintroduces a
 * specific real failure mode. Verified by reintroducing each bug and watching
 * the corresponding test fail.
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

const breakerSrc = read('src', 'lib', 'widget', 'circuit-breaker.ts')
const routeSrc = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
const clientSrc = read('src', 'components', 'widget', 'TryYuriSection.tsx')

// ---------------------------------------------------------------------------
// The ceiling is GLOBAL — the entire reason this exists
// ---------------------------------------------------------------------------

test('breaker key is fixed, NOT per-visitor or per-IP', () => {
  // A key containing ip/visitor would silently recreate a per-visitor limit —
  // which is precisely what already existed and failed to bound total spend.
  const keyLine = breakerSrc.match(/const GLOBAL_KEY = .*/)?.[0] ?? ''
  assert.ok(keyLine.includes("'widget-global-daily'"), 'GLOBAL_KEY must be a fixed literal')
  assert.ok(
    !/\$\{|ip|visitor/i.test(keyLine),
    'GLOBAL_KEY must not interpolate ip/visitor — that would make it non-global'
  )
})

test('ceiling is env-overridable so a real surge can be raised without a deploy', () => {
  assert.match(breakerSrc, /process\.env\.WIDGET_GLOBAL_DAILY_CEILING/)
})

// ---------------------------------------------------------------------------
// AI-First constraint #5 — the breaker must not silently starve the data
// ---------------------------------------------------------------------------

test('breaker trip is logged to ss_pipeline_runs (never a silent wall)', () => {
  // The v10.3.4 / May-5 silent-failure class: a degraded path that leaves no
  // trace means a surge is invisible until the bill arrives.
  assert.match(breakerSrc, /logPipelineRun/)
  assert.match(breakerSrc, /widget_circuit_breaker/)
  assert.match(breakerSrc, /console\.warn/)
})

test('trip logging is de-duped so a surge cannot bury the signal', () => {
  assert.match(breakerSrc, /TRIP_LOG_INTERVAL_MS/)
  assert.match(breakerSrc, /lastTripLoggedAt/)
})

test('degraded path still captures the email (a surge is when leads matter most)', () => {
  const block = routeSrc.match(/if \(budget\.tripped\)[\s\S]*?\n    \}/)?.[0] ?? ''
  assert.ok(block.length > 0, 'breaker block must exist in the route')
  assert.ok(
    block.includes('recordCapturedEmail'),
    'the degraded path must still capture a lead, or surge traffic is wasted'
  )
})

// ---------------------------------------------------------------------------
// AI-First constraint #6 — degraded state must be HONEST, not a fake Yuri
// ---------------------------------------------------------------------------

test('degraded message does not fabricate skincare advice', () => {
  // Yuri does not run on this path, so she must not appear to speak. A canned
  // reply in her voice is the v10.2.1 fake-confidence failure, and the Yuri
  // Sole Authority Principle forbids a non-Yuri surface inventing advice.
  const advice = /\b(routine|serum|cleanser|SPF|niacinamide|retinol|ingredient|apply|recommend)\b/i
  assert.ok(
    !advice.test(breakerSrc.match(/export const BREAKER_MESSAGE[\s\S]*?$/)?.[0] ?? ''),
    'BREAKER_MESSAGE must not contain templated skincare advice'
  )
})

// ---------------------------------------------------------------------------
// Availability — a broken meter must not take the product down
// ---------------------------------------------------------------------------

test('breaker fails OPEN when the counter itself errors', () => {
  const fn = breakerSrc.match(/export async function consumeGlobalBudget[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(fn, /catch/)
  assert.match(fn, /tripped: false/, 'a failed budget check must NOT block Yuri')
})

// ---------------------------------------------------------------------------
// Ordering & semantics — never upsell someone over OUR capacity problem
// ---------------------------------------------------------------------------

test('breaker is checked before any model work', () => {
  const breakerIdx = routeSrc.indexOf('consumeGlobalBudget')
  const modelIdx = routeSrc.indexOf('anthropic.messages.stream')
  assert.ok(breakerIdx > 0 && modelIdx > 0)
  assert.ok(breakerIdx < modelIdx, 'a tripped breaker must cost zero tokens')
})

test('breaker is checked AFTER the per-visitor cap', () => {
  // Otherwise a visitor who is personally out of preview sees a capacity
  // message instead of their own paywall — losing the conversion moment.
  assert.ok(
    routeSrc.indexOf('isVisitorAtLimit') < routeSrc.indexOf('consumeGlobalBudget')
  )
})

test('capacity response never sets limitReached (no paywall on our budget)', () => {
  const block = routeSrc.match(/if \(budget\.tripped\)[\s\S]*?\n    \}/)?.[0] ?? ''
  assert.match(block, /capacityLimited: true/)
  assert.match(block, /limitReached: false/)
})

test('client handles capacityLimited BEFORE rateLimited', () => {
  // The route sets both flags (so older clients degrade gracefully); if the
  // generic rateLimited branch ran first, the email card would never open.
  const cap = clientSrc.indexOf('errBody?.capacityLimited')
  const rate = clientSrc.indexOf('errBody?.rateLimited')
  assert.ok(cap > 0 && rate > 0)
  assert.ok(cap < rate, 'capacityLimited must be checked first')
})

test('client stashes the question and opens email capture on a capacity trip', () => {
  const block = clientSrc.match(/if \(errBody\?\.capacityLimited\)[\s\S]*?\n          \}/)?.[0] ?? ''
  assert.match(block, /setPendingQuestion/, "the visitor's question must survive")
  assert.match(block, /setEmailGateActive\(true\)/)
  assert.ok(
    !block.includes('setServerLimitReached'),
    'a capacity trip must never trigger the paywall'
  )
})
