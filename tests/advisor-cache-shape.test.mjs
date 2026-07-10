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

test('buildSystemPrompt returns the split shape { cachedPrompt, clockBlock }', () => {
  const body = buildSystemPromptBody(advisorSrc)
  // Positive structure (note 3: assert what the code produces, not just absence).
  assert.match(
    body,
    /return\s*{\s*cachedPrompt:[^}]*clockBlock[^}]*}/s,
    'split path must return { cachedPrompt, clockBlock } with the clock delivered separately'
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
