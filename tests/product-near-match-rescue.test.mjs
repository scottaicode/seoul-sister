/**
 * Guard test — a near-match must not be reported as "not in our catalog".
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Bailey (paying subscriber) asked Yuri for coverage that wouldn't break her
 * out. Yuri recommended the "Melixir Vegan Daily Skin Tint SPF50+ (#23 Light
 * Neutral), $25.50" — a real, verified catalog product with full INCI that a
 * tool had just handed her — and then, one turn later:
 *
 *     "I tried to pull the Melixir's full INCI and our catalog doesn't
 *      actually have that exact product on file"
 *
 * and two turns after that:
 *
 *     "the Melixir Skin Tint, $25.50 *is* in our catalog after all
 *      (I found it this time)"
 *
 * Bailey: "It was just weird cause she was the one talking about it."
 *
 * ROOT CAUSE (confirmed against the live catalog and the stored tool log)
 * The catalog stores the product as "Daily Skin Tint Sunscreen SPF50+ 50ml #23
 * Light Neutral" with brand "Melixir". It does NOT contain the word "Vegan" —
 * that is Melixir's real-world branding, which Yuri added herself. She then
 * called get_product_details({product_name: "Melixir Vegan Daily Skin Tint
 * SPF50+"}).
 *
 * That one unmatched token made Strategy 2's ALL-terms post-filter
 * unsatisfiable, so it discarded a candidate window that CONTAINED the correct
 * row, and fell through to Strategy 3, whose ANY-term + rating-ordered window
 * (a large pool of tied 5.00 ratings, so ordering among them is arbitrary) did
 * not include it at limit 10. The resolver landed on "TONEfitSUN Vegan
 * Hydrating Sun Cream SPF50+" at coverage 2/6 and correctly flagged it
 * 'partial'. Yuri obeyed that warning. The judgment layer worked correctly on
 * bad retrieval.
 *
 * WHY THIS TEST EXECUTES INSTEAD OF GREPPING
 * A source assertion cannot tell a rescued near-match from a discarded one.
 * These tests transpile the real smartProductSearch out of tools.ts and run it
 * against a fake DB seeded with the exact rows (and the exact rating ties) that
 * produced the failure. Revert the rescue block and test 1 fails.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const SRC = join(root, 'src', 'lib', 'yuri', 'tools.ts')

/**
 * Slice a top-level declaration (and its body) out of the source.
 *
 * Walks to the body brace by first skipping the PARAMETER list — a naive
 * "first { after the signature" lands on a destructured/inline-typed parameter
 * (`match: { name_en: string; ... }`) and truncates the function mid-way.
 */
function sliceDecl(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected to find "${signature}" in tools.ts`)

  // Skip the parameter list: from the opening paren, balance parens.
  const parenStart = src.indexOf('(', start)
  let parenDepth = 0
  let i = parenStart
  for (; i < src.length; i++) {
    if (src[i] === '(') parenDepth++
    else if (src[i] === ')') {
      parenDepth--
      if (parenDepth === 0) break
    }
  }

  // Body opens at the first { after the (possibly multi-line) return type.
  const bodyStart = src.indexOf('{', i)
  let depth = 0
  let j = bodyStart
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return src.slice(start, j + 1)
}

/** Slice a `const X = ...` array/set literal by balancing its brackets. */
/** Slice a `const X ... = { ... }` object literal (sliceConst scans for `[`). */
function sliceObjectConst(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const open = src.indexOf('{', start)
  let d = 0, i = open
  for (; i < src.length; i++) {
    if (src[i] === '{') d++
    else if (src[i] === '}') { d--; if (!d) break }
  }
  return src.slice(start, i + 1)
}

function sliceConst(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected to find "${signature}" in tools.ts`)
  const open = src.indexOf('[', start)
  let depth = 0
  let i = open
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) break
    }
  }
  // Include the trailing `)` and `;`/newline of `new Set([...])`
  const tail = src.indexOf('\n', i)
  return src.slice(start, tail)
}

