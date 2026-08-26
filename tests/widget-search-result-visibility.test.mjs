/**
 * Guard test — a search that RAN but returned something else must not read to
 * Yuri as a search that found the product.
 *
 * THE DEFECT. `detectToolGrounding` decided grounding with
 * `if (named > 0 && calls === 0)`. It asks "did a search run", never "did the
 * search find the product she named" — and those two questions have the same
 * fingerprint. On Aug 26 2026 a tool DID fire and returned the wrong product,
 * so the instrument read the reply as fully grounded while nothing about the
 * visitor's actual shelf had been verified. Same "nothing wrong vs nothing
 * checked" class the repo keeps paying for, one layer up from where it usually
 * bites: here the check itself ran, and reported clean.
 *
 * WHY IT MATTERS MORE THAN ONE VISITOR. All 24 distinct brand-naming searches
 * ever issued were re-run through the LIVE resolver on Aug 26 2026. Seven
 * returned something other than what was asked for. Five of those seven were
 * the RIGHT BRAND with the wrong product:
 *
 *   "House of Hur sunscreen"        -> Phyto Brew Matcha Dual Cream And Gel
 *   "Mixsoon Bifida Cream"          -> Master Gentle Recipe Foam Cleanser
 *   "Some By Mi ... tea tree toner" -> Retinol Bakuchiol Dual Cream
 *   "Torriden Cellmazing"           -> Cellmazing Vita Tone-Up Sun Cream
 *   "Mediheal sunscreen"            -> Madecassoside Moisture Sun Serum
 *
 * A right-brand row reads as confirmation, which is precisely why a
 * brand-level check scores these as hits and misses the more dangerous half.
 * (A first pass at this measurement reported 40% by comparing brands only, and
 * counted seven already-repaired historical failures as live. Re-running
 * against the current resolver is what separated stale from live.)
 *
 * WHERE THE GAP ACTUALLY IS. Within a turn Yuri sees the full tool output —
 * `result` is pushed untruncated into `loopMessages` (route.ts). The next
 * request rebuilds the conversation from reply TEXT plus a tool-call COUNT, so
 * by turn N+1 a hit and a miss are indistinguishable to her. This is a
 * cross-turn visibility fix, not a within-turn one, and NOT a classifier.
 *
 * WHY NO CLASSIFIER. Whether a returned row answers the visitor's question is a
 * judgment about their intent — "Mediheal sunscreen" -> Madecassoside Sun Serum
 * may be exactly right — and under the Yuri Sole Authority Principle that
 * judgment is hers. This repo has twice discarded a classifier that needed
 * hand-tuning (23% precision, and a brand list blind to three markets in turn).
 * So the module states the query, lists what came back, and stops.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PERSISTENCE = join(__dirname, '..', 'src', 'lib', 'widget', 'persistence.ts')

/**
 * Execute the REAL module rather than asserting on its source. A source-text
 * test passes against broken code — the failure mode recorded in CLAUDE.md and
 * the reason two Aug 15 guard tests reported green over deleted code.
 */
