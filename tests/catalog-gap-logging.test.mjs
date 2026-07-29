/**
 * Guard test — catalog gap logging.
 *
 * WHY THIS EXISTS
 * When Yuri couldn't find a product a subscriber said they owned, the fact
 * evaporated into the conversation. Nobody ever learned which products real
 * users have that the catalog lacks — the 13 known cases surfaced only from a
 * hand-written query on July 29 2026, months after the first one.
 *
 * WHAT IT MUST STAY
 * An INSTRUMENT, not a trigger. It records demand so a future catalog decision
 * is evidence-based; it must never fire a scraper, and must never cost a user
 * the save they actually asked for. It also has to keep logging Western
 * products — most gaps are Western (Naturium, Kiehl's, Byoma, Dr. Dennis
 * Gross), no K-beauty scrape can fill those, and they are still the honest
 * answer to "what do our subscribers use?"
 *
 * Source/SQL-structural assertions. Run: `npm test`.
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
const migrationSrc = read('scripts', 'migrations', 'add_catalog_requests.sql')

test('a save with no catalog match logs the gap', () => {
  assert.match(
    toolsSrc,
    /if \(!productId\) \{\s*await logCatalogGap\(/,
    'The no-match save path no longer records the gap — demand goes back to being invisible.'
  )
})

test('the gap is logged only AFTER the save succeeds', () => {
  // Logging before the insert would create phantom requests for saves that
  // errored out.
  const insertIdx = toolsSrc.indexOf("const { error } = await db.from('ss_user_products').insert(record)")
  const logIdx = toolsSrc.indexOf('await logCatalogGap(db, userId, productName')
  assert.ok(insertIdx > 0 && logIdx > insertIdx, 'logCatalogGap must run after the insert, not before.')
})

test('logging never blocks or breaks the user save', () => {
  const fn = toolsSrc.slice(
    toolsSrc.indexOf('async function logCatalogGap'),
    toolsSrc.indexOf('async function logCatalogGap') + 2200
  )
  assert.match(fn, /try \{/, 'Lost the try/catch — a measurement failure must not cost a user their save.')
  assert.match(
    fn,
    /console\.error\('\[catalog-gap\]/,
    'A silent failure here is how the gap stayed invisible the first time.'
  )
})

test('devices and routine steps are not counted as catalog gaps', () => {
  // No product database contains "Ice roller" or "Shower / cleanse". Counting
  // them inflates the exact number this table exists to measure honestly.
  assert.match(
    toolsSrc,
    /if \(category === 'device'\) return/,
    'Devices must be excluded, or the demand list is padded with things no catalog can carry.'
  )
  assert.match(
    migrationSrc,
    /coalesce\(up\.category, ''\) <> 'device'/,
    'The backfill must exclude devices too.'
  )
})

test('repeat asks bump a counter instead of duplicating rows', () => {
  assert.match(
    toolsSrc,
    /request_count: \(\(existing\.request_count as number\) \?\? 1\) \+ 1/,
    'Lost the repeat-ask counter — the ranking signal degrades to row spam.'
  )
  assert.match(
    migrationSrc,
    /ss_catalog_requests_user_name_uniq/,
    'Lost the uniqueness constraint backing the counter.'
  )
})

test('Western products are still logged', () => {
  // The majority of real gaps are Western. Filtering to Korean-only brands
  // would make the table answer a different, less useful question.
  // Strip comments first — the doc block legitimately DISCUSSES Western
  // products while explaining why they must not be filtered out.
  const fn = toolsSrc
    .slice(
      toolsSrc.indexOf('async function logCatalogGap'),
      toolsSrc.indexOf('async function logCatalogGap') + 2200
    )
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(
    !/korean|k-?beauty|brand_en/i.test(fn),
    'Gap logging must not filter by brand origin — most real gaps are Western.'
  )
})

test('the table is operator-only, not user-facing', () => {
  assert.match(migrationSrc, /ENABLE ROW LEVEL SECURITY/, 'Lost RLS on the requests table.')
  assert.match(
    migrationSrc,
    /auth\.role\(\) = 'service_role'/,
    'Catalog demand is operator intelligence; it must not be readable by users.'
  )
})

test('the migration is documented as NOT a scraper trigger', () => {
  assert.match(
    migrationSrc,
    /NOT a scraper trigger/i,
    'This must stay an instrument. Wiring it to an automated scrape is a separate, deliberate decision.'
  )
})