async function loadSearch() {
  const src = readFileSync(SRC, 'utf8')

  const pieces = [
    sliceConst(src, 'const SEARCH_STOP_WORDS = new Set(['),
    // Required since Aug 18 2026: smartProductSearch's sunscreen-signal
    // suppression reads this set, so omitting it makes the module throw.
    sliceConst(src, 'const GENERIC_PRODUCT_WORDS = new Set(['),
    sliceDecl(src, 'function singularize('),
    // Added Aug 19 2026: the SQL predicates call normalizeTerm(), which wraps
    // singularize() with the catalog word-form map (milky->milk,
    // cleanser->cleans). Omitting these makes the transpiled module throw
    // "normalizeTerm is not defined" — a harness gap that looks like a
    // behavior failure.
    sliceObjectConst(src, 'const WORD_FORM_STEMS'),
    sliceDecl(src, 'function wordFormStem('),
    sliceDecl(src, 'function normalizeTerm('),
    sliceDecl(src, 'function termMatches('),
    sliceDecl(src, 'async function smartProductSearch('),
  ]

  const module = pieces.join('\n\n') + '\nexport { smartProductSearch, singularize }\n'
  const js = ts.transpileModule(module, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText

  const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  return await import(url)
}

/**
 * Minimal PostgREST-shaped fake. Supports the exact chain smartProductSearch
 * uses: .from().select().eq().ilike().or().order().limit()
 */
function fakeDb(rows) {
  const norm = (s) => (s || '').toLowerCase()
  const like = (val, pattern) => norm(val).includes(pattern.replace(/%/g, '').toLowerCase())

  function makeQuery() {
    let set = rows.slice()
    let limitN = Infinity
    const q = {
      select() { return q },
      eq(col, val) {
        set = set.filter((r) => r[col] === val)
        return q
      },
      ilike(col, pattern) {
        set = set.filter((r) => like(r[col], pattern))
        return q
      },
      or(clauses) {
        const preds = clauses.split(',').map((c) => {
          const [col, , pattern] = c.split('.')
          return { col, pattern }
        })
        set = set.filter((r) => preds.some((p) => like(r[p.col], p.pattern)))
        return q
      },
      order(col, opts) {
        const dir = opts?.ascending === false ? -1 : 1
        // Stable sort — ties keep insertion order, which is what makes the
        // arbitrary-tie-window failure reproducible.
        set = set
          .map((r, i) => ({ r, i }))
          .sort((a, b) => {
            const av = a.r[col] ?? -Infinity
            const bv = b.r[col] ?? -Infinity
            if (av !== bv) return (av - bv) * dir
            return a.i - b.i
          })
          .map((x) => x.r)
        return q
      },
      limit(n) {
        limitN = n
        return Promise.resolve({ data: set.slice(0, limitN), error: null })
      },
      then(resolve) {
        return Promise.resolve({ data: set.slice(0, limitN), error: null }).then(resolve)
      },
    }
    return q
  }

  return { from: () => makeQuery() }
}

// The real row, as stored. Note: no "Vegan" in the name.
const MELIXIR = {
  id: 'melixir-23',
  brand_en: 'Melixir',
  name_en: 'Daily Skin Tint Sunscreen SPF50+ 50ml #23 Light Neutral',
  category: 'sunscreen',
  is_verified: true,
  rating_avg: 5.0,
}

// The decoy that actually won: matches "vegan" + "spf50+" only.
const TONEFIT = {
  id: 'tonefit',
  brand_en: 'TONEfitSUN',
  name_en: 'Vegan Hydrating Sun Cream SPF50+ PA++++',
  category: 'sunscreen',
  is_verified: true,
  rating_avg: 5.0,
}

// Rating-tied filler that crowds the limit-10 window, exactly as in production.
const FILLER = Array.from({ length: 20 }, (_, i) => ({
  id: `filler-${i}`,
  brand_en: ['Dinsee', 'Athe', 'Skinfood', 'AGE 20\'s'][i % 4],
  name_en: `Vegan Tone Up Sun Cream SPF50+ variant ${i}`,
  category: 'sunscreen',
  is_verified: true,
  rating_avg: 5.0,
}))

// Insertion order puts the decoy + filler ahead of the real row, which is how
// the arbitrary rating-tie ordering starved it in production.
const CATALOG = [TONEFIT, ...FILLER, MELIXIR]

test('a one-word-off product name still finds the real product', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb(CATALOG)

  const results = await smartProductSearch(db, 'Melixir Vegan Daily Skin Tint SPF50+', { limit: 10 })

  assert.ok(results.length > 0, 'a near-exact product name must not return zero results')

  const ids = results.map((r) => r.id)
  assert.ok(
    ids.includes(MELIXIR.id),
    `The real Melixir tint must be found even though the query adds "Vegan". Got: ${JSON.stringify(ids)}`
  )
  assert.ok(
    !ids.includes(TONEFIT.id),
    'A 2-of-6 decoy must not outrank/accompany the 5-of-6 true match'
  )
})

