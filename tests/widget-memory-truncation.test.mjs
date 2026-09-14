/**
 * Guard tests — the visitor-memory writer must not lose a memory to its own
 * token budget, and must not file a budget failure as a prompt failure.
 *
 * THE DEFECT (found Sept 14 2026). Of 18 multi-message widget visitors since
 * Aug 1, only 4 had `memory_write_status = 'saved'`. Seven were
 * `no_json_in_response`. The cause was `max_tokens: 400`: the parse is
 * `text.match(/\{[\s\S]*\}/)`, which needs a CLOSING brace, so a truncated
 * object matched nothing at all and was filed as "the model returned no JSON".
 * A budget problem wearing the costume of a prompt problem — and the taxonomy
 * comment in persistence.ts confidently asserted those two outcomes "point at
 * different fixes (max_tokens vs prompt)".
 *
 * WHY IT GREW WORSE WITH ENGAGEMENT. The merged memory is fed back into the
 * next extraction and the prompt asks for "ALL conversations", so output grows
 * on every fire. Replaying one real visitor's actual 3/6/9 cadence against the
 * live API: 371 -> 486 -> 709 -> 947 tokens. Every FIRST write fit inside 400
 * (one landed at 391/400, i.e. by luck) and every merge after it truncated.
 *
 * That is why three visitors show `no_json_in_response` while still HOLDING a
 * memory: an early fire saved and every later one failed, freezing them at the
 * fire@3 snapshot. Stale memory, not absent memory — the worse of the two,
 * because it reads as working. It is also exactly how a named visitor lost the
 * climate and burn/tan answers she had already given, and got re-asked.
 *
 * WHY NOT A JSON-REPAIR PARSER. A truncated object always loses its LAST field,
 * which in this schema is `recommended_approach` — the field the consumer leans
 * on hardest. Repairing to salvage the rest would store a memory silently
 * missing its most-used field and stamp it `saved`. That is the fake-confidence
 * class; better to write nothing and say so.
 *
 * WHY THESE TESTS EXECUTE. Asserting `max_tokens: 2000` appears in the source
 * is the wrong-but-passing shape: it passes against a build that still infers
 * truncation from a failed regex, and it cannot see a write that happens anyway.
 * So each test below transpiles the real module with its two imports stubbed,
 * runs `generateAndSaveMemory`, and asserts on the RETURNED OUTCOME and on
 * whether the ai_memory write actually fired.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

/**
 * Load persistence.ts with `@/lib/supabase` and `@/lib/anthropic` replaced by
 * in-memory stubs, so the real function body runs against controlled responses.
 */
async function loadWithStubs({ response, onUpdate }) {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/widget/persistence.ts'),
    'utf8'
  )

  const stubbed = src
    .replace(/^import \{ getServiceClient \} from '@\/lib\/supabase'$/m, '')
    .replace(
      /^import \{ getAnthropicClient, MODELS, callAnthropicWithRetry \} from '@\/lib\/anthropic'$/m,
      ''
    )

  const prelude = `
const __calls = { create: [], updates: [] }
globalThis.__memTestCalls = __calls
const MODELS = { background: 'stub-model' }
const callAnthropicWithRetry = (fn) => fn()
const getAnthropicClient = () => ({
  messages: {
    create: async (args) => { __calls.create.push(args); return globalThis.__memTestResponse },
  },
})
function __table(name) {
  const api = {
    select: () => api,
    eq: () => api,
    single: async () => ({ data: { ai_memory: {} } }),
    update: async (patch) => {
      __calls.updates.push({ table: name, patch })
      globalThis.__memTestOnUpdate?.(name, patch)
      return { error: null }
    },
  }
  // .update(...).eq(...) must also resolve, so make eq() thenable after update.
  api.update = (patch) => {
    __calls.updates.push({ table: name, patch })
    globalThis.__memTestOnUpdate?.(name, patch)
    const chain = { eq: async () => ({ error: null }) }
    return chain
  }
  return api
}
const getServiceClient = () => ({ from: (name) => __table(name) })
`

  const js = ts.transpileModule(prelude + stubbed, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText

  globalThis.__memTestResponse = response
  globalThis.__memTestOnUpdate = onUpdate
  const mod = await import(
    'data:text/javascript;base64,' + Buffer.from(js + `\n//${Math.random()}`).toString('base64')
  )
  return { mod, calls: globalThis.__memTestCalls }
}

