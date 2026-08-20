/**
 * Guard tests — SEO bet grader (Phase 3).
 *
 * These EXECUTE the real grading function rather than asserting on source text.
 * A source-regex test passes against broken code; this repo has shipped that
 * mistake more than once. Every test below was confirmed to FAIL when its bug
 * was reintroduced into src/lib/seo/bet-grader.ts.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// The module imports only types, so it transpiles and runs standalone.
const src = readFileSync(join(root, 'src', 'lib', 'seo', 'bet-grader.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const grader = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const ALPHA_LIMIT = 0.05
const PAGE = '/blog/x'
const rows = (clicks, impressions = 900) => [
  { query: 'q1', page: 'https://www.seoulsister.com' + PAGE, clicks, impressions, position: 8 },
]
const grade = (o) =>
  grader.gradeBet({
    betId: 't',
    expectedOutcome: o.expected ?? 'clicks rise from 5 to >=10',
    targetPage: o.targetPage === undefined ? PAGE : o.targetPage,
    targetQueries: o.queries ?? ['q1'],
    baselineRows: rows(o.baseline),
    afterRows: o.afterRows ?? rows(o.after),
    gapDays: o.gap ?? 28,
    execution: { status: o.exec ?? 'executed', evidence: 'test' },
    sitewideChangePct: o.sitewide ?? 0,
    today: '2026-08-20',
  })

// --- The statistics themselves --------------------------------------------
//
// These pin NUMBERS, not just verdicts. Without them a grader with
// `poissonUpperTail = () => 0.5` and fabricated p-values passes every
// behavioural test — demonstrated Aug 20 2026, 16/16 green against an impostor
// with no math in it at all. Verdict-shape tests cannot guard a statistical
// core; only the values can.

test('poissonUpperTail matches an independent reference exactly', () => {
  const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r }
  const ref = (k, lam) => {
    if (lam <= 0) return k <= 0 ? 1 : 0
    if (k <= 0) return 1
    let s = 0
    for (let i = 0; i < k; i++) s += Math.exp(-lam) * Math.pow(lam, i) / fact(i)
    return 1 - s
  }
  for (const lam of [0.5, 1, 3, 4, 5, 12, 30, 64]) {
    for (const k of [0, 1, 2, 3, 5, 9, 10, 20, 45]) {
      assert.ok(
        Math.abs(grader.poissonUpperTail(k, lam) - ref(k, lam)) < 1e-9,
        `poissonUpperTail(${k}, ${lam}) diverges from reference`
      )
    }
  }
  // The specific values this module's design rests on.
  assert.ok(Math.abs(grader.poissonUpperTail(5, 4) - 0.3712) < 0.0001, 'P(X>=5|4) must be 0.3712')
  assert.ok(Math.abs(grader.poissonUpperTail(10, 4) - 0.0081) < 0.0001, 'P(X>=10|4) must be 0.0081')
  assert.ok(Math.abs(grader.poissonUpperTail(10, 3) - 0.0011) < 0.0001, 'P(X>=10|3) must be 0.0011')
})

test('the alpha boundary is respected to the observation — 6 vs 7 straddles it', () => {
  // Threshold 12 from a baseline of 4 is gradeable (conditional p=0.038).
  // Then, under the bet's own hypothesis (rate=12):
  //   observed 6 -> P(X<=6|12) = 0.046  -> informative, a real miss
  //   observed 7 -> P(X<=7|12) = 0.090  -> NOT informative, must abstain
  // A `threshold/2` heuristic cannot reproduce this pair, which is the point.
  const informative = grade({ baseline: 4, after: 6, expected: 'clicks rise to >=12' })
  assert.equal(informative.verdict, 'miss', 'observed 6 vs threshold 12 is an informative shortfall')

  const notInformative = grade({ baseline: 4, after: 7, expected: 'clicks rise to >=12' })
  assert.equal(notInformative.verdict, 'ungradeable_underpowered', 'observed 7 sits above alpha — must abstain')
})

test('the conditional binomial test matches an independent reference', () => {
  // The baseline is ITSELF one noisy draw. Treating it as a known rate is
  // anti-conservative ~10x at this site's volumes.
  const comb = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return r }
  const ref = (b, a) => { const N = b + a; let s = 0; for (let i = a; i <= N; i++) s += comb(N, i); return s / Math.pow(2, N) }
  for (const [b, a] of [[3, 8], [2, 7], [3, 9], [4, 12], [4, 14], [10, 25], [30, 60], [5, 5], [1, 1]]) {
    assert.ok(
      Math.abs(grader.conditionalBinomialTail(b, a) - ref(b, a)) < 1e-9,
      `conditionalBinomialTail(${b}, ${a}) diverges from reference`
    )
  }
  // The specific value that exposed the anti-conservative bug.
  assert.ok(Math.abs(grader.conditionalBinomialTail(3, 8) - 0.1133) < 0.0001, '3->8 must be p=0.113, not 0.012')
})

test('a 3 -> 8 move is NOT a confident hit (the anti-conservative bug)', () => {
  // Naive Poisson called this p=0.0119 and graded a confident HIT, feeding the
  // strategist "this action type works" on what a correct test calls noise.
  const g = grade({ baseline: 3, after: 8, expected: 'clicks rise to >=8' })
  assert.notEqual(g.verdict, 'hit', '3 -> 8 must not grade a hit at p=0.113')
})

test('reported p_value is the real tail, not a label', () => {
  const g = grade({ baseline: 4, after: 14, expected: 'clicks rise to >=12' })
  assert.equal(g.verdict, 'hit')
  const expected = grader.conditionalBinomialTail(4, 14)
  assert.ok(Math.abs(g.p_value - +expected.toFixed(4)) < 1e-9, 'p_value must equal the computed conditional tail')
  assert.ok(g.p_value < ALPHA_LIMIT, `p_value ${g.p_value} should clear significance for 4->14`)

  // The abstention path must carry a real p too.
  const a = grade({ baseline: 4, after: 7, expected: 'clicks rise to >=12' })
  const expectedAbstain = grader.conditionalBinomialTail(4, 7)
  assert.ok(
    Math.abs(a.p_value - +expectedAbstain.toFixed(4)) < 1e-9,
    `abstention must report the real conditional tail, got ${a.p_value}`
  )
})

// --- The central failure this instrument exists to prevent ----------------

test('a shortfall that chance fully explains is NOT recorded as a miss', () => {
  // Real Aug 2026 data: BoJ Aqua-Fresh 4 -> 5 clicks against a >=10 threshold.
  // P(X>=5 | lambda=4) = 0.371 — the most likely outcome under no effect, and
  // equally consistent with the edit working. Calling this a miss would teach
  // the strategist "metadata edits don't work" from pure Poisson noise.
  const g = grade({ baseline: 4, after: 5 })
  assert.notEqual(g.verdict, 'miss', 'must not record a miss it cannot support')
  assert.equal(g.verdict, 'ungradeable_underpowered')
  assert.equal(g.powered, false)
})

test('a large real gain that falls just short is not punished', () => {
  // Sebaceous filaments: 3 -> 9 clicks (a 3x gain, p=0.0038) against a >=10
  // threshold. Tripping on the last click must not read as failure.
  const g = grade({ baseline: 3, after: 9 })
  assert.notEqual(g.verdict, 'miss')
})

test('an unambiguous shortfall IS recorded as a miss', () => {
  // The abstention must not swallow every negative result, or the instrument
  // can never say anything.
  const g = grade({ baseline: 4, after: 4, expected: 'clicks rise to >=20' })
  assert.equal(g.verdict, 'miss')
  assert.equal(g.powered, true)
})

test('a clear win IS recorded as a hit', () => {
  const g = grade({ baseline: 4, after: 14, expected: 'clicks rise to >=12' })
  assert.equal(g.verdict, 'hit')
  assert.equal(g.powered, true)
  assert.ok(g.p_value < ALPHA_LIMIT)
})

// --- Gate ordering --------------------------------------------------------

test('unexecuted work is never graded a miss', () => {
  // "The theory was wrong" and "the theory was untested" have opposite
  // remediations. Conflating them teaches the strategist about the content
  // pipeline's throughput while labelling it SEO.
  const g = grade({ baseline: 12, after: 1, exec: 'not_executed' })
  assert.equal(g.verdict, 'ungradeable_not_executed')
  assert.equal(g.baseline_clicks, null, 'metrics must not be computed for unshipped work')
})

test('an overlapping window abstains instead of measuring through the haircut', () => {
  // 28-day windows a week apart share 21 days, attenuating a true effect ~4x.
  const g = grade({ baseline: 4, after: 14, expected: 'clicks rise to >=12', gap: 7 })
  assert.equal(g.verdict, 'ungradeable_too_soon')
})

test('a threshold at or below baseline is unfalsifiable', () => {
  // Satisfied by standing still — predicts nothing however large the numbers.
  // NOTE: this is enforced by the SIGNIFICANCE test, not by the explicit
  // `threshold <= baseline` clause (which is provably redundant — see the
  // comment in bet-grader.ts). Deleting that clause does NOT fail this test,
  // and that is understood rather than overlooked.
  const g = grade({ baseline: 12, after: 20 })
  assert.equal(g.verdict, 'ungradeable_underpowered')
})

test('an expected_outcome with no numeric threshold cannot be graded', () => {
  // Otherwise the strategist learns to write vague outcomes that always grade
  // favourably (Goodhart).
  const g = grade({ baseline: 20, after: 40, expected: 'visibility should meaningfully improve' })
  assert.equal(g.verdict, 'ungradeable_underpowered')
})

test('a page absent from the after snapshot is no-data, never a miss', () => {
  const g = grade({ baseline: 12, after: 0, afterRows: [] })
  assert.equal(g.verdict, 'ungradeable_no_data')
})

// --- The silent all-miss bug ---------------------------------------------

test('URL normalization joins relative bet paths to absolute GSC rows', () => {
  // Verified Aug 2026: 21 bets store '/blog/...', all 21,263 snapshot rows
  // store 'https://www.seoulsister.com/blog/...'. A naive equality join returns
  // zero rows silently and grades EVERY bet a confident miss.
  assert.equal(grader.normalizePath('https://www.seoulsister.com/blog/x'), '/blog/x')
  assert.equal(grader.normalizePath('https://seoulsister.com/blog/x'), '/blog/x')
  assert.equal(grader.normalizePath('/blog/x'), '/blog/x')
  const g = grade({ baseline: 4, after: 14, expected: 'clicks rise to >=12' })
  assert.equal(g.baseline_clicks, 4, 'must actually find the page across URL forms')
})

test('a hit is never credited to execution we could not confirm', () => {
  // The verifier abstains readily ('unverified') because a false 'not_executed'
  // silently drops a bet. That abstention must not then flow into a confident
  // hit, or the loop learns "this bet type works" from an action that may never
  // have shipped.
  const confirmed = grade({ baseline: 4, after: 14, expected: 'clicks rise to >=12', exec: 'executed' })
  assert.equal(confirmed.verdict, 'hit', 'a confirmed-executed win must still grade hit')

  for (const status of ['unverified', 'partially_executed']) {
    const g = grade({ baseline: 4, after: 14, expected: 'clicks rise to >=12', exec: status })
    assert.notEqual(g.verdict, 'hit', `execution=${status} must not produce a hit`)
    assert.equal(g.verdict, 'ungradeable_execution_unknown')
  }
})

test('an unconfirmed-execution MISS is also withheld (symmetry)', () => {
  // `partially_executed` is the LITERAL BoJ case — metadata shipped, on-page
  // section did not. Letting a miss stand there files a content-pipeline
  // failure as "the SEO theory was wrong": opposite remediations.
  for (const status of ['unverified', 'partially_executed']) {
    const g = grade({ baseline: 4, after: 4, expected: 'clicks rise to >=20', exec: status })
    assert.notEqual(g.verdict, 'miss', `execution=${status} must not produce a miss`)
    assert.equal(g.verdict, 'ungradeable_execution_unknown')
  }
  // A confirmed-executed shortfall must STILL grade miss, or the instrument
  // can never say anything negative.
  const confirmed = grade({ baseline: 4, after: 4, expected: 'clicks rise to >=20', exec: 'executed' })
  assert.equal(confirmed.verdict, 'miss')
})

// --- Provenance travels with the verdict ---------------------------------

test('every verdict carries its own provenance in the same object', () => {
  // A caveat stored in a sibling table is a caveat that gets read past
  // (the fitzpatrick_source / v11.33.0 scorer discipline).
  const g = grade({ baseline: 4, after: 5 })
  assert.equal(g.scorer, 'bet-grader-v1-deterministic')
  assert.equal(typeof g.powered, 'boolean')
  assert.equal(typeof g.execution_status, 'string')
  assert.ok('gap_days' in g && 'p_value' in g)
})

test('a sitewide shock is flagged on the verdict', () => {
  const g = grade({ baseline: 4, after: 14, expected: 'clicks rise to >=12', sitewide: 22 })
  assert.equal(g.confounded_sitewide, true)
})

// --- Position is advisory only -------------------------------------------

test('position never upgrades a verdict and absence is not a ranking loss', () => {
  // A page-level average is uninterpretable: the real BoJ page gained 68 NEW
  // queries against a 67-query baseline, so its average mostly reports which
  // long-tails Google surfaced. And GSC privacy-filters low-volume queries, so
  // an absent query means no data, not a loss.
  const notes = grader.comparePositions(
    [{ query: 'q1', page: 'p', clicks: 0, impressions: 100, position: 12 }],
    [],
    ['q1']
  )
  assert.match(notes[0], /unmeasurable/)
  assert.doesNotMatch(notes[0], /lost|dropped/)

  const g = grade({ baseline: 4, after: 5 })
  assert.equal(g.verdict, 'ungradeable_underpowered', 'position must not rescue an unpowered verdict')
})

test('position moves inside the noise deadband are reported as noise', () => {
  const notes = grader.comparePositions(
    [{ query: 'q1', page: 'p', clicks: 0, impressions: 100, position: 8.4 }],
    [{ query: 'q1', page: 'p', clicks: 0, impressions: 100, position: 8.0 }],
    ['q1']
  )
  assert.match(notes[0], /deadband/)
})