const js = ts.transpileModule(
  readFileSync(join(__dirname, '..', 'src', 'lib', 'widget', 'tool-grounding.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText
const dir = mkdtempSync(join(tmpdir(), 'ss-searchrec-'))
const modFile = join(dir, 'tool-grounding.mjs')
writeFileSync(modFile, js)
const { detectToolGrounding, buildToolGroundingBlock } = await import(pathToFileURL(modFile).href)

/**
 * Execute the REAL extractSearches / parseResultNames too.
 *
 * The first version of this suite asserted on persistence.ts by grep. An
 * adversarial review then replaced the extractor's matcher with one that can
 * NEVER match — every real search would have rendered "returned nothing", a
 * false statement worse than the bug being fixed — and all ten tests passed.
 * The suite's own header lectures about source-text tests passing against
 * broken code; it was committing exactly that. persistence.ts imports the
 * Supabase client at module scope, so it is stubbed the way the repo already
 * stubs it elsewhere (see nudge-email-delivery.test.mjs).
 */
writeFileSync(
  join(dir, 'supabase.mjs'),
  'export function getServiceClient() { return { from() { return {} } } }'
)
writeFileSync(
  join(dir, 'anthropic.mjs'),
  `export function getAnthropicClient() { return {} }
export const MODELS = { background: 'stub', primary: 'stub' }
export async function callAnthropicWithRetry(fn) { return fn() }`
)
const persistenceJs = ts.transpileModule(
  readFileSync(PERSISTENCE, 'utf8')
    .replace("from '@/lib/supabase'", "from './supabase.mjs'")
    .replace("from '@/lib/anthropic'", "from './anthropic.mjs'"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText
const persistenceFile = join(dir, 'persistence.mjs')
writeFileSync(persistenceFile, persistenceJs)
const { extractSearches, parseResultNames } = await import(pathToFileURL(persistenceFile).href)

const HOUSE_OF_HUR = {
  query: 'House of Hur sunscreen',
  found: ['Phyto Brew Matcha Dual Cream And Gel', '3X Capsule Hydro Booster Cream'],
}
const MIXSOON = { query: 'Mixsoon Bifida Cream', found: ['Master Gentle Recipe Foam Cleanser'] }

function conversation(searches) {
  return [
    { role: 'user', content: 'I use House of Hur sunscreen and Mixsoon Bifida Cream' },
    { role: 'assistant', content: 'Let me look those up.', toolCalls: searches.length, searches },
  ]
}

test('the searches survive into the grounding state', () => {
  const g = detectToolGrounding(conversation([HOUSE_OF_HUR, MIXSOON]))
  assert.equal(g.searches.length, 2, 'both searches must be carried across turns')
  assert.equal(g.searches[0].query, 'House of Hur sunscreen')
  assert.deepEqual(g.searches[1].found, ['Master Gentle Recipe Foam Cleanser'])
})

test('the record renders the query AND what came back', () => {
  // This is the whole point: a count cannot express "you searched X and got Y".
  const block = buildToolGroundingBlock(detectToolGrounding(conversation([HOUSE_OF_HUR, MIXSOON])))
  assert.ok(block, 'a block must render when searches exist')
  assert.match(block, /"House of Hur sunscreen"/,
    'the record must name the query she actually sent')
  assert.match(block, /Phyto Brew Matcha Dual Cream And Gel/,
    'the record must name what the search returned')
  assert.match(block, /Master Gentle Recipe Foam Cleanser/,
    'every search in the conversation must appear, not just the first')
})

test('it renders even when nothing else in the block would', () => {
  // The pre-existing block returns null unless she has named products with NO
  // tool call. A conversation where she searched every time returns null there
  // — which is exactly the state this fix exists for. If the record only
  // rendered alongside the ungrounded warning, it would be silent in the case
  // it was built for.
  const g = detectToolGrounding(conversation([HOUSE_OF_HUR]))
  assert.equal(g.ungroundedReplies, 0, 'precondition: she is grounding')
  assert.equal(g.unhonoredSearchOffer, false, 'precondition: no open offer')
  const block = buildToolGroundingBlock(g)
  assert.ok(block, 'the search record must render on its own')
  assert.match(block, /What Your Earlier Searches Returned/)
})

test('an empty search is recorded as "nothing", not omitted', () => {
  // Omitting it would make a search that returned nothing indistinguishable
  // from a search never run — reintroducing the same bug one level down.
  const block = buildToolGroundingBlock(
    detectToolGrounding(conversation([{ query: 'Geek & Gorgeous Liquid Hydration', found: [] }]))
  )
  assert.match(block, /Geek & Gorgeous Liquid Hydration" → returned nothing/,
    'an empty result must be stated explicitly')
})

test('no searches means no record — an empty section is noise', () => {
  const g = detectToolGrounding([
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'Hey! What is your skin doing?', toolCalls: 0 },
  ])
  assert.equal(buildToolGroundingBlock(g), null, 'nothing to report must render nothing')
})

test('it states facts and never issues a command — the AI-First contract', () => {
  // The house rule for every instrument of this kind (cumulative-give,
  // value-density, tool-grounding): it observes, it never directs. A block
  // that tells her to search again, hedge, or withhold has become a cap, and
  // the widget give/gate failed TWICE by rewording a rule instead of stating
  // a fact.
  const block = buildToolGroundingBlock(detectToolGrounding(conversation([HOUSE_OF_HUR, MIXSOON])))
  for (const imperative of [
    /\byou must\b/i,
    /\bsearch again\b(?!,)/i,
    /\bdo not recommend\b/i,
    /\byou should\b/i,
    /\balways\b/i,
    /\bnever tell\b/i,
  ]) {
    assert.ok(!imperative.test(block), `the record must not command: ${imperative}`)
  }
  assert.match(block, /yours to judge/i, 'it must hand the decision back to Yuri')
  assert.match(block, /no bearing on how confidently you speak/i,
    'it must disclaim being a reason to hedge')
  // The trailer must not tell her what to DO with the record. An adversarial
  // review found a bare imperative ("Read them against what the visitor
  // actually named") sitting inside a section titled "facts, not instructions".
  assert.ok(!/^\s*Read them\b/im.test(block), 'the record must not instruct her to read it')
})

test('it does not pronounce a verdict on whether a search succeeded', () => {
  // Naming the guilty side is a separate investigation (CLAUDE.md: "a mismatch
  // is not a diagnosis"). "Mediheal sunscreen" -> Madecassoside Sun Serum may
  // be exactly the right product. The record must not call that a failure.
  const block = buildToolGroundingBlock(detectToolGrounding(conversation([HOUSE_OF_HUR])))
  for (const verdict of [/\bfailed\b/i, /\bunverified\b/i, /\bwrong product\b/i, /\bdid not find\b/i]) {
    assert.ok(!verdict.test(block), `the record must not deliver a verdict: ${verdict}`)
  }
})

test('the record is capped so a long consult cannot flood the context', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    query: `query number ${i}`,
    found: [`product ${i}`],
  }))
  const block = buildToolGroundingBlock(detectToolGrounding(conversation(many)))
  const lines = (block.match(/- You searched /g) || []).length
  assert.ok(lines <= 6, `at most 6 searches may render, got ${lines}`)
  // The most RECENT searches are the ones the next reply is about.
  assert.match(block, /query number 11/, 'the newest search must survive the cap')
  assert.ok(!/query number 0"/.test(block), 'the oldest search is the one dropped')
})

test('parseResultNames executes on a REAL full tool result', () => {
  // Executes the module's own parser — not a copy of it. A saboteur that
  // breaks parsing must fail HERE.
  const real = JSON.stringify({
    products: [
      { id: '58b277cd-679a-4630-a016-202d34ac5e75', name: 'Birch Juice Moisturizing Cleanser', brand: 'Round Lab' },
      { id: 'cd80a05f-c195-4aee-bf08-becbe9b791e1', name: 'Oat-In Calming Gel Cream', brand: 'Purito Seoul' },
    ],
  })
  const { names, count } = parseResultNames(real)
  assert.deepEqual(names, ['Birch Juice Moisturizing Cleanser', 'Oat-In Calming Gel Cream'])
  assert.equal(count, 2, 'the true result count must survive')
})

test('parseResultNames does not mistake an ingredient name for a product', () => {
  // Each product carries key_ingredients whose entries also use a `name` key.
  // A regex over the whole document would extract "Water" as a returned
  // product. This is the load-bearing reason for parsing rather than matching.
  const withIngredients = JSON.stringify({
    products: [{ name: 'Real Product', key_ingredients: [{ name: 'Water' }, { name: 'Niacinamide' }] }],
  })
  assert.deepEqual(parseResultNames(withIngredients).names, ['Real Product'])
})

test('parseResultNames survives malformed or non-JSON results', () => {
  for (const bad of ['', 'not json at all', '{"products":null}', '{}', '[]']) {
    const r = parseResultNames(bad)
    assert.deepEqual(r.names, [], `must not throw or invent names for: ${bad}`)
    assert.equal(r.count, 0)
  }
})

test('extractSearches executes against the REAL stored tool_calls shape', () => {
  const toolCalls = [
    {
      name: 'search_products',
      input: { query: 'House of Hur sunscreen', limit: 5 },
      result_summary: '{"products":[{"id":"x","name":"Phyto Brew Matcha Dual Cream A',
      result_names: ['Phyto Brew Matcha Dual Cream And Gel', '3X Capsule Hydro Booster Cream'],
      result_count: 5,
    },
    { name: 'get_ingredient_guide', input: { ingredient_name: 'niacinamide' }, result_summary: '{}' },
  ]
  const out = extractSearches(toolCalls)
  assert.equal(out.length, 1, 'only product searches are recorded')
  assert.equal(out[0].query, 'House of Hur sunscreen')
  assert.equal(out[0].total, 5, 'the TRUE count must come from result_count')
  assert.deepEqual(out[0].found, [
    'Phyto Brew Matcha Dual Cream And Gel',
    '3X Capsule Hydro Booster Cream',
  ])
})

test('a multi-result search never renders as a single-result one', () => {
  // THE DEFECT THIS CLOSES. result_summary is capped at 200 chars, and
  // measured across all 188 stored search_products calls, ZERO retain two
  // names (172 retain one, 16 none). Parsing the stored summary would render a
  // 10-row result identically to a 1-row result — the same "cannot tell
  // nothing-found from found-plenty" bug, one level down. Live consequence:
  // "House of Hur sunscreen" showing only a Matcha moisturizer, while the
  // catalog carries FOUR House of Hur sunscreens, invites Yuri to state a
  // catalog gap that does not exist.
  const block = buildToolGroundingBlock(
    detectToolGrounding(
      conversation([{ query: 'House of Hur sunscreen', found: ['Phyto Brew Matcha'], total: 5 }])
    )
  )
  assert.match(block, /5 results/, 'the true total must be stated')
  assert.match(block, /and 4 more/, 'unlisted results must be acknowledged, not hidden')
})

test('each query renders paired with ITS OWN results', () => {
  // A cross-wired record asserts a WRONG fact with an instrument's authority —
  // strictly worse than the count it replaces. An earlier version of this
  // suite asserted only that both queries and both names were PRESENT, and a
  // deliberately cross-wired implementation passed all ten tests.
  const block = buildToolGroundingBlock(detectToolGrounding(conversation([HOUSE_OF_HUR, MIXSOON])))
  const hurLine = block.split('\n').find((l) => l.includes('House of Hur sunscreen'))
  const mixLine = block.split('\n').find((l) => l.includes('Mixsoon Bifida Cream'))
  assert.ok(hurLine && mixLine, 'both searches must render on their own lines')
  assert.match(hurLine, /Phyto Brew Matcha Dual Cream And Gel/,
    'the House of Hur line must carry the House of Hur results')
  assert.ok(!hurLine.includes('Master Gentle Recipe Foam Cleanser'),
    'the House of Hur line must NOT carry the Mixsoon result')
  assert.match(mixLine, /Master Gentle Recipe Foam Cleanser/,
    'the Mixsoon line must carry the Mixsoon result')
  assert.ok(!mixLine.includes('Phyto Brew'),
    'the Mixsoon line must NOT carry the House of Hur result')
})

test('a filter-only search is recorded, not silently dropped', () => {
  // 15 of 188 stored calls have include_ingredients and no query. They count
  // in `toolCalls`, so dropping them here would make a search that ran and
  // returned products invisible in the record — the omission this exists to
  // prevent.
  const out = extractSearches([
    {
      name: 'search_products',
      input: { include_ingredients: ['centella asiatica'], category: 'toner' },
      result_names: ['Panthenol Barrier Toner'],
      result_count: 1,
    },
  ])
  assert.equal(out.length, 1, 'a filter-only search must still be recorded')
  assert.match(out[0].query, /centella asiatica/, 'the filter must identify the search')
})

test('the route captures names BEFORE truncation', () => {
  // If capture moves after truncateToolResult, result_names is derived from a
  // 200-char string and the multi-result fix silently dies while every
  // fixture-driven test above still passes.
  const route = readFileSync(
    join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts'),
    'utf8'
  )
  assert.match(route, /parseResultNames\(result\)/,
    'the route must parse the FULL result, not the truncated summary')
  assert.ok(!/parseResultNames\(truncateToolResult/.test(route),
    'names must never be parsed from the truncated summary')
})

test('getSessionTranscript carries searches, not just a count', () => {
  const src = readFileSync(PERSISTENCE, 'utf8')
  assert.match(src, /searches: extractSearches\(m\.tool_calls\)/,
    'the transcript loader must attach the extracted searches to each turn')
})
