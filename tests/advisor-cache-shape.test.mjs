/**
 * Guard test — Yuri advisor prompt-cache shape.
 *
 * Prevents regression of the prompt-cache cost bug fixed 2026-07-10 (ported from
 * LGAAS / "Richard"). The bug: a minute-granularity ## RIGHT NOW clock was
 * appended to the END of the cached `system` block. Because prompt caching is a
 * prefix match, that one ticking value invalidated the whole ~22K-token cached
 * prefix on every message — warm turns paid a ~21K cache-WRITE floor (measured:
 * advisor warm-turn min cache-write 21,240 vs the healthy widget's 0) instead of
 * reading the cache cheaply.
 *
 * The fix splits the volatile clock into a SEPARATE, UNMARKED system block after
 * the cache breakpoint, so the cached body stays byte-stable across the minute
 * boundary. This test asserts that structural contract against the source, so a
 * future edit that folds a Date-derived value back into the cached body fails
 * here (zero tokens, ~ms) instead of silently re-inflating cost in production.
 *
 * Pure source assertions — no compile, no API, no DB. Run: `npm test`.
 *
 * NOTE: Yuri's fix is the SIMPLER HALF of the LGAAS fix — her clock tail was
 * already in `system` (correct place), so she needs only the clock split, not
 * LGAAS's trailing role:'system' message machinery. Don't "restore" that here.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const advisorSrc = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'yuri', 'advisor.ts'),
  'utf8'
)

// Isolate the body of buildSystemPrompt() so "is X inside the cached builder"
// assertions are scoped, not fooled by matches elsewhere in the file.
function buildSystemPromptBody(src) {
  const start = src.indexOf('export function buildSystemPrompt(')
  assert.notEqual(start, -1, 'buildSystemPrompt not found — did it get renamed/unexported?')
  // Walk braces from the first { after the signature to its matching close.
  const open = src.indexOf('{', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  throw new Error('could not find end of buildSystemPrompt')
}

test('buildSystemPrompt returns the split shape { cachedPrompt, specialistBlock, clockBlock }', () => {
  const body = buildSystemPromptBody(advisorSrc)
  // Positive structure (note 3: assert what the code produces, not just absence).
  assert.match(
    body,
    /return\s*{[\s\S]*cachedPrompt:[\s\S]*specialistBlock[\s\S]*clockBlock[\s\S]*}/,
    'split path must return { cachedPrompt, specialistBlock, clockBlock } — both volatile ' +
      'blocks delivered separately, after the cache breakpoint'
  )
  assert.match(
    advisorSrc,
    /interface BuiltSystemPrompt/,
    'BuiltSystemPrompt result type must exist (the split contract)'
  )
})

test('the ## RIGHT NOW clock is built into clockBlock, NOT pushed into the cached parts[]', () => {
  const body = buildSystemPromptBody(advisorSrc)

  // The clock header must be assigned to the separate clockBlock variable.
  assert.match(
    body,
    /const clockBlock\s*=\s*`[^`]*## RIGHT NOW/s,
    '## RIGHT NOW must be assigned to clockBlock, delivered after the cache breakpoint'
  )

  // And it must NOT be appended to `parts` (the cached body). This is the exact
  // regression that caused the bug: parts.push(`... ## RIGHT NOW ...`).
  assert.doesNotMatch(
    body,
    /parts\.push\([^)]*## RIGHT NOW/s,
    'REGRESSION: ## RIGHT NOW is being pushed into the cached parts[] — this re-introduces the per-minute cache invalidation'
  )
})

test('no minute-granularity clock value is interpolated into the cached body', () => {
  const body = buildSystemPromptBody(advisorSrc)

  // Find where the cached body is assembled (everything that becomes cachedPrompt
  // via parts.join). Split the function at the clockBlock definition; everything
  // BEFORE it is the cached-body construction.
  const clockDefIdx = body.indexOf('const clockBlock')
  assert.notEqual(clockDefIdx, -1, 'clockBlock definition not found')
  const cachedConstruction = body.slice(0, clockDefIdx)

  // The volatile minute value is `nowTime` (from fmtTime, hour:minute precision).
  // It must never appear in the cached-body construction — only in clockBlock.
  assert.doesNotMatch(
    cachedConstruction,
    /\$\{\s*nowTime\s*\}/,
    'REGRESSION: nowTime (minute-granularity clock) is interpolated into the cached body — invalidates the cache every minute'
  )
})

test('the stream call delivers the clock as a SEPARATE system block after the cached, marked block', () => {
  // The cached body carries cache_control ephemeral; the clock block does NOT
  // (an unmarked block after the breakpoint is uncached — correct for volatile).
  assert.match(
    advisorSrc,
    /text:\s*cachedPrompt,\s*cache_control:\s*{\s*type:\s*'ephemeral'\s*}/,
    'cachedPrompt must be the ephemeral-marked (cached) system block'
  )
  assert.match(
    advisorSrc,
    /systemBlocks\.push\(\s*{\s*type:\s*'text',\s*text:\s*clockBlock\s*}\s*\)/,
    'clockBlock must be pushed as a SEPARATE, UNMARKED system block (no cache_control)'
  )
  // Guard the negative: the clock block must not carry a cache_control marker.
  assert.doesNotMatch(
    advisorSrc,
    /text:\s*clockBlock,\s*cache_control/,
    'REGRESSION: clockBlock must NOT be cached — that would re-freeze the minute value into the prefix'
  )
})

test('the kill switch exists and defaults ON (revert without a deploy)', () => {
  assert.match(
    advisorSrc,
    /CLOCK_SPLIT_ENABLED\s*=\s*process\.env\.YURI_CLOCK_SPLIT_ENABLED\s*!==\s*'false'/,
    'default-on kill switch YURI_CLOCK_SPLIT_ENABLED must exist'
  )
})

// ---------------------------------------------------------------------------
// Volatile-composition guard (the SECOND, independent invalidator — Jul 13 2026)
//
// The clock (above) was one per-turn-mutable value in the cached prefix. A byte-diff
// of Bailey's real conversations found two MORE, both of which made the cached
// block's CONTENT a function of the current user message:
//
//   1. classifyIntent(message) gated which USER CONTEXT sections got loaded, so
//      sections blinked in and out per turn (measured: 9 of 11 turns broke the
//      cache; first diff as early as char 36,469 — 41% into the prompt).
//   2. detectSpecialist(message) appended the ACTIVE SPECIALIST block into the
//      cached body, so it appeared/vanished as routing changed mid-conversation.
//
// Warm A/B on the live API: cache_creation_tokens 34K/turn -> 0, warm cost/turn
// -83.2%. These tests fail on the commit that would reintroduce either defect.
// ---------------------------------------------------------------------------

const memorySrc = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'yuri', 'memory.ts'),
  'utf8'
)

test('the ACTIVE SPECIALIST block is NOT pushed into the cached parts[]', () => {
  const body = buildSystemPromptBody(advisorSrc)

  // It must be assigned to its own variable, delivered after the breakpoint.
  assert.match(
    body,
    /specialistBlock\s*=\s*`\\n---\\n# ACTIVE SPECIALIST/s,
    'the specialist body must be assigned to specialistBlock, not appended to the cached parts[]'
  )

  // The regression shape: parts.push(`...# ACTIVE SPECIALIST...`) unconditionally.
  // (The kill-switch-OFF path legitimately pushes `specialistBlock` — a variable —
  // back into parts[], so we forbid the LITERAL heading being pushed, not the var.)
  assert.doesNotMatch(
    body,
    /parts\.push\(\s*`[^`]*# ACTIVE SPECIALIST/s,
    'REGRESSION: the ACTIVE SPECIALIST literal is being pushed into the cached parts[] — ' +
      'detectSpecialist() is recomputed every turn, so this re-introduces per-turn cache invalidation'
  )
})

test('buildSystemPrompt returns specialistBlock, and the stream delivers it UNMARKED after the cached block', () => {
  assert.match(
    advisorSrc,
    /interface BuiltSystemPrompt[\s\S]*specialistBlock:\s*string/,
    'BuiltSystemPrompt must carry specialistBlock (the split contract)'
  )
  assert.match(
    advisorSrc,
    /systemBlocks\.push\(\s*{\s*type:\s*'text',\s*text:\s*specialistBlock\s*}\s*\)/,
    'specialistBlock must be pushed as a SEPARATE, UNMARKED system block (no cache_control)'
  )
  assert.doesNotMatch(
    advisorSrc,
    /text:\s*specialistBlock,\s*cache_control/,
    'REGRESSION: specialistBlock must NOT be cached — it varies per turn with detectSpecialist()'
  )
})

test('the cached block composition does NOT depend on the current message (intent gating is off)', () => {
  // loadAll drives every `loadAll || topics.has(...)` gate in loadUserContext. If it
  // is computed purely from classifyIntent(message), the cached prefix's SECTION LIST
  // becomes a function of what the user just typed — the exact bug.
  assert.match(
    memorySrc,
    /const\s+loadAll\s*=\s*VOLATILE_SPLIT_ENABLED\s*\|\|\s*topics\.has\('general'\)/,
    'REGRESSION: loadAll must be forced true by VOLATILE_SPLIT_ENABLED. If it is computed ' +
      'only from classifyIntent(), context sections blink in/out per turn and invalidate the cached prefix.'
  )
})

test('the volatile-split kill switch exists and defaults ON (revert without a deploy)', () => {
  for (const [label, src] of [['memory.ts', memorySrc], ['advisor.ts', advisorSrc]]) {
    assert.match(
      src,
      /VOLATILE_SPLIT_ENABLED\s*=\s*process\.env\.YURI_VOLATILE_SPLIT_ENABLED\s*!==\s*'false'/,
      `default-on kill switch YURI_VOLATILE_SPLIT_ENABLED must exist in ${label} ` +
        '(both halves of the fix must revert together)'
    )
  }
})
