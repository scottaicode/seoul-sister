/**
 * Guard test — price age is stated as a FACT, and never becomes a promise.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Aug 15 2026: a visitor in Spain at purchase intent was quoted six prices as
 * current fact. They were ~130 days old. Live check the same day: Arencia
 * quoted $18.81 was really $24.00 (she'd pay 28% MORE), Jumiso quoted $24.05
 * was really $19.00, and two products — including her #1 recommendation — were
 * DELISTED entirely. `compare_prices` had carried staleness honesty since
 * v10.3.8, but all three of her tool calls were `search_products`, which never
 * selected `last_checked`. The instrument existed on the path visitors don't take.
 *
 * WHY THE ASSERTIONS BELOW ARE SHAPED THIS WAY — this is the load-bearing part.
 *
 * A SECOND-MODEL REVIEW (Fable 5) broke the first version of this test. Asked to
 * write something clearly harmful that would still pass a naive "no command
 * words" check, it produced two sentences in seconds:
 *
 *   "Our prices refresh against retailer sites each morning, so the number Yuri
 *    quotes reflects what a shopper pays today."
 *   "Stored prices this low tend to climb back within days, so today's quote is
 *    a good one to act on quickly."
 *
 * Neither contains must / never / always / should. The first is a FABRICATED
 * FRESHNESS GUARANTEE that flatly contradicts months-old data. The second is
 * SCARCITY — persuasion shape in a block that exists to be honest. Both would
 * have sailed through a vocabulary ban, and Yuri would have repeated either with
 * total confidence.
 *
 * That is the repo's own documented failure ("the attacker picks the verb, not
 * the test"), reproduced against the person writing it down. So these tests
 * assert on SHAPE and TRUTH, not on banned words:
 *   - no claimed refresh cadence (we cannot promise one)
 *   - no direction-of-drift prediction (n=8 is not a catalog fact)
 *   - no urgency/scarcity framing
 *   - the decision is handed back
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src', 'lib', 'yuri', 'price-freshness.ts')

/** Execute the REAL module — a source-regex test passes against broken code. */
async function load() {
  const js = ts.transpileModule(readFileSync(SRC, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const DAY = 86_400_000
const NOW = Date.UTC(2026, 7, 15)
const daysAgo = (n) => new Date(NOW - n * DAY).toISOString()

test('fresh prices produce NO block — a healthy catalog costs nothing', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  // This is what keeps the module honest once the refresher is working. If it
  // fired on fresh data it would be an always-on disclaimer.
  const f = summarisePriceFreshness([{ last_checked: daysAgo(1) }, { last_checked: daysAgo(10) }], NOW)
  assert.equal(f.stale, 0)
  assert.equal(buildPriceFreshnessBlock(f), null)
})

test('the real Aug 15 case is reported with its true age', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  const f = summarisePriceFreshness(
    [{ last_checked: daysAgo(130) }, { last_checked: daysAgo(130) }, { last_checked: daysAgo(130) }],
    NOW
  )
  assert.equal(f.stale, 3)
  assert.equal(f.oldestDays, 130)
  assert.ok(f.longStale)
  const block = buildPriceFreshnessBlock(f)
  assert.match(block, /130 days old/, 'the actual age must be stated, not a vague "may be old"')
})

test('an unknown age is never counted as fresh', async () => {
  const { summarisePriceFreshness } = await load()
  // The silent-failure class: a missing timestamp must not read as "current".
  const f = summarisePriceFreshness([{ last_checked: null }, { last_checked: undefined }, {}], NOW)
  assert.equal(f.priced, 0, 'rows with no readable age are not counted as priced')
  assert.equal(f.stale, 0)
})

test('a future timestamp does not read as fresher than now', async () => {
  const { ageInDays } = await load()
  assert.equal(ageInDays(new Date(NOW + 10 * DAY).toISOString(), NOW), 0)
  assert.equal(ageInDays('not-a-date', NOW), null)
})

test('ATTACK: no fabricated refresh cadence', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  const block = buildPriceFreshnessBlock(summarisePriceFreshness([{ last_checked: daysAgo(130) }], NOW))
  // The reviewer's attack: "Our prices refresh against retailer sites each
  // morning..." — zero command words, total fabrication. We cannot promise any
  // cadence, so no cadence claim may appear at all.
  assert.ok(
    !/(refresh|updat|verif|check|sync)\w*\s+(each|every|daily|nightly|hourly|continuously)/i.test(block),
    'the block must never claim how often prices refresh — that is a guarantee we cannot keep'
  )
  // Match only an AFFIRMATIVE freshness claim. The honest block legitimately
  // contains "NOT a live quote from this moment" — a negation, which is the
  // exact phrasing we want. A test that cannot tell "is live" from "is not
  // live" would force the wording to get vaguer to pass, i.e. the test would
  // make the prompt worse.
  assert.ok(
    !/(?<!not )(?<!never )\b(?:is|are|reflects?|shows?)\s+(?:a\s+|the\s+)?(?:live|real[- ]time|current|up[- ]to[- ]date)\s+(price|quote|number)/i.test(block),
    'stale prices must never be affirmatively described as live/current'
  )
  // And the honest negation must actually be present.
  assert.match(block, /not a live quote/i,
    'the block must say plainly that these are not live quotes')
})

