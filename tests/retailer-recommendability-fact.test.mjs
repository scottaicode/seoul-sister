/**
 * Guard test — a price row must carry whether we'd actually send someone there.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (a real cold visitor, Aug 8 2026)
 *
 * Suzy arrived from Bailey's TikTok with a stinging, barrier-compromised face,
 * at 2:58am. Yuri diagnosed it correctly — compromised barrier, not "breaking
 * out" — and anchored the reset on the COSRX Ceramide Skin Barrier Moisturizer.
 * Then she wrote, verbatim:
 *
 *   "$18.40 at YesStyle, $23 at Soko Glam, I'd order from Soko Glam even at
 *    the couple dollars more; faster and cleaner refunds than YesStyle."
 *
 * The judgment was RIGHT and the steer was RIGHT. But YesStyle is on the
 * never-steer list, and the cheaper number a first-time visitor reads and
 * remembers is the one she wasn't supposed to be sent to. Those live rows are
 * real: YesStyle $18.40, Soko Glam $23.00, Olive Young $46.40.
 *
 * WHY THE PROMPT WASN'T ENOUGH, AND WHY THIS IS A DATA FIX.
 *
 * The widget prompt already carried the policy in four explicit bullets,
 * correctly worded. The failure was structural, not a wording problem: the tool
 * returned `{retailer: "YesStyle", price_usd: 18.40}` — a bare name with no
 * indication of what we think of it — and asked Yuri to recall a policy from
 * thousands of tokens earlier and re-derive the classification per row, mid
 * safety triage. The one catalog field that LOOKS like it carries this does
 * not: `trust_score`/`is_authorized` score COUNTERFEIT risk, and YesStyle is
 * authorized (true) and sells authentic product. Nothing in the payload
 * disagreed with quoting it.
 *
 * Rewording the prompt a fifth time is the move this repo has already paid for
 * twice (the widget give/gate, the cumulative-give instrument). Attach the fact
 * to the row instead.
 *
 * THE STANDING RULE THESE TESTS PIN: it is a FACT, never a FILTER. The
 * non-recommended row is still returned, still priced, still ordered by price.
 * Yuri decides. Filtering would hide a real price from a real shopper and make
 * her "$23" look uninformed rather than considered.
 *
 * These tests EXECUTE the real classifier (transpiled out of tools.ts, which
 * has DB imports at module scope) rather than matching source text — a source
 * regex would pass against broken logic, which this repo has shipped before.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const toolsSrc = read('src', 'lib', 'yuri', 'tools.ts')

/**
 * Extract the real RECOMMENDED_RETAILERS set + isRecommendedRetailer function
 * from tools.ts and execute them. tools.ts imports the Supabase client at module
 * scope, so the whole module can't be imported in a test process; the classifier
 * is self-contained, so we lift exactly it. If either declaration is renamed or
 * removed, this throws and the test fails loudly rather than silently passing.
 */
