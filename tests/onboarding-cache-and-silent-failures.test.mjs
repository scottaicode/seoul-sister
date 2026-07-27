/**
 * Guard test — onboarding prompt-cache integrity + two silent-failure fixes.
 *
 * July 27 2026, found by an adversarial sweep after the Beplain Makiol incident.
 * The sweep was told to hunt for MORE instances of patterns that had already
 * bitten twice. It found three.
 *
 * 1. ONBOARDING KILLED ITS OWN PROMPT CACHE (`onboarding.ts`).
 *    The whole system prompt sat in one `cache_control` block, and per-turn
 *    state — including `JSON.stringify(extractedSoFar)`, which grows every time
 *    a field is captured — was injected MID-PROMPT at "## Current State", with
 *    ~800 chars of static rules after it. Prompt caching matches on PREFIX, so
 *    every extraction invalidated the entire block. Cache CREATION bills at
 *    1.25x base input, so the "cached" prompt cost MORE than not caching.
 *    This is the v11.1.0 regression (measured 60x on the widget), fixed there
 *    and never here — on the one Yuri endpoint reachable without a subscription.
 *
 * 2. `update_user_product` WAS `save_routine`'S UNFIXED TWIN (`tools.ts`).
 *    Same shape as the bug fixed that morning: it classifies a match as
 *    'matched_loose', tells the user in prose, writes the degraded row, and
 *    logged NOTHING. It is the PRIMARY library-write path, so the loose-match
 *    rate was invisible there while being measurable for routines.
 *
 * 3. A BARE CATCH SWALLOWED SKIN-PROFILE EXTRACTION FAILURE
 *    (`api/yuri/onboarding/route.ts`), commented "non-critical". It is not
 *    non-critical: it is the call that writes the profile. On failure,
 *    onboarding streamed a normal reply and a normal done event while the
 *    profile silently never filled — the v10.3.4 class.
 *
 * LIMITS: asserts code shape only. Cache behavior is proven by `cache_read > 0`
 * in ss_ai_usage, not by this file.
 *
 * Pure — no compile, no DB, no network. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const onboardingLib = read('src', 'lib', 'yuri', 'onboarding.ts')
const onboardingRoute = read('src', 'app', 'api', 'yuri', 'onboarding', 'route.ts')
const tools = read('src', 'lib', 'yuri', 'tools.ts')

// ---------------------------------------------------------------------------
// 1. PROMPT-CACHE INTEGRITY
// ---------------------------------------------------------------------------

test('the cached system prompt contains NO per-turn interpolation', () => {
  const fnStart = onboardingLib.indexOf('export function buildOnboardingSystemPrompt')
  const fnEnd = onboardingLib.indexOf('export function buildOnboardingTurnState')
  assert.ok(fnStart !== -1, 'buildOnboardingSystemPrompt is gone')
  assert.ok(fnEnd !== -1 && fnEnd > fnStart, 'buildOnboardingTurnState is gone')
  const cachedBody = onboardingLib.slice(fnStart, fnEnd)

  // The specific killers: a growing JSON blob and the captured/missing summaries.
  assert.ok(
    !/JSON\.stringify\(extractedSoFar/.test(cachedBody),
    'per-turn JSON is back inside the CACHED prompt — this invalidates the cache ' +
      'every turn and bills cache-creation at 1.25x, costing more than no caching'
  )
  assert.ok(
    !/\$\{capturedSummary\}|\$\{missingSummary\}|\$\{qualitySection\}/.test(cachedBody),
    'per-turn state interpolation is back in the cached prompt body'
  )
  assert.ok(
    !/## Current State/.test(cachedBody),
    'the "## Current State" block is back in the cached prompt — it must live in ' +
      'the separate uncached block'
  )
})

test('per-turn state is built separately and sent UNCACHED', () => {
  assert.ok(
    /export function buildOnboardingTurnState/.test(onboardingLib),
    'the per-turn state builder is missing'
  )
  // The system array must be two blocks: static+cache_control, then turn state
  // with NO cache_control.
  const sysIdx = onboardingLib.indexOf('system: [')
  assert.ok(sysIdx !== -1, 'no system array found')
  const sysBlock = onboardingLib.slice(sysIdx, sysIdx + 400)
  // Block 1 = static prompt WITH the cache breakpoint.
  assert.ok(
    /text: systemPrompt,\s*cache_control/.test(sysBlock),
    'the static prompt no longer carries the cache_control breakpoint'
  )
  // Block 2 = per-turn state, and it must come AFTER the cached block so the
  // cached prefix stays byte-identical across turns.
  const staticAt = sysBlock.indexOf('text: systemPrompt')
  const turnAt = sysBlock.indexOf('text: turnState')
  assert.ok(turnAt !== -1, 'turn state is not sent as its own system block')
  assert.ok(
    staticAt < turnAt,
    'turn state precedes the cached static block — that changes the cached prefix every turn'
  )
})

test('turn state carries no cache_control of its own', () => {
  const sysIdx = onboardingLib.indexOf('text: turnState')
  assert.ok(sysIdx !== -1, 'turnState is not passed to the model')
  const line = onboardingLib.slice(sysIdx, sysIdx + 120)
  assert.ok(
    !/cache_control/.test(line),
    'turnState has a cache_control breakpoint — it changes per turn, so caching it ' +
      'recreates the cache every request'
  )
})

// ---------------------------------------------------------------------------
// 2. LOOSE MATCHES MUST BE LOGGED ON *BOTH* LIBRARY WRITE PATHS
// ---------------------------------------------------------------------------

test('update_user_product logs loose catalog matches', () => {
  assert.ok(
    /\[update_user_product\] loose catalog match/.test(tools),
    'update_user_product still writes a knowingly-degraded row with no server-side ' +
      'record. It is the PRIMARY library-write path — the exact blind spot that hid ' +
      "Bailey's mis-joined rows for seven weeks."
  )
})

test('save_routine still logs its loose matches too', () => {
  // Regression guard for the sibling fix — both paths or neither.
  assert.ok(
    /\[save_routine\] step not confidently matched/.test(tools),
    'save_routine lost its loose-match logging'
  )
})

// ---------------------------------------------------------------------------
// 3. NO SILENT PROFILE-EXTRACTION FAILURE
// ---------------------------------------------------------------------------

test('skin-profile extraction failure is logged, not swallowed', () => {
  assert.ok(
    !/\} catch \{\s*\n\s*\/\/ Extraction failure is non-critical/.test(onboardingRoute),
    'the bare catch is back. Extraction is the call that WRITES the profile — ' +
      'swallowing it means onboarding "succeeds" while the profile never fills.'
  )
  assert.ok(
    /skin-profile extraction FAILED/.test(onboardingRoute),
    'no error log on the extraction failure path'
  )
})

test('the turn still completes when extraction fails', () => {
  // Visibility must not come at the cost of losing the user's message: the
  // catch must still swallow the THROW (log, don't rethrow).
  const idx = onboardingRoute.indexOf('skin-profile extraction FAILED')
  assert.ok(idx !== -1, 'log line missing')
  const block = onboardingRoute.slice(idx, idx + 400)
  assert.ok(
    !/throw\s/.test(block),
    'the extraction catch now rethrows — that would kill the whole turn and lose ' +
      "the user's message, which is worse than the silent failure it replaced"
  )
})

test('finalizeOnboardingProfile failure is at least visible', () => {
  assert.ok(
    !/\} catch \{\s*\n\s*\/\/ May already be finalized/.test(onboardingRoute),
    'the second bare catch is back'
  )
  assert.ok(
    /finalizeOnboardingProfile failed/.test(onboardingRoute),
    'no log on the finalize failure path'
  )
})
