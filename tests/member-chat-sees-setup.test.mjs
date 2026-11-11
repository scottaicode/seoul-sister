/**
 * The member chat is given what setup captured (Nov 11 2026).
 *
 * THE DEFECT. In the first real no-card trial, setup Yuri told a new member to
 * keep their CeraVe cleanser for nights and buy one thing, CeraVe Moisturizing
 * Cream. Twenty minutes later member Yuri built a routine that replaced both
 * with Korean products, then asked which niacinamide they use. Both gaps were
 * in what she was GIVEN (see src/lib/yuri/setup-carry.ts).
 *
 * A first version of this fix was reviewed by a second model, which found it
 * hid the list as soon as a routine was saved, called an extractor's list
 * "their own words" and "owned", kept the FIRST 60 messages of a long setup
 * (losing the wrap-up) while calling it complete, and that five wrong versions
 * passed these tests. The helpers are pure and are executed here, with every
 * rendered string compared whole.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const memory = read('src', 'lib', 'yuri', 'memory.ts')
const transpile = (code) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText

const dir = mkdtempSync(join(tmpdir(), 'ss-setup-'))
writeFileSync(join(dir, 'setup-carry.mjs'), transpile(read('src', 'lib', 'yuri', 'setup-carry.ts')))
const carry = await import(pathToFileURL(join(dir, 'setup-carry.mjs')).href)

/** Cut one top-level function out of memory.ts by walking its braces. */
function cut(signature) {
  const start = memory.indexOf(signature)
  assert.ok(start > -1, `${signature} must exist in memory.ts`)
  const open = memory.indexOf('{', memory.indexOf(')', start))
  let depth = 0
  for (let i = open; i < memory.length; i++) {
    if (memory[i] === '{') depth++
    else if (memory[i] === '}' && --depth === 0) return memory.slice(start, i + 1)
  }
  throw new Error(`could not delimit ${signature}`)
}
let n = 0
async function loadWithCarry(code) {
  const file = join(dir, `m${n++}.mjs`)
  writeFileSync(file, transpile(`import { parseSetupShelf, formatSetupShelfSection, buildSetupChatExcerpt, formatSetupChatSection, SETUP_CHAT_FETCH } from './setup-carry.mjs'\nconst safeSlice = (s, n) => String(s).slice(0, n)\n${code}`))
  return import(pathToFileURL(file).href)
}

const PROVENANCE = 'These are the products and steps the person said they were using, as noted during setup. An entry can be a type of product rather than an exact name, can be worded differently from the label, or can have changed since. No one has searched for these names yet, so whether we carry them, and what is in them, is not known from this list. Where the setup conversation is shown, it has their exact words.'

test('executed: the setup list is parsed strictly and described as what it is', () => {
  const { parseSetupShelf: parse, formatSetupShelfSection: fmt, setupShelfForTool: tool } = carry
  const shelf = parse({ current_routine: ['CeraVe Foaming Cleanser', '  The Ordinary Niacinamide 10% ', '', '   ', 42, null, 'sunscreen'] }, '2026-11-11T05:59:06Z')
  assert.deepEqual(shelf, { items: ['CeraVe Foaming Cleanser', 'The Ordinary Niacinamide 10%', 'sunscreen'], asOf: '2026-11-11T05:59:06Z' })
  for (const nothing of [null, undefined, {}, { current_routine: null }, { current_routine: 'CeraVe' }, { current_routine: [] }, { current_routine: ['', '  '] }]) {
    assert.equal(parse(nothing, '2026-11-11T00:00:00Z'), null, JSON.stringify(nothing))
  }
  assert.equal(fmt(shelf), `## Routine Items Noted During Setup (setup record last updated 2026-11-11)
- CeraVe Foaming Cleanser
- The Ordinary Niacinamide 10%
- sunscreen

${PROVENANCE}`)
  assert.equal(carry.SETUP_SHELF_PROVENANCE, PROVENANCE)
  assert.equal(fmt({ items: ['x'], asOf: null }).split('\n')[0], '## Routine Items Noted During Setup')
  for (const none of [null, undefined, { items: [], asOf: null }]) assert.equal(fmt(none), '')
  // It never claims ownership, the person's own words, or anything about the library's contents.
  // It never claims ownership or library contents, never says we do not carry something, and uses no words
  // about how the list was produced or stored that she could repeat to a member.
  assert.doesNotMatch(fmt(shelf), /\bown\b|their own words|Nothing has been saved|suggestions of yours|background reader|extract|catalog|library|matched|not in our/i)
  assert.deepEqual(tool(shelf), { items: shelf.items, setup_record_last_updated: '2026-11-11', what_this_is: PROVENANCE })
  assert.equal(tool(null), null)
})