async function loadClassifier() {
  const setMatch = toolsSrc.match(
    /const RECOMMENDED_RETAILERS = new Set\(\[[^\]]*\]\)/
  )
  assert.ok(
    setMatch,
    'RECOMMENDED_RETAILERS not found in tools.ts — was it renamed or removed?'
  )

  const fnMatch = toolsSrc.match(
    /export function isRecommendedRetailer\([\s\S]*?\n\}/
  )
  assert.ok(
    fnMatch,
    'isRecommendedRetailer not found in tools.ts — was it renamed or removed?'
  )

  const js = ts.transpileModule(`${setMatch[0]}\n${fnMatch[0]}\n`, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const dir = mkdtempSync(join(tmpdir(), 'ss-retailer-'))
  const file = join(dir, 'classifier.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

test('the three never-steer retailers classify as NOT recommended', async () => {
  const { isRecommendedRetailer } = await loadClassifier()

  // These are the exact strings in ss_retailers.name (live, Aug 8 2026).
  for (const name of ['YesStyle', 'Stylevana', 'StyleKorean']) {
    assert.equal(
      isRecommendedRetailer(name),
      false,
      `${name} is on the never-steer list and must classify false`
    )
  }
})

test('the three recommended retailers classify as recommended', async () => {
  const { isRecommendedRetailer } = await loadClassifier()

  for (const name of ['Olive Young', 'Soko Glam', 'iHerb']) {
    assert.equal(
      isRecommendedRetailer(name),
      true,
      `${name} is a recommended retailer and must classify true`
    )
  }
})

test('the catalog name and the display name classify identically', async () => {
  const { isRecommendedRetailer } = await loadClassifier()

  // ss_retailers stores "Olive Young"; the prompt and UI say "Olive Young
  // Global". A strict-equality check would classify the same retailer
  // differently depending on which string reached it — the substring match
  // exists for exactly this, so pin it.
  assert.equal(isRecommendedRetailer('Olive Young'), true)
  assert.equal(isRecommendedRetailer('Olive Young Global'), true)
})

test('classification is case- and whitespace-insensitive', async () => {
  const { isRecommendedRetailer } = await loadClassifier()

  assert.equal(isRecommendedRetailer('  soko glam  '), true)
  assert.equal(isRecommendedRetailer('YESSTYLE'), false)
})

test('an unknown or missing retailer is not silently recommended', async () => {
  const { isRecommendedRetailer } = await loadClassifier()

  // 'Unknown' is the literal fallback the price mappers emit when the joined
  // retailer row is null. Defaulting an unknown to "recommended" would be the
  // silent-failure shape: a missing join reading as an endorsement.
  assert.equal(isRecommendedRetailer('Unknown'), false)
  assert.equal(isRecommendedRetailer(null), false)
  assert.equal(isRecommendedRetailer(undefined), false)
  assert.equal(isRecommendedRetailer(''), false)
})

test('Amazon is not recommended (separate counterfeit-risk case)', async () => {
  const { isRecommendedRetailer } = await loadClassifier()
  assert.equal(isRecommendedRetailer('Amazon'), false)
})

test('all three price-bearing tools attach recommended_to_buy_from', () => {
  // search_products, compare_prices and get_product_details each build their own
  // price rows. Suzy's quote came from search_products; a fix applied to only
  // compare_prices would have left the exact path that failed her untouched.
  const attachments = toolsSrc.match(/recommended_to_buy_from:/g) || []
  assert.ok(
    attachments.length >= 4,
    `expected recommended_to_buy_from on all price-row builders plus best_deal, found ${attachments.length}`
  )
})

test('the non-recommended row is surfaced as a FACT, never filtered out', () => {
  // The standing rule. If someone "hardens" this by dropping non-recommended
  // rows, Yuri loses the ability to say "there's a cheaper one at YesStyle and
  // I'd still buy from Soko Glam" — which is the honest answer, and the one she
  // actually gave. Assert no price mapper filters on the flag.
  const filtersOnFlag =
    /\.filter\(\s*\([^)]*\)\s*=>\s*[^)]*recommended_to_buy_from\s*\)/.test(toolsSrc)
  assert.equal(
    filtersOnFlag,
    false,
    'price rows must never be filtered on recommended_to_buy_from — it is a fact for Yuri to weigh, not a gate'
  )
})

test('compare_prices hands Yuri the cheapest recommended alternative', () => {
  assert.ok(
    /cheapest_recommended:/.test(toolsSrc),
    'compare_prices must surface cheapest_recommended so Yuri has the real alternative without re-scanning'
  )
})

test('both Yuri prompts explain the flag and its axis', () => {
  // The data fix is the load-bearing half, but a field Yuri has never been told
  // about is a field she may not use. Both surfaces must describe it, and both
  // must distinguish it from trust_score (counterfeit risk) — conflating the
  // two is what made "authorized: true" read as "safe to recommend".
  for (const [label, src] of [
    ['widget', read('src', 'app', 'api', 'widget', 'chat', 'route.ts')],
    ['advisor', read('src', 'lib', 'yuri', 'advisor.ts')],
  ]) {
    assert.ok(
      src.includes('recommended_to_buy_from'),
      `${label} prompt must document the recommended_to_buy_from field`
    )
    assert.ok(
      /trust_score/.test(src),
      `${label} prompt must distinguish recommendability from trust_score/counterfeit risk`
    )
  }
})
