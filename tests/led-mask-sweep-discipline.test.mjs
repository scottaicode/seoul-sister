/**
 * Guard test — the LED-mask routine sweep, and the discipline it followed.
 *
 * THE DEFECT (July 30 2026)
 *
 * Bailey owns an LED light-therapy DEVICE. It is correctly stored in her library
 * as a custom entry with no product_id — devices have no catalog row. But when
 * Yuri saved routines containing an "LED mask" step, the resolver's loose
 * fallback matched the word "mask" to real catalog products and wrote their
 * product_id into the routine:
 *
 *   "10 min on bare clean skin BEFORE any products. Blue = hormonal/breakout
 *    days, Red = barrier + collagen"   -> BanoBagi Skin Booster Mask (sheet mask)
 *   "On clean skin, before any products"  -> VT Cryo Ice Mask         (sheet mask)
 *   "10 min on bare clean skin. Blue 3x..." -> Innisfree Super Volcanic Pore
 *                                              Clay Mask 2X
 *
 * Every note describes blue/red light sessions. None of those products were in
 * her library. This is the Beplain Makiol failure on a different word, and it
 * survived that sweep because that sweep targeted one specific product id.
 *
 * THE DURABLE LESSON THIS PINS
 * Shipping a guard does not clean what the bug already wrote, and sweeping ONE
 * fabricated product does not find the next one. The identity floor (July 27)
 * prevents new occurrences; residue needs its own audit, by SHAPE — a
 * catalog-linked routine step whose product is absent from the owning user's
 * library — not by product name.
 *
 * Source-structural assertions on the sweep script. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const sweepSrc = read('scripts', 'fix-led-mask-routine-matches.ts')

test('the sweep defaults to a dry run', () => {
  // A data-repair script that writes by default is one typo from a bad day.
  assert.ok(
    /const APPLY = process\.argv\.includes\('--apply'\)/.test(sweepSrc),
    'writes must require an explicit --apply flag'
  )
  assert.ok(
    /DRY RUN \(pass --apply to write\)/.test(sweepSrc),
    'the dry run must announce itself'
  )
})

test('every update is guarded so re-running is a no-op', () => {
  // The update fires only while the row still points at the wrong product, so a
  // second run cannot touch a row someone has since corrected by hand.
  assert.ok(
    /\.eq\('product_id', row\.product_id\)/.test(sweepSrc),
    'each update must be guarded on the row still holding the bad value'
  )
  assert.ok(
    /already nulled \(re-run is a no-op\)/.test(sweepSrc),
    'an already-fixed row must be skipped, not rewritten'
  )
})

test('the sweep refuses a row that no longer looks like the defect', () => {
  // If a targeted row has been re-pointed at something else, nulling it blindly
  // would destroy real data. Verified against the LIVE row, not a hardcoded id.
  assert.ok(
    /prod\?\.category !== 'mask'/.test(sweepSrc),
    'the sweep must verify the row still points at a mask before nulling it'
  )
  assert.ok(
    /not the expected mask; leaving alone/.test(sweepSrc),
    'a mismatched row must be skipped with an explicit reason'
  )
})

test('the step is preserved, not deleted', () => {
  // She does use an LED mask nightly. The step is real; only the false product
  // identity is wrong. product_id is nullable for exactly this case.
  assert.ok(
    /update\(\{ product_id: null/.test(sweepSrc),
    'the fix must null the product link rather than delete the step'
  )
  assert.ok(
    /WHY NULL RATHER THAN DELETE/.test(sweepSrc),
    'the script must explain why the row survives'
  )
})

test('the step keeps its identity and its schedule', () => {
  // The notes carry the blue/red schedule — losing them would cost real
  // clinical information the user depends on.
  assert.ok(
    /function ledLabelledNote/.test(sweepSrc),
    'the note must be labelled with the step identity'
  )
  assert.ok(
    /if \(\/\^led mask\/i\.test\(trimmed\)\) return trimmed/.test(sweepSrc),
    'a note that already names the step must not be double-prefixed'
  )
  assert.ok(
    !/notes: null[^,)]*\)/.test(sweepSrc.replace(/notes: null ->/g, '')),
    'the sweep must never blank an existing note'
  )
})

test('the sweep verifies its own result', () => {
  assert.ok(
    /verification: /.test(sweepSrc),
    'the script must re-query after applying and report what remains'
  )
})

test('targets are explicit row ids, never a pattern match', () => {
  // A fuzzy sweep over user routines is the wrong-product class with write
  // access — the same reasoning as the Phase 2 relink migration.
  assert.ok(
    /const TARGETS: Array<\{ stepId: string; label: string \}>/.test(sweepSrc),
    'targets must be explicit row ids'
  )
  assert.ok(
    !/\.ilike\(|\.like\(/.test(sweepSrc),
    'the sweep must not select rows to modify by fuzzy name matching'
  )
})
