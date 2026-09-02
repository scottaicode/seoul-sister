/**
 * Guard tests — the strategist must never be shown a delta across a UNITS CHANGE.
 *
 * Earned Sep 1 2026. `fetchSiteTotals` landed 2026-08-24 (commit a378075).
 * Before it, computed_facts.totals.clicks held the SUMMED DIMENSIONED ROWS
 * (~13% of real clicks); after it, the TRUE undimensioned site total. Same
 * column, two different measurements. The first run after the switch subtracted
 * 73 from 674 and led the weekly report with "traffic is up ~9x, a genuine
 * step-change" — then used that phantom shock to argue every bet graded in the
 * window was confounded. An instrument change presented as traffic, corrupting
 * the loop's own noise control.
 *
 * These EXECUTE the real transpiled function.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function load(rel) {
  const src = readFileSync(join(root, rel), 'utf8')
  const stripped = src.replace(/^import\s+(?:type\s+)?\{[^}]*\}\s+from\s+'(?!node:)[^']*'\s*$/gm, '')
  const js = ts.transpileModule(stripped, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const { buildPriorComparison } = await load('src/lib/seo/seo-guardian.ts')

// The REAL production numbers from the Aug 23 -> Aug 30 boundary.
const AUG30 = { clicks: 674, impressions: 70411, visible_clicks: 105, visible_impressions: 14426, totals_source: 'gsc_undimensioned' }
const AUG23_ROW = {
  window_start: '2026-07-24',
  window_end: '2026-08-20',
  // NOTE: no totals_source — pre-switch rows genuinely lack the field.
  computed_facts: { totals: { clicks: 73, impressions: 12056, queries: 2975 } },
}

test('across a units change it states NO week-over-week delta from the headline totals', () => {
  const out = buildPriorComparison(AUG30, AUG23_ROW)
  // The artifact delta is 674-73=+601 clicks and 70411-12056=+58355 impressions.
  assert.ok(!out.includes('+601'), 'must not present the units-change artifact as a click delta')
  assert.ok(!out.includes('+58355'), 'must not present the units-change artifact as an impression delta')
  assert.match(out, /MEASUREMENT CHANGED/, 'must say the measurement changed')
})

test('across a units change it warns against reporting a surge AND against treating it as a confound', () => {
  const out = buildPriorComparison(AUG30, AUG23_ROW)
  assert.match(out, /step-change|surge/i, 'must explicitly warn off the surge reading')
  assert.match(out, /confound/i, 'must warn against reading it as a sitewide shock for bet grading')
})

test('a missing totals_source is treated as OLD units, never as a match', () => {
  // The pre-switch rows have no totals_source at all. Defaulting it to the
  // current value would silently restore the exact bug.
  const out = buildPriorComparison(AUG30, AUG23_ROW)
  assert.match(out, /MEASUREMENT CHANGED/)
})

test('it offers the like-for-like visible series so the week is not left unmeasured', () => {
  const out = buildPriorComparison(AUG30, AUG23_ROW)
  // 73 -> 105 visible clicks is the honest comparable move (+32).
  assert.match(out, /73 → 105/, 'must compare the same-units visible series')
  assert.match(out, /\+32/, 'must state the honest like-for-like delta')
})

test('when BOTH runs use the same source it reports a normal delta', () => {
  const now = { clicks: 700, impressions: 72000, visible_clicks: 110, totals_source: 'gsc_undimensioned' }
  const prior = {
    window_start: '2026-08-07',
    window_end: '2026-09-03',
    computed_facts: { totals: { clicks: 674, impressions: 70411, queries: 3536, totals_source: 'gsc_undimensioned' } },
  }
  const out = buildPriorComparison(now, prior)
  assert.ok(!out.includes('MEASUREMENT CHANGED'), 'same units must not trigger the warning')
  assert.match(out, /\+26 clicks/)
})

test('no prior run is stated plainly', () => {
  assert.match(buildPriorComparison(AUG30, null), /baseline week/)
})
