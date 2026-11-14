/**
 * When a turn uses every tool round and never reaches a written answer, the
 * member is told what is true (Nov 14 2026).
 *
 * It used to say "I'm having trouble accessing the database right now. Let me
 * answer based on my knowledge instead." That is false in every case, and worst
 * after a save: the routine is on their page and they are told nothing worked.
 * The risk grew when a routine build started ending in two saves (v11.61.2).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const src = read('src/lib/llm-request.ts')
const a = src.indexOf('export const READ_ONLY_TOOLS')
const b = src.indexOf('/**', src.indexOf('export function exhaustedRoundsReply'))
assert.ok(a > 0 && b > a, 'READ_ONLY_TOOLS and exhaustedRoundsReply not found in order')
const js = ts.transpileModule(src.slice(a, b).replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const { READ_ONLY_TOOLS, exhaustedRoundsReply } = new Function(`${js}; return { READ_ONLY_TOOLS, exhaustedRoundsReply }`)()

const toolNames = () => {
  const tools = read('src/lib/yuri/tools.ts')
  const start = tools.indexOf('export const YURI_TOOLS')
  assert.ok(start > 0, 'YURI_TOOLS not found')
  return [...tools.slice(start).matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map((m) => m[1])
}

test('CLOSED WORLD: every tool Yuri has is either read-only or one of these six that write', () => {
  const names = toolNames()
  assert.ok(names.length >= 19, `expected the full tool list, found ${names.length}`)
  for (const r of READ_ONLY_TOOLS) assert.ok(names.includes(r), `${r} is listed read-only but is not a tool`)
  // A new tool lands here until someone decides which it is. Listing a tool
  // that writes as read-only is the dangerous direction: read its handler first.
  assert.deepEqual(
    names.filter((n) => !READ_ONLY_TOOLS.includes(n)).sort(),
    ['add_to_routine', 'clear_product_reaction', 'mark_product_reaction', 'remove_from_routine', 'save_routine', 'update_user_product']
  )
})

test('the reply says changes may be saved exactly when a tool that writes ran', () => {
  const read_only = exhaustedRoundsReply(['get_routine_context', 'search_products', 'search_products'])
  assert.equal(read_only, 'I ran out of steps before I could finish that answer. Ask me again and I will pick it up from here.')
  assert.equal(exhaustedRoundsReply([]), read_only)
  const wrote = exhaustedRoundsReply(['get_routine_context', 'search_products', 'save_routine'])
  assert.equal(wrote, 'I ran out of steps before I could finish that answer. Some of the changes I was making may already be saved, so check your Routine and Library pages, then ask me to pick it up from here.')
  for (const w of ['add_to_routine', 'remove_from_routine', 'update_user_product', 'mark_product_reaction', 'clear_product_reaction']) {
    assert.equal(exhaustedRoundsReply([w]), wrote)
  }
  // A tool nobody classified is treated as one that may have written.
  assert.equal(exhaustedRoundsReply(['some_new_tool']), wrote)
  // Neither sentence claims a save happened, or that nothing did.
  for (const s of [read_only, wrote]) assert.ok(!/\b(is|was|were|are) saved\b|nothing (was|is) saved|database|my knowledge/i.test(s))
})

test('the member chat uses it, logs the event, and the false sentence is gone from the tree', () => {
  const advisor = read('src/lib/yuri/advisor.ts')
  assert.match(advisor, /if \(!fullResponse\) \{\s*console\.error\(`\[yuri\/stream\][^`]*tool rounds exhausted[^`]*`\)\s*fullResponse = exhaustedRoundsReply\(toolCallLogs\.map\(\(t\) => t\.name\)\)\s*yield fullResponse\s*\}/)
  // Not raised without the route's time limit: a turn killed at 60s says nothing.
  assert.match(advisor, /const MAX_TOOL_LOOPS = 5\n/)
  const limit = Number(read('src/app/api/yuri/chat/route.ts').match(/^export const maxDuration = (\d+)$/m)?.[1])
  assert.ok(limit >= 120, `member chat time limit is ${limit}s; six tool rounds need the room`)
  // A long turn is silent until its last round: the stream carries a comment
  // line every 15s, stopped when the stream closes, and the client skips it.
  const chat = read('src/app/api/yuri/chat/route.ts')
  assert.match(chat, /const heartbeat = setInterval\(\(\) => \{\s*writer\.write\(encoder\.encode\(': ping\\n\\n'\)\)\.catch\(\(\) => \{\}\)\s*\}, 15000\)/)
  assert.match(chat, /\} finally \{\s*clearInterval\(heartbeat\)\s*await writer\.close\(\)/)
  assert.match(read('src/hooks/useYuri.ts'), /if \(!line\.startsWith\('data: '\)\) continue/)
  // The health check counts this reply as a bad one, so it reaches the Guardian.
  assert.match(read('src/lib/guardian/healthcheck.ts'), /i ran out of steps/)
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []
  })
  const hits = walk(join(ROOT, 'src')).filter((f) => {
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    return /trouble accessing the database|answer based on my knowledge instead/i.test(code)
  }).map((f) => relative(ROOT, f))
  assert.deepEqual(hits, [])
})
