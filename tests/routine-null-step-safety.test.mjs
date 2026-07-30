/**
 * Guard test — custom routine steps must not silently disable safety checks.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 30 2026)
 *
 * `ss_routine_products.product_id` is NULLABLE — a "custom" step (a device, a
 * shower step, or a product we don't carry) has no catalog row. 24 of 89 rows
 * were NULL in production.
 *
 * Three functions mapped rp.product_id straight into `.in('product_id', ids)`
 * without filtering nulls. PostgREST rejects a null in an `.in()` on a uuid
 * column with 22P02 ("invalid input syntax for type uuid"). All three sites
 * destructured only `{ data }` and ignored `error`, so the failed query looked
 * like an empty result and fell through to `return { safe: true, conflicts: [] }`.
 *
 * Consequence, measured against production: ONE custom step disabled ingredient
 * conflict checking for the ENTIRE routine — including every real catalog
 * product in it. On Bailey's Phase 3 PM routine, filtering the nulls recovered
 * 189 ingredient rows that were being skipped while the UI displayed no warning.
 * All three of her active routines returned a false all-clear.
 *
 * Compounding it, src/lib/yuri/memory.ts gated routine extraction on
 * `if (product)`, so custom steps were dropped from Yuri's context entirely.
 * Her step 4 is ADAPALENE (a prescription retinoid) and step 5 is COSRX BHA.
 * Yuri could see the acid and could NOT see the retinoid — she was asked to
 * reason about an interaction while blind to one side of it.
 *
 * Fixing the silent failure exposed a latent O(n²): the pair-enumeration built
 * 20,880 PostgREST `or` clauses (105 sequential round-trips) for one real
 * routine. It had never run at scale because the null bug short-circuited it
 * first. Both are fixed here.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const conflictSrc = read('src', 'lib', 'intelligence', 'conflict-detector.ts')
const effectivenessSrc = read('src', 'lib', 'intelligence', 'routine-effectiveness.ts')
const memorySrc = read('src', 'lib', 'yuri', 'memory.ts')

// --- 1. Nulls must never reach a uuid .in() --------------------------------

test('conflict-detector filters null product_ids before every .in() lookup', () => {
  // Both exported functions read ss_routine_products.product_id.
  const filters = conflictSrc.match(/\.filter\(\(id\): id is string => id !== null\)/g) || []
  assert.ok(
    filters.length >= 2,
    `both conflict paths must filter nulls; found ${filters.length}`
  )
  // The raw unfiltered map is what shipped the bug.
  assert.ok(
    !/const (existingProductIds|productIds) = routineProducts\.map\(\(rp\) => rp\.product_id\)\s*\n\s*\n?\s*const \{ data/.test(conflictSrc),
    'product ids must not flow into a query without a null filter'
  )
})

test('routine-effectiveness filters null product_ids too', () => {
  assert.ok(
    /\.filter\(\(id\): id is string => id !== null\)/.test(effectivenessSrc),
    'getConcernEffectiveness must not pass nulls into .in()'
  )
})

// --- 2. A failed query must never read as "safe" ---------------------------

test('conflict-detector surfaces query errors instead of returning a false all-clear', () => {
  // The precise mechanism: `error` was never destructured, so a 22P02 was
  // indistinguishable from "no conflicts found".
  const errorChecks = conflictSrc.match(/if \((existingIngredientsError|allIngredientsError|rulesError)\)/g) || []
  assert.ok(
    errorChecks.length >= 3,
    `every ingredient/rule lookup must check its error; found ${errorChecks.length}`
  )
  assert.ok(
    /Conflict check could not run/.test(conflictSrc),
    'a failed conflict check must throw, not silently report safe'
  )
})

// --- 3. The O(n²) pair enumeration must not come back ----------------------

test('conflict rules are fetched by ingredient membership, not pair enumeration', () => {
  assert.ok(
    !/and\(ingredient_a_id\.eq\./.test(conflictSrc),
    'the O(n^2) or-filter enumeration (20,880 clauses on a real routine) must be gone'
  )
  assert.ok(
    /\.in\('ingredient_a_id',[\s\S]{0,120}\.in\('ingredient_b_id',/.test(conflictSrc),
    'rules must be fetched with two .in() filters in a single request'
  )
})

// --- 4. Custom steps must reach Yuri, labelled honestly --------------------

test('memory.ts loads notes and no longer drops custom routine steps', () => {
  const selectIdx = memorySrc.indexOf('ss_routine_products (')
  assert.ok(selectIdx > -1, 'routine select must exist')
  const selectBlock = memorySrc.slice(selectIdx, selectIdx + 200)
  assert.ok(
    /notes/.test(selectBlock),
    'the routine query must select notes — it is the only identity a custom step has'
  )
  assert.ok(
    /kind: 'custom'/.test(memorySrc),
    'custom steps must be pushed into context, not skipped by the `if (product)` gate'
  )
})

test('the coverage statement is a FACT, never a command', () => {
  // Same discipline as the shelf-visibility and cumulative-give instruments:
  // surface what is and is not covered, then hand judgment back to Yuri.
  const idx = memorySrc.indexOf('CONFLICT-CHECK COVERAGE')
  assert.ok(idx > -1, 'coverage must be stated to Yuri')
  const block = memorySrc.slice(idx, idx + 900)

  assert.ok(
    /not a rule about what to say|fact about your coverage/i.test(block),
    'the coverage block must explicitly hand the decision back'
  )
  // It must not become a gate. These would convert a fact into a cage.
  for (const banned of ['you must not recommend', 'refuse to', 'do not answer']) {
    assert.ok(
      !new RegExp(banned, 'i').test(block),
      `coverage must not block Yuri's judgment (found "${banned}")`
    )
  }
})

test('a clean automatic result is explicitly distinguished from "checked"', () => {
  const idx = memorySrc.indexOf('CONFLICT-CHECK COVERAGE')
  const block = memorySrc.slice(idx, idx + 900)
  assert.ok(
    /not checked, not that they are safe|does NOT cover them/i.test(block),
    'Yuri must be told a clean result on an unchecked step means nothing was checked'
  )
})

test('the custom-step name is not split out of notes by a separator guess', () => {
  // One real production row is a bare instruction with no name
  // ("ADAPALENE NIGHTS (Tue + Sat...)"), and a wrong split would invent a
  // product name — the exact fabricated-product class this repo already paid
  // for. The whole string is shown instead.
  const idx = memorySrc.indexOf("kind: 'custom'")
  const block = memorySrc.slice(Math.max(0, idx - 1200), idx)
  assert.ok(
    !/notes.*\.split\(/.test(block),
    'the custom-step display must not parse a name out of notes'
  )
})