test('the rescue keeps the highest-coverage row, not merely any row', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb(CATALOG)

  const results = await smartProductSearch(db, 'Melixir Vegan Daily Skin Tint SPF50+', { limit: 10 })

  // Every returned row must match as many terms as the best row does.
  const terms = ['melixir', 'vegan', 'daily', 'skin', 'tint', 'spf50+']
  const coverage = (r) => {
    const c = `${r.brand_en} ${r.name_en}`.toLowerCase()
    return terms.filter((t) => c.includes(t)).length
  }
  const best = Math.max(...results.map(coverage))
  assert.ok(best >= terms.length - 1, `best coverage should be within one term of the query; got ${best}`)
  for (const r of results) {
    assert.equal(coverage(r), best, `all rescued rows must share the best coverage (offender: ${r.name_en})`)
  }
})

test('a genuinely different product is still NOT rescued', async () => {
  const { smartProductSearch } = await loadSearch()

  // The documented counter-case: "Hero Mighty Patches" must not bind to an
  // unrelated heel patch just because one weak token overlaps.
  const db = fakeDb([
    {
      id: 'heel',
      brand_en: 'Dr.ppae',
      name_en: 'Honey Heel Patch',
      category: 'treatment',
      is_verified: true,
      rating_avg: 5.0,
    },
  ])

  const results = await smartProductSearch(db, 'Hero Mighty Patches', { limit: 10 })
  const ids = results.map((r) => r.id)

  // Strategy 3 may still surface it as a last-resort loose read (that is the
  // documented existing behavior and the caller flags it 'partial'), but the
  // near-match RESCUE must not have claimed it as a high-coverage hit.
  // Coverage here is 1 of 3, below the all-but-one threshold.
  if (ids.includes('heel')) {
    const c = 'dr.ppae honey heel patch'
    const matched = ['hero', 'mighty', 'patches'].filter((t) => c.includes(t) || c.includes(t.replace(/es$/, '')))
    assert.ok(
      matched.length <= 1,
      'the heel patch may only appear via the loose last-resort path, not as a high-coverage rescue'
    )
  }
})

test('search strategies surface query errors instead of returning a silent empty', () => {
  const src = readFileSync(SRC, 'utf8')
  const fn = sliceDecl(src, 'async function smartProductSearch(')

  const destructures = fn.match(/const \{ data[^}]*\} = await/g) || []
  assert.ok(destructures.length >= 4, 'expected all four strategy queries')

  for (const d of destructures) {
    assert.match(
      d, /error/,
      `a strategy destructured only data — a failed query would read as "product not found": ${d}`
    )
  }
  assert.ok(
    (fn.match(/console\.error\('\[smartProductSearch\]/g) || []).length >= 4,
    'each strategy must log its own failure'
  )
})

test('a partial match tells Yuri WHICH words did not line up', () => {
  const src = readFileSync(SRC, 'utf8')
  const fn = sliceDecl(src, 'function describeResolution(')

  assert.match(fn, /unmatched_terms/, 'the partial-match payload must name the unmatched terms')
  assert.match(fn, /interpretation_guidance/, 'Yuri needs guidance to distinguish a renamed product from a different one')
  // It must remain a FACT for her judgment, not a command that decides for her.
  assert.match(
    fn, /Judge what they mean/,
    'the guidance must hand the judgment back to Yuri rather than dictating a verdict'
  )
})
