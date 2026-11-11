/**
 * The product resolver's verdict ('exact' | 'all_terms' | 'partial').
 *
 * Why the verdict matters: write paths accept 'exact' and 'all_terms' and
 * refuse 'partial'. A false 'partial' saves a real catalog product as a custom
 * entry, which takes it out of ingredient-conflict checking. A false confident
 * verdict writes a product nobody named.
 *
 * Nov 2026: a term now ALSO matches when it names the brand under the
 * brand-match rule ("drjart", "anua's", "tony moly" for TONYMOLY). It is a
 * union with the old substring test, never a replacement: a stricter
 * replacement was tried, and a second-model review measured it moving five
 * correctly named products to 'partial'. Those five are pinned below.
 *
 * Every test EXECUTES the real resolveProductByName and describeResolution,
 * cut from tools.ts, against a stub catalog. (tests/product-resolver-ranking
 * runs a hand-written mirror of the ranking; this file runs the real thing.)
 */

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(join(root, 'src/lib/yuri/tools.ts'), 'utf8')

function braceEnd(src, open) {
  let d = 0, j = open
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  return j
}
function sliceDecl(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  let pd = 0, i = src.indexOf('(', start)
  for (; i < src.length; i++) {
    if (src[i] === '(') pd++
    else if (src[i] === ')') { pd--; if (!pd) break }
  }
  return src.slice(start, braceEnd(src, src.indexOf('{', i)) + 1)
}
/** A function whose return type contains braces: the body starts after "> {". */
function sliceTypedDecl(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const open = src.indexOf('> {\n', start) + 2
  assert.ok(open > start + 2)
  return src.slice(start, braceEnd(src, open) + 1)
}
function sliceBracket(src, signature, open, close) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  let d = 0, i = src.indexOf(open, start)
  for (; i < src.length; i++) {
    if (src[i] === open) d++
    else if (src[i] === close) { d--; if (!d) break }
  }
  return src.slice(start, src.indexOf('\n', i))
}

