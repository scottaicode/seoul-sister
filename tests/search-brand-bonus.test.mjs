/**
 * The brand bonus in the last-resort product search goes to terms that NAME
 * the brand, not to any word that sits inside or beside one (Nov 2026).
 *
 * Production failures this guards:
 *   "lightweight gel moisturizer oily acne-prone" -> five Physiogel products
 *     ("gel" inside Physio-gel), Nov 11 2026.
 *   "daily sunscreen no white cast" -> COSNORI ("no" inside cos-NO-ri), Sept 4.
 *   whole-word matching alone -> "... dry sensitive skin" led by April Skin.
 *
 * Every search test EXECUTES the real smartProductSearch, cut from tools.ts,
 * against a stub catalog. Rankings are compared exactly.
 */

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(join(root, 'src/lib/yuri/tools.ts'), 'utf8')
const BRAND_SRC = readFileSync(join(root, 'src/lib/yuri/brand-match.ts'), 'utf8')

function sliceDecl(src, signature) {
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
function sliceBracket(src, signature, open, close) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const o = src.indexOf(open, start)
  let d = 0, i = o
  for (; i < src.length; i++) {
    if (src[i] === open) d++
    else if (src[i] === close) { d--; if (!d) break }
  }
  return src.slice(start, src.indexOf('\n', i))
}

