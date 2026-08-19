/**
 * Guard: query terms whose word FORM differs from the catalog's storage must
 * still match — and the fix must not broaden search into unrelated products.
 *
 * Origin (Aug 18 2026 production transcript): a visitor asked about her
 * "Centella 100 milky cleanser". The catalog stores "...Gentle Cleansing Milk".
 * TWO words disagreed at once, every precise strategy missed, and the
 * last-resort search returned a Spot Cream. Yuri then told her the product was
 * not in our catalog. It was.
 *
 * These tests EXECUTE the real transpiled helpers rather than asserting on
 * source text — a source-regex test passes against broken code.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const SRC = fs.readFileSync(path.join(process.cwd(), 'src/lib/yuri/tools.ts'), 'utf8')

// Transpile just the pure helpers (the module has DB imports at scope).
function slice(name) {
  const i = SRC.indexOf(`function ${name}`)
  assert.ok(i > 0, `${name} must exist`)
  return SRC.slice(i, SRC.indexOf('\n}', i) + 2)
}
const mapSrc = SRC.slice(
  SRC.indexOf('const WORD_FORM_STEMS'),
  SRC.indexOf('}', SRC.indexOf('const WORD_FORM_STEMS')) + 1
)
const bundle = [mapSrc, slice('singularize'), slice('wordFormStem'), slice('normalizeTerm')].join('\n')
const js = ts.transpileModule(
  bundle + '\nexport { singularize, wordFormStem, normalizeTerm, WORD_FORM_STEMS };',
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText
const { normalizeTerm, singularize, WORD_FORM_STEMS } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)

test('the transcript query resolves: milky -> milk, cleanser -> cleans', () => {
  assert.equal(normalizeTerm('milky'), 'milk')
  assert.equal(normalizeTerm('cleanser'), 'cleans')
  // BOTH are required — verified live, fixing only "milky" still returns 0 rows
  // because the catalog says "Cleansing", not "cleanser".
  assert.equal(normalizeTerm('cleansing'), 'cleans')
})

test('plural handling still works (does not regress singularize)', () => {
  assert.equal(normalizeTerm('pads'), 'pad')
  assert.equal(normalizeTerm('serums'), 'serum')
})

test('does NOT broaden on the measured-dangerous adjectives', () => {
  // Measured against all 5,311 verified products: stripping "-y" would admit
  // creamy->cream +982 rows, watery->water +198, oily->oil +167. A shopper
  // asking for a "creamy cleanser" must not receive the entire cream catalog.
  for (const t of ['creamy', 'watery', 'oily']) {
    assert.equal(normalizeTerm(t), t, `${t} must be left alone`)
  }
})

test('does NOT mangle words where -y is not a suffix', () => {
  for (const t of ['daily', 'jelly', 'honey', 'energy', 'beauty', 'berry']) {
    assert.equal(normalizeTerm(t), t, `${t} must be left alone`)
  }
})

test('the map stays SHORT — it is a closed list, not a heuristic', () => {
  // A growing map is the signal that someone is hand-tuning a classifier,
  // which this repo has paid for before. Every entry must be measured for how
  // many extra rows it admits; the cap forces that conversation to happen.
  const n = Object.keys(WORD_FORM_STEMS).length
  assert.ok(n <= 8, `WORD_FORM_STEMS has ${n} entries — measure before growing it`)
})

test('every mapped stem is a PREFIX of its key (a narrowing, not a rewrite)', () => {
  // Guards the SHAPE rather than enumerating bad values: a stem that is not a
  // prefix is a synonym mapping, which is a different and much riskier feature
  // (it would let one product's query silently return another's).
  for (const [term, stem] of Object.entries(WORD_FORM_STEMS)) {
    assert.ok(
      term.startsWith(stem),
      `"${term}" -> "${stem}" is a rewrite, not a stem. Synonyms are out of scope.`
    )
    assert.ok(stem.length >= 4, `stem "${stem}" is too short to stay meaningful`)
  }
})

test('normalizeTerm composes singularize — plural AND word-form together', () => {
  // "cleansers" must reach the same stem as "cleanser".
  assert.equal(normalizeTerm('cleansers'), normalizeTerm('cleanser'))
})

test('all three SQL predicate sites use normalizeTerm, not singularize', () => {
  // The Strategy-1.5 class: a fix wired into scoring but not into the query
  // that actually runs looks correct and never executes. If any ILIKE site
  // still calls singularize(t) directly, SQL and in-memory scoring disagree.
  assert.ok(
    !/singularize\(t\)/.test(SRC),
    'a predicate site still calls singularize(t) — SQL and scoring will disagree'
  )
  const uses = SRC.match(/normalizeTerm\(t\)/g) || []
  assert.ok(uses.length >= 3, `expected >=3 normalizeTerm(t) predicate sites, found ${uses.length}`)
})

test('the cleanser stem stays inside the cleanser category (no cross-category leak)', () => {
  // The risk this fix carries is RANKING, not correctness: "cleanser" and
  // "cleansing" now share a stem, so a Cleansing Oil can outrank a foam
  // Cleanser. Measured against all 5,311 verified products: 658 rows match
  // "cleans" and 650 are category='cleanser' — so a shifted result is still a
  // cleanser, which is why the tradeoff was accepted.
  //
  // This asserts the SHAPE that makes that true: the stem must be a prefix of
  // both spellings, so it cannot match an unrelated category noun. A stem like
  // "clean" would also match "Clean It Zero" balms and "Clean Vegan" lines —
  // a genuine cross-category leak.
  assert.equal(normalizeTerm('cleanser'), normalizeTerm('cleansing'))
  const stem = normalizeTerm('cleanser')
  assert.ok('cleanser'.startsWith(stem) && 'cleansing'.startsWith(stem))
  assert.ok(
    stem.length >= 'cleans'.length,
    `stem "${stem}" is shorter than "cleans" — it would match unrelated "Clean ..." product lines`
  )
})

test('word-form stems never collapse two DIFFERENT category nouns together', () => {
  // A future entry like { toner: 'ton', lotion: 'lot' } would silently merge
  // unrelated products. Every stem must be reachable from exactly one concept:
  // no two keys with different prefixes may share a stem.
  const byStem = new Map()
  for (const [term, stem] of Object.entries(WORD_FORM_STEMS)) {
    if (!byStem.has(stem)) byStem.set(stem, [])
    byStem.get(stem).push(term)
  }
  for (const [stem, terms] of byStem) {
    for (const t of terms) {
      assert.ok(
        t.startsWith(stem),
        `"${t}" shares stem "${stem}" without being a form of it — that merges two concepts`
      )
    }
  }
})