const row = (i, role, content, t = `2026-11-11T05:${String(i).padStart(2, '0')}:00Z`) => ({ role, content, created_at: t })

test('executed: a short setup is shown whole, in order, with its times, and called complete', () => {
  const chrono = [row(54, 'assistant', 'Welcome back. Last time you told me you use a CeraVe cleanser.'), row(55, 'user', 'Yes.'), row(56, 'system', 'INTERNAL'), row(59, 'assistant', 'Buy CeraVe Moisturizing Cream.')]
  const ex = carry.buildSetupChatExcerpt('c1', 'Skin Profile Onboarding', [...chrono].reverse(), 3)
  assert.deepEqual(ex, {
    conversationId: 'c1', title: 'Skin Profile Onboarding', fullSetupChat: true,
    messages: [{ role: 'assistant', content: 'Welcome back. Last time you told me you use a CeraVe cleanser.' }, { role: 'user', content: 'Yes.' }, { role: 'assistant', content: 'Buy CeraVe Moisturizing Cream.' }],
    startedAt: '2026-11-11T05:54:00Z', endedAt: '2026-11-11T05:59:00Z', omitted: 0, anyCut: false, totalKnown: true,
  })
  // In the member's own zone: 05:54 UTC on Nov 11 is 9:54 PM on Tuesday Nov 10 in California.
  assert.equal(carry.formatSetupChatSection([ex], 'America/Los_Angeles'), `## Your Setup (Onboarding) Conversation With This User (complete)
No summary of this conversation has been written yet, so it is shown directly. This is the whole conversation. The messages shown run from Tue, Nov 10, 9:54 PM to Tue, Nov 10, 9:59 PM. If a message here refers to an earlier chat, that is their free preview chat on the landing page, which is not shown here.

Yuri: Welcome back. Last time you told me you use a CeraVe cleanser.
User: Yes.
Yuri: Buy CeraVe Moisturizing Cream.`)
  // No zone, or one the runtime does not know: UTC, and labelled as UTC.
  for (const tz of [null, undefined, 'Mars/Olympus']) {
    assert.ok(carry.formatSetupChatSection([ex], tz).includes('The messages shown run from Wed, Nov 11, 5:54 AM UTC to Wed, Nov 11, 5:59 AM UTC.'), String(tz))
  }
  // One message: one time, not a range from a time to itself.
  const one = carry.buildSetupChatExcerpt('c1', null, [row(54, 'assistant', 'Hi.')], 1)
  assert.ok(carry.formatSetupChatSection([one], 'America/Los_Angeles').includes('This is the whole conversation. The message shown is from Tue, Nov 10, 9:54 PM. If a message here'))
  assert.equal(carry.formatSetupChatSection([]), '')
  assert.equal(carry.buildSetupChatExcerpt('c1', null, [row(1, 'system', 'x')], 1), null)
  assert.doesNotMatch(carry.formatSetupChatSection([ex]), /acting on now|everything you and this user said/)
})

