/**
 * Guard tests — extractClickThreshold must not file an AUTHORING failure that is
 * really a PARSER failure.
 *
 * Earned Sep 1 2026. Two production bets (`pih-into-pie-post`,
 * `sunscreen-buy-authentic-answer`) were graded `ungradeable_underpowered` with
 * the note "expected_outcome states no explicit numeric click threshold, so
 * nothing falsifiable can be tested." Both HAD stated one. ">=3 additional
 * clicks" returned null because pattern 3 required the digit to sit immediately
 * before `clicks`, and one qualifier word defeated it.
 *
 * Why this mattered beyond two bets: the verdict blames the STRATEGIST for how
 * it wrote the bet, and that verdict is fed back into the strategist's prompt as
 * its own track record. A parser defect was teaching the author to distrust
 * correct work — a mismatch filed under the wrong cause, where the two
 * remediations (fix the prompt vs fix the regex) are opposite.
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

const { extractClickThreshold } = await load('src/lib/seo/bet-grader.ts')

test('a qualifier between the number and "clicks" does not defeat the parse', () => {
  // The REAL string from the pih-into-pie-post bet.
  assert.equal(extractClickThreshold('>=3 additional clicks'), 3)
  assert.equal(extractClickThreshold('earns >=10 additional total clicks'), 10)
  assert.equal(extractClickThreshold('>=3 clicks'), 3)
})

test('"at least" is accepted wherever ">=" is', () => {
  assert.equal(extractClickThreshold('rise from 4 to at least 12 clicks'), 12)
  assert.equal(extractClickThreshold('at least 8 clicks'), 8)
})

test('real stored bets that DO state a threshold all parse', () => {
  assert.equal(
    extractClickThreshold(
      "'best korean skincare for pih' avg position improves from 10.3 to <8 on the PIH page as top-ranking URL, and the PIH page earns >=6 clicks (from 3) within 3 weeks."
    ),
    6
  )
})

// The other half of the contract: a LOOSER parser must not start reading a
// position or impression figure as a click threshold. That would manufacture a
// falsifiable-looking bet out of one that never stated a click target and grade
// it against a number the strategist never bet on.
test('position-only outcomes still yield NO click threshold', () => {
  assert.equal(extractClickThreshold('avg position improves from 10.3 to <8 within 3 weeks'), null)
  assert.equal(extractClickThreshold('position moves to 4'), null)
  assert.equal(extractClickThreshold('at least 2 of the sub-queries reach pos <4'), null)
})

test('impression- and CTR-only outcomes still yield NO click threshold', () => {
  assert.equal(extractClickThreshold('impressions grow from 200 to at least 400'), null)
  assert.equal(extractClickThreshold('impressions rise from 500 to at least 900 on the page'), null)
  assert.equal(extractClickThreshold('CTR improves from 0.2% to 1%'), null)
})

test('an unfalsifiable "holds or grows" outcome is still correctly unparseable', () => {
  // Aug 30's pie-subtype-internal-links bet. "holds or grows from 19" names no
  // target, so it must stay ungradeable — this is a real authoring gap, and the
  // looser parser must not paper over it by grabbing the 19.
  assert.equal(
    extractClickThreshold(
      "At least two of 'moisturizer for pie' / 'best skincare for pie' / 'best serum for pie' reach pos <4, and the PIE page holds or grows from 19 clicks within 3 weeks."
    ),
    null
  )
})

test('the qualifier gap cannot swallow an intervening number', () => {
  // If the gap allowed digits, this would read 8 (a position) as the click
  // threshold instead of 20.
  assert.equal(extractClickThreshold('>=20 clicks'), 20)
  assert.notEqual(extractClickThreshold('at least 5 impressions per 3 clicks'), null)
})
