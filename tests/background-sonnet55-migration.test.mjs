/**
 * Guard: the Sonnet 4.5 -> 5.5 background migration (Oct 19 2026).
 *
 * Sonnet 4.5 retires Nov 30 2026 (Anthropic model-deprecations page). Sonnet
 * 5.5 rejects 4.5-shaped requests and writes 10-40% more. A request asking for
 * no thinking gets adaptive thinking at effort low, not between_tools: on a real
 * conversation decision memory caught a Fitzpatrick correction 1/3 with
 * thinking off vs 3/3 adaptive-low (scripts/ab-decision-memory-thinking.ts). So:
 *   1. adaptParamsForModel must translate requests for Sonnet 5.5 ONLY, so the
 *      AI_BACKGROUND_MODEL kill switch can send 4.5 its own params.
 *   2. every background max_tokens must clear the MEASURED Sonnet 5.5 output
 *      with margin. Measured by scripts/ab-background-sonnet55-sites.ts on real
 *      inputs: the old 500 cap on pattern extraction already cut 4.5 off on
 *      5/5 conversation runs and 3/5 review runs, and 5.5 needed up to 1,164.
 *   3. no background site reads `content[0]` (a refusal has no text block).
 *
 * The adapter is EXECUTED (extracted from source), not grepped.
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const ANTH = read('src/lib/anthropic.ts')

function extractAdapter() {
  const start = ANTH.indexOf('export function adaptParamsForModel')
  let depth = 0
  let i = ANTH.indexOf('{', ANTH.indexOf(')', start))
  for (; i < ANTH.length; i++) {
    if (ANTH[i] === '{') depth++
    else if (ANTH[i] === '}' && --depth === 0) break
  }
  const tsSrc = ANTH.slice(start, i + 1).replace('export ', '')
  const js = ts.transpileModule(tsSrc, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(`const SONNET_55 = 'claude-sonnet-5-5'; ${js}; return adaptParamsForModel;`)()
}
const adapt = extractAdapter()

test('Sonnet 5.5 requests get adaptive thinking at low effort and lose sampling params', () => {
  const out = adapt({ model: 'claude-sonnet-5-5', max_tokens: 100, temperature: 0.2, top_p: 0.9, top_k: 5, messages: [] })
  assert.deepEqual(out.thinking, { type: 'adaptive' })
  assert.deepEqual(out.output_config, { effort: 'low' })
  assert.equal('top_k' in out, false)
  assert.equal('temperature' in out, false)
  assert.equal('top_p' in out, false)
  assert.deepEqual(adapt({ model: 'claude-sonnet-5-5', thinking: { type: 'disabled' } }).thinking, { type: 'adaptive' })
  assert.deepEqual(adapt({ model: 'claude-sonnet-5-5', thinking: { type: 'enabled', budget_tokens: 2000 } }).thinking, { type: 'adaptive' })
  // An explicit effort is the caller's choice and is kept.
  assert.deepEqual(adapt({ model: 'claude-sonnet-5-5', output_config: { effort: 'high' } }).output_config, { effort: 'high' })
})

test('the kill switch works: any other model passes through untouched', () => {
  const p = { model: 'claude-sonnet-4-5-20250929', max_tokens: 100, temperature: 0.2, messages: [] }
  assert.equal(adapt(p), p)
  const o = { model: 'claude-opus-5-5', max_tokens: 100, messages: [] }
  assert.equal(adapt(o), o)
})

test('MODELS.background defaults to Sonnet 5.5 and honors AI_BACKGROUND_MODEL', () => {
  assert.match(ANTH, /background: \(process\.env\.AI_BACKGROUND_MODEL \|\| SONNET_55\) as string,/)
  assert.match(ANTH, /const SONNET_55 = 'claude-sonnet-5-5'/)
  assert.match(ANTH, /if \(!params \|\| params\.model !== SONNET_55\) return params/)
})

// Measured Sonnet 5.5 maxima across two runs of scripts/ab-background-sonnet55-sites.ts
// (thinking off, then adaptive-low; n=4-5 real inputs each). Cap >= 1.5x the max.
const MEASURED = [
  ['src/lib/yuri/advisor.ts', 'generateTitle', 23],
  ['src/lib/yuri/advisor.ts', 'generateConversationSummary', 1733],
  ['src/lib/yuri/memory.ts', 'extractDecisionMemory', 1193],
  ['src/lib/learning/patterns.ts', 'extractPatternsFromConversation', 1164],
  ['src/lib/learning/patterns.ts', 'extractPatternsFromReview', 776],
  ['src/lib/yuri/onboarding.ts', 'extractSkinProfileData', 454],
  ['src/lib/pipeline/extractor.ts', 'extractProductData', 1129],
]

// The first max_tokens that is real code inside the function: a line that
// STARTS with `max_tokens:` (so a `// max_tokens: 200` comment cannot stand in
// for the value actually sent), within the function's own body.
function capIn(file, fn) {
  const s = read(file)
  const start = s.indexOf(`function ${fn}(`)
  assert.ok(start !== -1, `${fn} not found in ${file}`)
  const next = s.indexOf('\nfunction ', start + 10)
  const nextAsync = s.indexOf('\nasync function ', start + 10)
  const nextExport = s.indexOf('\nexport ', start + 10)
  const end = Math.min(...[next, nextAsync, nextExport, s.length].filter((i) => i > start))
  const m = s.slice(start, end).match(/^[ \t]*max_tokens: (\d+),/m)
  assert.ok(m, `no max_tokens in ${fn}`)
  return Number(m[1])
}

for (const [file, fn, measured] of MEASURED) {
  test(`${fn}: max_tokens clears the measured Sonnet 5.5 output (${measured}) by 1.5x`, () => {
    assert.ok(capIn(file, fn) >= Math.ceil(measured * 1.5), `${fn} cap ${capIn(file, fn)} < ${Math.ceil(measured * 1.5)}`)
  })
}

// Unmeasured sites, sized from their prompts and the one production
// measurement (widget memory: 947 tokens on 4.5 at fire@16). Floors, not exact.
const ESTIMATED = [
  ['src/lib/widget/persistence.ts', 'generateAndSaveMemory', 2000],
  ['src/lib/yuri/treatment-phase-extractor.ts', 'extractAndSaveTreatmentPhases', 2000],
  ['src/lib/yuri/advisor.ts', 'extractAndSaveInsight', 1000],
  ['src/lib/yuri/advisor.ts', 'extractContinuousLearning', 1500],
  ['src/lib/yuri/memory.ts', 'truncateWithBridge', 1500],
  ['src/lib/pipeline/ingredient-matcher.ts', 'createIngredient', 800],
  ['src/app/api/cron/seasonal-adjustments/route.ts', 'POST', 1500],
]
for (const [file, fn, floor] of ESTIMATED) {
  test(`${fn}: max_tokens at least ${floor} (unmeasured site, sized from its prompt)`, () => {
    assert.ok(capIn(file, fn) >= floor, `${fn} cap ${capIn(file, fn)} < ${floor}`)
  })
}

test('no background call site reads only the first content block', () => {
  for (const f of ['src/lib/yuri/advisor.ts', 'src/lib/yuri/memory.ts', 'src/lib/yuri/onboarding.ts', 'src/lib/yuri/treatment-phase-extractor.ts',
    'src/lib/learning/patterns.ts', 'src/lib/widget/persistence.ts', 'src/app/api/cron/seasonal-adjustments/route.ts']) {
    assert.doesNotMatch(read(f), /\.content(\[0\]|\?\.\[0\]|\.at\(0\)|\.shift\(\))/, f)
  }
})