const mod = [
  sliceBracket(SRC, 'const SEARCH_STOP_WORDS = new Set([', '[', ']'),
  sliceBracket(SRC, 'const GENERIC_PRODUCT_WORDS = new Set([', '[', ']'),
  sliceDecl(SRC, 'function singularize('),
  sliceBracket(SRC, 'const WORD_FORM_STEMS', '{', '}'),
  sliceDecl(SRC, 'function wordFormStem('),
  sliceDecl(SRC, 'function normalizeTerm('),
  readFileSync(join(root, 'src/lib/yuri/joined-alnum.ts'), 'utf8').replace(/^export /gm, ''),
  BRAND_SRC.replace(/^export /gm, ''),
  sliceDecl(SRC, 'function ilikeTerm('),
  sliceDecl(SRC, 'function termMatches('),
  sliceDecl(SRC, 'async function smartProductSearch('),
].join('\n\n') + `
export { smartProductSearch, brandTokens, brandBonusTerms, computeOrdinaryBrandWords,
  loadBrandCatalog, resetBrandCatalogCache, brandsNamedInQuery, ORDINARY_WORD_MIN_OTHER_BRANDS,
  MAX_NAMED_BRANDS, NAMED_BRAND_ROW_LIMIT, wordsOfBrandsTypedInFull }
`
const js = ts.transpileModule(mod, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText
const M = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const { smartProductSearch, brandTokens, brandBonusTerms, computeOrdinaryBrandWords } = M

beforeEach(() => M.resetBrandCatalogCache())

/** Split an or() string on the commas that sit outside double quotes. */
function splitOr(clauses) {
  const out = []
  let cur = '', quoted = false
  for (const ch of clauses) {
    if (ch === '"') quoted = !quoted
    if (ch === ',' && !quoted) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}

/** PostgREST-shaped fake. `opts.range` overrides the full-catalog scan. */
function fakeDb(rows, opts = {}) {
  const like = (v, p) => {
    const parts = p.toLowerCase().split('%').filter(Boolean)
    let hay = (v || '').toLowerCase(), at = 0
    for (const part of parts) {
      const i = hay.indexOf(part, at)
      if (i < 0) return false
      at = i + part.length
    }
    return true
  }
  const calls = { range: 0, order: [], in: [] }
  const db = {
    calls,
    from() {
      let set = rows.slice()
      let lim = Infinity
      const q = {
        select: () => q,
        eq(c, v) { set = set.filter((r) => r[c] === v); return q },
        in(c, vals) { calls.in.push(vals); set = set.filter((r) => vals.includes(r[c])); return q },
        ilike(c, p) { set = set.filter((r) => like(r[c], p)); return q },
        or(clauses) {
          // Commas inside a double-quoted value are part of the value, as in PostgREST.
          const preds = splitOr(clauses).map((c) => {
            const m = /^([^.]+)\.([^.]+)\.(.*)$/.exec(c)
            return { col: m ? m[1] : c, pattern: (m ? m[3] : '').replace(/"/g, '') }
          })
          set = set.filter((r) => preds.some((p) => like(r[p.col], p.pattern)))
          return q
        },
        order(col, o) {
          calls.order.push(col)
          if (col === 'id') return q
          const dir = o?.ascending === false ? -1 : 1
          set = set.map((r, i) => ({ r, i })).sort((a, b) => {
            const av = a.r[col] ?? -Infinity, bv = b.r[col] ?? -Infinity
            if (av !== bv) return (av - bv) * dir
            return a.i - b.i
          }).map((x) => x.r)
          return q
        },
        limit(n) { lim = n; return Promise.resolve({ data: set.slice(0, lim), error: null }) },
        range(a, b) {
          calls.range++
          if (opts.range) return Promise.resolve(opts.range(set, a, b))
          return Promise.resolve({ data: set.slice(a, b + 1), error: null, count: set.length })
        },
        then(res) { return Promise.resolve({ data: set.slice(0, lim), error: null }).then(res) },
      }
      return q
    },
  }
  return db
}

let seq = 0
const row = (brand_en, name_en, rating_avg = 4.0, category = 'moisturizer') => ({
  id: `p${seq++}`, brand_en, name_en, category, is_verified: true, rating_avg, review_count: 10,
})
const label = (r) => `${r.brand_en} | ${r.name_en}`
const top = async (db, q, limit = 5) => (await smartProductSearch(db, q, { limit })).map(label)

// ---------------------------------------------------------------------------
// The two production failures: a query word INSIDE an unrelated brand name.
// ---------------------------------------------------------------------------

test('"gel" inside Physiogel earns no brand bonus (the Nov 11 failure)', async () => {
  const db = fakeDb([
    row('Physiogel', 'DNT Facial Lotion', 5.0),
    row('Physiogel', 'DMT Essence In Toner', 5.0),
    row('Physiogel', 'Red Soothing Glow Up Sunscreen', 5.0),
    row('Torriden', 'Dive In Soothing Gel Moisturizer', 4.1),
    row('Isntree', 'Aloe Lightweight Gel', 4.0),
  ])
  assert.deepEqual(await top(db, 'lightweight gel moisturizer oily acne-prone'), [
    'Torriden | Dive In Soothing Gel Moisturizer',
    'Isntree | Aloe Lightweight Gel',
    'Physiogel | DNT Facial Lotion',
    'Physiogel | DMT Essence In Toner',
    'Physiogel | Red Soothing Glow Up Sunscreen',
  ])
})

test('"no" inside COSNORI and "free" inside Innisfree earn no brand bonus', async () => {
  const db = fakeDb([
    row('COSNORI', 'Panthenol Barrier Cream', 5.0),
    row('Innisfree', 'Volcanic Pore Clay Mask', 5.0),
    row('Round Lab', 'Birch Juice Daily Sunscreen', 4.0, 'sunscreen'),
  ])
  assert.equal((await top(db, 'daily sunscreen no white cast fragrance-free'))[0], 'Round Lab | Birch Juice Daily Sunscreen')
})

// ---------------------------------------------------------------------------
// One level up: the word IS a brand word, and an ordinary one.
// ---------------------------------------------------------------------------

const SKIN_CATALOG = () => [
  row('April Skin', 'Carrotene Clarifying Serum', 5.0),
  row("It's Skin", 'Power 10 Formula VC Effector', 5.0),
  row('Anua', 'Heartleaf Gentle Foam', 4.0, 'cleanser'),
  row('Etude', 'Soon Jung Dry Skin Wash', 3.9, 'cleanser'),
  row('Cosrx', 'Good Skin Barrier Toner', 3.5, 'toner'),
  row('Benton', 'Skin Fit Mineral Sun', 3.5, 'sunscreen'),
]

test('an ordinary brand word ("skin") earns no bonus on its own', async () => {
  const got = await top(fakeDb(SKIN_CATALOG()), 'gentle cleanser for dry sensitive skin', 3)
  // Etude matches two of her words, Anua one. April Skin and It's Skin match
  // only "skin", which three other brands use in product names.
  assert.deepEqual(got, [
    'Etude | Soon Jung Dry Skin Wash',
    'April Skin | Carrotene Clarifying Serum',
    "It's Skin | Power 10 Formula VC Effector",
  ])
})

test('a brand typed IN FULL keeps the bonus however ordinary its words', async () => {
  const catalog = [
    ...SKIN_CATALOG(),
    row('Real Barrier', 'Extreme Essence Toner', 3.0, 'toner'),
    row('Aestura', 'Atobarrier Real Soothing Cream', 5.0),
    row('Aestura', 'Barrier Mist', 5.0),
    row('Illiyoon', 'Ceramide Barrier Cream', 5.0),
    row('Dr.G', 'Barrier Cream', 5.0),
    row('Dr.G', 'Real Moist Gel', 5.0),
    row('Illiyoon', 'Real Calm Lotion', 5.0),
    row('Skin&Lab', 'Tone Up Sunblock', 3.0, 'sunscreen'),
    row('Mild Lab', 'Skin Night Mask', 5.0),
    row('Ground Lab', 'Skin Peel Pad', 5.0),
    row('The Tool Lab', 'Skin Brush', 5.0),
    // "lab" is ordinary here too, as it is in production.
    row('Aestura', 'Derma Lab Lotion', 1.0),
    row('Illiyoon', 'Lab Mist', 1.0),
    row('Dr.G', 'Lab Gel', 1.0),
  ]
  const db = () => fakeDb(catalog)
  // "real" and "barrier" are each used by 3 other brands here.
  assert.equal((await top(db(), 'Real Barrier intense moisture cream'))[0].split(' | ')[0], 'Real Barrier')
  assert.equal((await top(db(), "It's Skin hyaluronic ampoule"))[0].split(' | ')[0], "It's Skin")
  assert.equal((await top(db(), 'its skin hyaluronic ampoule'))[0].split(' | ')[0], "It's Skin")
  assert.equal((await top(db(), 'April Skin calendula peel'))[0].split(' | ')[0], 'April Skin')
  for (const q of ['Skin&Lab vitamin ampoule', 'skin & lab vitamin ampoule', 'skin lab vitamin ampoule']) {
    assert.equal((await top(db(), q))[0].split(' | ')[0], 'Skin&Lab', q)
  }
})

test('punctuated brands keep the bonus, typed with or without the punctuation', async () => {
  // Four or more terms, so the earlier near-match rescue (all but one term)
  // stands down and the ranking under test decides.
  const strangers = [
    row('Bushman', 'Vitamin Calming Mist Stick', 5.0),
    row('Benton', 'Vitamin Calming Ampoule Stick', 5.0),
  ]
  // NOT covered, and not fixed here: a punctuated brand typed as ONE word
  // ("drjart", "manyo", "skinlab"). The SQL fetch (`brand_en ILIKE %manyo%`)
  // never returns those rows, so no ranking can lift them.
  const cases = [
    ['TONYMOLY', ['tony moly vitamin stick refill', 'tonymoly vitamin stick refill']],
    ['Dr. Jart+', ['Dr. Jart+ vitamin stick refill', 'dr jart vitamin stick refill', 'jart vitamin stick refill']],
    ["d'Alba", ["d'Alba vitamin stick refill", 'd alba vitamin stick refill', 'alba vitamin stick refill']],
    ['Dear, Klairs', ['Dear Klairs vitamin stick refill', 'klairs vitamin stick refill', 'dear, klairs vitamin stick refill']],
    ['Ma:nyo', ['Ma:nyo vitamin stick refill', 'ma nyo vitamin stick refill']],
    ['Beauty of Joseon', ['beauty of joseon vitamin stick refill', 'joseon vitamin stick refill']],
    ['SKIN1004', ['skin1004 vitamin stick refill', 'skin 1004 vitamin stick refill']],
    ['Some By Mi', ['some by mi vitamin stick refill', 'Some By Mi vitamin stick refill']],
  ]
  for (const [brand, queries] of cases) {
    const db = fakeDb([...strangers, row(brand, 'Pore Toner', 1.0, 'toner')])
    for (const q of queries) {
      M.resetBrandCatalogCache()
      assert.equal((await top(db, q))[0], `${brand} | Pore Toner`, q)
    }
  }
})

// ---------------------------------------------------------------------------
// Ordinariness is measured over the CATALOG, not the rows one search fetched.
// ---------------------------------------------------------------------------

// The last-resort window is the 100 best-rated rows matching ANY term (at the
// default limits used here). It holds 95 ON:THE BODY rows, the right answer,
// and four fillers. The three other brands that use "body" in a product name
// sit below it, unfetched: only a catalog-wide measure can see them.
const BODY_CATALOG = () => [
  ...Array.from({ length: 95 }, (_, i) => row('ON:THE BODY', `Perfume Oil ${i}`, 5.0)),
  row('Cosrx', 'BHA Back Acne Wash', 4.9, 'cleanser'),
  ...Array.from({ length: 40 }, (_, i) => row('Filler Co', `Acne Patch ${i}`, 4.8)),
  row('Aestura', 'Atobarrier Body Lotion', 1.0),
  row('Illiyoon', 'Ceramide Body Cream', 1.0),
  row('Derma B', 'Daily Body Milk', 1.0),
]

test('a brand with many products cannot protect its own word (the fetched window is not the measure)', async () => {
  const catalog = [
  ...BODY_CATALOG(),
  ]
  assert.equal((await top(fakeDb(catalog), 'body wash back acne'))[0], 'Cosrx | BHA Back Acne Wash')
})

test('the ordinary-word verdict does not change with the caller limit', async () => {
  const catalog = [
  ...BODY_CATALOG(),
  ]
  for (const limit of [1, 5, 15, 30]) {
    M.resetBrandCatalogCache()
    assert.equal((await top(fakeDb(catalog), 'body wash back acne', limit))[0], 'Cosrx | BHA Back Acne Wash', `limit ${limit}`)
  }
})

test('the catalog is read once and reused', async () => {
  const db = fakeDb(SKIN_CATALOG())
  await top(db, 'gentle cleanser for dry sensitive skin')
  await top(db, 'soothing toner for oily skin types')
  assert.equal(db.calls.range, 1)
})

// ---------------------------------------------------------------------------
// A named brand's own rows are always candidates, whatever their rating.
// ---------------------------------------------------------------------------

// 200 five-star strangers sharing two of the query's loose words fill every
// rating-ordered window. The named brand's rows are rated far below them, and
// a brand term (3) outranks two shared words (2).
const CROWD = (words) => Array.from({ length: 200 }, (_, i) => row(`Crowd${i % 9}`, `${words} Thing ${i}`, 5.0))

test('a named brand reaches the ranking even when better-rated rows fill the window', async () => {
  const db = fakeDb([
    ...CROWD('Vitamin Fragrance'),
    row('Klairs', 'Freshly Juiced Vitamin Drop', 2.0),
    row('Klairs', 'Midnight Blue Calming Cream', 2.0),
  ])
  assert.deepEqual((await top(db, 'Klairs vitamin drop fragrance free refill', 2)), [
    'Klairs | Freshly Juiced Vitamin Drop',
    'Klairs | Midnight Blue Calming Cream',
  ])
})

test('the named brand joins the window; it does not replace it', async () => {
  const db = fakeDb([
    row('Klairs', 'Midnight Blue Calming Cream', 2.0),
    row('Anua', 'Vitamin Drop Glow Refill', 3.0),
  ])
  // Anua matches three of her words (3), Klairs the brand (3); rating decides.
  assert.deepEqual(await top(db, 'Klairs vitamin drop fragrance free refill'), [
    'Anua | Vitamin Drop Glow Refill',
    'Klairs | Midnight Blue Calming Cream',
  ])
})

test('a punctuated brand typed plainly is fetched and leads ("manyo", "dalba", "drjart", "skinlab")', async () => {
  const cases = [
    ['ma:nyo', 'manyo'], ["d'Alba", 'dalba'], ['Dr. Jart+', 'drjart'], ['Skin&Lab', 'skinlab'],
    ['Dear, Klairs', 'dear klairs'], ["I'm From", 'im from'], ['SKIN1004', 'skin 1004'],
  ]
  for (const [brand, typed] of cases) {
    M.resetBrandCatalogCache()
    const db = fakeDb([...CROWD('Herb Green'), row(brand, 'Herb Green Cleansing Oil', 1.0), row(brand, 'Pore Toner', 1.0)])
    // Every word is covered by the first row, so it answers alone...
    assert.deepEqual(await top(db, `${typed} herb green cleansing oil`, 2), [`${brand} | Herb Green Cleansing Oil`], typed)
    // ...and when no row covers everything, the brand's rows lead the ranking.
    M.resetBrandCatalogCache()
    assert.deepEqual(await top(db, `${typed} herb green calming mist refill`, 2), [
      `${brand} | Herb Green Cleansing Oil`, `${brand} | Pore Toner`,
    ], typed)
  }
})

test('the named-brand fetch respects category and is_verified, and names no brand for an ordinary word', async () => {
  const rows = [
    ...CROWD('Vitamin Calming Refill'),
    row('Klairs', 'Vitamin Mask', 1.0, 'mask'),
    { ...row('Klairs', 'Vitamin Drop', 1.0, 'serum'), is_verified: false },
    row('Klairs', 'Calming Serum', 1.0, 'serum'),
  ]
  const got = await smartProductSearch(fakeDb(rows), 'klairs vitamin drop calming refill', { limit: 3, category: 'serum' })
  assert.deepEqual(got.map(label), ['Klairs | Calming Serum'])
  // "skin" is ordinary in SKIN_CATALOG: April Skin / It's Skin are not named.
  M.resetBrandCatalogCache()
  const cat = await M.loadBrandCatalog(fakeDb(SKIN_CATALOG()))
  assert.deepEqual(M.brandsNamedInQuery(cat, brandTokens('dry skin cleanser'), ['dry', 'skin', 'cleanser']), [])
  assert.deepEqual(M.brandsNamedInQuery(cat, brandTokens('april skin cleanser'), ['april', 'skin', 'cleanser']), ['April Skin'])
})

test('the loader lists brands in case-insensitive order, exactly as stored', async () => {
  const db = fakeDb([row('ma:nyo', 'Oil'), row('Anua', 'Toner'), row("d'Alba", 'Mist'), row('Zeroid', 'Cream'), row('anua', 'Pad'), row('Anua', 'Serum')])
  assert.deepEqual((await M.loadBrandCatalog(db)).brands, ['Anua', 'anua', "d'Alba", 'ma:nyo', 'Zeroid'])
})

test('a query naming several brands fetches each of them, and each leads with its own match', async () => {
  const db = fakeDb([
    ...CROWD('Glow Heartleaf'),
    row('Beauty of Joseon', 'Glow Serum', 1.4, 'serum'),
    row('Beauty of Joseon', 'Dynasty Cream', 1.1),
    row('Beauty of Joseon', 'Ginseng Essence Water', 1.0),
    row('Anua', 'Heartleaf 77 Toner', 1.3, 'toner'),
    row('COSRX', 'Low pH Cleanser', 1.2, 'cleanser'),
  ])
  const got = await top(db, 'COSRX cleanser Anua heartleaf toner Beauty of Joseon glow serum', 4)
  assert.deepEqual(db.calls.in, [['Anua', 'Beauty of Joseon', 'COSRX']])
  // Matched words + 2 for the brand: 6, 5, 4, 4 (rating splits the last
  // two). A two-word brand's unrelated cream does not outrank COSRX's
  // cleanser for having two brand words.
  assert.deepEqual(got, [
    'Beauty of Joseon | Glow Serum',
    'Anua | Heartleaf 77 Toner',
    'COSRX | Low pH Cleanser',
    'Beauty of Joseon | Dynasty Cream',
  ])
})

test('a term inside a brand name does not satisfy the precise strategies either', async () => {
  // "cica gel cream": Physiogel's Cica Balance Cream matched all three terms
  // only because "gel" sits inside the brand. It answered alone, before any
  // ranking ran.
  const db = fakeDb([
    row('Physiogel', 'Red Soothing Cica Balance Cream', 5.0),
    row('Aestura', 'A-Cica Soothing Gel Cream', 4.0),
  ])
  assert.deepEqual(await top(db, 'cica gel cream'), ['Aestura | A-Cica Soothing Gel Cream'])
  // The brand's own word still counts as a match.
  assert.deepEqual(await top(db, 'physiogel cica cream'), ['Physiogel | Red Soothing Cica Balance Cream'])
  // The same for a near match (all but one term): "gel" inside the brand used
  // to bring Physiogel's cream up level with the gel cream that was asked for.
  assert.deepEqual(await top(db, 'cica gel cream calming'), ['Aestura | A-Cica Soothing Gel Cream'])
})

test('two products that share a name are both returned; a tie keeps the rating window first', async () => {
  const db = fakeDb([
    { ...row('Anua', 'Vitamin Refill Glow Mist', 4.0), id: 'c' },
    { ...row('Etude', 'SoonJung Relief Toner', 4.0, 'toner'), id: 'a' },
    { ...row('Etude', 'SoonJung Relief Toner', 4.0, 'toner'), id: 'b' },
  ])
  const got = await smartProductSearch(db, 'etude vitamin refill glow extra', { limit: 5 })
  // c: three words (3). a, b: the brand word plus 2 (3). All rated 4.0, so the order the
  // rating window gave them stands; the brand's rows are added after it.
  assert.deepEqual(got.map((r) => r.id), ['c', 'a', 'b'])
})

test('a brand row sharing its NAME with a row already in the window is still added', async () => {
  // Two listings of one product name are two products (ids differ). The
  // top-rated one is in the rating window; the other arrives only through the
  // named-brand fetch and must not be dropped as a duplicate.
  const db = fakeDb([
    { ...row('Etude', 'SoonJung Relief Toner', 5.0, 'toner'), id: 'top' },
    ...CROWD('Vitamin Glow'),
    { ...row('Etude', 'SoonJung Relief Toner', 1.0, 'toner'), id: 'low' },
  ])
  const got = await smartProductSearch(db, 'etude vitamin glow refill extra', { limit: 2 })
  assert.deepEqual(got.map((r) => r.id), ['top', 'low'])
})

test('the whole brand is recognised from the full query, stop words included', async () => {
  const db = fakeDb([
    ...CROWD('Shower Fresh'),
    row('ON:THE BODY', 'Rice Therapy Scrub', 1.0),
    row('Aestura', 'Body Lotion', 1.0), row('Illiyoon', 'Body Cream', 1.0), row('Derma B', 'Body Milk', 1.0),
  ])
  assert.equal((await top(db, 'on the body shower fresh gel refill'))[0], 'ON:THE BODY | Rice Therapy Scrub')
})

test('a word of a brand typed in full does not name a second brand', async () => {
  const brands = ['Round Lab', 'Round Around', 'House of Hur', 'House of B', 'Yakson House', 'Klairs', 'Dear, Klairs', 'Purito', 'Purito Seoul']
  const catalog = { ordinary: new Set(['lab']), brands }
  const named = (q) => M.brandsNamedInQuery(catalog, brandTokens(q), q.toLowerCase().split(/\s+/).filter((w) => w.length > 1))
  assert.deepEqual(named('round lab 1025 dokdo toner'), ['Round Lab'])
  assert.deepEqual(named('roundlab 1025 dokdo toner'), ['Round Lab'])
  assert.deepEqual(named('house of hur sunscreen'), ['House of Hur'])
  // Typed alone, the word still names every brand that carries it.
  assert.deepEqual(named('round toner'), ['Round Lab', 'Round Around'])
  // A one-word brand does not take its word away from its longer spelling.
  assert.deepEqual(named('klairs toner'), ['Klairs', 'Dear, Klairs'])
  assert.deepEqual(named('purito seoul sunscreen'), ['Purito', 'Purito Seoul'])
  assert.deepEqual([...M.wordsOfBrandsTypedInFull(brands, brandTokens('round lab and klairs toner')).words].sort(), ['lab', 'round'])
  // One brand stored two ways does not block itself.
  const whoo = { ordinary: new Set(), brands: ['The History of Whoo', 'The Whoo', 'Whoo Care'] }
  const namedW = (q) => M.brandsNamedInQuery(whoo, brandTokens(q), q.toLowerCase().split(/\s+/).filter((w) => w.length > 1))
  assert.deepEqual(namedW('the history of whoo gong jin hyang'), ['The History of Whoo', 'The Whoo'], 'Whoo Care is a different brand; The Whoo is the same one')
  // Through the search: Round Around's row gets no brand weight and no
  // coverage for "round", so it ranks below a row that matches one real word.
  const db = fakeDb([
    row('Round Around', 'Greentea Cica Sun Lotion', 5.0),
    row('Round Lab', 'Birch Juice Cream', 1.0),
    row('Anua', 'Heartleaf Toner', 1.0),
    row('Aestura', 'Lab Lotion', 1.0), row('Illiyoon', 'Lab Mist', 1.0), row('Dr.G', 'Lab Gel', 1.0),
  ])
  M.resetBrandCatalogCache()
  const got = await top(db, 'round lab dokdo calming toner refill', 10)
  assert.deepEqual(got, [
    'Round Lab | Birch Juice Cream',
    'Anua | Heartleaf Toner', 'Aestura | Lab Lotion', 'Illiyoon | Lab Mist', 'Dr.G | Lab Gel',
    'Round Around | Greentea Cica Sun Lotion',
  ])
  assert.deepEqual(db.calls.in, [['Round Lab']])
})

test('the exact all-terms pass sees the named brand; the near match does not', async () => {
  // All-terms: the 1.0-rated exact product is outside the rating window and is found through its brand.
  const exact = fakeDb([...CROWD('Dokdo Lotion'), row('Round Lab', '1025 Dokdo Lotion', 1.0)])
  assert.deepEqual(await top(exact, 'roundlab 1025 dokdo lotion'), ['Round Lab | 1025 Dokdo Lotion'])
  // Near match (all but one term) keeps to the window: here it finds nothing
  // there, so the ranking decides and returns the wider field, brand first.
  M.resetBrandCatalogCache()
  const near = fakeDb([...CROWD('Dokdo Lotion'), row('Round Lab', '1025 Dokdo Lotion', 1.0)])
  const got = await top(near, 'roundlab 1025 dokdo lotion refill', 3)
  assert.equal(got[0], 'Round Lab | 1025 Dokdo Lotion')
  assert.equal(got.length, 3)
})

test('the search tool keeps rating order among all-terms rows, window first; only the resolver asks for closest fit', async () => {
  const rows = [
    row('Skinfood', 'Rice Daily Mask Sheet', 5.0), row('Skinfood', 'Honey Mask Sheet', 4.9), row('Skinfood', 'Mask Sheet', 4.0),
  ]
  const ids = async (opts) => (await smartProductSearch(fakeDb(rows), 'skin food mask sheet', opts)).map((r) => r.name_en)
  assert.deepEqual(await ids({ limit: 2 }), ['Rice Daily Mask Sheet', 'Honey Mask Sheet'])
  M.resetBrandCatalogCache()
  assert.deepEqual(await ids({ limit: 2, closestFitFirst: true }), ['Mask Sheet', 'Honey Mask Sheet'])
  // With room for all of them, the order is not touched.
  M.resetBrandCatalogCache()
  assert.deepEqual(await ids({ limit: 5, closestFitFirst: true }), ['Rice Daily Mask Sheet', 'Honey Mask Sheet', 'Mask Sheet'])
})

test('the sunscreen retry: a comma brand is found, and a skipped row never answers', async () => {
  const rows = [
    ...Array.from({ length: 120 }, (_, i) => row(`Crowd${i % 9}`, `All Day Airy Sun Filler ${i}`, 5.0, 'sunscreen')),
    row('Dear, Klairs', 'All Day Airy Mineral Sun Cream', 3.0, 'sunscreen'),
    row('Dear, Klairs for Men', 'All Day Airy Mineral Sun Cream', 4.0, 'sunscreen'),
  ]
  const skip = (p) => /for men/i.test(p.brand_en)
  const got = await smartProductSearch(fakeDb(rows), 'Dear, Klairs All Day Airy Mineral sunscreen SPF50', { limit: 5, skip })
  assert.deepEqual(got.map(label), ['Dear, Klairs | All Day Airy Mineral Sun Cream'])
})

test('brandsNamedInQuery stops at the cap', () => {
  const brands = Array.from({ length: 20 }, (_, i) => `Dear Brand${i}`)
  const named = M.brandsNamedInQuery({ ordinary: new Set(), brands }, ['dear', 'toner'], ['dear', 'toner'])
  assert.equal(M.MAX_NAMED_BRANDS, 8)
  assert.equal(named.length, 8)
  assert.equal(M.NAMED_BRAND_ROW_LIMIT, 300)
})

test('a failed named-brand fetch is logged and the search still answers from the window', async () => {
  const base = fakeDb([row('Klairs', 'Vitamin Drop', 4.0), row('Anua', 'Vitamin Calming Refill Serum', 4.5)])
  const db = { from() { const q = base.from(); q.in = () => ({ eq: () => q2, order: () => q2 }); return q } }
  const q2 = { eq: () => q2, order: () => q2, limit: () => Promise.resolve({ data: null, error: { message: 'in-boom' } }) }
  const [got, errs] = await withErrors(() => top(db, 'klairs vitamin calming refill mist'))
  assert.deepEqual(got, ['Klairs | Vitamin Drop', 'Anua | Vitamin Calming Refill Serum'])
  assert.equal(errs.filter((e) => e.includes('named-brand fetch failed') && e.includes('in-boom')).length, 1)
})

// ---------------------------------------------------------------------------
// Rows the caller will not show never count as an answer.
// ---------------------------------------------------------------------------

test('a strategy whose only match is a skipped row does not end the search', async () => {
  const rows = [
    row('Ideal for Men', 'Power Cooling After Shave Gel', 5.0),
    row('Aestura', 'Soothing Cream', 4.0),
    row('Isntree', 'Aloe Gel', 3.0),
  ]
  const skip = (p) => /for men/i.test(p.brand_en)
  // Unskipped, the after-shave gel is the one near match (two of three words) and answers alone.
  assert.deepEqual((await smartProductSearch(fakeDb(rows), 'cool soothing gel', { limit: 5 })).map(label), ['Ideal for Men | Power Cooling After Shave Gel'])
  // Skipped, the search goes on and returns what the caller can show.
  M.resetBrandCatalogCache()
  assert.deepEqual((await smartProductSearch(fakeDb(rows), 'cool soothing gel', { limit: 5, skip })).map(label), ['Aestura | Soothing Cream', 'Isntree | Aloe Gel'])
  // The same at every strategy that can return on its own.
  const exact = [row('Ideal for Men', 'Cool Soothing Gel', 5.0), row('Isntree', 'Aloe Gel', 3.0)]
  M.resetBrandCatalogCache()
  assert.deepEqual((await smartProductSearch(fakeDb(exact), 'cool soothing gel', { limit: 5, skip })).map(label), ['Isntree | Aloe Gel'])
  M.resetBrandCatalogCache()
  assert.deepEqual((await smartProductSearch(fakeDb(exact), 'ideal cool soothing gel', { limit: 5, skip })).map(label), ['Isntree | Aloe Gel'])
  assert.match(SRC, /skip: includeMens \? undefined : isMensLineProduct,/)
})

// ---------------------------------------------------------------------------
// PostgREST syntax characters in a query.
// ---------------------------------------------------------------------------

test('commas, parentheses and quotes never break a filter string', async () => {
  const seen = []
  const base = fakeDb([
    row('Some By Mi', 'AHA BHA PHA 30 Days Miracle Toner', 4.0, 'toner'),
    row('Some By Mi', 'AHA, BHA, PHA 30 Days Miracle Acne Clear Foam', 4.0, 'cleanser'),
  ])
  const db = { from() { const q = base.from(); const or = q.or; q.or = (c) => { seen.push(c); return or(c) }; return q } }
  const got = await top(db, 'Some By Mi AHA, BHA, PHA (30 Days) "Miracle" Toner')
  assert.deepEqual(got, ['Some By Mi | AHA BHA PHA 30 Days Miracle Toner'])
  assert.ok(seen.length >= 1)
  // The same through the strategies that build one clause per term.
  seen.length = 0
  assert.deepEqual(await top(db, 'gentle aha, bha (pha) "daily" lotion'), [
    'Some By Mi | AHA BHA PHA 30 Days Miracle Toner',
    'Some By Mi | AHA, BHA, PHA 30 Days Miracle Acne Clear Foam',
  ])
  assert.ok(seen.length >= 3)
  // Every clause is `col.ilike.value`. An unquoted value holds no filter
  // syntax; a quoted one may hold commas and holds no quote of its own.
  for (const c of seen) {
    for (const clause of splitOr(c)) {
      assert.match(clause, /^(name_en|brand_en)\.ilike\.(%[^,()"]*%|"%[^"()]*%")$/, clause)
    }
  }
  // A query with no comma builds its filters exactly as it always did.
  seen.length = 0
  await top(db, 'Some By Mi AHA BHA PHA Miracle Toner')
  assert.equal(seen[0], 'name_en.ilike.%Some By Mi AHA BHA PHA Miracle Toner%,brand_en.ilike.%Some By Mi AHA BHA PHA Miracle Toner%')
})

test('a brand stored with a comma is found with or without it, by the precise lookup', async () => {
  // Strategy 1.5 (brand prefix + every name word). It returns ONLY the match,
  // so a second row coming back means a looser strategy answered instead.
  // 40 better-rated rows sharing its words keep it out of every rating
  // window, so only the brand-prefix lookup can return it alone.
  const rows = [
    ...Array.from({ length: 40 }, (_, i) => row(`Crowd${i % 5}`, `Supple Preparation Toner ${i}`, 5.0, 'toner')),
    row('Dear, Klairs', 'Supple Preparation Unscented Toner', 3.0, 'toner'),
    row('Klairs', 'Supple Preparation Unscented Toner', 5.0, 'toner'),
    row('Dear, Klairs', 'Rich Moist Soothing Cream', 5.0),
  ]
  for (const q of ['Dear, Klairs Supple Preparation Unscented Toner', 'Dear Klairs Supple Preparation Unscented Toner']) {
    M.resetBrandCatalogCache()
    const got = await top(fakeDb(rows), q)
    assert.equal(got[0], 'Dear, Klairs | Supple Preparation Unscented Toner', q)
  }
  assert.deepEqual(await top(fakeDb(rows), 'Dear, Klairs Supple Preparation Unscented Toner'), ['Dear, Klairs | Supple Preparation Unscented Toner'])
})

// ---------------------------------------------------------------------------
// A catalog that could not be read in full is a failure, said out loud.
// ---------------------------------------------------------------------------

async function withErrors(fn) {
  const orig = console.error
  const seen = []
  console.error = (...a) => seen.push(a.join(' '))
  try { return [await fn(), seen] } finally { console.error = orig }
}

async function withClock(fn) {
  const real = Date.now
  let now = real()
  Date.now = () => now
  try { return await fn((ms) => { now += ms }) } finally { Date.now = real }
}

test('a failed catalog read is logged once, retried after a minute, and only a brand typed in full then counts', async () => {
  await withClock(async (advance) => {
    const rows = [
      ...SKIN_CATALOG(),
      row('Dear, Klairs', 'Pore Toner', 1.0, 'toner'),
      row('Real Barrier', 'Pore Toner', 1.0, 'toner'),
      row('Bushman', 'Vitamin Calming Stick', 5.0),
    ]
    let fail = true
    const db = fakeDb(rows, { range: (set, a, b) => fail
      ? { data: null, error: { message: 'boom' }, count: null }
      : { data: set.slice(a, b + 1), error: null, count: set.length } })
    // No catalog: a single brand word ("klairs") earns nothing, because which
    // words are ordinary is unknown. A brand typed in full still leads.
    const [got, errs] = await withErrors(() => top(db, 'klairs vitamin calming mist refill'))
    assert.equal(got[0], 'Bushman | Vitamin Calming Stick')
    assert.equal(errs.filter((e) => e.includes('[brand-match]') && e.includes('boom')).length, 1)
    const [full] = await withErrors(() => top(db, 'real barrier vitamin calming mist'))
    assert.equal(full[0], 'Real Barrier | Pore Toner')
    assert.equal(db.calls.range, 1, 'not re-read on every search while it is failing')
    advance(59_000)
    await withErrors(() => top(db, 'klairs vitamin calming mist refill'))
    assert.equal(db.calls.range, 1)
    advance(2_000)
    fail = false
    assert.equal((await top(db, 'klairs vitamin calming mist refill'))[0], 'Dear, Klairs | Pore Toner', 'read again after a minute, and the brand word counts once the catalog is known')
    assert.equal(db.calls.range, 2)
  })
})

test('the catalog is kept for six hours, and a failed refresh keeps serving the last good one', async () => {
  await withClock(async (advance) => {
    let fail = false
    const db = fakeDb(SKIN_CATALOG(), { range: (set, a, b) => fail
      ? { data: null, error: { message: 'boom' }, count: null }
      : { data: set.slice(a, b + 1), error: null, count: set.length } })
    const first = await M.loadBrandCatalog(db)
    advance(6 * 60 * 60 * 1000 - 1000)
    assert.equal(await M.loadBrandCatalog(db), first)
    assert.equal(db.calls.range, 1)
    advance(2000)
    fail = true
    const [stale, errs] = await withErrors(() => M.loadBrandCatalog(db))
    assert.equal(stale, first, 'the last good catalog, not null')
    assert.equal(errs.length, 1)
    assert.equal(db.calls.range, 2)
    // During the minute before the next attempt, still the last good catalog.
    advance(30_000)
    assert.equal(await M.loadBrandCatalog(db), first)
    assert.equal(db.calls.range, 2)
  })
})

test('concurrent searches share one catalog read', async () => {
  const db = fakeDb(SKIN_CATALOG())
  const [a, b] = await Promise.all([M.loadBrandCatalog(db), M.loadBrandCatalog(db)])
  assert.equal(a, b)
  assert.equal(db.calls.range, 1)
})

test('a silently capped page (fewer rows than the exact count) is a failure, not a small catalog', async () => {
  const db = fakeDb(SKIN_CATALOG(), {
    range: (set, a, b) => ({ data: set.slice(a, Math.min(b + 1, 3)), error: null, count: set.length }),
  })
  const [catalog, errs] = await withErrors(() => M.loadBrandCatalog(db))
  assert.equal(catalog, null)
  assert.equal(errs.filter((e) => e.includes('partial catalog scan: 3 rows of 6')).length, 1)
})

test('a missing exact count is a failure', async () => {
  const db = fakeDb(SKIN_CATALOG(), { range: (set, a, b) => ({ data: set.slice(a, b + 1), error: null, count: null }) })
  const [catalog] = await withErrors(() => M.loadBrandCatalog(db))
  assert.equal(catalog, null)
})

test('the catalog scan is ordered by id, so pages cannot overlap or skip', async () => {
  const db = fakeDb(SKIN_CATALOG())
  await M.loadBrandCatalog(db)
  assert.deepEqual(db.calls.order, ['id'])
})

test('the catalog scan pages past 1,000 rows', async () => {
  const many = Array.from({ length: 2300 }, (_, i) => row(`Brand${i % 40}`, `Thing ${i} Skin`, 3))
  const db = fakeDb([...many, row('April Skin', 'Serum', 3)])
  const catalog = await M.loadBrandCatalog(db)
  assert.equal(db.calls.range, 3)
  assert.deepEqual([...catalog.ordinary], ['skin'])
  assert.equal(catalog.brands.length, 41)
})

// ---------------------------------------------------------------------------
// The pure pieces, exactly.
// ---------------------------------------------------------------------------

test('brandTokens: one cleaning rule', () => {
  assert.deepEqual(brandTokens('Dr. Jart+'), ['dr', 'jart'])
  assert.deepEqual(brandTokens('Skin&Lab'), ['skin', 'lab'])
  assert.deepEqual(brandTokens("d'Alba"), ['d', 'alba'])
  assert.deepEqual(brandTokens('Dear, Klairs'), ['dear', 'klairs'])
  assert.deepEqual(brandTokens('Ma:nyo'), ['ma', 'nyo'])
  assert.deepEqual(brandTokens('ON:THE BODY'), ['on', 'the', 'body'])
  assert.deepEqual(brandTokens('It’s Skin'), ['it', 's', 'skin'])
  assert.deepEqual(brandTokens(''), [])
})

test('brandBonusTerms: exact sets', () => {
  const ordinary = (w) => ['skin', 'barrier', 'real', 'body', 'lab'].includes(w)
  const run = (brand, query) => {
    const terms = query.toLowerCase().replace(/[-/_.]+/g, ' ').split(/\s+/).filter((t) => t.length > 1)
    return [...brandBonusTerms(brand, brandTokens(query), terms, ordinary)].sort()
  }
  assert.deepEqual(run('Physiogel', 'gel moisturizer'), [])
  assert.deepEqual(run('COSNORI', 'no white cast'), [])
  assert.deepEqual(run('Acnes', 'acne cream'), [])
  assert.deepEqual(run('April Skin', 'dry skin cleanser'), [])
  assert.deepEqual(run('April Skin', 'april skin cleanser'), ['april', 'skin'])
  assert.deepEqual(run('April Skin', 'april cleanser'), ['april'])
  assert.deepEqual(run('Real Barrier', 'barrier cream'), [])
  assert.deepEqual(run('Real Barrier', 'real barrier cream'), ['barrier', 'real'])
  assert.deepEqual(run('Real Barrier', 'barrier real cream'), [], 'out of order is not the brand')
  assert.deepEqual(run('ON:THE BODY', 'body wash'), [])
  assert.deepEqual(run('ON:THE BODY', 'on the body wash'), ['body', 'on', 'the'])
  assert.deepEqual(run('Dr. Jart+', 'dr.jart+ cicapair'), ['dr', 'jart+'])
  assert.deepEqual(run('Beauty of Joseon', 'joseon sunscreen'), ['joseon'])
  assert.deepEqual(run('Beauty of Joseon', 'best of sunscreen'), [], 'a filler word is never the brand')
  assert.deepEqual(run('SKIN1004', 'skin 1004 centella'), ['1004', 'skin'])
  assert.deepEqual(run('SKIN1004', 'skin centella'), [])
  assert.deepEqual(run('Skin&Lab', 'skinlab toner'), ['skinlab'])
  assert.deepEqual(run('Mild Lab', 'skin&lab toner'), [], 'one word of a two-word term is not the brand')
  assert.deepEqual(run('Mild Farm', 'skin&farm toner'), [])
  assert.deepEqual(run('Mild Farm', 'mild&farm toner'), ['mild&farm'])
  assert.deepEqual(run("I'm From", "i'm tired"), [], 'a term with no identifying word names nothing')
  // The whole brand may sit anywhere in the query, and must be whole.
  assert.deepEqual(run('Real Barrier', 'best real barrier cream'), ['barrier', 'real'])
  assert.deepEqual(run('Real Barrier', 'a cream for my real skin barrier'), [])
  assert.deepEqual(run('SKIN1004', 'cream for dry skin'), [], 'a brand that merely starts with the last word is not named')
  assert.deepEqual(run('Skin&Lab', 'cream for dry skin'), [])
  // A typed term of several words is the brand only if ALL of them are in the run.
  assert.deepEqual(run('Skin&Lab', 'skin lab skin&farm toner'), ['lab', 'skin'])
  // Two-letter brands and brand words count.
  assert.deepEqual(run('VT', 'vt reedle shot'), ['vt'])
  assert.deepEqual(run('VT Cosmetics', 'vt reedle shot'), ['vt'])
  assert.deepEqual(run('Dr.G', 'dr g red blemish'), ['dr'])
  // Function words never name a brand on their own.
  assert.deepEqual(run("I'm From", 'toner from korea'), [])
  assert.deepEqual(run('LA DOLF', 'la roche posay anthelios'), [])
  assert.deepEqual(run('LA DOLF', 'la dolf ampoule'), ['dolf', 'la'])
  assert.deepEqual(run('Too Cool For School', 'not too sticky'), [])
  assert.deepEqual(run("I'm From", 'im from rice toner'), ['from', 'im'])
  // Marks nobody listed still separate.
  assert.deepEqual(brandTokens('su:m37°'), ['su', 'm37'])
  assert.deepEqual(brandTokens('Cica·go'), ['cica', 'go'])
  assert.deepEqual(run('su:m37°', 'sum37 losec serum'), ['sum37'])
  // A one-word brand whose word is ordinary is not named by that word.
  const ord = (w) => w === 'cure'
  const terms = ['acne', 'cure', 'cream']
  assert.deepEqual([...brandBonusTerms('Cure', brandTokens('acne cure cream'), terms, ord)], [])
  assert.deepEqual([...brandBonusTerms('Cure', brandTokens('acne cure cream'), terms, () => false)], ['cure'])
  // Without single words (no catalog), only a brand typed in full counts.
  assert.deepEqual([...brandBonusTerms('Dear, Klairs', ['klairs', 'toner'], ['klairs', 'toner'], () => false, false)], [])
  assert.deepEqual([...brandBonusTerms('Dear, Klairs', ['dear', 'klairs', 'toner'], ['dear', 'klairs', 'toner'], () => false, false)].sort(), ['dear', 'klairs'])
  assert.deepEqual([...brandBonusTerms('Medicube', ['medicube', 'pad'], ['medicube', 'pad'], () => false, false)], ['medicube'])
  assert.deepEqual(run('', 'anything here'), [])
})

test('computeOrdinaryBrandWords: three OTHER brands, counted by brand not by product', () => {
  const rows = (others) => [
    { brand_en: 'April Skin', name_en: 'Carrot Serum' },
    { brand_en: "It's Skin", name_en: 'Skin Power Skin Toner' },
    ...others.map((b) => ({ brand_en: b, name_en: 'Good Skin Cream' })),
  ]
  assert.equal(M.ORDINARY_WORD_MIN_OTHER_BRANDS, 3)
  assert.deepEqual([...computeOrdinaryBrandWords(rows(['A1', 'B1']))], [])
  assert.deepEqual([...computeOrdinaryBrandWords(rows(['A1', 'A1', 'A1', 'B1']))], [], 'one brand with many products is one brand')
  assert.deepEqual([...computeOrdinaryBrandWords(rows(['A1', 'B1', 'C1']))], ['skin'])
  // A brand that owns the word does not count against it.
  assert.deepEqual([...computeOrdinaryBrandWords([
    { brand_en: 'April Skin', name_en: 'Skin Serum' },
    { brand_en: "It's Skin", name_en: 'Skin Toner' },
    { brand_en: 'Skin&Lab', name_en: 'Skin Mask' },
    { brand_en: 'Skin Signal', name_en: 'Skin Pad' },
  ])], [])
  assert.deepEqual([...computeOrdinaryBrandWords([{ brand_en: null, name_en: 'Skin' }, { brand_en: 'X', name_en: null }])], [])
  // A brand stored joined and spaced is one brand when it uses someone else's word.
  assert.deepEqual([...computeOrdinaryBrandWords([
    { brand_en: 'April Skin', name_en: 'Serum' },
    { brand_en: 'Tony Moly', name_en: 'Skin Cream' },
    { brand_en: 'TONYMOLY', name_en: 'Skin Toner' },
    { brand_en: 'A1', name_en: 'Skin Mask' },
  ])], [])
  // A word in other brands' BRAND names is not product-name usage.
  assert.deepEqual([...computeOrdinaryBrandWords(['Glow A', 'Glow B', 'Glow C', 'Glow D'].map((b) => ({ brand_en: b, name_en: 'Serum' })))], [])
  // Two spellings of one brand are one brand: they neither count against their own word...
  assert.deepEqual([...computeOrdinaryBrandWords([
    { brand_en: 'Dr. Different', name_en: 'Different Cream' },
    { brand_en: 'Dr.Different', name_en: 'Different Toner' },
    { brand_en: 'DR.DIFFERENT', name_en: 'Different Serum' },
    { brand_en: 'A1', name_en: 'Different Mask' },
    { brand_en: 'B1', name_en: 'Different Pad' },
  ])], [])
  // ...nor count three times against someone else's.
  assert.deepEqual([...computeOrdinaryBrandWords([
    { brand_en: 'April Skin', name_en: 'Serum' },
    { brand_en: 'Dr. Different', name_en: 'Skin Cream' },
    { brand_en: 'Dr.Different', name_en: 'Skin Toner' },
    { brand_en: 'DR.DIFFERENT', name_en: 'Skin Serum' },
  ])], [])
})

test('wiring: smartProductSearch scores the brand through brand-match, with no substring brand test left', () => {
  const fn = sliceDecl(SRC, 'async function smartProductSearch(')
  assert.ok(!/termMatches\(brand\b/.test(fn), 'a substring brand test is back')
  assert.equal((fn.match(/brandBonusTerms\(/g) || []).length, 1)
  assert.equal((fn.match(/loadBrandCatalog\(db\)/g) || []).length, 1)
})
