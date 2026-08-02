/**
 * Guard tests — two defects Bailey hit on Aug 1 2026.
 *
 * 1. AN INGREDIENT COMMON IN FORMULAS BUT RARE IN NAMES WAS UNFINDABLE
 *    Yuri recommended tranexamic acid for Bailey's hyperpigmentation, then said
 *    "I pulled our catalog and there isn't a clean K-beauty tranexamic acid
 *    *serum* in it right now" and steered her to a cream. Bailey: "she said I
 *    needed this ingredient but doesn't have any in catalog?"
 *
 *    Measured against the live catalog: 3 verified products have "tranexamic"
 *    in name_en (two eye creams and that cream) — but 169 have it in their INCI,
 *    including 32 serums and 37 ampoules.
 *
 *    Yuri's tool call was correct and well-formed:
 *      search_products({query:"tranexamic acid serum", category:"serum",
 *                       max_price_usd:30, include_ingredients:["tranexamic acid"]})
 *    The bug was in executeSearchProducts: when a `query` is present the
 *    candidate set comes only from smartProductSearch (name/brand/description),
 *    and include_ingredients was applied as a POST-FILTER over those name
 *    matches. It could only narrow, never widen.
 *
 * 2. YURI NARRATED HER OWN PLUMBING AT THE USER
 *    "The library entry saved, here's exactly what landed, verbatim from the
 *    system: > Saved ... as a custom entry. ⚠️ Closest catalog match was
 *    'Dr. Jart+ Ceramidin Cream', but the names don't fully overlap..."
 *    and "The swap and the PDRN drop we agreed on earlier never actually got
 *    saved, I described them but didn't write them."
 *    Bailey: "This is kinda a lot of unnecessary information just makes it
 *    confusing."
 *
 *    She was OBEYING THE PROMPT. advisor.ts ordered her to quote the tool
 *    message "verbatim. Never paraphrase." — while a different section, scoped
 *    to save_routine only, said "NEVER narrate the machinery." The prompt
 *    contradicted itself and the user got the collision.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const TOOLS = join(root, 'src', 'lib', 'yuri', 'tools.ts')
const ADVISOR = join(root, 'src', 'lib', 'yuri', 'advisor.ts')

function sliceFn(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const parenStart = src.indexOf('(', start)
  let pd = 0, i = parenStart
  for (; i < src.length; i++) {
    if (src[i] === '(') pd++
    else if (src[i] === ')') { pd--; if (!pd) break }
  }
  const bodyStart = src.indexOf('{', i)
  let d = 0, j = bodyStart
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  return src.slice(start, j + 1)
}

/** The search_products executor, whichever name it carries. */
function searchExecutor(src) {
  for (const sig of [
    'async function executeSearchProducts(',
    'async function searchProducts(',
  ]) {
    if (src.includes(sig)) return sliceFn(src, sig)
  }
  // Fall back: the region between the include_ingredients read and the return.
  const start = src.indexOf('const includeIngredients = input.include_ingredients')
  assert.ok(start > -1, 'could not locate the search_products executor')
  return src.slice(start, start + 12000)
}

test('include_ingredients drives retrieval, it does not only narrow it', () => {
  const fn = searchExecutor(readFileSync(TOOLS, 'utf8'))

  // There must be a candidate query keyed on the ingredient itself, not just a
  // post-filter over name matches.
  assert.match(
    fn, /ingQuery|ingredient candidate|ingredient-driven/i,
    'an ingredient-driven candidate query must exist — otherwise an ingredient common in INCI but rare in product names is unfindable'
  )
  assert.match(
    fn, /ilike\(\s*'ingredients_raw'/,
    'the ingredient candidate query must search ingredients_raw'
  )

  // It must UNION with name results, never replace them (today's brand-ranking
  // and near-match fixes live in the name path).
  assert.match(
    fn, /products\.push\(/,
    'ingredient candidates must be unioned into the existing name results, not replace them'
  )
  assert.match(fn, /seen\.has\(/, 'the union must de-duplicate by id')
})

test('a failed ingredient lookup cannot read as "we do not carry this"', () => {
  const fn = searchExecutor(readFileSync(TOOLS, 'utf8'))

  // The link-table join must surface its error, and the include filter must
  // not run on an empty map produced by a dead query — that would assert an
  // absence nothing ever checked.
  assert.match(fn, /linkError/, 'the ingredient link query must capture its error')
  assert.match(
    fn, /includeIngredients\?\.length && !linkError/,
    'the include filter must be skipped when the link lookup failed, rather than filtering everything out'
  )
  assert.match(
    fn, /excludeIngredients\?\.length && !linkError/,
    'the exclude filter must likewise not run on a failed lookup'
  )
})

test('null ids never reach the .in() ingredient lookup', () => {
  const fn = searchExecutor(readFileSync(TOOLS, 'utf8'))
  // A null inside .in() on a uuid column throws 22P02 and kills the query.
  assert.match(
    fn, /typeof id === 'string'/,
    'product ids must be filtered to non-empty strings before .in()'
  )
})

test('a product with INCI but no ingredient links is still matchable', () => {
  const fn = searchExecutor(readFileSync(TOOLS, 'utf8'))
  // The daily link cron lags new products; dropping them re-creates the bug.
  assert.match(fn, /rawInciById/, 'there must be a raw-INCI fallback for unlinked products')
  assert.match(
    fn, /select\('id, ingredients_raw'\)/,
    'the fallback must actually FETCH ingredients_raw — the candidate selects omit it, so reading p.ingredients_raw would always be undefined'
  )
})

test('the prompt no longer orders Yuri to quote tool output verbatim', () => {
  const src = readFileSync(ADVISOR, 'utf8')

  assert.ok(
    !/MUST quote the tool's "message" field verbatim/.test(src),
    'the verbatim-quote mandate is what produced "here\'s exactly what landed, verbatim from the system"'
  )
  assert.ok(
    !/Never paraphrase\./.test(src),
    '"Never paraphrase" directly contradicts "NEVER narrate the machinery"'
  )
  assert.ok(
    !/your reply MUST quote the "message" field verbatim/.test(src),
    'the reaction tools carried the same mandate'
  )
})

test('the required disclosures survive — the register changed, not the content', () => {
  const src = readFileSync(ADVISOR, 'utf8')

  // The Hero-Mighty-Patches protection is load-bearing: a loose match must
  // still be disclosed, just in Yuri's own voice.
  assert.match(src, /Hero Mighty Patches/, 'the loose-match failure must still be cited')
  assert.match(
    src, /the exact name that was saved/,
    'the reply must still state what name landed'
  )
  assert.match(
    src, /near-miss catalog product, name it and offer to switch/,
    'a near-miss must still be surfaced to the user'
  )
  assert.match(
    src, /never claim a link that didn't happen/,
    'the anti-fabrication rule must survive'
  )
})

test('the machinery rule governs every tool, not just save_routine', () => {
  const src = readFileSync(ADVISOR, 'utf8')

  assert.match(
    src, /NEVER narrate the machinery — this governs EVERY tool/,
    'the rule was scoped to save_routine while other tools were ordered to do the opposite'
  )
  // And it must not become a license to hide facts.
  assert.match(
    src, /never licenses hiding a fact the user needs/,
    'the register rule must explicitly preserve required disclosures'
  )
  // The write-honesty rule needs a register, not just a mandate.
  assert.match(
    src, /isn't saved yet/,
    'the unsaved-write disclosure needs a human phrasing to imitate'
  )
})
