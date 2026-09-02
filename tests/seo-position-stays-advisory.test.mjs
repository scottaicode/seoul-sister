/**
 * Guard test — position must NOT become a verdict without a re-measured floor.
 *
 * Proposed Sep 1 2026 and REJECTED on measurement. `comparePositions` looks like
 * an easy win: it already computes impression-weighted position per named query,
 * already has a deadband, and 30 of 30 production bets name queries. Two facts
 * killed it, and both are invisible from reading the code:
 *
 *  1. POSITION_DEADBAND (1.5) is not a noise floor — it is roughly the MEDIAN of
 *     ordinary churn. Across all 871 queries present in both the Jul 26 and Aug
 *     30 snapshots, with NO intervention: mean absolute move 5.99, median 2.86,
 *     p90 15.83, and 583 (66.9%) cleared 1.5. A second reviewer independently
 *     measured 67.6% on a different window pair.
 *
 *  2. Absence is ASYMMETRIC. Between those snapshots 1,972 queries vanished and
 *     2,665 appeared against 871 present in both. GSC privacy-filters low-volume
 *     queries, so a query that DROPS loses impressions and disappears while one
 *     that IMPROVES stays visible. comparePositions correctly calls an absent
 *     query "unmeasurable, not a loss" — which as a VERDICT would filter out
 *     losses preferentially and make the instrument systematically optimistic.
 *
 * This test does not forbid the change. It pins the two properties that make
 * position advisory-only, so a future session must confront them deliberately.
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

const { comparePositions, gradeBet } = await load('src/lib/seo/bet-grader.ts')

const row = (query, clicks, impressions, position) => ({ query, page: '/blog/x', clicks, impressions, position })

test('a query absent from one snapshot is never scored as a loss', () => {
  // The asymmetry: drops vanish from GSC, improvements stay visible. Scoring
  // absence as a loss would be wrong; scoring it as nothing is why position
  // cannot carry a verdict.
  const notes = comparePositions([row('q1', 2, 100, 8)], [], ['q1'])
  assert.match(notes[0], /unmeasurable, not a loss/)
})

test('position movement alone cannot produce a hit or a miss', () => {
  // A huge position gain with NO click threshold stated must still abstain.
  // If this ever returns hit/miss, someone promoted position to a verdict —
  // re-measure the noise floor on the FULL query population first (66.9% of
  // untouched queries clear the current 1.5 deadband).
  const grade = gradeBet({
    betId: 'b1',
    expectedOutcome: "'q1' moves from pos 20 to pos <5 within 3 weeks",
    targetPage: '/blog/x',
    targetQueries: ['q1'],
    baselineRows: [row('q1', 2, 100, 20)],
    afterRows: [row('q1', 2, 100, 3)],
    gapDays: 28,
    execution: { status: 'executed', evidence: 'stub' },
    sitewideChangePct: 0,
    sitewideBaselineClicks: 50,
    windowStart: '2026-08-01',
    executionFirstSeen: '2026-07-01',
    today: '2026-09-01',
  })
  assert.ok(
    grade.verdict.startsWith('ungradeable'),
    `position movement must not settle a bet; got ${grade.verdict}`
  )
})

test('the deadband constant is pinned — changing it is a measurement decision', () => {
  const { POSITION_DEADBAND } = { POSITION_DEADBAND: 1.5 }
  const src = readFileSync(join(root, 'src', 'lib', 'seo', 'bet-grader.ts'), 'utf8')
  const m = src.match(/export const POSITION_DEADBAND = ([\d.]+)/)
  assert.ok(m, 'POSITION_DEADBAND must remain an exported, findable constant')
  assert.equal(
    Number(m[1]),
    POSITION_DEADBAND,
    'POSITION_DEADBAND changed. It is ADVISORY-only and sits near the median of ordinary churn (measured: 66.9% of 871 untouched queries clear 1.5). If you are raising it toward a real floor (~p90 = 16) to support verdicts, re-measure on the full population and update tests/seo-position-stays-advisory.test.mjs.'
  )
})
