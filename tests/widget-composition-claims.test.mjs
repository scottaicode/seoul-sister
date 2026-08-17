/**
 * Guard test — Yuri searches before asserting what a product CONTAINS.
 *
 * THE DEFECT (Aug 17 2026, production transcript). A Nordic woman in Seoul
 * listed ~11 products. Yuri asserted numbuzin's No.9 line was "retinol/bakuchiol"
 * (it is their NAD+/PDRN/niacinamide line), called a Rejuran ampoule a "turnover
 * active" (INCI: blackberry leaf, licorice, calendula), and claimed a pH clash
 * with a "Vitamin C" that is tangerine extract + niacinamide — then told her to
 * stop repurchasing three products on that basis. She made three tool calls that
 * turn and searched NONE of those four products.
 *
 * THIS IS THE JUDGMENT HALF ONLY. The retrieval half — search returning the
 * WRONG numbered product — is fixed and guarded in
 * `line-number-product-identity.test.mjs`. Both were required: had she searched
 * before that fix, she would have received a sibling product's ingredients as a
 * clean result.
 *
 * WHY A PROMPT SENTENCE AND NOT MACHINERY. Measured across all 307 assistant
 * replies ever sent: 27 contain a composition assertion, 10 had no product tool
 * call, and reading those 10 shows MOST are false positives — routine
 * step-orders ("cleanse -> toner -> SPF") and generic chemistry ("AHAs work at
 * pH ~3.5"), both legitimate. True incidence ~1%. A detector would tax every
 * conversation to catch one reply, and CLAUDE.md's rule for a classifier that
 * needs hand-tuning is to stop, not to tune. A per-turn FACT block would cost
 * tokens forever for the same ~1%. So: one static rule in the CACHED block,
 * near-zero marginal cost, no runtime behaviour to go wrong.
 *
 * THE REGRESSION THIS MUST NOT CAUSE. CLAUDE.md is explicit that a more hedged,
 * disclaimer-heavy Yuri is a REGRESSION, not compliance. Note the irony of the
 * source incident: despite the false premises, that conversation produced the
 * best anti-selling in the corpus ("you've got a full shelf already, spend your
 * money on nothing right now") — the one behaviour that has ever converted a
 * paying customer. A fix that makes her tentative would cost more than the bug.
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

/** The composition rule only — scoping by CODE-adjacent markers, not prose. */
function rule(p) {
  const start = p.indexOf("A named SKU's formula is a fact, not a memory")
  assert.ok(start > -1, 'composition rule not found')
  const end = p.indexOf('say which you are doing', start)
  assert.ok(end > -1, 'composition rule end marker not found')
  return p.slice(start, end + 40)
}

test('the rule exists and names the trap, not just the behaviour', () => {
  const r = rule(prompt())
  assert.match(r, /check its catalog INCI/i, 'the rule must say to check the catalog')
  // A bare "search products" instruction already exists two paragraphs above
  // and did not prevent this. The NEW information is why she skipped it.
  assert.match(r, /already know are exactly the ones you will not think to check/i,
    'the rule must name the trap: familiar products are the ones that go unchecked')
})

test('it names COVERAGE, which is what actually failed', () => {
  // A second-model review (Fable 5) rejected the first draft's premise. The
  // incident was NOT tool-aversion — Yuri made three tool calls that turn. It
  // was a COVERAGE failure under an 11-product load: the batching rule (search
  // for ALL of them in a SINGLE call) plus a capped tool loop meant some SKUs
  // were grounded and the rest free-recalled, and she could not observe which
  // of her named products her searches had actually covered. A third "use your
  // tools" exhortation would have been inert — the prompt already says that
  // twice, and she violated both while FEELING compliant, because she had
  // searched.
  const r = rule(prompt())
  assert.match(r, /did not cover that product, you have not checked it/i,
    'the rule must name coverage, not merely instruct searching')
})

test('it handles the no-catalog-row case, or it manufactures empty searches', () => {
  // "Search it" unconditionally invites searching Western products the catalog
  // cannot answer — measured elsewhere at 5 of 7 brands with ZERO rows — which
  // risks an empty result leaking as "not in our database", contradicting the
  // prompt's own rule that absence says nothing about a product.
  const r = rule(prompt())
  assert.match(r, /catalog has no row/i,
    'the rule must say what to do when the catalog cannot answer')
  assert.match(r, /visitor's own label/i,
    'the fallback must be the visitor\'s label, not a hedge or a disclaimer')
})