test('ATTACK: no direction-of-drift prediction', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  const block = buildPriceFreshnessBlock(summarisePriceFreshness([{ last_checked: daysAgo(130) }], NOW))
  // Cut in review: true of n=8, not of the catalog. Yuri would relay it as
  // "you'll probably pay less", a promise we cannot keep.
  assert.ok(
    !/(errs?|drifts?|skews?|leans?|tends?)\b[^.]{0,60}\b(high|low|higher|lower|favou?r)/i.test(block),
    'the block must not predict which way a stale price moved — n=8 is not a catalog fact'
  )
  assert.match(block, /not something we know/i,
    'the block must explicitly disclaim knowing the direction of drift')
})

test('ATTACK: no urgency or scarcity framing', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  const block = buildPriceFreshnessBlock(summarisePriceFreshness([{ last_checked: daysAgo(130) }], NOW))
  // The reviewer's second attack: "...today's quote is a good one to act on
  // quickly." Persuasion shape inside an honesty instrument.
  assert.ok(
    !/\b(act|buy|grab|order|subscribe)\b[^.]{0,30}\b(quick|fast|soon|now|today|before)/i.test(block),
    'an honesty block must never carry a call to act'
  )
  assert.ok(!/\b(hurry|limited time|running out|while (?:they|it) last)\b/i.test(block),
    'no scarcity framing')
})

test('ATTACK: it is a fact, not a command — the decision is handed back', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  const block = buildPriceFreshnessBlock(summarisePriceFreshness([{ last_checked: daysAgo(130) }], NOW))

  // House pattern (cumulative-give.ts, tool-grounding.ts): state the fact, end
  // by handing the judgment back.
  assert.match(block, /facts, not instructions/i)
  assert.match(block, /not a rule and not a cap/i)

  // The specific regression this guards: turning the fact into an order to
  // caveat every price, which is the disclaimer-heavy Yuri CLAUDE.md forbids.
  assert.ok(
    !/\b(you must|always (?:add|say|mention|include)|never quote|be sure to)\b/i.test(block),
    'the fact must not become a command'
  )
  assert.match(block, /Nothing here asks you to/i,
    'the block must explicitly disclaim commanding her')
})

test('singular and plural read correctly', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  // "1 of the 1 price" is the kind of sentence a model notices and works around.
  const one = buildPriceFreshnessBlock(summarisePriceFreshness([{ last_checked: daysAgo(30) }], NOW))
  assert.match(one, /The price in front of you was last verified/)
  assert.ok(!/\b1 of the 1\b/.test(one), 'no "1 of the 1" phrasing')
  const many = buildPriceFreshnessBlock(
    summarisePriceFreshness([{ last_checked: daysAgo(30) }, { last_checked: daysAgo(40) }], NOW)
  )
  assert.match(many, /2 of the 2 prices in front of you were last verified/)
})

test('a mixed batch reports only the stale ones', async () => {
  const { summarisePriceFreshness, buildPriceFreshnessBlock } = await load()
  const f = summarisePriceFreshness(
    [{ last_checked: daysAgo(2) }, { last_checked: daysAgo(3) }, { last_checked: daysAgo(45) }],
    NOW
  )
  assert.equal(f.priced, 3)
  assert.equal(f.stale, 1)
  assert.match(buildPriceFreshnessBlock(f), /1 of the 3 prices/)
})

test('no surface claims a price refresh CADENCE we do not keep', async () => {
  // Found Aug 15 2026 by following an adversarial reviewer's thread. The product
  // page shipped this to customers: "Prices are refreshed automatically every 6
  // hours." The real cadence was ~130 days — the refresher had been dead since
  // July. That is the reviewer's own attack sentence ("Our prices refresh each
  // morning...") already live in the UI, and no test could see it because every
  // test looked at Yuri's prompt rather than the pages a customer reads.
  //
  // Closed-world over every price-rendering surface: a NEW file that promises a
  // cadence fails this test rather than sailing through.
  const { readdirSync, statSync } = await import('node:fs')
  const roots = [join(__dirname, '..', 'src', 'components'), join(__dirname, '..', 'src', 'app')]
  const files = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|ts)$/.test(e)) files.push(p)
    }
  }
  roots.forEach(walk)

  const CADENCE = /(price|pricing)[^.\n]{0,60}(refresh|updat|check|sync)\w*[^.\n]{0,30}\b(every|each|hourly|daily|nightly|weekly)\b/i
  const offenders = []
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    if (CADENCE.test(src)) offenders.push(f.replace(/.*\/src\//, 'src/'))
  }
  assert.deepEqual(offenders, [],
    `these surfaces promise a price-refresh cadence we cannot keep: ${offenders.join(', ')}`)
})
