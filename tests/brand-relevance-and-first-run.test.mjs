/**
 * Guard tests — three defects Bailey hit on Aug 1 2026 while screen-recording
 * for TikTok ("She's messing up my screen recordings 🤦‍♀️").
 *
 * 1. BRAND HIJACK IN THE FALLBACK SEARCH
 *    She uploaded a photo of the "Medicube PDRN Pink Collagen Volume Multi Balm
 *    Stick". We don't carry that exact SKU — fine — but the search returned four
 *    unrelated Bushman/TONEfitSUN/Mixsoon SUN STICKS whose only overlap was the
 *    word "stick" (1 of 8 terms), while 20 real Medicube rows sat in the
 *    catalog. Yuri had to open with "that match is wrong, the database pulled up
 *    a Mixsoon sun stick".
 *
 *    Two causes, both required for the fix:
 *      (a) the last-resort strategy ordered ANY-term matches by `rating_avg`, a
 *          popularity signal unrelated to whether the row is what was asked for;
 *      (b) it applied `LIMIT 10` SERVER-SIDE, before anything could be scored —
 *          measured, that window contained ZERO Medicube rows, so no amount of
 *          re-ranking could recover them.
 *
 * 2. "YOU HAVEN'T TRIED THIS YET" ABOVE HER OWN SCAN HISTORY
 *    The discovery banner counted scans since the 1st of the current month while
 *    its headline claims first-run. On Aug 1 her July 26 + July 29 scans fell
 *    outside the window, so the banner told a user who had scanned twice that
 *    she'd never tried it — directly above the Recent Scans list showing both.
 *
 * 3. A CORRECTED FACT WITH A LIVE CONTRADICTING INSTRUCTION
 *    See tests/…/decision-correction-precedence below.
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
const BANNER = join(root, 'src', 'components', 'dashboard', 'ScannerDiscoveryBanner.tsx')
const MEMORY = join(root, 'src', 'lib', 'yuri', 'memory.ts')

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
    sliceDecl(src, 'function singularize('),
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
            return { col, pattern }
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

const MEDICUBE = Array.from({ length: 6 }, (_, i) => ({
  id: `medicube-${i}`,
  brand_en: 'Medicube',
  name_en: `PDRN Pink Collagen ${['Capsule Cream', 'Toning Gel Toner Pads', 'Glow Jelly Mist Serum', 'Bubble Serum', 'One Day Serum', 'Cica Soothing Toner'][i]}`,
  category: 'moisturizer',
  is_verified: true,
  rating_avg: 4.2,
}))

// Rating-tied sun sticks that crowded out the real brand in production.
const STICKS = Array.from({ length: 30 }, (_, i) => ({
  id: `stick-${i}`,
  brand_en: ['Bushman', 'TONEfitSUN', 'Mixsoon', 'Benton'][i % 4],
  name_en: `Waterproof Sun Stick variant ${i}`,
  category: 'sunscreen',
  is_verified: true,
  rating_avg: 5.0,
}))

test('the fallback search degrades toward the right BRAND, not a popular stranger', async () => {
  const { smartProductSearch } = await loadSearch()
  // Sticks first: they win every rating-ordered window.
  const db = fakeDb([...STICKS, ...MEDICUBE])

  const results = await smartProductSearch(
    db, 'Medicube PDRN Pink Collagen Volume Multi Balm Stick', { limit: 5 }
  )

  assert.ok(results.length > 0, 'expected results')
  assert.equal(
    results[0].brand_en, 'Medicube',
    `the top hit must be the brand the user named, not a higher-rated unrelated product. Got: ${results[0].brand_en} | ${results[0].name_en}`
  )
  const strangers = results.filter((r) => r.brand_en !== 'Medicube')
  assert.equal(
    strangers.length, 0,
    `no unrelated brand should appear above real brand matches. Got: ${strangers.map((s) => s.brand_en).join(', ')}`
  )
})

test('the fallback over-fetches so ranking has the real candidates', () => {
  const src = readFileSync(TOOLS, 'utf8')
  const fn = sliceDecl(src, 'async function smartProductSearch(')

  // The final strategy must not cap at the caller's limit before scoring —
  // that is what made the correct rows unreachable regardless of ranking.
  const tail = fn.slice(fn.lastIndexOf('Strategy 3'))
  assert.ok(
    /\.limit\(\s*Math\.max\(/.test(tail),
    'Strategy 3 must over-fetch (Math.max(...)) before ranking, not LIMIT to the caller value'
  )
  assert.ok(
    /slice\(0,\s*limit\)/.test(tail),
    'after ranking it must trim back to the caller-requested limit'
  )
})

test('brand matches outweigh generic noun matches', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    { id: 'a', brand_en: 'Bushman', name_en: 'Sun Stick', category: 'sunscreen', is_verified: true, rating_avg: 5.0 },
    { id: 'b', brand_en: 'Medicube', name_en: 'Zero Pore Pad', category: 'toner', is_verified: true, rating_avg: 1.0 },
  ])

  // "stick" matches a's NAME; "medicube" matches b's BRAND. Brand must win
  // despite a's far better rating.
  const results = await smartProductSearch(db, 'Medicube Balm Stick', { limit: 5 })
  assert.equal(results[0].id, 'b', 'a brand-term match must outrank a generic-noun match')
})

test('the scanner discovery banner keys on first-run, not the calendar month', () => {
  const src = readFileSync(BANNER, 'utf8')

  assert.ok(
    !/setDate\(1\)/.test(src),
    'the banner must not scope its scan count to the current calendar month — that told a user with 2 scans that she had never tried it'
  )
  assert.ok(
    !/periodStart/.test(src),
    'no billing-period window should remain in a first-run banner'
  )
  // The count must still be user-scoped and must not treat a failure as zero.
  assert.match(src, /\.eq\('user_id', user\.id\)/, 'count must be scoped to the user')
  assert.match(src, /if \(error\)/, 'a failed count must not render as "never scanned"')
})

test('a corrected fact takes precedence over a stale decision', () => {
  const src = readFileSync(MEMORY, 'utf8')

  // Renderer: a static framing line, NOT a per-row classifier. A fuzzy matcher
  // was measured against live data first — 23% precision historically, 0% at
  // render time — and discarded rather than tuned.
  const header = src.slice(src.indexOf('### Active Decisions') - 400, src.indexOf('### Active Decisions') + 400)
  assert.match(
    header, /the correction wins/,
    'the Active Decisions block must state that a correction outranks a decision about the same fact'
  )

  // Extraction: the durable fix — reconcile where the model has full context.
  assert.match(
    src, /RECONCILE DECISIONS AGAINST THE CORRECTIONS/,
    'the extraction prompt must ask the model to reconcile decisions against corrections in the same pass'
  )
  assert.match(
    src, /Beplain Makiol/,
    'the extraction prompt should carry the concrete failure so the instruction is unambiguous'
  )
  // It must protect remediation decisions, which a naive rule would destroy.
  assert.match(
    src, /is the remediation, not a contradiction/,
    'the instruction must tell the model NOT to drop decisions that are themselves the fix'
  )
})