test('executed: a long setup keeps its wrap-up, says what is missing, and is never called complete', () => {
  // 70 messages; the plan is in the last one. The loader fetches the newest 60.
  const all = Array.from({ length: 70 }, (_, i) => row(i % 60, i % 2 ? 'user' : 'assistant', i === 69 ? 'THE PLAN: buy CeraVe Moisturizing Cream.' : `m${i}`, new Date(Date.UTC(2026, 10, 11, 5, 0, i)).toISOString()))
  const newest60 = [...all].reverse().slice(0, carry.SETUP_CHAT_FETCH)
  const ex = carry.buildSetupChatExcerpt('c1', 't', newest60, 70)
  assert.equal(ex.messages.length, 60)
  assert.equal(ex.messages[59].content, 'THE PLAN: buy CeraVe Moisturizing Cream.')
  assert.equal(ex.messages[0].content, 'm10', 'the oldest ten are the ones dropped')
  assert.equal(ex.omitted, 10)
  const out = carry.formatSetupChatSection([ex])
  assert.ok(out.startsWith('## Your Setup (Onboarding) Conversation With This User (most recent part)\nNo summary of this conversation has been written yet, so it is shown directly. This is the most recent part of it: 10 earlier messages are not shown.'), out.slice(0, 300))
  assert.ok(out.endsWith('Yuri: m68\nUser: THE PLAN: buy CeraVe Moisturizing Cream.'))

  // One over-long message is cut and marked, and the section says so.
  const long = carry.buildSetupChatExcerpt('c1', 't', [row(2, 'assistant', 'z'.repeat(carry.SETUP_CHAT_MAX_CHARS + 50)), row(1, 'user', 'hi')], 2)
  assert.equal(long.anyCut, true)
  assert.ok(long.messages[1].content.endsWith('z [cut]') && long.messages[1].content.length === carry.SETUP_CHAT_MAX_CHARS + 6)
  assert.match(carry.formatSetupChatSection([long]), /\(most recent part\)\n.*This is the most recent part of it: a message marked \[cut\] was shortened\./)

  // The whole section stays inside its budget, dropping the OLDEST first.
  const big = Array.from({ length: 20 }, (_, i) => row(i, 'assistant', `${i}:` + 'q'.repeat(3000))).reverse()
  const budgeted = carry.buildSetupChatExcerpt('c1', 't', big, 20)
  assert.ok(budgeted.messages.map((m) => m.content.length).reduce((a, b) => a + b, 0) <= carry.SETUP_CHAT_BUDGET_CHARS)
  assert.ok(budgeted.messages.at(-1).content.startsWith('19:'), 'the newest is always kept')
  assert.equal(budgeted.omitted, 20 - budgeted.messages.length)
  assert.ok(budgeted.omitted > 0)
  // Unknown or inconsistent total: never called complete.
  for (const total of [null, undefined, 0]) {
    const unknown = carry.buildSetupChatExcerpt('c1', 't', [row(2, 'assistant', 'ok'), row(1, 'user', 'hi')], total)
    assert.equal(unknown.totalKnown, false, String(total))
    const section = carry.formatSetupChatSection([unknown])
    assert.match(section, /\(most recent part\)/)
    assert.doesNotMatch(section, /whole conversation|\(complete\)/)
  }
})

/** A fake Supabase client for the two tables the excerpt loader reads. */
function fakeDb(conversations, messagesByConv, log = []) {
  const from = (table) => {
    const q = { table, filters: {}, roles: null, asc: null, limit: null }
    const api = {
      select: () => api,
      eq: (k, v) => { q.filters[k] = v; return api },
      neq: () => api, gte: () => api,
      in: (_c, v) => { q.roles = v; return api },
      order: (_c, o) => { q.asc = o?.ascending; return api },
      limit: (lim) => {
        q.limit = lim
        log.push({ ...q, filters: { ...q.filters } })
        if (table === 'ss_yuri_conversations') return Promise.resolve({ data: conversations })
        const all = messagesByConv[q.filters.conversation_id] ?? []
        if (all === 'ERROR') return Promise.resolve({ data: null, error: { message: 'boom' } })
        let rows = q.roles ? all.filter((m) => q.roles.includes(m.role)) : all
        rows = q.asc ? rows : [...rows].reverse()
        return Promise.resolve({ data: rows.slice(0, lim) })
      },
    }
    return api
  }
  return { from }
}