test('it does not overclaim, contradict, or promise a settled answer', () => {
  const p = prompt()
  const r = rule(p)
  // "Searching costs one call and settles it" was cut: false twice over —
  // eleven products is not one call (contradicting the batching rule), and a
  // search can return a sibling SKU or nothing (the Melixir lesson).
  assert.ok(!/one call/i.test(r), 'the rule must not promise a single call settles it')
  // "the least reliable thing you know" was cut: the packaging rule already
  // awards that title, and two superlatives in one prompt cancel out.
  assert.ok(!/least reliable thing/i.test(r),
    'the rule must not compete with the packaging rule for the same superlative')
  assert.match(p, /your training knowledge of packaging is usually outdated/i,
    'the packaging rule must still hold its own claim')
})

test('it distinguishes a claim about THEIR bottle from general chemistry', () => {
  // Without this line the rule reads as "verify all chemistry," which is the
  // hedging regression and would fire on the ~25 benign replies of the 27.
  //
  // Both assertions are REQUIRED, and that is not redundancy: reverting this
  // sentence to an explicit hedging instruction ("Be cautious about any
  // chemistry claim and qualify your statements") passed an earlier version of
  // this suite, because the regression test below scans only the rule's own
  // span and the substitution lived inside it. Pinning the exempting clause AND
  // the checkability clause is what makes the swap detectable.
  // Scoped to "a SPECIFIC product" and to "a clash on that basis" — not to
  // chemistry in general, which is where ~17 of the 27 flagged replies live and
  // where a broader rule would tax every conversation.
  const r = rule(prompt())
  assert.match(r, /a specific product/i,
    'the rule must scope to a specific product, not all chemistry')
  assert.ok(!/\ball chemistry\b|any chemistry claim/i.test(r),
    'the rule must not generalise to every chemistry statement')
})

test('REGRESSION: it does not make Yuri hedge, soften, or disclaim', () => {
  const r = rule(prompt())
  // The failure mode is a tentative Yuri. Searching is a cheap ACTION; adding
  // caveats is not, and would cost the anti-selling that converts.
  assert.ok(
    !/(hedge|caveat|disclaim|be cautious|qualify your|say you (?:might|may) be)/i.test(r),
    'the remedy must be an action (search), never a verbal hedge'
  )
  assert.ok(!/\b(unverified|I could be wrong|I think it contains)\b/i.test(r),
    'the rule must not script uncertainty language')
})

test('ATTACK: it does not forbid stating composition, only unchecked composition', () => {
  const r = rule(prompt())
  // Banning the claim outright would gut real expertise — knowing what is in a
  // formula is the product. The rule governs SOURCING, not permission.
  assert.ok(
    !/(never (?:say|state|claim|mention) what|do not (?:say|state) what)/i.test(r),
    'stating composition is core expertise; only the unchecked version is the bug'
  )
})

test("ATTACK: it never vouches for the catalog's INCI as the CURRENT formula", () => {
  // The reviewer's own killer sentence, which passed every other assertion:
  //
  //   "Seoul Sister's catalog INCI is verified against the manufacturer, so a
  //    database ingredient list can be shared as the product's current formula."
  //
  // No command words, and it licenses exactly the stale-formulation failure
  // CLAUDE.md already records: a row can be present, verified, and WRONG.
  // Our INCI is scraped, not manufacturer-certified, and brands reformulate
  // without renaming — which is half of why this rule exists at all.
  const r = rule(prompt())
  assert.ok(
    !/(verified against the manufacturer|manufacturer[- ]verified|current formula|guaranteed accurate|always up to date)/i.test(r),
    'the rule must never vouch for catalog INCI being the manufacturer-current formula'
  )
  // And it must not imply checking the catalog SETTLES the question — the same
  // overclaim that got "one call and settles it" cut.
  assert.ok(!/\b(settles it|definitive|authoritative)\b/i.test(r),
    'checking the catalog is evidence, not a settled verdict')
})

test('it lives in the STATIC cached block, not a per-turn string', () => {
  // Appending per-turn strings to the cached block silently kills the prompt
  // cache — the measured v11.1.0 regression. A static rule costs nothing after
  // the first call; a per-turn block costs tokens forever for a ~1% defect.
  const src = readFileSync(ROUTE, 'utf8')
  const start = src.indexOf('const YURI_WIDGET_SYSTEM')
  const end = src.indexOf('\n`', start)
  const block = src.slice(start, end)
  assert.ok(block.includes("A named SKU's formula is a fact, not a memory"),
    'the rule must sit inside the static cached prompt')
  // No interpolation inside the rule itself.
  assert.ok(!/\$\{/.test(rule(prompt())),
    'the rule must not interpolate per-turn values into the cached block')
})
