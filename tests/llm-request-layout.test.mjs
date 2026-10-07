/**
 * Executed contract for src/lib/llm-request.ts — the request layout shared by
 * the widget, authenticated Yuri and onboarding (Opus 5.5 migration, Oct 7 2026).
 *
 * Runs the REAL functions (transpiled), not source text: the cache property that
 * matters — "everything before the breakpoint on turn N is byte-identical on
 * turn N+1" — is a property of what the functions RETURN, and a source regex
 * passes against a broken implementation (see CLAUDE.md, Silent Failure).
 *
 * Why the layout matters (measured, scripts/ab-model-widget-multiturn.ts): with
 * per-turn facts in a system block, history cache writes climbed 2K -> 9K
 * tokens/turn; with them after the newest user message they stay flat ~1K.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const src = readFileSync('src/lib/llm-request.ts', 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText
const mod = { exports: {} }
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}))
const L = mod.exports

// Strip breakpoint markers and treat a plain string as one text block: the
// cache keys on content, and the multi-turn A/B measured string history reading
// the cache written by the block-form message.
function norm(m) {
  const content = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content
  return JSON.stringify({ role: m.role, content: content.map(({ cache_control, ...b }) => b) })
}
const markerIndex = (msgs) =>
  msgs.findIndex((m) => Array.isArray(m.content) && m.content.some((b) => b.cache_control))
const markerCount = (msgs) =>
  msgs.reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter((b) => b.cache_control).length : 0), 0)

const H = [
  { role: 'user', content: 'my skin is oily by noon' },
  { role: 'assistant', content: 'Where do you live? Humidity matters.' },
]

test('widget layout: turn N prefix through the breakpoint is byte-identical on turn N+1', () => {
  const ctx1 = '## Conversation State\n- message #2'
  const ctx2 = '## Conversation State\n- message #3'
  const turn1 = L.withTrailingContext(L.markLastUserMessage([...H, { role: 'user', content: 'Austin, TX' }]), ctx1)
  const turn2 = L.withTrailingContext(
    L.markLastUserMessage([...H, { role: 'user', content: 'Austin, TX' }, { role: 'assistant', content: 'Then gel textures.' }, { role: 'user', content: 'which gel?' }]),
    ctx2
  )
  const bp = markerIndex(turn1)
  assert.equal(bp, H.length, 'breakpoint must sit on the visitor message')
  for (let i = 0; i <= bp; i++) assert.equal(norm(turn2[i]), norm(turn1[i]), `prefix differs at message ${i}`)
  assert.ok(!JSON.stringify(turn1.slice(0, bp + 1)).includes('message #2'), 'per-turn context leaked above the breakpoint')
  assert.deepEqual(turn1[turn1.length - 1], { role: 'system', content: ctx1 })
})

test('trailing context: empty context adds nothing; placement stays valid across tool rounds', () => {
  const base = [...H, { role: 'user', content: 'hi' }]
  assert.equal(L.withTrailingContext(base, '   ').length, base.length)
  const withCtx = L.withTrailingContext(base, 'facts')
  withCtx.push({ role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'search_products', input: {} }] })
  withCtx.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '[]' }] })
  const sysAt = withCtx.findIndex((m) => m.role === 'system')
  // API rule: a mid-conversation system message follows a user message and is last or followed by an assistant turn.
  assert.equal(withCtx[sysAt - 1].role, 'user')
  assert.equal(withCtx[sysAt + 1].role, 'assistant')
})

test('advisor/onboarding layout: history breakpoint is placed BEFORE the trailing message (order matters)', () => {
  const msgs = [...H, { role: 'user', content: 'and at night?' }]
  const right = L.withTrailingContext(L.markPenultimateAssistant(msgs), 'clock')
  assert.equal(markerCount(right), 1)
  assert.equal(right[markerIndex(right)].role, 'assistant')
  // Applied after the trailing message, len-2 is the USER message: no breakpoint at all.
  const wrong = L.markPenultimateAssistant(L.withTrailingContext(msgs, 'clock'))
  assert.equal(markerCount(wrong), 0, 'documents why the call order in advisor/onboarding is load-bearing')
})

test('markLastUserMessage marks exactly one block, including image messages', () => {
  const img = [...H, { role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://x/y.jpg' } }, { type: 'text', text: 'what is this?' }] }]
  const out = L.markLastUserMessage(img)
  assert.equal(markerCount(out), 1)
  assert.ok(out[2].content[1].cache_control, 'marker belongs on the last block')
  assert.ok(!img[2].content[1].cache_control, 'input must not be mutated')
})

test('tool round passes the model content back UNCHANGED (Opus 5.5 thinking blocks)', () => {
  const final = [
    { type: 'thinking', thinking: '', signature: 'sig-abc' },
    { type: 'text', text: 'Let me check.' },
    { type: 'tool_use', id: 'tu1', name: 'search_products', input: { query: 'cosrx' } },
  ]
  const recon = [{ id: 'tu1', name: 'search_products', input: '{"query":"cosrx"}' }]
  assert.deepEqual(L.assistantTurnForToolRound(final, recon, true), final, 'any edit to this turn invalidates the thinking block on Opus 5.5')
  // A thinking model's turn cannot be rebuilt from tool_use alone: fail loudly.
  assert.throws(() => L.assistantTurnForToolRound(null, recon, true))
  // The non-thinking fallback model may use the reconstruction.
  assert.deepEqual(L.assistantTurnForToolRound(null, recon, false), [{ type: 'tool_use', id: 'tu1', name: 'search_products', input: { query: 'cosrx' } }])
})

test('nextRoundAction: every branch, including the ones that must NOT repeat', () => {
  const base = { stopReason: 'end_turn', onFallbackModel: false, toolUses: 0, productTurn: true, round: 0, alreadyRetried: false, draftNamesProducts: true, retryEnabled: true }
  const act = (o) => L.nextRoundAction({ ...base, ...o })
  assert.equal(act({}), 'retry_search')
  assert.equal(act({ alreadyRetried: true }), 'finalize', 'a second retry would loop on paid calls')
  assert.equal(act({ draftNamesProducts: false }), 'finalize', 'a reply that names nothing to look up is never retried')
  assert.equal(act({ productTurn: false }), 'finalize')
  assert.equal(act({ retryEnabled: false }), 'finalize', 'the kill switch must disable the retry')
  assert.equal(act({ round: 1 }), 'finalize')
  assert.equal(act({ toolUses: 2 }), 'run_tools')
  assert.equal(act({ stopReason: 'refusal' }), 'fallback_model')
  assert.equal(act({ stopReason: 'refusal', onFallbackModel: true }), 'declined', 'a second refusal must end the turn, not re-run')
  assert.equal(act({ stopReason: 'refusal', toolUses: 1 }), 'fallback_model', 'refusal wins over a partial tool call')
})

test('mentionsTerm: whole-term only (substring matching flagged "january" as Anua)', () => {
  assert.equal(L.mentionsTerm('since january my cheeks are red', 'anua'), false)
  assert.equal(L.mentionsTerm('i apply it manually', 'anua'), false)
  assert.equal(L.mentionsTerm('post chemotherapy skin', 'hera'), false)
  assert.equal(L.mentionsTerm('is the anua toner good', 'anua'), true)
  assert.equal(L.mentionsTerm('COSRX snail', 'cosrx'), true)
  assert.equal(L.mentionsTerm('dr.jart cicapair', 'dr.jart'), true)
  assert.equal(L.mentionsTerm('drxjart', 'dr.jart'), false, 'the dot must be literal')
  assert.equal(L.mentionsTerm("a'pieu sunscreen", "a'pieu"), true)
})

test('search retry note rides in the trailing message and leaves the cached prefix untouched', () => {
  const turn = L.withTrailingContext(L.markLastUserMessage([...H, { role: 'user', content: 'best toner?' }]), 'facts')
  const retried = L.withSearchRetry(turn)
  assert.equal(retried.length, turn.length)
  for (let i = 0; i < turn.length - 1; i++) assert.equal(norm(retried[i]), norm(turn[i]))
  assert.ok(retried[retried.length - 1].content.includes(L.SEARCH_RETRY_NOTE))
  assert.ok(retried[retried.length - 1].content.startsWith('facts'))
})

test('fact, retry note and decline reply are exactly the reviewed wording (closed world)', () => {
  // Closed-world on purpose: these are the only sentences this layer adds to
  // what Yuri reads or a user sees. An enumerated ban list ("yet", "has run")
  // would pass the next false fact worded differently. Change them only with a
  // second-model review (CLAUDE.md, Second-Model Review).
  assert.equal(L.PRODUCT_TURN_FACT, "## This Message (fact)\nA keyword check flagged this message as possibly about products, prices, trends, or weather. Seoul Sister's tools are where its catalog, price, trend, and weather data live.")
  assert.equal(L.SEARCH_RETRY_NOTE, "A first pass at this reply named specific products without any tool having run this turn. If a catalog or price lookup could change or confirm what you'd say about those products, check it before answering. If it couldn't (for example a brand our catalog doesn't carry), just answer.")
  assert.equal(L.DECLINED_REPLY, "I'm not able to take that one on. If it's a spot or a symptom that worries you, a dermatologist (피부과) is the right next stop. Anything about your skin, your routine, or a product, ask away.")
})

// --- The surfaces actually use this layout (source guards; the behavior is above) ---
const route = readFileSync('src/app/api/widget/chat/route.ts', 'utf8')
const advisor = readFileSync('src/lib/yuri/advisor.ts', 'utf8')
const onboarding = readFileSync('src/lib/yuri/onboarding.ts', 'utf8')

test('no chat surface sends tool_choice (forced tool use returns 400 on Opus 5.5)', () => {
  for (const [name, s] of [['widget route', route], ['advisor', advisor], ['onboarding', onboarding]]) {
    assert.doesNotMatch(s, /tool_choice\s*:/, `${name} sends tool_choice`)
  }
})

test('chat surfaces run on MODELS.chat with an explicit effort', () => {
  for (const [name, s] of [['widget route', route], ['advisor', advisor], ['onboarding', onboarding]]) {
    assert.match(s, /output_config:\s*{\s*effort:\s*CHAT_EFFORT\s*}/, `${name} has no explicit effort (5.5 defaults to medium)`)
    assert.match(s, /MODELS\.chat/, `${name} is not on MODELS.chat`)
  }
  assert.match(route, /withTrailingContext\(\s*markLastUserMessage\(/, 'widget must use the user-message breakpoint + trailing context')
})

test('brand heuristics use whole-term matching, not substring includes()', () => {
  for (const [name, s] of [['widget route', route], ['advisor', advisor]]) {
    assert.match(s, /mentionsTerm\(msg, brand\)/, `${name} brand loop must use mentionsTerm`)
    assert.doesNotMatch(s, /msg\.includes\(brand\)/, `${name} still substring-matches brands`)
  }
})

test('each loop sets its one-shot flags inside the branch that spends them, and caps total rounds', () => {
  // Slice EXACTLY the branch body by brace depth. An indentation-based slice
  // ran to the end of the widget's stream function (16K chars), so a branch with
  // its break/continue deleted still matched text further down (Fable review).
  const branch = (s, name) => {
    const at = s.indexOf(`if (action === '${name}')`)
    assert.notEqual(at, -1, `missing ${name} branch`)
    let depth = 0
    for (let i = s.indexOf('{', at); i < s.length; i++) {
      if (s[i] === '{') depth++
      else if (s[i] === '}' && --depth === 0) return s.slice(at, i + 1)
    }
    throw new Error(`unterminated ${name} branch`)
  }
  for (const [name, s] of [['widget route', route], ['advisor', advisor]]) {
    assert.match(branch(s, 'retry_search'), /searchRetried = true[\s\S]*withSearchRetry[\s\S]*continue\s*}$/, `${name}: the retry branch must set searchRetried, then re-run`)
    const fb = branch(s, 'fallback_model')
    assert.match(fb, /roundModel = MODELS\.primary/, `${name}: the fallback branch must switch the model it runs on`)
    assert.match(fb, /continue\s*}$/, `${name}: the fallback branch must re-run the round`)
    assert.match(branch(s, 'declined'), /DECLINED_REPLY[\s\S]*break\s*}$/, `${name}: a double refusal must say so and end the turn`)
    assert.match(s, /\+\+roundsRun > MAX_\w*TOOL_LOOPS \+ 1 \+ MAX_EXTRA_ROUNDS/, `${name}: no independent round cap`)
  }
})

test('advisor static block really is the first part of the cached prompt (the split depends on it)', () => {
  assert.match(advisor, /const parts: string\[\] = \[YURI_SYSTEM_PROMPT\]/)
  assert.match(advisor, /startsWith\(YURI_SYSTEM_PROMPT\)\)\s*{[\s\S]{0,200}console\.error/, 'a failed split must be logged, not silent')
})

test('splitCachedPrompt (executed): static prompt and user context become two blocks that rejoin byte-identically', () => {
  const at = advisor.indexOf('function splitCachedPrompt(')
  assert.notEqual(at, -1, 'splitCachedPrompt not found')
  let depth = 0
  let end = -1
  for (let i = advisor.indexOf('{', at); i < advisor.length; i++) {
    if (advisor[i] === '{') depth++
    else if (advisor[i] === '}' && --depth === 0) { end = i + 1; break }
  }
  const fnSrc = ts.transpileModule(advisor.slice(at, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  const errors = []
  const split = new Function('YURI_SYSTEM_PROMPT', 'console', `${fnSrc}; return splitCachedPrompt`)('STATIC PROMPT', { error: (m) => errors.push(m) })
  const cached = 'STATIC PROMPT\n\n---\n# USER CONTEXT\n- skin: oily'
  const blocks = split(cached)
  assert.equal(blocks.length, 2, 'the static block must be cached separately from the user context')
  assert.equal(blocks[0], 'STATIC PROMPT')
  assert.equal(blocks.join(''), cached, 'the model must see exactly the same text')
  assert.deepEqual(split('STATIC PROMPT'), ['STATIC PROMPT'])
  assert.deepEqual(split('something else'), ['something else'])
  assert.equal(errors.length, 1, 'a prompt that cannot be split must be logged')
})
