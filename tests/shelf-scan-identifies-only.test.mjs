/**
 * Shelf Scan and the Routine page picker state facts and never advise
 * (Nov 13 2026).
 *
 * What happened: Shelf Scan graded a member's shelf "C, missing cleanser,
 * sunscreen, toner, exfoliator, lip_care" twenty minutes after Yuri had told
 * her to leave exfoliation out because of a precancer history. The Routine
 * page's "Add" window then listed 20 catalog products she did not own (the
 * first a BHA toner), and she added from it. Yuri caught and removed it.
 *
 * These are closed-world checks: the response and the type may carry ONE
 * collection field, so a new verdict field fails here (and fails `tsc`, which
 * holds the route to the type with `satisfies`). The picker test runs the
 * real search function.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const SHELF_PROMPT_FINGERPRINT = '33c9d60a08e2ea0ef9e8c3639c3f36241b2ed993bc81225cfbeb8b1cb25ef67c'

/** Body of `interface Name { ... }` or of the object literal after `marker`. */
function braceBody(src, marker) {
  const at = src.indexOf(marker)
  assert.ok(at >= 0, `not found: ${marker}`)
  const open = src.indexOf('{', at)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i)
  }
  throw new Error(`unbalanced after ${marker}`)
}
const keys = (body) => [...body.matchAll(/^\s*([A-Za-z_]+)\??\s*:/gm)].map((m) => m[1])

test('the collection type carries one fact and nothing else', () => {
  assert.deepEqual(keys(braceBody(read('src/types/database.ts'), 'export interface ShelfScanCollectionAnalysis')), ['total_estimated_value'])
})

test('the route returns one collection field, held to the type, and never spreads the model output', () => {
  const route = read('src/app/api/shelf-scan/route.ts')
  const body = braceBody(route, 'collection_analysis: {\n        total_estimated_value: Math.round')
  assert.deepEqual(keys(body), ['total_estimated_value'])
  assert.ok(!body.includes('...'), 'spreading the model output would return whatever it chose to add')
  assert.match(route, /\} satisfies ShelfScanCollectionAnalysis,/)
  assert.ok(!/\.\.\.analysis\b/.test(route), 'the raw model object must never be spread into a response')
})

test('the response has exactly the fields the page reads', () => {
  const route = read('src/app/api/shelf-scan/route.ts')
  const body = braceBody(route, 'return NextResponse.json({\n      success: true,')
  // EVERY line at the top level of the object must be `key: ...` or the close
  // of the nested object: a shorthand key (`recommendations,`) or a spread
  // (`...verdict,`) has no colon and fails here.
  const lines = body.split('\n').filter((l) => /^ {6}\S/.test(l))
  const stray = lines.filter((l) => !/^ {6}[a-z_]+: /.test(l) && !/^ {6}\} satisfies ShelfScanCollectionAnalysis,$/.test(l))
  assert.deepEqual(stray, [])
  const top = lines.map((l) => l.match(/^ {6}([a-z_]+):/)?.[1]).filter(Boolean)
  assert.deepEqual(top, ['success', 'products_identified', 'collection_analysis', 'products_count', 'matched_count', 'already_owned_count', 'allergies_on_profile'])
})

