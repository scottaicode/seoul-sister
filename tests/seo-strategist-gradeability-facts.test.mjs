/**
 * Guard tests — the strategist prompt must tell the model how a bet gets GRADED,
 * and must do it as FACTS about the instrument, never as a cage on judgment.
 *
 * WHY THIS EXISTS
 * 34 bets across 10 weeks produced ZERO hit-or-miss verdicts. The grader was
 * fixed separately (a structural bug made a verdict unreachable for any bet),
 * but a fixed grader still cannot score a bet that states no numeric threshold,
 * names a statistically unreachable one, or names no verifiable marker. The
 * grader's own error string literally says "Write thresholds, not directions"
 * while the prompt's schema said "metric + direction" — the instrument stated
 * its requirement and nothing carried it back to the author.
 *
 * THE LINE THIS MUST NOT CROSS
 * "Surface the fact, never cage the judgment." This repo has a documented
 * history of a FACT block turning into a COMMAND (the widget cumulative-give
 * instrument, reworded twice). The strategist may bet on anything in the data;
 * these tests pin that the block informs HOW a bet is scored and never restricts
 * WHAT may be bet on.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'seo', 'seo-guardian.ts'), 'utf8')

function block() {
  const a = src.indexOf('HOW A BET GETS GRADED')
  assert.ok(a > 0, 'the gradeability block is missing from the strategist prompt')
  const b = src.indexOf('Output format:', a)
  assert.ok(b > a, 'end of block not found')
  return src.slice(a, b)
}

test('the block exists and names itself as mechanics, not restriction', () => {
  const b = block()
  assert.match(b, /NOT a restriction on what you may bet on/i)
  assert.match(b, /Bet on whatever your reasoning supports/i)
})

test('it carries the actual power table, so a threshold can be chosen honestly', () => {
  const b = block()
  // Each row verified by EXECUTING the grader's own conditional test at its real
  // alpha. A wrong table is worse than none: it would send the strategist to an
  // unreachable number while looking authoritative.
  for (const row of ['B=0 -> 3', 'B=3 -> 10', 'B=5 -> 13', 'B=10 -> 20', 'B=20 -> 33']) {
    assert.ok(b.includes(row), `power table missing row: ${row}`)
  }
})

test('it explicitly protects the honest-but-ungradeable bet', () => {
  const b = block()
  // The Goodhart guard. Handing a model a scoring threshold invites it to pick
  // safe winnable bets; this sentence is what stops the table becoming a target.
  assert.match(b, /WRITE THE HONEST NUMBER/i)
  assert.match(
    b,
    /accurate ungradeable bet is worth more than an inflated gradeable one/i,
    'without this, the power table is a target rather than a fact'
  )
})

test('it does NOT tell the strategist which pages or queries to bet on', () => {
  const b = block()
  // The cage test. Any of these would convert a fact block into a content rule.
  for (const caged of [
    /only bet on pages with/i,
    /do not bet on (?!.*(a prediction of no change|shapes))/i,
    /avoid (?:betting|bets) on/i,
    /prefer (?:pages|queries) (?:with|that)/i,
    /never bet on/i,
  ]) {
    assert.ok(!caged.test(b), `the block constrains WHAT may be bet on: ${caged}`)
  }
})

test('the unmeasurable shapes are framed as instrument gaps, not as bad work', () => {
  const b = block()
  // internal_links and new-content bets cannot be click-graded. If the prompt
  // let that read as "these do not work", the strategist would stop proposing
  // genuinely valuable link work because the RULER cannot see it.
  assert.match(b, /Propose them freely when they are the right work/i)
  assert.match(
    b,
    /gap in the instrument, NOT a finding that link work is ineffective/i,
    'an instrument blind spot must never be read back as evidence about the tactic'
  )
})

test('the schema line no longer instructs the failure mode', () => {
  // The original said "<falsifiable: metric + direction + rough timeframe>".
  // "direction" is exactly what the grader rejects.
  const schema = src.match(/"expected_outcome": "<[^"]*>"/)
  assert.ok(schema, 'expected_outcome schema hint not found')
  assert.ok(
    !/direction/i.test(schema[0]),
    `the schema must not ask for a direction; the grader needs a threshold. Saw: ${schema[0]}`
  )
  assert.match(schema[0], /threshold/i)
})

test('it does not over-attribute every abstention to the author', () => {
  const b = block()
  // Measured: 6 of 20 graded bets abstained as `too_soon` (pure timing) and 10
  // carried a sitewide confound. Telling the model every abstention is its own
  // fault would make it over-correct for something outside its control.
  assert.match(b, /not all of them do|do not read this as blame/i)
})

test('no closed-form threshold approximation — it was measured wrong and deleted', () => {
  const b = block()
  // An adversarial review caught this and executing the grader's own test
  // confirmed it: T = B + 1.65*sqrt(B+1) + 2 is LOW at every baseline
  // (B=4 gives 10 vs the true 12; B=20 gives 30 vs 33; B=30 gives 42 vs 46),
  // worsening as B grows. A formula is consulted precisely when the baseline
  // falls between table rows, so it would have produced an underpowered
  // threshold — the exact failure this block exists to end — while carrying the
  // authority of the correct table printed beside it.
  assert.ok(
    !/1\.65\s*\*\s*sqrt/i.test(b),
    'the closed-form approximation is measurably wrong; use the next table row up'
  )
  assert.match(b, /NEXT ROW UP/i, 'there must still be guidance for a between-rows baseline')
})

test('the Goodhart guard covers bet SELECTION, not just threshold writing', () => {
  const b = block()
  // Handing over a power table is handing over a menu: a low-baseline page needs
  // a smaller number to clear the bar. Telling the model to write an honest
  // threshold does not stop it from choosing an easy PAGE.
  assert.match(
    b,
    /Choose the page from the DATA, never from where this table is cheapest/i,
    'without this, the table is a menu of cheap wins'
  )
})

test('a narrow shortfall is not described as a recorded miss', () => {
  const b = block()
  // The grader abstains rather than recording a miss when the shortfall is not
  // itself informative (bet-grader.ts: pUnderHypothesis >= ALPHA). Overstating
  // the penalty is a false mechanic, and a false mechanic in a prompt is worse
  // than silence.
  assert.ok(
    !/it makes it a recorded MISS/i.test(b),
    'a narrowly missed threshold abstains; it does not automatically record a miss'
  )
})

test('the execution-timing mechanic is present and framed as not-your-fault', () => {
  const b = block()
  // The biggest omission the review found: a perfect bet whose action ships
  // mid-window abstains on execution timing. The strategist does not control
  // the content pipeline, so this must inform without assigning blame.
  assert.match(b, /BEFORE THE MEASUREMENT WINDOW OPENS/i)
  assert.match(
    b,
    /not something to design around/i,
    'the strategist does not control ship timing; stating it as a rule would be a cage'
  )
})

test('the threshold advice matches what the extractor actually does', () => {
  const b = block()
  // An Opus fact-check executed extractClickThreshold and found my advice
  // inverted. Multi-clause sentences parse fine ("impressions >=400 and clicks
  // >=12" -> 12; the real pie-restructure-subtypes bet -> 17), so the
  // "own sentence" rule taught a defense against a failure that does not exist.
  // The hazard that DOES exist is two figures with no separator:
  // "impressions >=400 clicks unchanged" extracts 400 and grades a click bet
  // against an impression count.
  assert.ok(
    !/its own sentence/i.test(b),
    'the own-sentence rule is unsupported; multi-clause thresholds parse correctly'
  )
  assert.match(b, /impressions >=400 clicks unchanged/, 'the real trap must be named concretely')
  assert.match(b, /comma or an "and" between adjacent figures/i)
})

test('the corpus numbers are exact, in a block about numeric precision', () => {
  const b = block()
  // I shipped "34 bets across 10 weeks" against a live count of 30 bets across
  // 9 reports, in a prompt whose whole purpose is teaching the model to state
  // precise, checkable numbers. Verified: 30 bets, 9 reports, 20 graded.
  assert.match(b, /30 bets across 9 weekly reports/)
  assert.match(b, /20 of them graded/)
  assert.ok(!/34 bets/.test(b), 'the inflated count must not return')
  // And the authorship share is a measured number, not a vague "most".
  assert.match(b, /9 of those 20/, 'state the measured authorship share, not an impression of it')
})

test('review_after guidance does not contradict itself across the prompt', () => {
  // The schema hint said "typically 3 weeks out" while the block says 28 days.
  // A prompt that contradicts itself teaches the model that neither half is
  // load-bearing.
  const schema = src.match(/"review_after": "<[^"]*>"/)
  assert.ok(schema, 'review_after schema hint not found')
  assert.ok(
    !/3 weeks/i.test(schema[0]),
    `the schema hint must not contradict the 28-day guidance. Saw: ${schema[0]}`
  )
  assert.match(schema[0], /28 days/)
})
