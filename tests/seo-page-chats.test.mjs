/**
 * SEO Guardian page-chat facts (Oct 14 2026, src/lib/seo/page-chats.ts).
 *
 * Executes the real aggregation and formatting. The invariants:
 *  - chats are counted per landing page, with messages and emails;
 *  - chats with no landing page are counted as unattributed, not dropped;
 *  - a FAILED fetch renders as "UNAVAILABLE", never as zero chats (a dead
 *    query and a quiet week must not look the same to the strategist).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/seo/page-chats.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { aggregatePageChats, formatPageChats } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const ROWS = [
  { landing_path: '/blog/sunscreen', message_count: 5, visitor_id: 'a' },
  { landing_path: '/blog/sunscreen', message_count: 3, visitor_id: 'b' },
  { landing_path: '/products/x', message_count: 2, visitor_id: 'c' },
  { landing_path: null, message_count: 4, visitor_id: 'd' },
]

test('aggregates chats, messages and emails per landing page', () => {
  const f = aggregatePageChats(ROWS, new Set(['a']))
  assert.equal(f.totalChats, 4)
  assert.equal(f.unattributedChats, 1)
  assert.deepEqual(f.pages[0], { path: '/blog/sunscreen', chats: 2, messages: 8, emails: 1 })
  assert.deepEqual(f.pages[1], { path: '/products/x', chats: 1, messages: 2, emails: 0 })
})

test('the prompt section lists each page and the unattributed count', () => {
  const f = { ok: true, ...aggregatePageChats(ROWS, new Set()) }
  const out = formatPageChats(f, '2026-09-11', '2026-10-08')
  assert.match(out, /\/blog\/sunscreen \| 2 \| 8 \| 0/)
  assert.match(out, /4 chats in the window, 1 with no page recorded/)
})

test('a failed fetch says UNAVAILABLE and never reads as zero chats', () => {
  const out = formatPageChats({ ok: false, error: 'boom', totalChats: 0, unattributedChats: 0, pages: [] }, 'a', 'b')
  assert.match(out, /UNAVAILABLE/)
  assert.doesNotMatch(out, /0 chats in the window/)
})

test('the Guardian prompt and stored facts carry the page-chat section', () => {
  const g = fs.readFileSync(path.join(process.cwd(), 'src/lib/seo/seo-guardian.ts'), 'utf8')
  assert.match(g, /\$\{input\.pageChats\}/)
  assert.match(g, /pageChats: formatPageChats\(pageChatFacts, windowStart, windowEnd\)/)
  assert.match(g, /pageChats: pageChatFacts[,\s}]/)
})
