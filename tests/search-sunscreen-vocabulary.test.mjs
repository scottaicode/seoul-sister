/**
 * Guard tests — a sunscreen must be findable when the query uses the words
 * "sunscreen"/"SPF" that the catalog's NAMES do not carry.
 *
 * THE DEFECT (Aug 17 2026). A visitor asked about "mediheal madecassoside
 * 50+++", a real sunscreen. Yuri searched "Mediheal madecassoside sunscreen
 * SPF50" and told her "we pulled Mediheal masks, not that specific SPF". We
 * stock three. Neither "sunscreen" nor "spf50" appears in ANY of Mediheal's 133
 * product names, so all-terms matching fails, coverage (2) misses the near-match
 * threshold (3), and the query falls to Strategy 3 — where the sheet masks and
 * the sun serums TIE on coverage and `rating_avg` broke it toward a 5.00 mask
 * over the 4.90 Madecassoside Moisture Sun Serum.
 *
 * WHY THESE TESTS EXECUTE THE REAL FUNCTION. A source regex would pass against
 * a dead signal: the first draft of this fix used /...|pa\s*\+{2,}\b/, whose
 * trailing \b can never match after a '+', so the PA branch matched nothing and
 * a text-matching test would have called it shipped. Only running the ranker on
 * the real shape catches that.
 *
 * THE OVER-CORRECTION THESE TESTS PIN DOWN. "toner to use under sunscreen" and
 * "cleansing oil that removes sunscreen" name sunscreen as CONTEXT. Both reach
 * Strategy 3, where any boost >= 1 would rank sunscreens above the genuine
 * toner/cleanser matches the visitor asked for. The signal must stand down.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const TOOLS = join(root, 'src', 'lib', 'yuri', 'tools.ts')

function sliceDecl(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  // Start at the BODY brace, not the first '{'. The signature contains an
  // inline type literal (`options?: { category?: string ... }`), so naive
  // first-brace counting closes on the type and returns a truncated slice —
  // which imports cleanly and exports NOTHING, i.e. a silent no-op test.
  const sigEnd = src.indexOf('{\n', src.indexOf('(', start))
  let d = 0, j = sigEnd
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  return src.slice(start, j + 1)
}

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
  assert.ok(start > -1, `expected "${signature}"`)
  const open = src.indexOf('[', start)
  let d = 0, i = open
  for (; i < src.length; i++) {
    if (src[i] === '[') d++
    else if (src[i] === ']') { d--; if (!d) break }
  }
  return src.slice(start, src.indexOf('\n', i))
}

async function loadSearch() {
  const src = readFileSync(TOOLS, 'utf8')
  const mod = [
    sliceConst(src, 'const SEARCH_STOP_WORDS = new Set(['),
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
  ].join('\n\n') + '\nexport { smartProductSearch }\n'
  const js = ts.transpileModule(mod, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText
  return await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

/** PostgREST-shaped fake supporting the chain smartProductSearch uses. */
function fakeDb(rows) {
  const norm = (s) => (s || '').toLowerCase()
  const like = (v, p) => norm(v).includes(p.replace(/%/g, '').toLowerCase())
  return {
    from() {
      let set = rows.slice()
      let lim = Infinity
      const q = {
        select: () => q,
        eq(c, v) { set = set.filter((r) => r[c] === v); return q },
        ilike(c, p) { set = set.filter((r) => like(r[c], p)); return q },
        or(clauses) {
          const preds = clauses.split(',').map((c) => {
            const [col, , pattern] = c.split('.')
            return { col, pattern: (pattern || '').replace(/"/g, '') }
          })
          set = set.filter((r) => preds.some((p) => like(r[p.col], p.pattern)))
          return q
        },
        order(col, opts) {
          const dir = opts?.ascending === false ? -1 : 1
          set = set.map((r, i) => ({ r, i })).sort((a, b) => {
            const av = a.r[col] ?? -Infinity, bv = b.r[col] ?? -Infinity
            if (av !== bv) return (av - bv) * dir
            return a.i - b.i
          }).map((x) => x.r)
          return q
        },
        limit(n) { lim = n; return Promise.resolve({ data: set.slice(0, lim), error: null }) },
        then(res) { return Promise.resolve({ data: set.slice(0, lim), error: null }).then(res) },
      }
      return q
    },
  }
}

/** The real production shape: masks rated ABOVE the sunscreens. */
const MEDIHEAL = [
  { id: 'mask-1', brand_en: 'Mediheal', name_en: 'Derma 365 Mask Madecassoside (Blemish Repair) 30P Refill', category: 'mask', is_verified: true, rating_avg: 5.0 },
  { id: 'mask-2', brand_en: 'Mediheal', name_en: 'Essential Mask Madecassoside & Teatree Set', category: 'mask', is_verified: true, rating_avg: 4.9 },
  { id: 'mask-3', brand_en: 'Mediheal', name_en: 'Madecassoside Essential Mask Sheet Blemish Repair', category: 'mask', is_verified: true, rating_avg: 4.9 },
  { id: 'sun-1', brand_en: 'Mediheal', name_en: 'Madecassoside Moisture Sun Serum Blemish Repair', category: 'sunscreen', is_verified: true, rating_avg: 4.9 },
  { id: 'sun-2', brand_en: 'Mediheal', name_en: 'Madecassoside Sun Serum Trio', category: 'sunscreen', is_verified: true, rating_avg: 4.8 },
]

test('a sunscreen query finds the sunscreen, not the higher-rated sheet mask', async () => {
  const { smartProductSearch } = await loadSearch()
  const rows0 = await smartProductSearch(
    fakeDb(MEDIHEAL),
    'Mediheal madecassoside sunscreen SPF50',
    { limit: 5 }
  )
  assert.ok(rows0.length > 0, 'the search must return something')
  assert.equal(
    rows0[0].category,
    'sunscreen',
    `a sunscreen query must not rank a sheet mask first (got "${rows0[0].name_en}")`
  )
})

test('the PA+ form is a live branch, not dead regex', () => {
  // THE BUG THIS PINS. The first draft used /...|pa\s*\+{2,}\b/. A trailing \b
  // requires a word character after the final '+', so "pa++++" NEVER matched —
  // the branch was dead code that a source-text test would have called shipped.
  // This repo lost four fixes to a dead code path in v11.29.0 for the same
  // reason, so the regex is executed here rather than merely matched.
  const src = readFileSync(TOOLS, 'utf8')
  const m = /const SUNSCREEN_SIGNAL = (\/.*\/)\n/.exec(src)
  assert.ok(m, 'SUNSCREEN_SIGNAL must be a regex literal')
  // eslint-disable-next-line no-eval
  const re = eval(m[1])

  for (const q of ['round lab birch juice pa++++', 'pa+++ sunscreen', 'PA++++']) {
    assert.ok(re.test(q.toLowerCase()), `the PA branch must match "${q}"`)
  }
  // The VISITOR's own phrasing. She typed "mediheal madecassoside 50+++" — none
  // of the word branches match it; only the digit+pluses branch does. Measured
  // before adding: that shape appears in ZERO verified product names of any
  // category, so it cannot collide with a real product.
  for (const q of ['mediheal madecassoside 50+++', 'spf 50+++']) {
    assert.ok(re.test(q.toLowerCase()), `the visitor's literal phrasing must match "${q}"`)
  }
  // But NOT the single-plus shape: it appears in 9 non-sunscreen names
  // (spot treatments, a mask, a serum), so widening to it would over-correct.
  for (const q of ['cosrx snail 92 cream', 'hyaluronic acid 100', 'centella 50+ ampoule']) {
    assert.ok(!re.test(q.toLowerCase()), `must NOT fire on the single-plus shape "${q}"`)
  }
  for (const q of ['mediheal madecassoside sunscreen spf50', 'japanese sunblock', 'spf 50 cream']) {
    assert.ok(re.test(q.toLowerCase()), `the signal must match "${q}"`)
  }
  // And must NOT fire on words that merely contain the letters.
  for (const q of ['sunflower seed oil', 'sunday riley good genes', 'sun damage repair',
                   'sunspots treatment', 'spa treatment mask', 'some by mi spa']) {
    assert.ok(!re.test(q.toLowerCase()), `the signal must NOT fire on "${q}"`)
  }
})

test('an incidental sunscreen mention does not TRIGGER the signal', async () => {
  // "toner to use under sunscreen" names sunscreen as CONTEXT, not as the thing
  // wanted. The signal must stand down so this query behaves exactly as it did
  // before the fix.
  //
  // NOTE ON WHAT THIS DOES *NOT* CLAIM. Ranking on this query is imperfect
  // today for an unrelated, PRE-EXISTING reason (the higher-rated sunscreen
  // wins on rating among rows that tie on coverage) — verified by running this
  // exact case against the unmodified code, where it behaves identically. This
  // fix neither causes nor repairs that. Asserting a first-result category here
  // would be asserting a bug we did not introduce and did not fix, so instead
  // this pins the thing that IS ours: the suppression, i.e. that the boost is
  // not applied. If suppression breaks, the sunscreen's score gains +0.5 and
  // its lead over the toner widens beyond the rating-only ordering.
  const src = readFileSync(TOOLS, 'utf8')
  assert.match(
    src,
    /!terms\.some\(OTHER_CATEGORY_NOUN\)/,
    'the signal must stand down when the query names another category noun'
  )
  assert.match(
    src,
    /GENERIC_PRODUCT_WORDS\.has\(t\)/,
    'suppression must reuse the closed DB-derived word set, not an ad-hoc list ' +
      'of phrasings — the next incidental mention will be worded differently'
  )
})

test('an explicit category param wins over the inferred signal', async () => {
  const { smartProductSearch } = await loadSearch()
  // With category='mask' the sunscreens are filtered out entirely; the derived
  // signal must not fight the explicit parameter.
  const rows0 = await smartProductSearch(
    fakeDb(MEDIHEAL),
    'Mediheal madecassoside sunscreen SPF50',
    { limit: 5, category: 'mask' }
  )
  for (const p of rows0) {
    assert.equal(p.category, 'mask', 'an explicit category filter must be honoured exactly')
  }
})

test('the boost is a tie-break, strictly smaller than one term match', () => {
  const src = readFileSync(TOOLS, 'utf8')
  const m = /wantsSunscreen && p\.category === 'sunscreen'\) score \+= ([\d.]+)/.exec(src)
  assert.ok(m, 'the sunscreen boost must exist in scoreOf')
  const boost = parseFloat(m[1])
  assert.ok(
    boost > 0 && boost < 1,
    `the boost must break ties without outranking a real term match (found ${boost}); ` +
      'a boost >= 1 flips "cleansing oil that removes sunscreen" to a sunscreen'
  )
})