const mod = [
  sliceBracket(SRC, 'const SEARCH_STOP_WORDS = new Set([', '[', ']'),
  sliceBracket(SRC, 'const GENERIC_PRODUCT_WORDS = new Set([', '[', ']'),
  sliceDecl(SRC, 'function hasIdentifyingTerm('),
  sliceDecl(SRC, 'function singularize('),
  sliceBracket(SRC, 'const WORD_FORM_STEMS', '{', '}'),
  sliceDecl(SRC, 'function wordFormStem('),
  sliceDecl(SRC, 'function normalizeTerm('),
  sliceDecl(SRC, 'export function joinLineNumbers(').replace(/^export /, ''),
  readFileSync(join(root, 'src/lib/yuri/joined-alnum.ts'), 'utf8').replace(/^export /gm, ''),
  readFileSync(join(root, 'src/lib/yuri/brand-match.ts'), 'utf8').replace(/^export /gm, ''),
  sliceDecl(SRC, 'function ilikeTerm('),
  sliceDecl(SRC, 'function termMatches('),
  sliceDecl(SRC, 'async function smartProductSearch('),
  sliceTypedDecl(SRC, 'async function resolveProductByName('),
  sliceDecl(SRC, 'function describeResolution('),
].join('\n\n') + '\nexport { resolveProductByName, describeResolution, resetBrandCatalogCache }\n'
const js = ts.transpileModule(mod, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText
const M = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

beforeEach(() => M.resetBrandCatalogCache())

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
function fakeDb(rows) {
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
  return {
    from() {
      let set = rows.slice()
      let lim = Infinity
      const q = {
        select: () => q,
        eq(c, v) { set = set.filter((r) => r[c] === v); return q },
        in(c, vals) { set = set.filter((r) => vals.includes(r[c])); return q },
        ilike(c, p) { set = set.filter((r) => like(r[c], p)); return q },
        or(clauses) {
          const preds = splitOr(clauses).map((c) => {
            const m = /^([^.]+)\.([^.]+)\.(.*)$/.exec(c)
            return { col: m ? m[1] : c, pattern: (m ? m[3] : '').replace(/"/g, '') }
          })
          set = set.filter((r) => preds.some((p) => like(r[p.col], p.pattern)))
          return q
        },
        order(col, o) {
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
        range(a, b) { return Promise.resolve({ data: set.slice(a, b + 1), error: null, count: set.length }) },
        then(res) { return Promise.resolve({ data: set.slice(0, lim), error: null }).then(res) },
      }
      return q
    },
  }
}

let seq = 0
const row = (brand_en, name_en, rating_avg = 4.0) => ({ id: `p${seq++}`, brand_en, name_en, category: 'x', is_verified: true, rating_avg })
const verdict = async (rows, name) => {
  M.resetBrandCatalogCache()
  const m = await M.resolveProductByName(fakeDb(rows), name)
  return m ? `${m.brand_en} | ${m.name_en} [${m.match_quality}]` : null
}

const CATALOG = [
  row('Physiogel', 'Red Soothing Cica Balance Cream', 5.0),
  row('Aestura', 'A-Cica 365 Soothing Gel Cream', 4.0),
  row('COSNORI', 'Barrier Cream', 5.0),
  row('Dear, Klairs', 'Supple Preparation Unscented Toner', 4.0),
  row('Some By Mi', 'AHA, BHA, PHA 30 Days Miracle Toner', 4.0),
  row('Dr. Jart+', 'Cicapair Tiger Grass Cream', 4.0),
  row('Beauty of Joseon', 'Relief Sun Rice + Probiotics', 4.0),
  row('SKIN1004', 'Madagascar Centella Ampoule', 4.0),
  row("It's Skin", 'Power 10 Formula VC Effector', 4.0),
  row('TONYMOLY', 'Wonder Ceramide Mocchi Toner', 4.0),
  row('ma:nyo', 'Bifida Biome Complex Ampoule', 4.0),
  row('Etude', 'SoonJung 2x Barrier Intensive Cream', 4.0),
  row('Numbuzin', 'No. 3 Skin Softening Serum', 4.0),
  row('Numbuzin', 'No. 5 Vitamin Concentrated Serum', 4.5),
  row('VT', 'Reedle Shot 100 Essence', 4.0),
  row('Some By Mi', 'AHA BHA PHA 30 Days Miracle Serum', 4.0),
  row('Apieu', 'Madecassoside Cica Gel', 4.0),
  row('Isntree', 'Hyaluronic Acid Toner Plus', 4.0),
]

test('nothing that was confident before the brand rule became partial (the five measured regressions)', async () => {
  const rows = [
    row('TonyMoly', 'Tako Pore Blackhead Scrub Stick'),
    row('CNP Laboratory', 'Propolis Energy Ampule'),
    row('Klairs', 'Rich Moist Soothing Cream'),
    row('Too Cool For School', 'Egg Cream Mask Sheet'),
    row('Numbuzin', 'No. 3 Skin Softening Serum'),
    row('Round Lab', '1025 Dokdo Lotion'),
  ]
  assert.equal(await verdict(rows, 'Tony Tako Pore Blackhead Scrub Stick'), 'TonyMoly | Tako Pore Blackhead Scrub Stick [all_terms]')
  assert.equal(await verdict(rows, 'CNP Lab Propolis Energy Ampule'), 'CNP Laboratory | Propolis Energy Ampule [all_terms]')
  assert.equal(await verdict(rows, 'Klair Rich Moist Soothing Cream'), 'Klairs | Rich Moist Soothing Cream [all_terms]')
  assert.equal(await verdict(rows, 'Too Cool Egg Cream Mask Sheet'), 'Too Cool For School | Egg Cream Mask Sheet [all_terms]')
  assert.equal(await verdict(rows, 'Numbuzins No.3 Skin Softening Serum'), 'Numbuzin | No. 3 Skin Softening Serum [all_terms]')
  assert.equal(await verdict(rows, 'Round Labs 1025 Dokdo Lotion'), 'Round Lab | 1025 Dokdo Lotion [all_terms]')
})

test('a brand typed as one word resolves to the product named, not a set that contains its words', async () => {
  // Measured live: "Roundlab 1025 Dokdo Lotion" became 'all_terms' for the
  // Toner + Lotion SET, because the plain lotion was outside the rating
  // window. The named brand's rows are now always candidates.
  const rows = [
    ...Array.from({ length: 80 }, (_, i) => row(`Crowd${i % 7}`, `1025 Dokdo Lotion Filler ${i}`, 5.0)),
    row('Round Lab', '1025 Dokdo Toner + Lotion Special Set', 4.9),
    row('Round Lab', '1025 Dokdo All In One Gel Lotion', 4.8),
    row('Round Lab', '1025 Dokdo Lotion', 1.0),
  ]
  assert.equal(await verdict(rows, 'Roundlab 1025 Dokdo Lotion'), 'Round Lab | 1025 Dokdo Lotion [all_terms]')
  assert.equal(await verdict(rows, 'Round Lab 1025 Dokdo Lotion'), 'Round Lab | 1025 Dokdo Lotion [exact]')
})

test('with more all-terms products than the resolver asks for, the closest fit is among them', async () => {
  // Measured live: "Skin Food Mask Sheet" resolved 'all_terms' to Daily Mask
  // Sheet. The exact "Mask Sheet" was 16th of 22 by rating and the resolver
  // is handed 10.
  const kinds = ['Daily', 'Rice', 'Honey', 'Tomato', 'Avocado', 'Peach', 'Carrot', 'Potato', 'Lemon', 'Banana', 'Berry', 'Cucumber', 'Pear', 'Yuja', 'Fig']
  const rows = [
    ...kinds.map((k, i) => row('Skinfood', `${k} Mask Sheet`, 5.0 - i * 0.01)),
    row('Skinfood', 'Mask Sheet', 4.0),
    ...kinds.slice(0, 6).map((k) => row('Skinfood', `${k} Sleeping Mask Sheet`, 3.9)),
  ]
  for (const typed of ['Skin Food Mask Sheet', "Skinfood's Mask Sheet", 'Skinfood Mask Sheet']) {
    assert.match(await verdict(rows, typed), /^Skinfood \| Mask Sheet \[(exact|all_terms)\]$/, typed)
  }
})

test('known and unchanged: a term that only sits inside the brand string still counts in the verdict', async () => {
  // "gel" is inside Physio-gel. This was so before Nov 2026 and is left alone
  // here, because tightening it is what broke the five names above. With the
  // right product in the catalog, the right product is chosen.
  assert.equal(await verdict(CATALOG, 'cica gel cream'), 'Aestura | A-Cica 365 Soothing Gel Cream [all_terms]')
  assert.equal(await verdict([CATALOG[0]], 'cica gel cream'), 'Physiogel | Red Soothing Cica Balance Cream [all_terms]')
})

test('a product the person named keeps its confident verdict, however the brand is typed', async () => {
  const cases = [
    ['Physiogel Red Soothing Cica Balance Cream', 'Physiogel | Red Soothing Cica Balance Cream [exact]'],
    ['physiogel cica cream', 'Physiogel | Red Soothing Cica Balance Cream [all_terms]'],
    ['Dear, Klairs Supple Preparation Unscented Toner', 'Dear, Klairs | Supple Preparation Unscented Toner [exact]'],
    ['Dear Klairs Supple Preparation Unscented Toner', 'Dear, Klairs | Supple Preparation Unscented Toner [exact]'],
    ['Klairs Supple Preparation Unscented Toner', 'Dear, Klairs | Supple Preparation Unscented Toner [exact]'],
    ['klairs unscented toner', 'Dear, Klairs | Supple Preparation Unscented Toner [all_terms]'],
    ['Some By Mi AHA, BHA, PHA 30 Days Miracle Toner', 'Some By Mi | AHA, BHA, PHA 30 Days Miracle Toner [exact]'],
    ['Some By Mi AHA BHA PHA 30 Days Miracle Toner', 'Some By Mi | AHA, BHA, PHA 30 Days Miracle Toner [exact]'],
    ['Dr. Jart+ Cicapair Tiger Grass Cream', 'Dr. Jart+ | Cicapair Tiger Grass Cream [exact]'],
    ['Dr Jart Cicapair Cream', 'Dr. Jart+ | Cicapair Tiger Grass Cream [all_terms]'],
    ["A'pieu Madecassoside Cica Gel", 'Apieu | Madecassoside Cica Gel [all_terms]'],
    ["Isn'tree Hyaluronic Acid Toner Plus", 'Isntree | Hyaluronic Acid Toner Plus [all_terms]'],
    ['Dr.Jart+ cicapair tiger grass cream', 'Dr. Jart+ | Cicapair Tiger Grass Cream [exact]'],
    ['jart cicapair cream', 'Dr. Jart+ | Cicapair Tiger Grass Cream [all_terms]'],
    ['Beauty of Joseon Relief Sun', 'Beauty of Joseon | Relief Sun Rice + Probiotics [exact]'],
    ['joseon relief sun', 'Beauty of Joseon | Relief Sun Rice + Probiotics [exact]'],
    ['joseon sun probiotics', 'Beauty of Joseon | Relief Sun Rice + Probiotics [all_terms]'],
    ['skin1004 centella ampoule', 'SKIN1004 | Madagascar Centella Ampoule [all_terms]'],
    ['skin 1004 centella ampoule', 'SKIN1004 | Madagascar Centella Ampoule [all_terms]'],
    ["It's Skin Power 10 Formula VC Effector", "It's Skin | Power 10 Formula VC Effector [exact]"],
    ['its skin power 10 vc effector', "It's Skin | Power 10 Formula VC Effector [all_terms]"],
    ["it's skin vc effector", "It's Skin | Power 10 Formula VC Effector [all_terms]"],
    ['Some By Mi AHA, BHA, PHA 30 Days Miracle Serum', 'Some By Mi | AHA BHA PHA 30 Days Miracle Serum [exact]'],
    ['tony moly wonder ceramide toner', 'TONYMOLY | Wonder Ceramide Mocchi Toner [all_terms]'],
    ['Tonymoly Wonder Ceramide Mocchi Toner', 'TONYMOLY | Wonder Ceramide Mocchi Toner [exact]'],
    ['manyo bifida ampoule', 'ma:nyo | Bifida Biome Complex Ampoule [all_terms]'],
    ['Ma:nyo Bifida Biome Complex Ampoule', 'ma:nyo | Bifida Biome Complex Ampoule [exact]'],
    ['etude soonjung barrier cream', 'Etude | SoonJung 2x Barrier Intensive Cream [all_terms]'],
    ['numbuzin no.3 serum', 'Numbuzin | No. 3 Skin Softening Serum [all_terms]'],
    ['Numbuzin No 5 serum', 'Numbuzin | No. 5 Vitamin Concentrated Serum [all_terms]'],
    ['VT reedle shot 100', 'VT | Reedle Shot 100 Essence [exact]'],
    ['vt shot 100 essence', 'VT | Reedle Shot 100 Essence [all_terms]'],
    ['reedle shot 100 essence', 'VT | Reedle Shot 100 Essence [exact]'],
  ]
  for (const [typed, want] of cases) {
    assert.equal(await verdict(CATALOG, typed), want, typed)
  }
})

test('a word the product does not carry still makes the verdict partial', async () => {
  // A wrong brand, an extra descriptor, and a brand that is only similar.
  assert.equal(await verdict(CATALOG, 'Anua Cicapair Tiger Grass Cream'), 'Dr. Jart+ | Cicapair Tiger Grass Cream [partial]')
  assert.equal(await verdict(CATALOG, 'Klairs Supple Preparation Unscented Toner 180ml'), 'Dear, Klairs | Supple Preparation Unscented Toner [partial]')
  assert.equal(await verdict(CATALOG, 'Etude House SoonJung 2x Barrier Intensive Cream'), 'Etude | SoonJung 2x Barrier Intensive Cream [partial]')
  assert.equal(await verdict(CATALOG, 'Laneige Red Soothing Cica Balance Cream'), 'Physiogel | Red Soothing Cica Balance Cream [partial]')
})

test('describeResolution names exactly the words that failed to line up', () => {
  const d = (requested, brand_en, name_en) => M.describeResolution(requested, { brand_en, name_en, match_quality: 'partial' }).unmatched_terms
  // The substring half still counts: "tony" is inside TonyMoly, "lab" inside Laboratory.
  assert.deepEqual(d('tony tako scrub serum', 'TonyMoly', 'Tako Pore Blackhead Scrub Stick'), ['serum'])
  assert.deepEqual(d('cnp lab propolis toner', 'CNP Laboratory', 'Propolis Energy Ampule'), ['toner'])
  // A brand the substring test could not see is no longer reported as missing.
  assert.deepEqual(d('drjart cicapair serum', 'Dr. Jart+', 'Cicapair Tiger Grass Cream'), ['serum'])
  assert.deepEqual(d("anua's heartleaf serum", 'Anua', 'Heartleaf 77 Toner'), ['serum'])
  assert.deepEqual(d('tony moly wonder cream', 'TONYMOLY', 'Wonder Ceramide Mocchi Toner'), ['cream'])
  assert.deepEqual(d('Melixir Vegan Daily Skin Tint SPF50+', 'Melixir', 'Daily Skin Tint Sunscreen SPF50+ 50ml #23 Light Neutral'), ['vegan'])
  assert.deepEqual(d('Some By Mi AHA, BHA, PHA Miracle Serum', 'Some By Mi', 'AHA BHA PHA 30 Days Miracle Toner'), ['serum'])
  assert.deepEqual(d('Anua Cicapair Cream', 'Dr. Jart+', 'Cicapair Tiger Grass Cream'), ['anua'])
  assert.deepEqual(d('dr jart cicapair serum', 'Dr. Jart+', 'Cicapair Tiger Grass Cream'), ['serum'])
})
