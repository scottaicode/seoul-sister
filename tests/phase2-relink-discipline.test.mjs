/**
 * Guard test — Phase 2 relink discipline.
 *
 * Phase 2 measured the unlinked-library problem instead of assuming it, and the
 * measurement contradicted the plan twice. These tests pin the two conclusions
 * that a future session would otherwise "fix" back into bugs.
 *
 * 1. The resolver's all-terms strictness is CORRECT, not a defect. Bailey's
 *    stored "Anua Rice 70 + Ceramide Glow Milky Toner" fails to match the real
 *    catalog row "Rice 70 Glow Milky Toner" because of one user-typed extra
 *    term. Loosening that is precisely how "Hero Mighty Patches" resolved to
 *    Dr.ppae Honey Heel Patch (v10.7.0) and how a routine step named
 *    "Shower / cleanse" became "your nightly cleanser" in a real user's face.
 *
 * 2. The relink migration must stay EXACT-pair-only. A fuzzy sweep over user
 *    libraries is the wrong-product class with write access.
 *
 * Source/SQL-structural assertions only. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const toolsSrc = read('src', 'lib', 'yuri', 'tools.ts')
const migrationSrc = read('scripts', 'migrations', 'phase2_relink_and_dedupe.sql')

test('resolver still requires ALL query terms to match', () => {
  // The conservatism that makes "Rice 70 + Ceramide Glow Milky Toner" fail is
  // the same conservatism that stops a wrong product being written to a
  // library. If this filter is removed or softened, the wrong-product class
  // returns with write access.
  assert.match(
    toolsSrc,
    /const allTermMatches = results\.filter\(p => coverageOf\(p\) === terms\.length\)/,
    'All-terms matching was loosened — this is how a spurious token lets the resolver bind the wrong product.'
  )
})

test('write paths still refuse a partial match', () => {
  // resolveProductByNameStrict is what library/routine writes go through.
  assert.match(
    toolsSrc,
    /Only returns a result when the match quality is 'exact' or\s*\*\s*'all_terms'/,
    'Lost the strict-write contract: partial matches must never become a stored product_id.'
  )
})

test('the relink migration is exact-pair only, never a fuzzy sweep', () => {
  // Every UPDATE must target a specific row id AND assert the stored name.
  const relinkUpdates = migrationSrc.match(/UPDATE ss_user_products[\s\S]*?;/g) || []
  assert.ok(relinkUpdates.length >= 2, 'Expected the verified relink statements.')

  for (const stmt of relinkUpdates) {
    if (!/SET product_id/.test(stmt)) continue
    assert.match(stmt, /WHERE id = '[0-9a-f-]{36}'/, 'A relink must target one verified row id.')
    assert.match(stmt, /AND product_id IS NULL/, 'A relink must not overwrite an existing link.')
    assert.match(stmt, /AND custom_name = /, 'A relink must assert the stored name it was verified against.')
    assert.match(
      stmt,
      /EXISTS \(SELECT 1 FROM ss_products/,
      'A relink must verify the target product still exists under the expected name.'
    )
  }
})

test('the casing merge skips genuinely tied groups rather than guessing', () => {
  assert.match(
    migrationSrc,
    /has_tie/,
    'Lost the tie guard — a 1-vs-1 casing split would be resolved by an arbitrary sort.'
  )
  assert.match(
    migrationSrc,
    /c\.k NOT IN \(SELECT k FROM has_tie\)/,
    'Tied casing groups must be excluded from the UPDATE.'
  )
})

test('the migration records that casing is NOT a matching fix', () => {
  // The plan asserted casing duplicates caused resolver misses. Measurement
  // disproved it (search uses ilike). Keep the correction attached to the code
  // so it is not "re-discovered" as a bug later.
  assert.match(
    migrationSrc,
    /casing is NOT a resolver bug|Brand-CASING is NOT a resolver bug/i,
    'Lost the recorded finding that brand casing never affected matching.'
  )
})
