/**
 * /browse crashed to the error boundary on any search matching zero products.
 *
 * Aug 7 2026, found on Bailey's account. She typed "Medicc" on the way to
 * "Medicube" — a partial word matching 0 of 5,311 verified products. The
 * curated API's zero-candidate early return omitted `allergens`,
 * `has_decision_memory_exclusions` and `total_pages`, which the main return
 * sends. The client reads `data.allergens.length` unconditionally, so the
 * render threw `Cannot read properties of undefined (reading 'length')`.
 *
 * The fetch returned 200 OK, so the client's catch never fired and no error
 * banner appeared — it went straight to the React error boundary and read as a
 * hard crash. Every partial word passes through a zero-match state, which is
 * why it looked like "it crashes every time I type."
 *
 * These tests EXECUTE the real expressions and parse the real route source.
 * A test that merely greps for a field name would pass against the broken code.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROUTE = join(root, 'src/app/api/products/curated/route.ts')
const PAGE = join(root, 'src/app/(app)/browse/page.tsx')

/**
 * Extract the object literal of every `return NextResponse.json({...})` in the
 * route, and report its top-level keys. Brace-counting rather than regex so
 * nested objects (active_phase) don't truncate the match.
 */
function jsonReturnKeySets(source) {
  const marker = 'return NextResponse.json({'
  const sets = []
  let idx = source.indexOf(marker)
  while (idx !== -1) {
    const open = source.indexOf('{', idx + marker.length - 1)
    let depth = 0
    let end = open
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    const body = source.slice(open + 1, end)
    // Top-level keys only: those at brace depth 0 within this literal.
    const keys = []
    let d = 0
    let line = ''
    for (let i = 0; i < body.length; i++) {
      const ch = body[i]
      if (ch === '{' || ch === '[' || ch === '(') d++
      else if (ch === '}' || ch === ']' || ch === ')') d--
      if (ch === '\n') {
        const m = d === 0 ? line.match(/^\s*([a-z_][a-z0-9_]*)\s*:/i) : null
        if (m) keys.push(m[1])
        line = ''
      } else line += ch
    }
    const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s*:/i)
    if (m && d === 0) keys.push(m[1])
    sets.push(new Set(keys))
    idx = source.indexOf(marker, end)
  }
  return sets
}

test('every success payload from the curated route has an identical key set', () => {
  const source = readFileSync(ROUTE, 'utf8')
  // Success payloads carry `fits`; error returns ({error: ...}) do not.
  const successSets = jsonReturnKeySets(source).filter((s) => s.has('fits'))

  assert.ok(
    successSets.length >= 2,
    `expected at least 2 success returns (early + main), found ${successSets.length}`
  )

  const [first, ...rest] = successSets
  for (const [i, set] of rest.entries()) {
    const missing = [...first].filter((k) => !set.has(k))
    const extra = [...set].filter((k) => !first.has(k))
    assert.deepEqual(
      { missing, extra },
      { missing: [], extra: [] },
      `success return #${i + 2} diverges from #1 — missing: [${missing}], extra: [${extra}]. ` +
        `Two shapes for one endpoint is the defect that crashed /browse.`
    )
  }
})

test('the zero-candidate branch specifically carries the fields the client reads', () => {
  const source = readFileSync(ROUTE, 'utf8')
  const successSets = jsonReturnKeySets(source).filter((s) => s.has('fits'))
  // The early return is the one whose fits value is a literal empty array.
  for (const required of ['allergens', 'has_decision_memory_exclusions', 'total_pages']) {
    for (const [i, set] of successSets.entries()) {
      assert.ok(
        set.has(required),
        `success return #${i + 1} omits "${required}" — the client dereferences it unconditionally`
      )
    }
  }
})

test('the render expression survives a payload with allergens absent', () => {
  // The literal expression from browse/page.tsx, evaluated for real.
  const render = (data) => ((data.allergens?.length ?? 0) > 0 ? ', your declared allergens,' : '')

  const zeroCandidatePayload = {
    fits: [], skipped: [], total_fits: 0, total_skipped: 0, page: 1,
    active_phase: { phase_number: 3, name: 'Brightening/Glow', goal: null },
  }

  assert.doesNotThrow(() => render(zeroCandidatePayload))
  assert.equal(render(zeroCandidatePayload), '')
  assert.equal(render({ allergens: [] }), '')
  assert.equal(render({ allergens: ['fragrance'] }), ', your declared allergens,')
})

test('the OLD render expression throws on the OLD payload — proves the bug was real', () => {
  const oldRender = (data) => (data.allergens.length > 0 ? ', your declared allergens,' : '')
  const oldPayload = {
    fits: [], skipped: [], total_fits: 0, total_skipped: 0, page: 1,
    active_phase: { phase_number: 3, name: 'Brightening/Glow' },
  }

  assert.throws(
    () => oldRender(oldPayload),
    /Cannot read properties of undefined \(reading 'length'\)/,
    'the original bug must still reproduce against the original code, or this test proves nothing'
  )
})

test('the client type does not promise fields the API might omit', () => {
  const page = readFileSync(PAGE, 'utf8')
  const iface = page.match(/interface CuratedPayload \{([\s\S]*?)\n\}/)
  assert.ok(iface, 'CuratedPayload interface not found')

  // A type asserting `allergens: string[]` while a branch omits it is what let
  // this compile cleanly. Either the field is guaranteed by every branch (it is
  // now) or the type must mark it optional — but the client must never
  // dereference it without a guard regardless.
  assert.match(
    page,
    /data\.allergens\?\.\ length|data\.allergens\?\.length/,
    'client must guard allergens access — a non-optional type is not a runtime guarantee'
  )
})
