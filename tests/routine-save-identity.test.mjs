/**
 * Three things the owner's own walkthrough found on Nov 11 2026, each of which
 * decides whether Yuri's allergy and conflict checks can be trusted.
 *
 * 1. get_product_details fetched the whole ingredient list and then returned
 *    NOTHING past the 20th: the tail read `name_en ?? name_inci` off entries
 *    that only have `name`. Yuri told a member with a fragrance allergy she
 *    "could only see the first 20 ingredients"; the sunscreen listed Fragrance
 *    after them. A source-text test had been passing over this for months.
 * 2. A step called "Salicylic acid foaming cleanser" (no brand) was tied to
 *    Jumiso's product, because every word fits. A description is not an identity.
 * 3. A cream Yuri had only recommended was put on the member's shelf as active
 *    and shown as "Owned".
 *
 * Every behaviour test EXECUTES the real code cut from src/lib/yuri/tools.ts.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const TOOLS = read('src/lib/yuri/tools.ts')
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const BM = await import('data:text/javascript;base64,' + Buffer.from(js(read('src/lib/yuri/brand-match.ts'))).toString('base64'))

function sliceFn(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const open = src.indexOf('{', src.indexOf(')', start + signature.length - 1 > start ? start : start))
  // The body's opening brace is the first "{" after the parameter list's closing ")" + return type.
  const bodyOpen = src.indexOf('{\n', src.indexOf('): Promise<string>', start))
  let d = 0, j = bodyOpen
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  void open
  return src.slice(start, j + 1)
}

// ── 1. the ingredient tail ───────────────────────────────────────────────────
test('get_product_details returns EVERY ingredient name: 20 in detail and all the rest by name (executed)', () => {
  const from = TOOLS.indexOf('  const ingredients = (ingredientsRes.data || []).map(')
  const to = TOOLS.indexOf('  if (pricesRes.error) {', from)
  const tailFrom = TOOLS.indexOf('    other_ingredients: ingredients', to)
  const tailTo = TOOLS.indexOf('    ingredients_total: ingredients.length,', tailFrom)
  assert.ok(from > -1 && to > from && tailFrom > to && tailTo > tailFrom)
  // The rows are asked for in label order; the split at 20 means nothing otherwise.
  const query = TOOLS.slice(TOOLS.lastIndexOf("db.from('ss_product_ingredients')", from), from)
  assert.match(query, /\.eq\('product_id', productId\)\n\s+\.order\('position', \{ ascending: true \}\),/)
  assert.doesNotMatch(query.slice(0, query.indexOf("db.from('ss_product_prices')")), /\.limit\(/)
  const body = `${TOOLS.slice(from, to)}\nreturn { ingredients: ingredients.slice(0, 20),\n${TOOLS.slice(tailFrom, tailTo)}\n ingredients_total: ingredients.length }`
  const shape = new Function('ingredientsRes', js(body))
  // 45 rows as the database returns them: a late Fragrance, one with only an INCI name, one with no ingredient row.
  const data = Array.from({ length: 45 }, (_, i) => ({
    position: i + 1,
    ingredient: { name_inci: `Inci ${i + 1}`, name_en: `Ingredient ${i + 1}`, function: 'x', is_active: false },
  }))
  data[36].ingredient = { name_inci: 'Fragrance (Parfum)', name_en: 'Fragrance' }
  data[40].ingredient = { name_inci: 'Limonene', name_en: null }
  data[44].ingredient = null
  const out = shape({ data })
  assert.equal(out.ingredients.length, 20)
  assert.equal(out.other_ingredients.length, 25, 'every name past the 20th must be there')
  assert.equal(out.ingredients.length + out.other_ingredients.length, out.ingredients_total)
  assert.ok(out.other_ingredients.includes('Fragrance'))
  assert.ok(out.other_ingredients.includes('Limonene'), 'an ingredient with only an INCI name still appears')
  assert.equal(out.other_ingredients[0], 'Ingredient 21')
  assert.ok(out.other_ingredients.every((n) => typeof n === 'string' && n.length > 0))
  // A short list has no tail, and that is an empty list, not a missing one.
  assert.deepEqual(shape({ data: data.slice(0, 12) }).other_ingredients, [])
  assert.deepEqual(shape({ data: null }), { ingredients: [], other_ingredients: [], ingredients_total: 0 })
})

const { brandIsNamed, brandTokens } = BM

// ── 2. a description is not an identity ──────────────────────────────────────
// A small catalog with the shapes that matter: a brand whose short form is what
// people type, brands whose letters sit inside ordinary words, a two-letter brand.
const BRANDS = ['Joseon Garden', 'Round Around', 'Cure', 'Dear, Klairs', 'Purito Seoul', 'Haruharu Wonder', 'COSRX', 'Jumiso', 'Acnes', 'HERA', "Te'", 'VT', 'Dr.Jart+', 'Some By Mi', "I'm From", 'Aestura', 'OBgE', 'Beauty of Joseon', 'Round Lab', 'CeraVe']
const CATALOG = { brands: BRANDS, ordinary: new Set(['seoul', 'wonder', 'beauty', 'round', 'lab', 'dear', 'some', 'from', 'of', 'by', 'cure', 'around']) }

test('brandIsNamed uses whole words and the search\'s own rule: short forms count, letters inside other words do not (executed)', () => {
  const yes = [
    ['COSRX', 'BHA Blackhead Power Liquid', 'COSRX'],
    ['COSRX', 'cosrx bha blackhead power liquid', null],
    ['Dear, Klairs', 'Klairs Supple Preparation Facial Toner', null],
    ['Dear, Klairs', 'Supple Preparation Facial Toner', 'Klairs'],
    ['Purito Seoul', 'Purito Centella Unscented Serum', null],
    ['Haruharu Wonder', 'Haruharu Black Rice Hyaluronic Toner', null],
    ['Dr.Jart+', 'Cicapair Tiger Grass Cream', 'Dr. Jart'],
    ['Dr.Jart+', 'drjart cicapair cream', undefined],
    ['Some By Mi', 'some by mi miracle toner', null],
    ["I'm From", 'im from rice toner', null],
    ['Round Lab', 'Birch Juice Sunscreen', 'ROUND LAB'],
    ['VT', 'VT Reedle Shot 100', null],
    ['Beauty of Joseon', 'Beauty of Joseon Relief Sun', null],
    ['Beauty of Joseon', 'joseon relief sun', null],
    // The brand is in the name even though the brand field holds something else.
    ['COSRX', 'cosrx bha blackhead power liquid', 'Korean skincare'],
    // A one-word brand that is an ordinary word is named by its own brand field.
    ['Cure', 'Aqua Gel', 'Cure'],
    ['Round Lab', 'round lab dokdo toner', null],
  ]
  for (const [matched, name, brand] of yes) assert.equal(brandIsNamed(matched, name, brand, CATALOG), true, `${matched} / ${name} / ${brand}`)
  const no = [
    ['Jumiso', 'Salicylic acid foaming cleanser', null],
    ['Jumiso', 'Salicylic acid foaming cleanser', 'CeraVe'],
    ['Acnes', 'acne spot patch', null],
    ['HERA', 'Cica therapy cream', null],
    ["Te'", 'tinted tone up sun cushion', null],
    ['VT', 'vitamin tint', null],
    ['COSRX', 'Snail mucin essence', undefined],
    ["I'm From", 'Rice toner', ''],
    ['Aestura', 'Ceramide cream', null],
    ['Round Lab', 'lab series toner', null],
    ['Beauty of Joseon', 'beauty cream', null],
    ['Purito Seoul', 'Seoul glow serum', null],
    ['', 'anything', 'anything'],
    [null, 'anything', null],
    ['COSRX', '', null],
    // ...but not by the word turning up in a description,
    ['Cure', 'acne cure gel', null],
    // and a brand typed in full keeps its words from naming a different brand that shares one.
    ['Round Around', 'round lab dokdo toner', null],
    ['Jumiso', 'Rice Toner', 'Anua'],
    // "joseon" belongs to the brand that was typed in full, not to another brand that shares the word.
    ['Joseon Garden', 'beauty of joseon relief sun', null],
    // A brand field that only STARTS like the brand is a different brand.
    ['Round Lab', 'Dokdo Toner', 'Round Around'],
    ['Round Around', 'Dokdo Toner', 'Round'],
  ]
  for (const [matched, name, brand] of no) assert.equal(brandIsNamed(matched, name, brand, CATALOG), false, `${matched} / ${name} / ${brand}`)
  // With no catalog, only a brand typed in full counts: nothing is known about which words are ordinary.
  assert.equal(brandIsNamed('Dear, Klairs', 'Klairs Supple Preparation Facial Toner', null, null), false)
  assert.equal(brandIsNamed('Dear, Klairs', 'dear klairs toner', null, null), true)
  assert.equal(brandIsNamed('COSRX', 'cosrx toner', null, null), true)
})

/** A recording fake for the tables the save tools touch. `fail` names tables whose writes or reads error. */
function fakeDb({ products = {}, shelf = [], fail = {} } = {}) {
  const writes = []
  let n = 0
  return {
    writes,
    from(table) {
      const f = { eq: [], ilike: [] }
      let op = 'select', values
      const err = (kind) => (fail[`${table}:${kind}`] ? { message: `${table} ${kind} failed` } : null)
      const q = {
        select: () => q,
        insert(v) { op = 'insert'; values = v; writes.push({ table, op, values: v }); return q },
        update(v) { op = 'update'; values = v; writes.push({ table, op, values: v, eq: f.eq }); return q },
        eq(c, v) { f.eq.push([c, v]); return q },
        ilike(c, v) { f.ilike.push([c, v]); return q },
        is: () => q,
        limit: () => q,
        order: () => q,
        maybeSingle: () => q.single(),
        single() {
          if (op === 'insert') return Promise.resolve(err('insert') ? { data: null, error: err('insert') } : { data: { id: `${table}-${++n}` }, error: null })
          if (table === 'ss_products') {
            const id = f.eq.find(([c]) => c === 'id')?.[1]
            return Promise.resolve({ data: products[id] ?? null, error: null })
          }
          if (table === 'ss_user_products') {
            if (err('select')) return Promise.resolve({ data: null, error: err('select') })
            const pid = f.eq.find(([c]) => c === 'product_id')?.[1]
            return Promise.resolve({ data: shelf.find((x) => x.product_id === pid) ?? null, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        then(res, rej) {
          let out = { data: null, error: err(op) }
          if (table === 'ss_user_products' && op === 'select') {
            // "Is this product already on this member's shelf?"
            // Every filter counts: a row on someone else's shelf is not this member's.
            out = err('select') ? { data: null, error: err('select') } : { data: shelf.filter((x) => f.eq.every(([c, v]) => (x[c] ?? (c === 'user_id' ? 'u1' : undefined)) === v)), error: null }
          }
          return Promise.resolve(out).then(res, rej)
        },
      }
      return q
    },
  }
}

function loadTools(db, matches, { catalog = CATALOG } = {}) {
  const src = [sliceFnAny(TOOLS, 'async function identifiedForWrite('), sliceFn(TOOLS, 'async function executeSaveRoutine('), sliceFn(TOOLS, 'async function executeUpdateUserProduct(')].join('\n')
  const asked = []
  const errors = []
  const run = new Function('getServiceClient', 'resolveProductByName', 'brandIsNamed', 'brandTokens', 'loadBrandCatalog', 'readIngredientInput', 'logCatalogGap', 'console',
    `${js(src)}\nreturn { executeSaveRoutine, executeUpdateUserProduct, identifiedForWrite }`)
  const tools = run(() => db, async (_db, name) => { asked.push(name); return matches[name] ?? null }, brandIsNamed, brandTokens,
    async () => { if (catalog instanceof Error) throw catalog; return catalog }, () => ({ ok: true, list: null }), async () => {}, { warn() {}, error: (...a) => errors.push(a.join(' ')), log() {} })
  return { ...tools, errors, asked }
}
function sliceFnAny(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  let d = 0, j = src.indexOf('{\n', src.indexOf('): Promise<boolean>', start))
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  return src.slice(start, j + 1)
}
const JUMISO = { id: 'p-jumiso', name_en: 'Pore Purifying Salicylic Acid Foaming Cleanser', brand_en: 'Jumiso', match_quality: 'exact' }
const OBGE = { id: 'p-obge', name_en: 'Moisture Protein Barrier Cream', brand_en: 'OBgE', match_quality: 'exact' }
const COSRX = { id: 'p-cosrx', name_en: 'BHA Blackhead Power Liquid', brand_en: 'COSRX', match_quality: 'exact' }
const SNAIL = { id: 'p-snail', name_en: 'Advanced Snail 96 Mucin Power Essence', brand_en: 'COSRX', match_quality: 'exact' }
const KLAIRS = { id: 'p-klairs', name_en: 'Supple Preparation Facial Toner', brand_en: 'Dear, Klairs', match_quality: 'all_terms' }
const IMFROM = { id: 'p-imfrom', name_en: 'Rice Toner', brand_en: "I'm From", match_quality: 'exact' }
const ANUA = { id: 'p-anua', name_en: 'Rice 70 Glow Milky Toner', brand_en: 'Anua', match_quality: 'all_terms' }
// What the resolver returns for each NAME it is asked for (it is never asked with the brand prepended).
const MATCHES = {
  'Salicylic acid foaming cleanser': JUMISO,
  'Moisture Protein Barrier Cream': OBGE,
  'cosrx BHA Blackhead Power Liquid': COSRX,
  'COSRX BHA Blackhead Power Liquid': COSRX,
  'BHA Blackhead Power Liquid': COSRX,
  'Advanced Snail 96 Mucin Power Essence': SNAIL,
  'Snail mucin essence': SNAIL,
  'snail essence': SNAIL,
  'Klairs Supple Preparation Facial Toner': KLAIRS,
  'Rice Toner': IMFROM,
  'toner': ANUA,
  'Bakuchiol serum': { id: 'p-bak', name_en: 'Bakuchiol Serum', brand_en: 'Anua', match_quality: 'exact' },
  'Hero Mighty Patch': { id: 'p-x', name_en: 'Honey Heel Patch', brand_en: 'Dr.ppae', match_quality: 'partial' },
}

test('save_routine links a step only when its brand is named; a description or a bare product name is saved under the member\'s own words (executed)', async () => {
  const db = fakeDb()
  const t = loadTools(db, MATCHES)
  const steps = [
    ['Salicylic acid foaming cleanser', undefined, null],              // a description that fits one product
    ['Salicylic acid foaming cleanser', 'CeraVe', null],               // ...and with a DIFFERENT brand given
    ['Moisture Protein Barrier Cream', 'OBgE', 'p-obge'],              // brand in its field
    ['cosrx BHA Blackhead Power Liquid', undefined, 'p-cosrx'],        // brand inside the name
    ['Klairs Supple Preparation Facial Toner', undefined, 'p-klairs'], // the brand's short form
    ['Advanced Snail 96 Mucin Power Essence', undefined, null],        // the whole name but no brand: still not an identity
    ['Bakuchiol serum', undefined, null],                              // a description that IS one product's whole name
    ['Rice Toner', 'Anua', null],                                      // the name alone finds ANOTHER brand's product: refused, not re-aimed
    ['Rice Toner', "I'm From", 'p-imfrom'],
    ['Rice Toner', '   ', null],                                       // a blank brand is no brand
  ]
  const out = JSON.parse(await t.executeSaveRoutine({ routine_type: 'pm', steps: steps.map(([product_name, product_brand], i) => ({ product_name, product_brand, step_order: i + 1, notes: i === 0 ? 'Night only' : undefined })) }, 'u1'))
  const saved = db.writes.filter((w) => w.table === 'ss_routine_products').map((w) => w.values)
  assert.deepEqual(saved.map((x) => x.product_id), steps.map((x) => x[2]))
  assert.deepEqual(t.asked, steps.map((x) => x[0]), 'the resolver is asked by name only: brand + a generic word would pick an arbitrary product of that brand')
  // An unlinked step keeps the member's own words as its name.
  assert.equal(saved[0].notes, 'Salicylic acid foaming cleanser — Night only')
  assert.equal(saved[6].notes, 'Bakuchiol serum')
  // Yuri is told, for EACH unlinked step, which product it resembled and whether a brand was given.
  assert.deepEqual(out.steps.map((x) => [x.brand_not_named_nearest ?? null, x.brand_given_differs ?? null]), [
    ['Jumiso Pore Purifying Salicylic Acid Foaming Cleanser', false], ['Jumiso Pore Purifying Salicylic Acid Foaming Cleanser', true],
    [null, null], [null, null], [null, null],
    ['COSRX Advanced Snail 96 Mucin Power Essence', false], ['Anua Bakuchiol Serum', false], ["I'm From Rice Toner", true], [null, null], ["I'm From Rice Toner", false],
  ])
  assert.match(out.message, /6 steps were saved under the member's own words and NOT tied to a catalog product, because the words did not identify one\. That alone does not tell you whether we carry it:/)
  assert.match(out.message, /- Step 1: "Salicylic acid foaming cleanser" \(no brand was named; the closest catalog product is Jumiso Pore Purifying Salicylic Acid Foaming Cleanser, which may or may not be theirs\)/)
  assert.match(out.message, /- Step 2: "Salicylic acid foaming cleanser" \(the brand given, CeraVe, was not recognised as the brand of the closest product by name, Jumiso Pore Purifying Salicylic Acid Foaming Cleanser; search for it by brand to see whether we carry theirs\)/)
  assert.match(out.message, /- Step 8: "Rice Toner" \(the brand given, Anua, was not recognised as the brand of the closest product by name, I'm From Rice Toner; /)
  // A blank brand field is reported as no brand, never as "the brand given, , ...".
  assert.match(out.message, /- Step 10: "Rice Toner" \(no brand was named; /)
  assert.doesNotMatch(out.message, /the brand given, *,/)
  for (const n of [6, 7, 10]) assert.match(out.message, new RegExp(`- Step ${n}: "[^"]+" \\(no brand was named; the closest catalog product is `))
  assert.match(out.message, /To link one: confirm with them which product it is, find it with search_products, then save the routine again with that product_id on the step and replace_existing: true\./)
  // These are not "we don't carry it" entries, and nothing here claims a clean save.
  assert.doesNotMatch(out.message, /as a custom entry — we don't have a clean catalog match|matched cleanly|no brand was named, so/)
  assert.deepEqual([out.steps_clean, out.steps_loose], [4, 6])
})

test('save_routine: a step the resolver only half-matched is still the ordinary custom entry, worded as before (executed)', async () => {
  const db = fakeDb()
  const out = JSON.parse(await loadTools(db, MATCHES).executeSaveRoutine({ routine_type: 'pm', steps: [{ product_name: 'Hero Mighty Patch', step_order: 1 }, { product_name: 'LED mask', step_order: 2 }] }, 'u1'))
  assert.deepEqual(db.writes.filter((w) => w.table === 'ss_routine_products').map((w) => w.values.product_id), [null, null])
  assert.match(out.message, /1 step was saved under the exact name you gave, as a custom entry/)
  assert.match(out.message, /1 step was saved without a database match/)
  assert.doesNotMatch(out.message, /NOT tied to a catalog product/)
  assert.equal(out.steps[0].brand_not_named_nearest, undefined)
})

test('save_routine: when the brand list cannot be read, only a brand typed in full links (executed)', async () => {
  const db = fakeDb()
  const t = loadTools(db, MATCHES, { catalog: new Error('catalog down') })
  await t.executeSaveRoutine({ routine_type: 'pm', steps: [{ product_name: 'cosrx BHA Blackhead Power Liquid', step_order: 1 }, { product_name: 'Klairs Supple Preparation Facial Toner', step_order: 2 }] }, 'u1')
  assert.deepEqual(db.writes.filter((w) => w.table === 'ss_routine_products').map((w) => w.values.product_id), ['p-cosrx', null])
  assert.ok(t.errors.some((e) => /brand catalog unavailable/.test(e)))
})

test('save_routine: a product id Yuri looked up is still trusted as it is', async () => {
  const db = fakeDb({ products: { 'p-jumiso': JUMISO } })
  const out = JSON.parse(await loadTools(db, {}).executeSaveRoutine({ routine_type: 'pm', steps: [{ product_id: 'p-jumiso', product_name: 'Salicylic acid foaming cleanser', step_order: 1 }] }, 'u1'))
  assert.equal(db.writes.find((w) => w.table === 'ss_routine_products').values.product_id, 'p-jumiso')
  assert.equal(out.steps[0].status, 'matched')
})

test('save_routine: only a product the member HAS goes on their shelf, whether it came by id or by name (executed)', async () => {
  const db = fakeDb({ products: { 'p-obge': OBGE, 'p-cosrx': COSRX } })
  const out = JSON.parse(await loadTools(db, MATCHES).executeSaveRoutine({ routine_type: 'pm', steps: [
    { product_id: 'p-obge', product_name: 'Moisture Protein Barrier Cream', product_brand: 'OBgE', step_order: 1 },
    { product_id: 'p-cosrx', product_name: 'BHA Blackhead Power Liquid', product_brand: 'COSRX', step_order: 2, owned: true },
    { product_id: 'p-obge', product_name: 'again', step_order: 3, owned: false },
    { product_id: 'p-obge', product_name: 'again', step_order: 4, owned: 'true' },
    { product_name: 'Klairs Supple Preparation Facial Toner', step_order: 5 },              // resolved by NAME, not marked owned
    { product_name: 'Advanced Snail 96 Mucin Power Essence', product_brand: 'COSRX', step_order: 6, owned: true },  // resolved by name, owned
    { product_name: 'Salicylic acid foaming cleanser', step_order: 7, owned: true },        // not linked: nothing to shelve
  ] }, 'u1'))
  const shelf = db.writes.filter((w) => w.table === 'ss_user_products')
  assert.deepEqual(shelf.map((w) => [w.op, w.values.product_id, w.values.status]), [['insert', 'p-cosrx', 'active'], ['insert', 'p-snail', 'active']], 'a recommendation is not a possession; only a literal true counts')
  assert.equal(db.writes.filter((w) => w.table === 'ss_routine_products').length, 7, 'all seven are in the routine either way')
  assert.deepEqual(out.steps.map((x) => x.added_to_shelf), [false, true, false, false, false, true, false])
  // The message counts catalog products left off the shelf, never the unlinked step.
  assert.match(out.message, /4 catalog products are in the routine but NOT on their shelf \(not marked as owned, or the shelf could not be written\): "OBgE Moisture Protein Barrier Cream", "OBgE Moisture Protein Barrier Cream", "OBgE Moisture Protein Barrier Cream", "Dear, Klairs Supple Preparation Facial Toner"\. The routine itself is saved and does not need saving again\. If they tell you they have one, record that with update_user_product\./)
  assert.doesNotMatch(out.message, /save again with owned/)
})

test('save_routine: the shelf write is checked, and an old shelf row is not mistaken for a current one (executed)', async () => {
  const step = [{ product_id: 'p-cosrx', product_name: 'x', step_order: 1, owned: true }]
  // Already on the shelf and active: nothing written, counted as on the shelf.
  const a = fakeDb({ products: { 'p-cosrx': COSRX }, shelf: [{ id: 's1', product_id: 'p-cosrx', status: 'active' }] })
  const outA = JSON.parse(await loadTools(a, {}).executeSaveRoutine({ routine_type: 'am', steps: step }, 'u1'))
  assert.equal(a.writes.filter((w) => w.table === 'ss_user_products').length, 0)
  assert.equal(outA.steps[0].added_to_shelf, true)
  assert.doesNotMatch(outA.message, /NOT on their shelf/)
  // Set aside earlier, and now they say they have it: brought back, not duplicated.
  const b = fakeDb({ products: { 'p-cosrx': COSRX }, shelf: [{ id: 's1', product_id: 'p-cosrx', status: 'destashed' }] })
  const outB = JSON.parse(await loadTools(b, {}).executeSaveRoutine({ routine_type: 'am', steps: step }, 'u1'))
  assert.deepEqual(b.writes.filter((w) => w.table === 'ss_user_products').map((w) => [w.op, w.values, w.eq]), [['update', { status: 'active' }, [['id', 's1']]]])
  assert.equal(outB.steps[0].added_to_shelf, true)
  // Each way the shelf can fail: reported as NOT on the shelf, never as success.
  for (const fail of [{ 'ss_user_products:insert': true }, { 'ss_user_products:select': true }]) {
    const c = fakeDb({ products: { 'p-cosrx': COSRX }, fail })
    const t = loadTools(c, {})
    const outC = JSON.parse(await t.executeSaveRoutine({ routine_type: 'am', steps: step }, 'u1'))
    assert.equal(outC.steps[0].added_to_shelf, false, JSON.stringify(fail))
    assert.match(outC.message, /One catalog product is in the routine but NOT on their shelf/)
    assert.ok(t.errors.some((e) => /\[save_routine\] shelf (insert|read) failed/.test(e)))
  }
  const d = fakeDb({ products: { 'p-cosrx': COSRX }, shelf: [{ id: 's1', product_id: 'p-cosrx', status: 'finished' }], fail: { 'ss_user_products:update': true } })
  assert.equal(JSON.parse(await loadTools(d, {}).executeSaveRoutine({ routine_type: 'am', steps: step }, 'u1')).steps[0].added_to_shelf, false)
})

test('the shelf tool: a NEW link needs the brand; a product already on their shelf is found without it (executed)', async () => {
  for (const [name, brand, linked] of [
    ['Salicylic acid foaming cleanser', undefined, null],
    ['Salicylic acid foaming cleanser', 'CeraVe', null],
    ['BHA Blackhead Power Liquid', 'COSRX', 'p-cosrx'],
    ['Advanced Snail 96 Mucin Power Essence', undefined, null],
    ['Advanced Snail 96 Mucin Power Essence', 'COSRX', 'p-snail'],
    ['Rice Toner', 'Anua', null],
    ['Rice Toner', "I'm From", 'p-imfrom'],
    // A partial match is never linked, even with its brand named (the Hero -> Dr.ppae class).
    ['Hero Mighty Patch', 'Dr.ppae', null],
  ]) {
    const db = fakeDb()
    await loadTools(db, MATCHES).executeUpdateUserProduct({ product_name: name, brand }, 'u1')
    const row = db.writes.find((w) => w.table === 'ss_user_products' && w.op === 'insert')
    assert.ok(row, `${name}: a shelf row is written either way`)
    assert.equal(row.values.product_id ?? null, linked, `${name} [${brand}]`)
    if (!linked) assert.equal(row.values.custom_name, name)
  }
  // "My snail essence is finished": the product is on their shelf, so THAT row is updated.
  // No second row, and the real one does not stay active.
  const db = fakeDb({ shelf: [{ id: 's-snail', product_id: 'p-snail', custom_name: 'COSRX Snail Essence', status: 'active' }] })
  await loadTools(db, MATCHES).executeUpdateUserProduct({ product_name: 'snail essence', status: 'finished' }, 'u1')
  const writes = db.writes.filter((w) => w.table === 'ss_user_products')
  assert.deepEqual(writes.map((w) => w.op), ['update'], JSON.stringify(writes))
  assert.equal(writes[0].values.status, 'finished')
  assert.deepEqual(writes[0].eq.find(([c]) => c === 'id'), ['id', 's-snail'])
  // The same product on ANOTHER member's shelf is no evidence about this one.
  const other = fakeDb({ shelf: [{ id: 's-other', user_id: 'someone-else', product_id: 'p-snail', status: 'active' }] })
  await loadTools(other, MATCHES).executeUpdateUserProduct({ product_name: 'snail essence', status: 'finished' }, 'u1')
  assert.ok(!other.writes.some((w) => w.op === 'update'), 'another member\'s row must never be updated')
  assert.equal(other.writes.find((w) => w.op === 'insert').values.product_id ?? null, null)
  // A DIFFERENT product on their own shelf is no evidence either: the shortcut is for that product only.
  const elsewhere = fakeDb({ shelf: [{ id: 's-cosrx', product_id: 'p-cosrx', status: 'active' }] })
  await loadTools(elsewhere, MATCHES).executeUpdateUserProduct({ product_name: 'snail essence', status: 'finished' }, 'u1')
  assert.ok(!elsewhere.writes.some((w) => w.op === 'update'))
  assert.equal(elsewhere.writes.find((w) => w.op === 'insert').values.product_id ?? null, null)
  // The resolver is asked by name only, and Yuri is told the truth about an unlinked fit and how to link it.
  const told = loadTools(fakeDb(), MATCHES)
  const res = JSON.parse(await told.executeUpdateUserProduct({ product_name: 'Advanced Snail 96 Mucin Power Essence', brand: undefined }, 'u1'))
  assert.deepEqual(told.asked, ['Advanced Snail 96 Mucin Power Essence'])
  assert.match(res.message, /NOT tied to a catalog product: the name fits "COSRX Advanced Snail 96 Mucin Power Essence" but names no brand that identifies it, so it may or may not be that product\. If it is, call this tool again with brand set to that product's brand and it will link\./)
  assert.doesNotMatch(res.message, /names don't fully overlap/)
  // A genuinely partial match keeps the old wording.
  const partial = JSON.parse(await loadTools(fakeDb(), MATCHES).executeUpdateUserProduct({ product_name: 'Hero Mighty Patch' }, 'u1'))
  assert.match(partial.message, /names don't fully overlap/)
  // If the shelf cannot be read, that is not evidence: no link, and it is logged.
  const broken = fakeDb({ shelf: [{ id: 's-snail', product_id: 'p-snail', status: 'active' }], fail: { 'ss_user_products:select': true } })
  const t = loadTools(broken, MATCHES)
  await t.executeUpdateUserProduct({ product_name: 'snail essence', status: 'finished' }, 'u1').catch(() => {})
  assert.ok(t.errors.some((e) => /shelf lookup failed/.test(e)))
  assert.ok(!broken.writes.some((w) => w.values?.product_id === 'p-snail'))
})

test('add_to_routine refuses a description too, and what Yuri is told matches what the tools now do', () => {
  const add = TOOLS.slice(TOOLS.indexOf('async function executeAddToRoutine('), TOOLS.indexOf('async function executeRemoveFromRoutine('))
  assert.match(add, /const found = await resolveProductByNameStrict\(db, productName\)\n[\s\S]{0,400}const match = found && \(await identifiedForWrite\(db, found, productName, null\)\) \? found : null\n\s+if \(match\) \{\n\s+productId = match\.id/)
  // Every name-resolved WRITE goes through the gate: no write path takes the resolver's word alone.
  for (const fn of ['async function executeSaveRoutine(', 'async function executeUpdateUserProduct(']) {
    const body = sliceFn(TOOLS, fn)
    assert.match(body, /identifiedForWrite\(db, match, /, fn)
  }
  const schema = TOOLS.slice(TOOLS.indexOf("name: 'save_routine'"), TOOLS.indexOf("name: 'find_sunscreen_match'"))
  assert.match(schema, /owned: \{ type: 'boolean', description: 'true only when the member has told you they already have this product\. Leave it out for something you are recommending that they have not bought/)
  assert.match(schema, /required: \['product_name', 'step_order'\],/)
  // One instruction about the result, not two that disagree (the prompt says do not quote it).
  assert.doesNotMatch(schema, /MUST quote|verbatim/)
  const advisor = read('src/lib/yuri/advisor.ts')
  assert.match(advisor, /do NOT quote it verbatim like a log dump/)
  assert.match(advisor, /- \*\*A step the message says was not tied to a catalog product\*\*: this is a different case from a custom entry\. Their words \("salicylic acid cleanser"\) fit a product we carry without identifying it, and the message names the closest one\. That is not yet "we don't carry it": find out which product they mean, look it up with search_products, and if we have it save the routine again with that product_id on the step and replace_existing: true\./)
  assert.doesNotMatch(advisor, /save again with the brand and it links/)
  assert.match(advisor, /- \*\*Owned or recommended\*\*: mark a step owned: true only when they have told you they already have that product\./)
})
