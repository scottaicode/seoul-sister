/**
 * Guard tests — a visitor who comes back in a new tab continues the same conversation.
 *
 * THE DEFECT (Oct 25-26 2026). The widget's session id lives in sessionStorage,
 * which dies with the tab. Two of two real visitors that weekend returned within
 * minutes in a fresh tab, got a brand-new empty session, and Yuri forgot them:
 * a New Yorker had to say where she lives twice, and a "KT1 after 까지" question
 * about a product LABEL was answered as if it were a blog formatting glitch.
 *
 * Executes the real session helpers (the Supabase import is stubbed) and checks
 * the route wiring that uses them.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(join(__dirname, '..', ...p), 'utf8')

const dir = mkdtempSync(join(tmpdir(), 'ss-resume-'))
writeFileSync(join(dir, 'supabase-stub.mjs'), 'export const getServiceClient = () => globalThis.__db')
const src = read('src', 'lib', 'widget', 'session.ts').replace("from '@/lib/supabase'", "from './supabase-stub.mjs'")
writeFileSync(join(dir, 'session.mjs'), ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)
const { getSession, findResumableSession, fillSessionAttribution, markSessionEnded, RESUME_WINDOW_MS } = await import(pathToFileURL(join(dir, 'session.mjs')).href)

/** In-memory ss_widget_sessions that applies the filters the code asks for. */
function fakeDb(rows, { error = null } = {}) {
  return {
    from() {
      const f = []
      let lim = Infinity
      let ord = null
      let asc = true
      let patch = null
      const run = () => {
        if (error) return { data: null, error }
        let out = rows.filter((r) => f.every((fn) => fn(r)))
        if (ord) out = [...out].sort((a, b) => (a[ord] < b[ord] ? (asc ? -1 : 1) : (asc ? 1 : -1)))
        return { data: out.slice(0, lim), error: null }
      }
      const chain = {
        select() { return chain },
        eq(k, v) { f.push((r) => r[k] === v); return chain },
        gt(k, v) { f.push((r) => r[k] > v); return chain },
        gte(k, v) { f.push((r) => r[k] >= v); return chain },
        not(k, op, v) { f.push((r) => !(op === 'is' && r[k] === v)); return chain },
        order(k, o) { ord = k; asc = o?.ascending !== false; return chain },
        update(p) { patch = p; return chain },
        // An awaited update chain (…update().eq().eq()) applies the patch.
        then(resolve) {
          const hit = rows.filter((r) => f.every((fn) => fn(r)))
          if (patch && !error) for (const r of hit) Object.assign(r, patch)
          resolve({ data: error ? null : hit.map((r) => ({ id: r.id })), error })
        },
        is(k, v) {
          f.push((r) => r[k] === v)
          if (patch) { for (const r of rows.filter((r) => f.every((fn) => fn(r)))) Object.assign(r, patch); return Promise.resolve({ error }) }
          return chain
        },
        limit(n) { lim = n; return Promise.resolve(run()) },
        maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error } },
      }
      return chain
    },
  }
}

const NOW = Date.parse('2026-10-26T01:00:00Z')
const iso = (msAgo) => new Date(NOW - msAgo).toISOString()
const MIN = 60 * 1000

test('the resume window is 1 hour (keeps 7 of 9 measured same-day returns; limits shared-device exposure)', () => {
  assert.equal(RESUME_WINDOW_MS, 60 * MIN)
})

test('a visitor back within the window gets their most recent conversation', async () => {
  globalThis.__db = fakeDb([
    { id: 'old', visitor_id: 'V', message_count: 3, last_message_at: iso(3 * 24 * 60 * MIN) },
    { id: 'earlier', visitor_id: 'V', message_count: 2, last_message_at: iso(40 * MIN) },
    { id: 'recent', visitor_id: 'V', message_count: 2, last_message_at: iso(6 * MIN) },
    { id: 'someone-else', visitor_id: 'W', message_count: 5, last_message_at: iso(1 * MIN) },
  ])
  const s = await findResumableSession('V', NOW)
  assert.equal(s?.id, 'recent')
})

test('a visitor back after the window starts fresh', async () => {
  globalThis.__db = fakeDb([{ id: 'stale', visitor_id: 'V', message_count: 2, last_message_at: iso(61 * MIN) }])
  assert.equal(await findResumableSession('V', NOW), null)
})

test('an empty session (no messages) is never resumed', async () => {
  globalThis.__db = fakeDb([{ id: 'ghost', visitor_id: 'V', message_count: 0, last_message_at: iso(MIN) }])
  assert.equal(await findResumableSession('V', NOW), null)
})

test('a failed lookup throws instead of reading as "no conversation"', async () => {
  globalThis.__db = fakeDb([], { error: { message: 'boom' } })
  await assert.rejects(findResumableSession('V', NOW), /resumable session lookup failed/)
  await assert.rejects(getSession('S', 'V'), /widget session lookup failed/)
})

test("getSession refuses another visitor's conversation id", async () => {
  globalThis.__db = fakeDb([{ id: 'S', visitor_id: 'OWNER', message_count: 4, last_message_at: iso(MIN) }])
  assert.equal(await getSession('S', 'INTRUDER'), null)
  assert.equal((await getSession('S', 'OWNER'))?.id, 'S')
})