test('executed: the loader shows an unsummarised setup conversation once, newest-first from the database, and nothing else that way', async () => {
  const { loadRecentConversationExcerpts: loader } = await loadWithCarry(`export ${cut('async function loadRecentConversationExcerpts')}`)
  const msgs = [...Array.from({ length: 11 }, (_, i) => row(i, i % 2 ? 'user' : 'assistant', i === 10 ? 'y'.repeat(1700) + ' buy CeraVe Moisturizing Cream' : `m${i}`)), row(11, 'system', 'INTERNAL NOTE')]
  const log = []
  const out = await loader(fakeDb([{ id: 'setup', title: 'Skin Profile Onboarding', message_count: 11, conversation_type: 'onboarding', summary: null }], { setup: msgs }, log), 'u1')
  assert.equal(out.length, 1, 'exactly one excerpt for the conversation, not the whole chat plus a short one')
  assert.deepEqual(out[0].messages, [])
  const s = out[0].setupChat
  assert.equal(s.messages.length, 11)
  assert.deepEqual(s.messages.slice(0, 3).map((m) => m.content), ['m0', 'm1', 'm2'])
  assert.ok(s.messages[10].content.endsWith('buy CeraVe Moisturizing Cream'), 'not cut at 500 characters')
  assert.ok(!s.messages.some((m) => m.content.includes('INTERNAL')), 'system rows are not shown')
  assert.equal(s.omitted, 0)
  const q = log.find((l) => l.table === 'ss_yuri_messages')
  assert.deepEqual([q.asc, q.limit, q.roles], [false, 60, ['user', 'assistant']])

  // With a summary on file, the ordinary short excerpt is used.
  const short = await loader(fakeDb([{ id: 'setup', title: 'S', message_count: 11, conversation_type: 'onboarding', summary: 'Phase 1...' }], { setup: msgs }), 'u1')
  assert.equal(short[0].setupChat, undefined)
  assert.equal(short[0].messages.length, 6)
  // An ordinary conversation with no summary is never shown this way.
  assert.equal((await loader(fakeDb([{ id: 'c', title: 'Chat', message_count: 11, conversation_type: 'general', summary: null }], { c: msgs }), 'u1'))[0].setupChat, undefined)

  // A failed load is logged, never silent, and never a crash.
  const errors = []
  const orig = console.error
  console.error = (...a) => errors.push(a.join(' '))
  try {
    assert.deepEqual(await loader(fakeDb([{ id: 'setup', title: 'S', message_count: 11, conversation_type: 'onboarding', summary: null }], { setup: 'ERROR' }), 'u1'), [])
  } finally { console.error = orig }
  assert.ok(errors.some((e) => e.includes('setup conversation load failed') && e.includes('boom')), errors.join('|'))
})

test('executed: the setup record read returns the list, and a failed read is logged and yields null', async () => {
  const { loadSetupShelf } = await loadWithCarry(`export ${cut('async function loadSetupShelf').replace('export ', '')}`)
  const db = (result) => ({ from: (t) => { assert.equal(t, 'ss_onboarding_progress'); const api = { select: () => api, eq: (k, v) => { assert.deepEqual([k, v], ['user_id', 'u1']); return api }, maybeSingle: async () => result }; return api } })
  assert.deepEqual(await loadSetupShelf(db({ data: { skin_profile_data: { current_routine: ['CeraVe Foaming Cleanser'] }, updated_at: '2026-11-11T05:59:06Z' } }), 'u1'), { items: ['CeraVe Foaming Cleanser'], asOf: '2026-11-11T05:59:06Z' })
  assert.equal(await loadSetupShelf(db({ data: null }), 'u1'), null)
  const errors = []
  const orig = console.error
  console.error = (...a) => errors.push(a.join(' '))
  try { assert.equal(await loadSetupShelf(db({ data: null, error: { message: 'down' } }), 'u1'), null) } finally { console.error = orig }
  assert.ok(errors.some((e) => e.includes('setup record read failed') && e.includes('down')))
})

