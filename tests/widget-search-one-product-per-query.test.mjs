/**
 * Guard test — the widget prompt must not tell Yuri to batch several named
 * products into one search.
 *
 * THE DEFECT (Aug 26 2026, production transcript). A visitor arriving from the
 * blog listed six products she owned. Yuri issued ONE search_products call
 * containing three of them:
 *
 *   "Round Lab Birch Juice Moisturizing Cleanser Purito Oat-In Calming Gel
 *    Cream SKIN1004 sunscreen"
 *
 * and opened her reply with "Your exact SKUs didn't come back in the catalog."
 * Two of those products are in the catalog, verified, under exactly the names
 * she typed. She then reasoned about their formulas from memory.
 *
 * She was obeying the prompt. route.ts carried, since ebe7342 (Mar 10 2026):
 *
 *   "IMPORTANT: When recommending multiple products (e.g., a routine), search
 *    for ALL of them in a SINGLE tool call using a broad query rather than
 *    making separate searches for each product."
 *
 * WHY BATCHING CANNOT WORK (executed against the live catalog, not read).
 * smartProductSearch resolves ONE product per query. Its precise strategies
 * scale their bar to terms.length, so a 13-term three-product query needs
 * 12-of-13 coverage on a single row — unreachable by construction. Measured:
 * terms=13 maxCoverage=3 threshold=12, so it falls through to Strategy 3's
 * loose any-term scorer. Each product searched ALONE resolves correctly via
 * Strategy 1.5. Splitting is the entire fix; ranking changes cannot help,
 * because the correct rows are never fetched (tools.ts:643-648, :781-788).
 *
 * WHY THE OLD LINE WAS THERE, AND WHY IT IS SAFE TO REMOVE. It was added to
 * stop tool-loop exhaustion. That constraint does not apply to parallel calls:
 * toolUseBlocks is an array (route.ts:~864) and toolLoopCount++ fires ONCE per
 * API round (route.ts:~862) regardless of how many tool_use blocks that round
 * carried. Production confirms it — Yuri has issued 4 tool calls in a single
 * reply 7 times without incident.
 *
 * THE REGRESSION THIS MUST NOT CAUSE, and the reason for the parallel clause.
 * MAX_WIDGET_TOOL_LOOPS = 3 permits 4 API rounds, and a round that emits tools
 * has its text DISCARDED (route.ts:~861). A model that SERIALIZES — search,
 * read, search again — on a six-product shelf exhausts the budget and the
 * visitor receives the canned "I'm having a moment accessing our database"
 * fallback as their entire reply, at the deepest point of engagement. The rule
 * must therefore say the calls go out TOGETHER, not merely that there are
 * several of them. A Fable 5 adversarial review found this omission in the
 * first draft; it is the single most likely way this change breaks production.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROUTE = join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts')

function prompt() {
  const src = readFileSync(ROUTE, 'utf8')
  const start = src.indexOf('const YURI_WIDGET_SYSTEM')
  assert.ok(start > -1, 'widget system prompt not found')
  return src.slice(start, src.indexOf('\n`', start))
}

/**
 * Scope to THIS rule's own span. A prompt-wide regex would pass against a
 * gutted paragraph whenever a similar phrase appeared elsewhere — the exact
 * failure recorded in CLAUDE.md for two Aug 15 guard tests that reported green
 * over deleted code.
 */
function rule(p) {
  const start = p.indexOf('The product search resolves ONE named product per query')
  assert.ok(start > -1, 'one-product-per-query rule not found')
  const end = p.indexOf('never a verdict on their product', start)
  assert.ok(end > -1, 'rule end marker not found')
  return p.slice(start, end + 40)
}

test('the batching instruction is GONE from the whole prompt', () => {
  const p = prompt()
  // Closed-world: the defect is an instruction that EXISTS, so scan the entire
  // prompt, not the new rule's span. Any reintroduction anywhere fails.
  assert.ok(
    !/SINGLE tool call/i.test(p),
    'the "search for ALL of them in a SINGLE tool call" instruction must not return'
  )
  assert.ok(
    !/search for ALL of them/i.test(p),
    'no phrasing may instruct batching several products into one search'
  )
})