test('a resumed conversation records a new feeder touch only where none exists', async () => {
  const rows = [
    { id: 'A', source: null, landing_path: null },
    { id: 'B', source: 'blog', landing_path: '/blog/first' },
  ]
  globalThis.__db = fakeDb(rows)
  await fillSessionAttribution('A', 'blog', '/blog/how-do-you-read-korean-skincare-expiration-dates-and-batch')
  await fillSessionAttribution('B', 'landing', '/blog/second')
  assert.deepEqual(rows[0], { id: 'A', source: 'blog', landing_path: '/blog/how-do-you-read-korean-skincare-expiration-dates-and-batch' })
  assert.deepEqual(rows[1], { id: 'B', source: 'blog', landing_path: '/blog/first' }, 'first touch wins')
})

test('the chat route resumes only without a session id, keeps the id, and falls through on failure', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /session = await getSession\(sessionId, parsed\.visitor_id\)/)
  assert.match(route, /if \(!session && !sessionId && !parsed\.fresh\) \{\s*try \{\s*session = await findResumableSession\(parsed\.visitor_id\)/)
  // Without this the resumed turn has no sessionId: nothing is saved or counted.
  assert.match(route, /if \(session\) \{\s*sessionId = session\.id\s*resumedConversation = true\s*try \{\s*await fillSessionAttribution\(session\.id, parsed\.source, parsed\.landing_path\)/)
  // A failed lookup must fall through to createSession, not into the outer catch.
  assert.match(route, /catch \(err\) \{\s*console\.error\('\[widget\/chat\] resumable session lookup failed; starting a new one:'/)
  // The DB is the truth whenever it holds more than the browser sent.
  assert.match(route, /if \(groundedHistory\.length > history\.length\) \{/)
})

test('the transcript endpoint restores by visitor and hands back the session id', () => {
  const t = read('src', 'app', 'api', 'widget', 'transcript', 'route.ts')
  assert.match(t, /if \(sessionId\) \{[\s\S]{0,900}\} else \{\s*session = await findResumableSession\(visitorId\)/,
    'a provided session id must be honoured; the visitor-only lookup is the fallback')
  assert.match(t, /session_id: session\.id/)
  const ui = read('src', 'components', 'widget', 'TryYuriSection.tsx')
  assert.match(ui, /if \(!sessionId && data\.session_id\) setWidgetSessionId\(data\.session_id\)/)
})

test('"Start over" ends a conversation for good: it is never resumed', async () => {
  const rows = [{ id: 'S', visitor_id: 'V', message_count: 3, last_message_at: iso(5 * MIN), ended_naturally: false }]
  globalThis.__db = fakeDb(rows)
  assert.equal((await findResumableSession('V', NOW))?.id, 'S')
  await markSessionEnded('S', 'INTRUDER')
  assert.equal(rows[0].ended_naturally, false, 'only the owner can end it')
  await markSessionEnded('S', 'V')
  assert.equal(rows[0].ended_naturally, true)
  assert.equal(await findResumableSession('V', NOW), null)
})

test('fresh start skips resuming even if ending the old conversation failed', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /fresh: z\.boolean\(\)\.optional\(\)/)
  assert.match(route, /if \(!session && !sessionId && !parsed\.fresh\) \{/)
  const ui = read('src', 'components', 'widget', 'TryYuriSection.tsx')
  assert.match(ui, /markWidgetFresh\(\)\s*clearWidgetSessionId\(\)/)
  const t = read('src', 'app', 'api', 'widget', 'transcript', 'route.ts')
  assert.match(t, /export async function POST[\s\S]{0,1200}await markSessionEnded\(sessionId, visitorId\)/)
})

test("Yuri is told the continuity rule as a fact, matching the real window", async () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  // Inside the rendered Conversation State template, right after the country
  // fact — not in a comment (a review moved it into a comment and it passed).
  assert.match(route, /\$\{visitorCountryFact\([^\n]*\n- Continuity in this browser: if they leave and come back within about an hour/)
  // Rendered only when the conversation WAS resumed.
  assert.match(route, /\$\{resumedConversation \? ' They just reopened the page/)
  // No claim that she forgets everything: ai_memory and carryover still exist.
  assert.doesNotMatch(route, /next visit, you won't remember them|no memory of them after today/)
  assert.equal(RESUME_WINDOW_MS, 60 * MIN)
})

test('ending a conversation reports a failed write and a non-matching pair', async () => {
  globalThis.__db = fakeDb([], { error: { message: 'boom' } })
  await assert.rejects(markSessionEnded('S', 'V'), /end session failed/)
  globalThis.__db = fakeDb([{ id: 'S', visitor_id: 'OWNER', ended_naturally: false }])
  assert.equal(await markSessionEnded('S', 'INTRUDER'), false)
  assert.equal(await markSessionEnded('S', 'OWNER'), true)
})

test('Start over survives a reload and cannot strand the paywall or email prompt', () => {
  const ui = read('src', 'components', 'widget', 'TryYuriSection.tsx')
  assert.match(ui, /if \(!sessionId && isWidgetFresh\(\)\) return/, 'no restore after Start over, even after a reload')
  assert.match(ui, /\.\.\.\(isWidgetFresh\(\) \? \{ fresh: true \} : \{\}\)/)
  assert.match(ui, /!isStreaming && !isAtLimit && !emailGateActive && \(/, 'hidden at the cap and during the email gate')
  assert.match(ui, /if \(!confirmStartOver\) \{\s*setConfirmStartOver\(true\)/, 'needs a second tap')
  const store = read('src', 'lib', 'utils', 'widget-session.ts')
  assert.match(store, /sessionStorage\.setItem\(SESSION_ID_KEY, id\)\s*sessionStorage\.removeItem\(FRESH_KEY\)/)
})
