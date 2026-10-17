/**
 * Guard test — only a user's NEWEST nudge can surface on the dashboard.
 *
 * Oct 2026: GET /api/me/nudge returned the newest OPEN nudge, so dismissing it
 * brought back the next-oldest one. Caroline had three open (Aug 3, Oct 6, Oct
 * 11); the Oct 6 note claimed "I never got that baseline photo from you" hours
 * after she uploaded three. Executes the real rule and checks the route uses it
 * on an any-status query.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const js = ts.transpileModule(read('src/lib/intelligence/nudge-surface.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { isSurfaceable } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const row = (status, extra = {}) => ({ status, dismissed_at: null, acted_at: null, ...extra })

test('an open newest nudge surfaces', () => {
  assert.equal(isSurfaceable(row('pending')), true)
  assert.equal(isSurfaceable(row('surfaced')), true) // seen once is still unresolved (Aug 7 fix)
})

test('a dismissed or acted newest nudge hides everything, including older open ones', () => {
  assert.equal(isSurfaceable(row('dismissed', { dismissed_at: '2026-10-12' })), false)
  assert.equal(isSurfaceable(row('acted', { acted_at: '2026-10-12' })), false)
  assert.equal(isSurfaceable(row('pending', { dismissed_at: '2026-10-12' })), false)
  assert.equal(isSurfaceable(null), false)
})

test('the route reads exactly: this user, newest first, one row, no other filter', () => {
  const src = read('src/app/api/me/nudge/route.ts')
  const get = src.slice(src.indexOf('export async function GET'), src.indexOf('const postSchema'))
  // Closed-world: the whole query chain, so a status filter of ANY form (which
  // lets an older nudge resurface or brings back the Aug 7 bug) or a missing
  // user filter (another user's nudge) cannot slip in.
  const chain = get.slice(get.indexOf(".from('ss_user_nudges')"), get.indexOf('.maybeSingle()'))
  const filters = chain.match(/\.(eq|neq|in|is|not|or|filter|match|gt|gte|lt|lte|like|ilike)\([^)]*\)/g) || []
  assert.deepEqual(filters, [".eq('user_id', user.id)"])
  assert.match(chain, /\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(1\)\s*$/)
  assert.match(get, /if \(!isSurfaceable\(data\)\) return NextResponse\.json\(\{ nudge: null \}\)/)
})
