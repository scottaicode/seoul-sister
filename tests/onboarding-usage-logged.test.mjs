/**
 * Guard test — onboarding model calls are logged to ss_ai_usage, with real numbers.
 *
 * Oct 17 2026: ss_ai_usage held ZERO onboarding rows all-time, so onboarding
 * cost was missing from the per-user numbers pricing is decided on. A review
 * then showed the first version of this test passed with token counts zeroed
 * (the June 2026 tokens_in=0 bug) and with the log call inside a dead branch.
 *
 * The row builder is EXECUTED. The call sites are pinned by adjacency: each log
 * must be a top-level statement directly beside the line it guards.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const js = ts.transpileModule(read('src/lib/yuri/onboarding-usage.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { onboardingUsageRow } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('every token count reaches the row unchanged', () => {
  const row = onboardingUsageRow('yuri_onboarding', 'claude-opus-5-5',
    { input_tokens: 1234, output_tokens: 567, cache_read_input_tokens: 8910, cache_creation_input_tokens: 111 }, 'u1', 'c1')
  assert.deepEqual(row, {
    feature: 'yuri_onboarding', model: 'claude-opus-5-5',
    inputTokens: 1234, outputTokens: 567, cacheReadTokens: 8910, cacheCreationTokens: 111,
    userId: 'u1', conversationId: 'c1', cached: true,
  })
})

test('missing cache fields read as zero, not undefined', () => {
  const row = onboardingUsageRow('onboarding_extraction', 'claude-sonnet-4-5-20250929',
    { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: null }, 'u1')
  assert.equal(row.cacheReadTokens, 0)
  assert.equal(row.cacheCreationTokens, 0)
  assert.equal(row.cached, false)
  assert.equal(row.conversationId, null)
})

const SRC = read('src/lib/yuri/onboarding.ts')

test('every round of the setup chat is logged straight after it finishes, priced as the model that ran it', () => {
  // One call site inside the lookup loop serves every round: the first reply,
  // each round after a lookup, and the re-run on MODELS.primary after a refusal
  // (`model` is reassigned before that re-run, so its row is priced as primary).
  assert.match(SRC,
    /\n    const final = await stream\.finalMessage\(\)\n    await logAIUsage\(onboardingUsageRow\('yuri_onboarding', model, final\.usage, userId, conversationId\)\)\n/)
  assert.match(SRC, /\n  let model: string = MODELS\.chat\n/)
  assert.match(SRC, /console\.warn\('\[onboarding\] chat model declined; re-running on', MODELS\.primary\)\n        model = MODELS\.primary\n/)
  // Nothing between the model call's result and its log can return or throw first.
  assert.equal((SRC.match(/onboardingUsageRow\('yuri_onboarding'/g) ?? []).length, 1)
})

test('the extraction logs directly after its call, priced as MODELS.background, with the user id', () => {
  assert.match(SRC,
    /\n  \)\n\n?  await logAIUsage\(onboardingUsageRow\('onboarding_extraction', MODELS\.background, response\.usage, userId\)\)\n  const block = response\.content\.find\(\(b\) => b\.type === 'text'\) \?\? \{ type: 'none' as const \}\n/)
  assert.match(read('src/app/api/yuri/onboarding/route.ts'), /await extractSkinProfileData\(messages, userId\)/)
})

test('no call site logs the API-echoed model name', () => {
  assert.doesNotMatch(SRC, /onboardingUsageRow\([^)]*\.model\b/)
  assert.match(read('src/lib/ai-usage-logger.ts'), /\| 'yuri_onboarding'/)
})