test('only five named fields are read from each product the model returns', () => {
  const route = read('src/app/api/shelf-scan/route.ts')
  const a = route.indexOf('const identified = (analysis.products_identified ?? []).map((raw) => ({')
  assert.ok(a > 0)
  const mapper = route.slice(a, route.indexOf('})).filter(', a) + 3)
  assert.deepEqual(keys(mapper), ['name', 'brand', 'category', 'confidence', 'position_in_image'])
  assert.ok(!mapper.includes('...'), 'spreading the raw product would pass through anything the model invents')
  // Run it: an invented note and a non-string name do not survive.
  const js = ts.transpileModule(`const analysis = INPUT; ${mapper.replace(/\)$/, '')}); OUT = identified`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const out = new Function('INPUT', `let OUT; ${js}; return OUT`)({ products_identified: [
    { name: 'Toner', brand: 'B', category: 'toner', confidence: 0.9, position_in_image: 'left', note: 'redundant, replace with X', grade: 'C' },
    { name: { advice: 'buy an exfoliator' } },
  ] })
  assert.deepEqual(out, [
    { name: 'Toner', brand: 'B', category: 'toner', confidence: 0.9, position_in_image: 'left' },
    { name: '', brand: '', category: '', confidence: 0, position_in_image: '' },
  ])
  assert.equal((route.match(/analysis\.products_identified/g) ?? []).length, 1, 'the raw list is read once, by the mapper')
})

test('the instruction to the model is pinned: identification only', () => {
  const route = read('src/app/api/shelf-scan/route.ts')
  const a = route.indexOf('const SHELF_SCAN_SYSTEM_PROMPT = `')
  const prompt = route.slice(a, route.indexOf('}`', a) + 2)
  // Changing a word of this prompt means a second-model review, then a new fingerprint.
  assert.equal(createHash('sha256').update(prompt).digest('hex'), SHELF_PROMPT_FINGERPRINT)
  assert.match(route, /system: SHELF_SCAN_SYSTEM_PROMPT,/)
  assert.equal((route.match(/messages\.create\(/g) ?? []).length, 1)
})

test('a product that was not checked for allergies is never shown as clear', async () => {
  const route = read('src/app/api/shelf-scan/route.ts')
  const a = route.indexOf('async function checkAllergens(')
  const fn = route.slice(a, route.indexOf('// ----', a))
  const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const make = (result) => new Function('getServiceClient', 'console', `${js}; return checkAllergens`)(
    () => ({ from: () => ({ select: () => ({ eq: () => Promise.resolve(result) }) }) }), { error() {} })
  assert.deepEqual(await make({ data: null, error: { message: 'boom' } })('p', ['fragrance']), { checked: false, warnings: [] })
  assert.deepEqual(await make({ data: [], error: null })('p', ['fragrance']), { checked: false, warnings: [] })
  assert.deepEqual(await make({ data: [{ ingredient: { name_en: 'Water' } }], error: null })('p', ['fragrance']), { checked: true, warnings: [] })
  const hit = await make({ data: [{ ingredient: { name_en: 'Fragrance' } }], error: null })('p', ['fragrance'])
  assert.equal(hit.checked, true)
  assert.equal(hit.warnings.length, 1)
  // The page says so, for a member who has allergies on file.
  assert.match(read('src/components/shelf-scan/CollectionGrid.tsx'), /\{allergiesOnProfile > 0 && !product\.allergens_checked && \(\s*<p[^>]*>\s*Not checked against your allergies/)
  assert.match(route, /const unmatched = \{ matched_product_id: null, allergen_warnings: \[\], allergens_checked: false \}/)
})

test('the page renders products and facts, and hands the list to Yuri with no verdict in it', () => {
  const page = read('src/app/(app)/shelf-scan/page.tsx')
  // Every read of the analysis object on the page and in the stats component.
  const reads = [page, read('src/components/shelf-scan/CollectionStats.tsx')]
    .flatMap((src) => [...src.matchAll(/(?:collection_analysis|analysis)\.([a-z_]+)/g)].map((m) => m[1]))
  assert.deepEqual([...new Set(reads)], ['total_estimated_value'])
  assert.ok(!existsSync(join(ROOT, 'src/components/shelf-scan/RoutineGrade.tsx')))

  // Run the real message builder.
  const fn = page.slice(page.indexOf('function askYuriAboutShelf'), page.indexOf('export default function ShelfScanPage'))
  const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const ask = new Function(`${js}; return askYuriAboutShelf`)()
  const msg = ask([
    { brand: 'COSRX', name: 'The Ceramide Skin Barrier Moisturizer', category: 'moisturizer' },
    { brand: '', name: 'Neova Everyday Broad Spectrum', category: 'sunscreen' },
  ])
  assert.equal(msg, 'I just scanned my skincare shelf. It found: COSRX The Ceramide Skin Barrier Moisturizer; Neova Everyday Broad Spectrum. What do you make of it for my skin?')
  assert.equal(ask([]), 'I just scanned my skincare shelf. What do you make of it for my skin?')
  // The only route out of the results is that message or another scan.
  const ra = page.indexOf('{result && ('), rb = page.indexOf('{/* Upload UI')
  assert.ok(ra > 0 && rb > ra, 'the results region must be found, or this check covers nothing')
  const results = page.slice(ra, rb)
  assert.equal((results.match(/href=/g) ?? []).length, 1)
  assert.match(results, /href=\{`\/yuri\?ask=\$\{encodeURIComponent\(askYuriAboutShelf\(result\.products_identified\)\)\}`\}/)
  assert.ok(!/useRouter|router\.|window\.location|location\.href/.test(page), 'no navigation other than the one link')

  // SHAPE, not a word list: the three files that draw the results may not say
  // what a shelf lacks, rate it, or tell the member what to do. Comments are
  // stripped; the one sentence that says the page does NOT judge is allowed.
  const VERDICT = /\b(missing|lacks?|gaps?|grade[sd]?|rating|score[sd]?|redundan\w*|overlap\w*|recommend\w*|suggest\w*|should|need(s|ed)?|consider|upgrade|replace (it|this|them|with)|swap|add (a|an|some)\b)/i
  for (const f of ['src/app/(app)/shelf-scan/page.tsx', 'src/components/shelf-scan/CollectionStats.tsx', 'src/components/shelf-scan/CollectionGrid.tsx']) {
    const text = read(f).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      // Styling is not copy: Tailwind's `gap-2` is not a gap in a shelf.
      .replace(/className=("[^"]*"|\{`[^`]*`\})/g, '')
    const hits = text.split('\n').filter((l) => VERDICT.test(l))
    assert.deepEqual(hits, [], `${f} states a verdict or an instruction`)
    // No list of categories a shelf "ought" to have can be compared against.
    assert.ok(!/\[\s*['"](cleanser|toner|sunscreen|moisturizer|serum|exfoliator)['"]\s*,/.test(text.replace(/CATEGORY_LABELS[\s\S]*?\n\}/, '')), `${f} holds a category checklist`)
  }
  // Nothing new draws results: the folder holds exactly these two components.
  assert.deepEqual(readdirSync(join(ROOT, 'src/components/shelf-scan')).sort(), ['CollectionGrid.tsx', 'CollectionStats.tsx'])
})

test('the Routine picker shows no catalog product until the member types a search', async () => {
  const src = read('src/components/routine/AddProductModal.tsx')
  const a = src.indexOf('const searchProducts = useCallback(async (searchQuery: string) => {')
  const b = src.indexOf('}, [existingProductIds])', a)
  assert.ok(a > 0 && b > a)
  const body = src.slice(src.indexOf('{', a + 60), b + 1)
  const js = ts.transpileModule(`async function run(searchQuery: string) ${body}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const sanitizer = ts.transpileModule(read('src/lib/utils/sanitize-search.ts').replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

  async function run(query) {
    const calls = []
    let shown = null
    const chain = {
      from: (t) => (calls.push(['from', t]), chain),
      select: () => chain,
      eq: () => chain,
      or: (f) => (calls.push(['or', f]), chain),
      order: (c, o) => (calls.push(['order', c, o]), chain),
      limit: () => Promise.resolve({ data: [{ id: 'x' }, { id: 'in-routine' }], error: null }),
    }
    const make = new Function('supabase', 'setProducts', 'setSearchFailed', 'setLoading', 'existingProductIds', 'console',
      `${sanitizer}; ${js}; return run`)
    await make(chain, (v) => { shown = v }, () => {}, () => {}, ['in-routine'], { error() {} })(query)
    return { calls, shown }
  }

  for (const empty of ['', '   ', ',,', '()']) {
    const { calls, shown } = await run(empty)
    assert.deepEqual(calls, [], `"${empty}" must not query the catalog`)
    assert.deepEqual(shown, [])
  }
  const { calls, shown } = await run('no.9')
  assert.deepEqual(calls[0], ['from', 'ss_products'])
  assert.deepEqual(calls[1], ['or', 'name_en.ilike."%no.9%",brand_en.ilike."%no.9%"'])
  assert.deepEqual(calls[2], ['order', 'rating_avg', { ascending: false, nullsFirst: false }])
  assert.deepEqual(shown, [{ id: 'x' }])
  // A typed % or _ is searched literally: the LIKE escape survives PostgREST's quoting.
  assert.deepEqual((await run('100%')).calls[1], ['or', 'name_en.ilike."%100\\\\%%",brand_en.ilike."%100\\\\%%"'])
})

test('the picker has one catalog query, and draws catalog rows only under a typed search', () => {
  const src = read('src/components/routine/AddProductModal.tsx')
  // One read of the catalog in the whole file (the search), one writer of the list besides the two resets.
  assert.equal((src.match(/\.from\('ss_products'\)/g) ?? []).length, 1)
  assert.equal((src.match(/setProducts\(/g) ?? []).length, 3)
  assert.equal((src.match(/products\.map\(/g) ?? []).length, 1)
  // The branch order in the list: loading, failed, EMPTY BOX, no matches, then rows.
  const a = src.indexOf('{loading ? (')
  const order = ['{loading ? (', ') : searchFailed ? (', ') : !query.trim() ? (', ') : products.length === 0 ? (', 'products.map((product) => (']
  let at = a
  for (const marker of order) {
    const next = src.indexOf(marker, at)
    assert.ok(next >= at && next >= 0, `branch missing or out of order: ${marker}`)
    at = next
  }
  // Section headings in the window: the member's own products, and nothing else.
  const headings = [...src.matchAll(/uppercase tracking-wider">([^<]+)</g)].map((m) => m[1])
  assert.deepEqual(headings, ['Your Products'])
})
