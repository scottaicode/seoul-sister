/**
 * Guard test — a word joined to a number must find the catalog's spaced name.
 *
 * Oct 6 2026, production: a subscriber pasted the Olive Young link for AESTURA
 * AtoBarrier 365 Cream. Yuri searched "AtoBarrier365 Cream" three times, told
 * her the product "isn't surfacing in our catalog", and saved it as a custom
 * entry. The catalog stores "Atobarrier 365 Cream". Same failure measured for
 * joined Heartleaf 77, Derma 365, PHA 30, Molecule 300.
 *
 * Executes the real helpers (transpiled), then checks every SQL and in-memory
 * site in smartProductSearch routes through them. Live before/after replay:
 * scripts/replay-joined-alnum-search.ts
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const js = ts.transpileModule(readFileSync(join(root, 'src/lib/yuri/joined-alnum.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { joinedAlnumParts, joinedAlnumMatches, joinedAlnumIlike } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)

test('the production query matches the spaced catalog name', () => {
  assert.equal(joinedAlnumMatches('aestura atobarrier 365 cream', 'atobarrier365'), true)
  assert.equal(joinedAlnumIlike('atobarrier365'), 'atobarrier%365')
})

test('both directions and both seams', () => {
  assert.equal(joinedAlnumMatches('anua heartleaf 77 soothing toner', 'heartleaf77'), true)
  assert.equal(joinedAlnumMatches('aestura atobarrier365 cream', 'atobarrier365'), true)
  assert.deepEqual(joinedAlnumParts('1004skin'), ['1004', 'skin'])
})

test('a different number does not match', () => {
  assert.equal(joinedAlnumMatches('anua heartleaf 70 daily lotion', 'heartleaf77'), false)
  assert.equal(joinedAlnumMatches('ckd low molecular 300', 'molecule300'), false)
})

test('a number must end where the catalog number ends (10 is not 100)', () => {
  // Review Oct 16 2026: without this, "Anua PDRN10 toner" resolved to the
  // PDRN 100 toner as all_terms, which write paths accept.
  assert.equal(joinedAlnumMatches('anua pdrn 100 hyaluronic toner', 'pdrn10'), false)
  assert.equal(joinedAlnumMatches('vt reedle shot 1000 mask', 'shot100'), false)
  assert.equal(joinedAlnumMatches('missha atelo collagen 500 cream', 'collagen50'), false)
  assert.equal(joinedAlnumMatches('xatobarrier 365 cream', 'atobarrier365'), false)
  assert.equal(joinedAlnumMatches('anua pdrn 10 toner', 'pdrn10'), true)
})

test('parts must be adjacent and in order, not merely both present', () => {
  // A wrong implementation (every part anywhere) passed the first suite.
  assert.equal(joinedAlnumMatches('365 day atobarrier cream', 'atobarrier365'), false)
  assert.equal(joinedAlnumMatches('atobarrier soothing 365 cream', 'atobarrier365'), false)
  assert.equal(joinedAlnumMatches('atobarrier-365 cream', 'atobarrier365'), true)
})

// ── Behaviour: the real smartProductSearch against a fake with REAL ILIKE ──
// (the shared fakes elsewhere strip `%`, so they cannot see this fix)

const TOOLS = readFileSync(join(root, 'src/lib/yuri/tools.ts'), 'utf8')
function sliceDecl(src, sig) {
  const start = src.indexOf(sig)
  assert.ok(start > -1, `missing ${sig}`)
  let i = src.indexOf('{', src.indexOf(')', start)), depth = 0
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) break
  }
  return src.slice(start, i + 1)
}
function sliceConst(src, sig) {
  const start = src.indexOf(sig)
  assert.ok(start > -1, `missing ${sig}`)
  return src.slice(start, src.indexOf('\n])', start) + 3)
}
function sliceObj(src, sig) {
  const start = src.indexOf(sig)
  assert.ok(start > -1, `missing ${sig}`)
  return src.slice(start, src.indexOf('\n}', start) + 2)
}
const searchMod = await (async () => {
  const mod = [
    sliceConst(TOOLS, 'const SEARCH_STOP_WORDS = new Set(['),
    sliceConst(TOOLS, 'const GENERIC_PRODUCT_WORDS = new Set(['),
    sliceDecl(TOOLS, 'function singularize('),
    sliceObj(TOOLS, 'const WORD_FORM_STEMS'),
    sliceDecl(TOOLS, 'function wordFormStem('),
    sliceDecl(TOOLS, 'function normalizeTerm('),
    readFileSync(join(root, 'src/lib/yuri/joined-alnum.ts'), 'utf8').replace(/^export /gm, ''),
    sliceDecl(TOOLS, 'function ilikeTerm('),
    sliceDecl(TOOLS, 'function termMatches('),
    sliceDecl(TOOLS, 'async function smartProductSearch('),
  ].join('\n\n') + '\nexport { smartProductSearch }\n'
  const out = ts.transpileModule(mod, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(out).toString('base64'))
})()

/** PostgREST-shaped fake whose ILIKE treats `%` as "anything", like Postgres. */
function ilikeDb(rows) {
  const like = (v, p) =>
    new RegExp('^' + p.toLowerCase().split('%').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
      .test((v || '').toLowerCase())
  return {
    from() {
      let set = rows.slice(), lim = Infinity
      const q = {
        select: () => q,
        eq(c, v) { set = set.filter((r) => r[c] === v); return q },
        ilike(c, p) { set = set.filter((r) => like(r[c], p)); return q },
        or(s) {
          const preds = s.split(',').map((c) => { const [col, , ...rest] = c.split('.'); return { col, p: rest.join('.').replace(/^"|"$/g, '') } })
          set = set.filter((r) => preds.some((x) => like(r[x.col], x.p)))
          return q
        },
        order(c, o) { const d = o?.ascending === false ? -1 : 1; set = [...set].sort((a, b) => ((a[c] ?? -1e9) - (b[c] ?? -1e9)) * d); return q },
        limit(n) { lim = n; return Promise.resolve({ data: set.slice(0, lim), error: null }) },
        then(res) { return Promise.resolve({ data: set.slice(0, lim), error: null }).then(res) },
      }
      return q
    },
  }
}

const row = (id, brand, name, rating) => ({ id, brand_en: brand, name_en: name, category: 'moisturizer', is_verified: true, rating_avg: rating })
const TARGET = row('target', 'Aestura', 'Atobarrier 365 Cream', null)
// A production-sized crowd of rated creams that fills every rating-ordered window (Strategy 3 fetches 150).
const CROWD = Array.from({ length: 300 }, (_, i) => row(`c${i}`, `Brand${i}`, `Barrier Repair Cream ${i}`, 4.9))

test('brandless "AtoBarrier365 Cream" finds the unrated catalog row (the rescue)', async () => {
  const out = await searchMod.smartProductSearch(ilikeDb([...CROWD, TARGET]), 'AtoBarrier365 Cream')
  assert.equal(out[0]?.id, 'target', `got ${out.map((r) => r.name_en).slice(0, 3)}`)
})

test('the brand step does not return a different number ("Shot100" is not "Shot 1000")', async () => {
  const rows = [
    { ...row('s1000', 'VT', 'Reedle Shot 1000 Mask Sheet', 5) },
    { ...row('s100', 'VT', 'Reedle Shot 100 Essence', null) },
  ]
  const out = await searchMod.smartProductSearch(ilikeDb(rows), 'VT Reedle Shot100')
  assert.deepEqual(out.map((r) => r.id), ['s100'])
})

test('short codes stay exact (closed list: these and nothing split)', () => {
  for (const t of ['b5', 'c20', '10ml', 'no9', 'bha', 'x10', 'ab12']) {
    assert.deepEqual(joinedAlnumParts(t), [t], t)
    assert.equal(joinedAlnumMatches(`something ${t} here`, t), false, t)
  }
})

test('regex metacharacters cannot leak into the pattern', () => {
  assert.doesNotThrow(() => joinedAlnumMatches('x', 'abc12(def'))
})

test('every term site in smartProductSearch uses the seam-aware form', () => {
  const src = readFileSync(join(root, 'src/lib/yuri/tools.ts'), 'utf8')
  const start = src.indexOf('async function smartProductSearch(')
  const body = src.slice(start, src.indexOf('\nasync function ', start + 10))
  assert.doesNotMatch(body, /`%\$\{normalizeTerm\(t\)\}%`/, 'raw normalizeTerm ILIKE remains')
  assert.doesNotMatch(body, /const stem = normalizeTerm\(t\)/, 'raw OR-clause stem remains')
  assert.equal((body.match(/ilikeTerm\(t\)/g) || []).length >= 4, true)
  assert.match(src, /function ilikeTerm\(term: string\): string \{\s*return joinedAlnumIlike\(normalizeTerm\(term\)\)/)
  assert.match(src, /joinedAlnumMatches\(haystack, normalizeTerm\(term\)\)/)
  assert.match(body, /identityTokens/)
})