test('executed: the formatter shows the list whatever the library holds, and the setup chat apart from ordinary excerpts', async () => {
  const { formatContextForPrompt: fmt } = await loadWithCarry(`export ${cut('export function formatContextForPrompt').replace('export ', '')}`)
  const ctx = (over = {}) => ({
    skinProfile: null, recentConversations: [], recentExcerpts: [], productReactions: [], knownAllergies: [], knownPreferences: [],
    routineProducts: [], userProducts: [], learningInsights: [], specialistInsights: [], decisionMemory: null, cyclePhase: null,
    locationName: null, ingredientOverlap: null, glassSkinHistory: [], ...over,
  })
  const shelf = { items: ['CeraVe Foaming Cleanser'], asOf: '2026-11-11T05:59:06Z' }
  const section = carry.formatSetupShelfSection(shelf)
  assert.ok(fmt(ctx({ setupShelf: shelf })).includes(section))
  // Saving a routine adds catalog steps to the library; the list must survive that.
  const lib = [{ product_id: 'p1', custom_name: 'OBgE Barrier Cream', custom_brand: null, category: 'moisturizer', texture_weight: 3, notes: null, learned_from: 'conversation' }]
  const withLib = fmt(ctx({ setupShelf: shelf, userProducts: lib }))
  assert.equal(withLib.split(section).length - 1, 1, 'shown exactly once, with a non-empty library')
  assert.ok(!fmt(ctx({ setupShelf: null })).includes('Routine Items Noted During Setup'))

  const setupChat = carry.buildSetupChatExcerpt('s', 'Skin Profile Onboarding', [row(3, 'assistant', 'Keep the CeraVe cleanser for nights.'), row(2, 'user', 'I use a CeraVe cleanser.'), row(1, 'assistant', 'What do you wash with?')], 3)
  const out = fmt(ctx({ recentExcerpts: [{ conversationId: 's', title: 'Skin Profile Onboarding', messages: [], setupChat }, { conversationId: 'o', title: 'Sunscreen', messages: [{ role: 'user', content: 'which SPF?' }] }] }))
  assert.equal(out.split(carry.formatSetupChatSection([setupChat], null)).length - 1, 1, 'the setup chat appears once, whole')
  // The member's profile zone is what the times are written in.
  const zoned = fmt(ctx({ skinProfile: { timezone: 'America/Los_Angeles' }, recentExcerpts: [{ conversationId: 's', title: 'S', messages: [], setupChat }] }))
  assert.ok(zoned.includes(carry.formatSetupChatSection([setupChat], 'America/Los_Angeles')) && zoned.includes('Tue, Nov 10, 9:'), 'times are in the member zone')
  const rest = out.slice(out.indexOf('## Recent Conversation Excerpts'))
  assert.ok(rest.includes('### Sunscreen') && rest.includes('User: which SPF?'))
  assert.ok(!rest.includes('CeraVe') && !rest.includes('Skin Profile Onboarding'), 'and is not repeated among the excerpts')
})

test('the routine tool is given the setup list, and the routine instruction says so', () => {
  const tools = read('src', 'lib', 'yuri', 'tools.ts')
  assert.match(tools, /const setupShelf = setupShelfForTool\(await loadSetupShelf\(db, userId\)\)/)
  assert.match(tools, /setup_noted_items: setupShelf,\n\s*current_saved_routine:/)
  assert.ok(tools.includes("'Fetch the user\\'s product inventory, the routine items noted during setup, current saved routines, texture data, and ingredient conflict records."))
  const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
  assert.ok(advisor.includes("1. Call get_routine_context to see their saved product inventory, the routine items noted during setup (a new member's inventory is often empty, so these and the setup conversation are the main record), texture data, any saved routine, and known ingredient conflicts. Build from what they really have, not hypothetical products."))
  assert.ok(advisor.includes('their product inventory with texture weights, the routine items noted during setup, their currently saved routine steps, known ingredient conflicts, and skin profile.'))
  assert.match(memory, /const setupShelfPromise = loadSetupShelf\(db, userId\)/)
  assert.match(memory, /routineProducts,\n    userProducts,\n    setupShelf,\n/)
})

test('the landing chat records why a reply stopped and which conversation it was', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /let stopReason: string \| null = null\n\s*lastStopReason = null\n/, 'reset each round, so a failed final message reads as null, not the round before')
  assert.match(route, /stopReason = finalMessage\.stop_reason\n\s*lastStopReason = stopReason\n/)
  assert.match(route, /conversationId: sessionId,\n\s*stopReason: lastStopReason,\n/)
  assert.match(read('src', 'lib', 'ai-usage-logger.ts'), /\.\.\.\(params\.stopReason !== undefined \? \{ stop_reason: params\.stopReason \} : \{\}\),/)
  assert.match(read('supabase', 'migrations', '20261111000001_ai_usage_stop_reason.sql'), /ADD COLUMN IF NOT EXISTS stop_reason text/)
})

test('a real return from a recap link is recorded apart from a link open', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /if \(parsed\.reopened_from_email === true && sessionId\) \{\s*void logAIUsage\(\{ feature: 'widget_resume_message_sent', model: 'n\/a', inputTokens: 0, outputTokens: 0, cached: true, conversationId: sessionId \}\)/)
  assert.match(read('src', 'lib', 'ai-usage-logger.ts'), /\| 'widget_resume_message_sent'\n/)
})