const COMPLETE_JSON = JSON.stringify({
  summary: 'Visitor with dry sensitive skin.',
  topics_discussed: ['barrier repair'],
  skin_concerns: ['dryness'],
  products_interested_in: ['Round Lab toner'],
  interest_level: 'engaged',
  recommended_approach: 'Lead with barrier support.',
})

test('EXECUTED: a truncated response is reported as truncated, and NOTHING is written', async () => {
  // The exact production shape: cut off mid-object, so no closing brace exists.
  const { mod, calls } = await loadWithStubs({
    response: {
      stop_reason: 'max_tokens',
      usage: { output_tokens: 2000 },
      content: [{ type: 'text', text: '```json\n{"summary":"x","topics_discussed":["a"' }],
    },
  })

  const outcome = await mod.generateAndSaveMemory('visitor-1', [
    { role: 'user', content: 'hi' },
  ])

  assert.equal(outcome, 'truncated', 'a max_tokens stop must be named, not filed as no_json')
  const memWrites = calls.updates.filter((u) => 'ai_memory' in u.patch)
  assert.equal(memWrites.length, 0, 'a truncated memory must never be persisted')
})

test('EXECUTED: a complete response saves all six fields', async () => {
  const { mod, calls } = await loadWithStubs({
    response: {
      stop_reason: 'end_turn',
      usage: { output_tokens: 420 },
      content: [{ type: 'text', text: '```json\n' + COMPLETE_JSON + '\n```' }],
    },
  })

  const outcome = await mod.generateAndSaveMemory('visitor-2', [
    { role: 'user', content: 'hi' },
  ])

  assert.equal(outcome, 'saved')
  const memWrites = calls.updates.filter((u) => 'ai_memory' in u.patch)
  assert.equal(memWrites.length, 1, 'a complete memory must be written exactly once')
  for (const field of ['summary', 'topics_discussed', 'skin_concerns',
                       'products_interested_in', 'interest_level', 'recommended_approach']) {
    assert.ok(field in memWrites[0].patch.ai_memory, `${field} must survive to the stored row`)
  }
})

test('EXECUTED: the token budget is at least 2x the largest observed production output', async () => {
  // Largest measured real output was 947 tokens (fire@16 on a live visitor's
  // replayed cadence). A budget that merely clears today's worst case will be
  // re-broken by the next engaged visitor, since output grows per fire.
  const { mod, calls } = await loadWithStubs({
    response: {
      stop_reason: 'end_turn',
      usage: { output_tokens: 420 },
      content: [{ type: 'text', text: COMPLETE_JSON }],
    },
  })
  await mod.generateAndSaveMemory('visitor-3', [{ role: 'user', content: 'hi' }])

  assert.equal(calls.create.length, 1, 'the model must actually have been called')
  assert.ok(
    calls.create[0].max_tokens >= 1900,
    `max_tokens must leave real headroom, got ${calls.create[0].max_tokens}`
  )
})

test('EXECUTED: a genuinely JSON-free response is still distinguished from truncation', async () => {
  // The two outcomes must stay separable — they point at different fixes, which
  // is what the old code only CLAIMED to do.
  const { mod } = await loadWithStubs({
    response: {
      stop_reason: 'end_turn',
      usage: { output_tokens: 12 },
      content: [{ type: 'text', text: 'I was unable to extract a profile.' }],
    },
  })
  const outcome = await mod.generateAndSaveMemory('visitor-4', [
    { role: 'user', content: 'hi' },
  ])
  assert.equal(outcome, 'no_json_in_response')
})

test('the prompt bounds the SHAPE of the memory it asks for', () => {
  // Memory is re-injected into every later turn (route.ts:767), so an unbounded
  // profile costs tokens forever and eventually outgrows any ceiling. Measured
  // growth without bounds: 1,297 -> 3,160 chars across four fires.
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/widget/persistence.ts'),
    'utf8'
  )
  const start = src.indexOf('Return JSON with these fields')
  assert.ok(start !== -1, 'the extraction prompt is missing')
  const block = src.slice(start, start + 900)
  assert.match(block, /at most 8/, 'array fields must be bounded')
  assert.match(block, /2 sentences max|2-3 sentences max/, 'prose fields must be bounded')
})
