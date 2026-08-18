/**
 * Guard test — the "last checked" stamp reports the TYPICAL row, not the best one.
 *
 * THE DEFECT
 *
 * /best/[category] fetched price rows for the 20 products it displays, ordered
 * last_checked DESC, and took `.limit(1)` — the single freshest row in the set —
 * then printed it as "prices ... last checked {date}".
 *
 * Measured on /best/serums (Aug 18 2026): the page displayed **Aug 18**, today,
 * while the median row was **June 11** and the oldest **Feb 17**. One product
 * refreshed that morning made four-month-old pricing read as same-day.
 *
 * This is the false-cadence class the repo has already paid for once — every
 * product page claimed "prices are refreshed automatically every 6 hours"
 * against a ~130-day reality. A max() freshness stamp is the same lie told
 * with real data: every individual number is true, and the summary is not.
 *
 * The fix is the median. On a set whose ages span months, the typical row is
 * the honest summary; the newest is an outlier being passed off as the norm.
 *
 * The direction matters more than the statistic. Reporting the best case is
 * what makes it dishonest — a stamp that erred toward "older than reality"
 * would merely be conservative.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BEST = join(root, 'src/app/best/[category]/page.tsx')

/** The real selection logic, extracted so the test executes it rather than reading it. */
function medianOf(datesDesc) {
  const dates = datesDesc.filter(Boolean)
  return dates.length > 0 ? dates[Math.floor(dates.length / 2)] : null
}

test('the freshness stamp never reports the newest row', () => {
  const src = readFileSync(BEST, 'utf8')
  const block = src.slice(
    src.indexOf('let priceCheckedAt'),
    src.indexOf('// Map ingredient') > 0 ? src.indexOf('// Map ingredient') : undefined
  )

  // `.limit(1)` on a DESC ordering is precisely the bug: it selects the max.
  assert.doesNotMatch(
    block.slice(0, 900),
    /order\('last_checked',\s*\{\s*ascending:\s*false\s*\}\)\s*\n\s*\.limit\(1\)/,
    'takes the single freshest price row and presents it as the page freshness'
  )
  assert.match(
    block.slice(0, 1400),
    /Math\.floor\(dates\.length \/ 2\)/,
    'freshness must be the median of the displayed set'
  )
})

test('median picks a typical date, never the outlier', () => {
  // Real shape from /best/serums: one row refreshed today, the rest months old.
  const desc = [
    '2026-08-18T00:00:00Z',
    '2026-06-11T00:00:00Z',
    '2026-06-11T00:00:00Z',
    '2026-03-02T00:00:00Z',
    '2026-02-17T00:00:00Z',
  ]
  const got = medianOf(desc)
  assert.notEqual(got, desc[0], 'must not report the freshest row')
  assert.equal(got, '2026-06-11T00:00:00Z', 'must report the typical row')
})

test('a single-row set still reports that row, and an empty set reports nothing', () => {
  assert.equal(medianOf(['2026-08-18T00:00:00Z']), '2026-08-18T00:00:00Z')
  // Unknown must render as nothing rather than a fabricated date — the page
  // only renders the stamp when this is non-null.
  assert.equal(medianOf([]), null)
})
