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

test('the chat logs its first response on the line directly before the early return', () => {
  assert.match(SRC,
    /\n  await logAIUsage\(onboardingUsageRow\('yuri_onboarding', MODELS\.chat, first\.usage, userId, conversationId\)\)\n  if \(yielded \|\| first\.stop_reason !== 'refusal'\) return\n/)
})

test('the refusal re-run is logged as the function\'s final statements, priced as MODELS.primary', () => {
  assert.match(SRC,
    /\n  const rerun = await stream\.finalMessage\(\)\n  await logAIUsage\(onboardingUsageRow\('yuri_onboarding', MODELS\.primary, rerun\.usage, userId, conversationId\)\)\n\}\n/)
})

test('the extraction logs directly after its call, priced as MODELS.background, with the user id', () => {
  assert.match(SRC,
    /\n  \)\n\n?  await logAIUsage\(onboardingUsageRow\('onboarding_extraction', MODELS\.background, response\.usage, userId\)\)\n  const block = response\.content\[0\]\n/)
  assert.match(read('src/app/api/yuri/onboarding/route.ts'), /await extractSkinProfileData\(messages, userId\)/)
})

test('no call site logs the API-echoed model name', () => {
  assert.doesNotMatch(SRC, /onboardingUsageRow\([^)]*\.model\b/)
  assert.match(read('src/lib/ai-usage-logger.ts'), /\| 'yuri_onboarding'/)
})