test('it states the one-product-per-query limit as a property of the tool', () => {
  const r = rule(prompt())
  assert.match(r, /resolves ONE named product per query/i,
    'the rule must state the search resolves one product per query')
  // Naming the SHAPE of the failure is what makes it actionable. Without this
  // she has no reason to distrust a result that looks populated.
  assert.match(r, /MIXED LIST/i,
    'the rule must describe the mixed-list failure, not merely "a wrong result"')
})

test('it tells her to issue the calls TOGETHER — the tool-budget guard', () => {
  // This is the assertion that prevents the canned-fallback regression. It is
  // NOT redundant with "one per call": one-per-call plus serialization is the
  // failing combination.
  const r = rule(prompt())
  assert.match(r, /issued together in the same turn/i,
    'the rule must say the per-product calls go out together in one turn')
  assert.match(r, /sequential tool rounds are limited/i,
    'the rule must say WHY they go together, or the clause reads as arbitrary')
})

test('attribute searches are explicitly exempted', () => {
  // Descriptive discovery queries ("gentle low pH cleanser sensitive") are the
  // MAJORITY of real traffic and work correctly today. A rule that reads as
  // "never put several words in a query" would break them, which is the
  // mirror-image over-correction. Measured: of every long search query ever
  // issued, only two were multi-brand SKU lookups; the rest were attribute
  // searches.
  const r = rule(prompt())
  assert.match(r, /Attribute searches are the opposite case/i,
    'the rule must exempt attribute/discovery searches by name')
  assert.match(r, /belongs in one search/i,
    'the exemption must say attribute words stay batched')
})

test('it does not let an empty catalog result become a verdict on the product', () => {
  // Searching per-product invites more empty results on Western brands (5 of 7
  // measured with ZERO rows). The grounding block that normally carries this
  // reminder returns NULL once Yuri is actively grounding (tool-grounding.ts),
  // so after this change it goes silent exactly when she is searching hardest.
  // The reminder therefore has to live here.
  const r = rule(prompt())
  assert.match(r, /never a verdict on their product/i,
    'an empty result must be framed as catalog coverage, never a product verdict')
  assert.match(r, /their label is the source/i,
    "the no-row fallback must be the visitor's own label")
})

test('it does not become a hedging or disclaimer instruction', () => {
  // CLAUDE.md is explicit that a more hedged, disclaimer-heavy Yuri is a
  // REGRESSION, not compliance. This rule governs WHICH ROW she trusts, never
  // how confidently she speaks once she has it.
  const r = rule(prompt())
  for (const banned of [
    /\bdisclaim/i,
    /\bcaveat/i,
    /\bqualify your\b/i,
    /\bI'?m just an AI\b/i,
    /\bhedge\b/i,
  ]) {
    assert.ok(!banned.test(r), `the rule must not instruct hedging: ${banned}`)
  }
})

test('it does not promise that a solo search always returns the right row', () => {
  // The first draft claimed each product "searched on its own returns exactly
  // the right row". Executed live, that is FALSE for a category word:
  // "SKIN1004 sunscreen" returns the Tone-Up and Tinted sunscreens and MISSES
  // the flagship Water-Fit Sun Serum, because Strategy 1.5 matches names
  // CONTAINING "sunscreen" and returns before the sunscreen-vocabulary signal
  // in Strategy 3 can run. Teaching her that solo searches are reliable would
  // manufacture a new false-confidence class.
  const r = rule(prompt())
  assert.ok(!/exactly the right row/i.test(r),
    'the rule must not promise a solo search returns exactly the right row')
  assert.match(r, /neither is the category when they named a specific bottle/i,
    'the rule must warn that a category word returns a category, not their bottle')
})
