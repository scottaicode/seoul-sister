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

test('the map is CLOSED — these three entries and nothing else', () => {
  // CLOSED-WORLD, deliberately (Aug 19 2026). The previous version of this
  // suite asserted properties of the entries that existed (short map, stem is a
  // prefix, stems >= 4 chars) and was therefore blind to what someone ADDS —
  // the open-world failure CLAUDE.md names verbatim.
  //
  // An adversarial review broke it in one move: adding
  //   moisturizer: 'mois', treatment: 'treat', exfoliator: 'exfo'
  // passed all ten assertions. Measured, `mois` matches **334 rows of which
  // 205 are NOT moisturizers** — every "Moisture"/"Moisturizing"/"Moist"
  // product across sunscreens, toners and essences. A 12x broadening, the exact
  // `creamy -> cream +982` class this map exists to prevent.
  //
  // A ratio budget cannot separate them: the legitimate `milky -> milk` is 11.9x
  // (7 rows -> 83) and the malicious `moisturizer -> mois` is 12.4x. The only
  // honest guard is a roster, so ADDING an entry must fail here and force the
  // author to measure it and update this list on purpose.
  assert.deepEqual(
    Object.keys(WORD_FORM_STEMS).sort(),
    ['cleanser', 'cleansing', 'milky'],
    'WORD_FORM_STEMS changed. Adding an entry requires MEASURING how many extra ' +
      'rows the stem admits and whether they are the right category, then ' +
      'updating this roster deliberately. See the notes above the map.'
  )
  assert.deepEqual(
    Object.values(WORD_FORM_STEMS).sort(),
    ['cleans', 'cleans', 'milk'],
    'a stem changed — re-measure its match count and category purity'
  )
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

test('GENERIC_PRODUCT_WORDS is checked on RAW terms, never on stems', () => {
  // LATENT TRAP found in post-hoc review (Aug 19 2026). The sunscreen-signal
  // suppression at tools.ts asks `GENERIC_PRODUCT_WORDS.has(t)` to decide
  // whether a query names another category ("cleansing oil that removes
  // sunscreen" wants a cleanser, not an SPF). That set contains the RAW words
  // 'cleanser' and 'cleansing' — it does NOT contain the stem 'cleans'.
  //
  // Today this is correct because `terms` holds raw tokens and normalizeTerm is
  // applied later, at the ILIKE predicates. But a future refactor that
  // normalizes terms EARLIER would silently break it: "cleanser sunscreen"
  // would stop suppressing and start returning sunscreens. Verified by
  // simulation — raw suppresses, stemmed does not.
  //
  // This test fails if anyone maps a GENERIC_PRODUCT_WORDS member to a stem
  // that is NOT itself in the set, which is the condition that makes the
  // ordering load-bearing and invisible.
  const generic = new Set(
    (SRC.slice(SRC.indexOf('const GENERIC_PRODUCT_WORDS'), SRC.indexOf('])', SRC.indexOf('const GENERIC_PRODUCT_WORDS')))
      .match(/'[a-z-]+'/g) || []).map((w) => w.slice(1, -1))
  )
  assert.ok(generic.has('cleanser'), 'sanity: the set must still list cleanser')

  const risky = Object.entries(WORD_FORM_STEMS).filter(
    ([term, stem]) => generic.has(term) && !generic.has(stem)
  )
  if (risky.length > 0) {
    // Not necessarily a bug TODAY — it is only a bug if terms get normalized
    // before the category check. The assertion documents the coupling so the
    // refactor that would break it fails here first.
    assert.ok(
      !/const terms = originalTokens[\s\S]{0,80}normalizeTerm/.test(SRC),
      `WORD_FORM_STEMS maps ${risky.map(([t, s]) => `${t}->${s}`).join(', ')} ` +
        'out of GENERIC_PRODUCT_WORDS, AND terms are now normalized before the ' +
        'category check — the sunscreen signal will misfire on "cleanser sunscreen".'
    )
  }
})
