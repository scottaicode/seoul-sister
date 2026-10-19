/**
 * Guard: the shared Anthropic client, executed against the REAL SDK.
 *
 * WHY (Oct 19 2026): every other test stubs getAnthropicClient(), so a client
 * wrapper that broke messages.stream() for all three Yuri chat surfaces passed
 * all 1,328 tests and tsc. The wrapper returned `p.then(...)`, a native Promise
 * without APIPromise.withResponse(), which MessageStream calls internally.
 * Found by a Fable 5.1 review that executed the SDK; this test does the same.
 *
 * src/lib/anthropic.ts is transpiled and evaluated with the project's real
 * @anthropic-ai/sdk; only `fetch` is stubbed, and every outgoing body is
 * captured so the wire format is asserted, not the code.
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const projectRequire = createRequire(join(root, 'package.json'))
const sent = []

globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body)
  sent.push(body)
  if (body.stream) {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"x","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":0}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ].join('')
    return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } })
}

/** Evaluate src/lib/anthropic.ts as CommonJS with the real SDK, under a given env. */
function loadClientModule(env = {}) {
  const saved = {}
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v }
  try {
    const js = ts.transpileModule(readFileSync(join(root, 'src/lib/anthropic.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    const module = { exports: {} }
    new Function('require', 'module', 'exports', js)(projectRequire, module, module.exports)
    return module.exports
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
}

process.env.ANTHROPIC_API_KEY = 'sk-test'
const mod = loadClientModule({ AI_BACKGROUND_MODEL: '' })
const client = mod.getAnthropicClient()

test('messages.stream() works through the wrapped client (all three Yuri chat surfaces use it)', async () => {
  const fm = await client.messages.stream({ model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }).finalMessage()
  assert.equal(fm.content[0].text, 'hi')
})

test('create() still returns the SDK promise (withResponse intact)', () => {
  const p = client.messages.create({ model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] })
  assert.equal(typeof p.withResponse, 'function')
  return p
})

test('a Sonnet 5.5 request leaves with adaptive thinking at low effort and no sampling params', async () => {
  sent.length = 0
  await client.messages.create({ model: 'claude-sonnet-5-5', max_tokens: 10, temperature: 0.3, top_k: 5, messages: [{ role: 'user', content: 'x' }] })
  assert.deepEqual(sent[0].thinking, { type: 'adaptive' })
  assert.deepEqual(sent[0].output_config, { effort: 'low' })
  assert.equal('temperature' in sent[0], false)
  assert.equal('top_k' in sent[0], false)
})

test('a Sonnet 5.5 stream is adapted too', async () => {
  sent.length = 0
  await client.messages.stream({ model: 'claude-sonnet-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }).finalMessage()
  assert.deepEqual(sent[0].thinking, { type: 'adaptive' })
})

test('kill switch: a Sonnet 4.5 request leaves untouched, and AI_BACKGROUND_MODEL selects it', async () => {
  sent.length = 0
  await client.messages.create({ model: 'claude-sonnet-4-5-20250929', max_tokens: 10, temperature: 0.3, messages: [{ role: 'user', content: 'x' }] })
  assert.equal(sent[0].temperature, 0.3)
  assert.equal('thinking' in sent[0], false)
  assert.equal(mod.MODELS.background, 'claude-sonnet-5-5')
  assert.equal(loadClientModule({ AI_BACKGROUND_MODEL: 'claude-sonnet-4-5-20250929' }).MODELS.background, 'claude-sonnet-4-5-20250929')
})
