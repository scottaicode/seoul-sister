/**
 * Four defects found when the owner signed up as a new member (Nov 16 2026).
 *
 * 1. Yuri saved a sunscreen holding four essential oils, retinol and ascorbic
 *    acid for a member with rosacea on a prescription retinoid: the sunscreen
 *    tool returned no ingredients, so there was nothing to read.
 * 2. A medical correction ("I have had skin cancer many times") was dropped
 *    for one turn: the extractor wrote valid JSON and then a sentence, and
 *    JSON.parse on the whole text threw.
 * 3. "near Sacramento, Northern California" got no coordinates.
 * 4. The confirmation email gave the end of the free week in UTC, a different
 *    day from the one the app showed.
 *
 * The real functions are EXECUTED here wherever they can be loaded without a
 * database. What Yuri then does with an ingredient list is not testable from
 * source: that is counted by scripts/replay-routine-build.ts.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const transpile = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const dir = mkdtempSync(join(tmpdir(), 'ss-nov16-'))
const load = async (name, src) => {
  writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  return import(pathToFileURL(join(dir, `${name}.mjs`)).href)
}

// ── 2. the JSON a model returns ─────────────────────────────────────────────

test('a complete JSON object followed by commentary is read, not thrown away', async () => {
  const { parseModelJson } = await load('model-json', read('src/lib/utils/model-json.ts'))
  // The shape that lost a skin cancer correction for one turn.
  const recorded = '{"skin_type":"dry","medical_history":["skin cancer history, around 30 spots removed"],"sun_history":"Has had skin cancer many times."}\n\nNote: the user corrected an earlier statement, so "no skin cancer" was removed.'
  assert.deepEqual(parseModelJson(recorded), { skin_type: 'dry', medical_history: ['skin cancer history, around 30 spots removed'], sun_history: 'Has had skin cancer many times.' })
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseModelJson('Here it is: {"a":{"b":[1,2]}} done'), { a: { b: [1, 2] } })
  // Found in review: the first bracket of any kind read these as [1] and [],
  // which the callers took for an object with no fields. The object is the value.
  assert.deepEqual(parseModelJson('Note [1]: {"skin_type":"oily"}'), { skin_type: 'oily' })
  assert.deepEqual(parseModelJson('Changes []: {"a":1}'), { a: 1 })
  assert.deepEqual(parseModelJson('As asked {see below}: {"a":1}'), { a: 1 })
  // Brackets and escaped quotes inside a string do not end the value early.
  assert.deepEqual(parseModelJson('{"note":"uses } and ] and \\" inside","n":2} extra'), { note: 'uses } and ] and " inside', n: 2 })
})

test('a cut-off or absent JSON value still throws: half a record is not a record', async () => {
  const { parseModelJson } = await load('model-json', read('src/lib/utils/model-json.ts'))
  assert.throws(() => parseModelJson('{"skin_type":"dry","medical_history":["skin canc'))
  assert.throws(() => parseModelJson('I could not find anything to extract.'))
  assert.throws(() => parseModelJson(''))
  assert.throws(() => parseModelJson('Nothing to record [1].'), 'commentary with a bracket and no object is not a record')
})

test('every background extractor reads model JSON through the shared parser', () => {
  for (const file of ['src/lib/yuri/onboarding.ts', 'src/lib/yuri/advisor.ts', 'src/lib/yuri/memory.ts', 'src/lib/yuri/treatment-phase-extractor.ts']) {
    const src = read(file)
    assert.ok(src.includes("import { parseModelJson } from '@/lib/utils/model-json'"), `${file} imports the parser`)
    assert.ok(src.includes('parseModelJson(block.text)'), `${file} uses it`)
    assert.equal(src.includes("replace(/^```json?\\s*/, '')"), false, `${file} no longer strips fences and parses the whole reply itself`)
  }
})

// ── 3. where the member said they live ──────────────────────────────────────

async function geocoder(known) {
  const { geocodeLocation } = await load('geocode', read('src/lib/geo/geocode.ts'))
  const asked = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const name = decodeURIComponent(String(url).match(/name=([^&]*)/)[1])
    asked.push(name)
    return { ok: true, json: async () => ({ results: known[name] ?? [] }) }
  }
  return { geocodeLocation, asked, restore: () => { globalThis.fetch = realFetch } }
}
const SACRAMENTO = { latitude: 38.58, longitude: -121.49, name: 'Sacramento', admin1: 'California', country: 'United States', country_code: 'US', timezone: 'America/Los_Angeles' }

test('"near Sacramento, Northern California" resolves to Sacramento, checked against the state they gave', async () => {
  const g = await geocoder({ Sacramento: [SACRAMENTO] })
  try {
    const r = await g.geocodeLocation('near Sacramento, Northern California')
    assert.deepEqual(r, { lat: 38.58, lng: -121.49, name: 'Sacramento, California, United States', timezone: 'America/Los_Angeles' })
    assert.deepEqual(g.asked, ['near Sacramento, Northern California', 'near Sacramento', 'Sacramento'])
  } finally { g.restore() }
})

test('a town of the same name in a state they did not name is refused', async () => {
  const g = await geocoder({ Sacramento: [{ ...SACRAMENTO, admin1: 'Kentucky' }] })
  try {
    assert.equal(await g.geocodeLocation('near Sacramento, Northern California'), null)
  } finally { g.restore() }
})

test('with no state or country to check against, no words are dropped', async () => {
  // Measured live: dropping words turned "Northern California" into
  // California, Missouri and "somewhere warm" into Warm, Netherlands.
  const g = await geocoder({ California: [{ latitude: 38.63, longitude: -92.57, name: 'California', admin1: 'Missouri', country: 'United States' }], warm: [{ latitude: 51.9, longitude: 6.3, name: 'Warm', admin1: 'Gelderland', country: 'The Netherlands' }], Sacramento: [SACRAMENTO] })
  try {
    assert.equal(await g.geocodeLocation('Northern California'), null)
    assert.equal(await g.geocodeLocation('somewhere warm'), null)
    assert.equal(await g.geocodeLocation('near Sacramento'), null)
    assert.deepEqual(g.asked, ['Northern California', 'somewhere warm', 'near Sacramento'])
  } finally { g.restore() }
})

test('a country alone does not license dropping words, and a country code is not a state', async () => {
  // All three found in review and measured live before this guard.
  const g = await geocoder({
    Iowa: [{ latitude: 30.2, longitude: -93.0, name: 'Iowa', admin1: 'Louisiana', country: 'United States', country_code: 'US' }],
    California: [{ latitude: 38.63, longitude: -92.57, name: 'California', admin1: 'Missouri', country: 'United States', country_code: 'US' }],
    London: [{ latitude: 42.98, longitude: -81.25, name: 'London', admin1: 'Ontario', country: 'Canada', country_code: 'CA' }],
    'London, CA': [{ latitude: 42.98, longitude: -81.25, name: 'London', admin1: 'Ontario', country: 'Canada', country_code: 'CA' }],
    Paris: [{ latitude: 48.85, longitude: 2.35, name: 'Paris', admin1: 'Ile-de-France', country: 'France', country_code: 'FR' }],
  })
  try {
    assert.equal(await g.geocodeLocation('rural Iowa, USA'), null, 'not Iowa, Louisiana')
    assert.equal(await g.geocodeLocation('Northern California, USA'), null, 'not California, Missouri')
    assert.equal(await g.geocodeLocation('near London, CA'), null, 'CA the state is not CA the country code')
    assert.equal(await g.geocodeLocation('London, CA'), null)
    // A code typed as a code still matches the country it is.
    assert.equal((await g.geocodeLocation('Paris, FR')).name, 'Paris, Ile-de-France, France')
  } finally { g.restore() }
})

test('at most three words are dropped: each one is a request inside a chat turn', async () => {
  const g = await geocoder({ Sacramento: [SACRAMENTO] })
  try {
    assert.equal(await g.geocodeLocation('a small town about an hour outside of Sacramento, California'), null)
    assert.equal(g.asked.length, 5, 'the whole string, the place, then three shorter tries')
  } finally { g.restore() }
})

test('a whole country is never somebody\'s coordinates, and a city of the same name still is', async () => {
  const CANADA = { latitude: 60.1, longitude: -113.6, name: 'Canada', country: 'Canada', feature_code: 'PCLI' }
  const g = await geocoder({
    Canada: [CANADA, { latitude: 39.4, longitude: -0.4, name: 'Cañada', admin1: 'Valencia', country: 'Spain', feature_code: 'PPLA3' }],
    Singapore: [{ latitude: 1.29, longitude: 103.85, name: 'Singapore', country: 'Singapore', feature_code: 'PPLC' }, { latitude: 1.36, longitude: 103.8, name: 'Singapore', country: 'Singapore', feature_code: 'PCLI' }],
    Toronto: [{ latitude: 43.7, longitude: -79.4, name: 'Toronto', admin1: 'Ontario', country: 'Canada', feature_code: 'PPLA' }],
  })
  try {
    assert.equal(await g.geocodeLocation('Canada'), null)
    assert.equal((await g.geocodeLocation('Singapore')).lat, 1.29)
    assert.equal((await g.geocodeLocation('Toronto, Canada')).name, 'Toronto, Ontario, Canada')
  } finally { g.restore() }
})

// ── 4. the end of the free week, in the member's own time ───────────────────

test('the browser time zone is stored on the free-week subscription, and only when there is one', async () => {
  writeFileSync(join(dir, 'pricing.mjs'), transpile(read('src/lib/pricing.ts')))
  writeFileSync(join(dir, 'offers.mjs'), transpile(read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'")))
  const params = await load('stripe-params', read('src/lib/stripe-params.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  const base = { userId: 'u1', plan: 'monthly', priceId: 'price_1', customerId: 'cus_1', termsShown: 'signup' }
  assert.equal(params.buildDirectFreeWeekParams({ ...base, timezone: 'America/Los_Angeles' }).metadata.timezone, 'America/Los_Angeles')
  assert.equal('timezone' in params.buildDirectFreeWeekParams(base).metadata, false)
  assert.equal('timezone' in params.buildDirectFreeWeekParams({ ...base, timezone: null }).metadata, false)
})

test('the zone the browser sends is checked before it is used, and reaches the email when the profile has none', async () => {
  const { validTimeZone } = await load('timezone', read('src/lib/email/timezone.ts'))
  assert.equal(validTimeZone('America/Los_Angeles'), 'America/Los_Angeles')
  assert.equal(validTimeZone('Not/AZone'), null)
  assert.equal(validTimeZone('<script>'), null)
  const route = read('src/app/api/stripe/checkout/route.ts')
  assert.ok(route.includes('timezone: z.string().max(64).optional(),'))
  assert.ok(route.includes('timezone: validTimeZone(parsed.data.timezone) })'), 'the route validates it, never passes the raw string')
  const fulfil = read('src/lib/subscription-fulfilment.ts')
  assert.ok(fulfil.includes('const zone = (await timezoneForUser(db, userId)) ?? subscription.metadata?.timezone ?? null'))
  assert.equal(fulfil.split('timezone: zone, startedOnOurPage').length - 1, 2, 'both sends use it')
  assert.equal(fulfil.includes('timezone: await timezoneForUser(db, userId), startedOnOurPage'), false)
})

test('both pages that start a free week send the browser zone', async () => {
  const mod = await load('start-free-week', read('src/lib/start-free-week.ts').replace("import { freeWeekNotStartedLine } from '@/lib/offers'", 'const freeWeekNotStartedLine = (r) => r'))
  assert.deepEqual(mod.browserTimeZone(), { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  const bodies = []
  const fetchStub = async (url, init) => {
    if (url === '/api/me/trial') return { ok: true, status: 200, json: async () => ({ eligible: true, no_card: true, direct: true }) }
    bodies.push(JSON.parse(init.body))
    return { ok: true, status: 200, json: async () => ({ started: true }) }
  }
  assert.deepEqual(await mod.startFreeWeekAfterSignup('tok', null, fetchStub, async () => {}), { started: true })
  assert.equal(bodies[0].timezone, Intl.DateTimeFormat().resolvedOptions().timeZone)
  assert.ok(read('src/app/(auth)/subscribe/page.tsx').includes("{ via: 'direct', agreed_terms: agreed, ...browserTimeZone() }"))
})

test('the confirmation email states the end time in the zone it is given', async () => {
  writeFileSync(join(dir, 'send.mjs'), 'export const sendEmail = async () => ({ sent: true }); export const wrapEmailHtml = (b, f) => b + f')
  writeFileSync(join(dir, 'html.mjs'), 'export const escapeHtml = (x) => String(x)')
  const confirm = await load('confirm', read('src/lib/email/subscription-confirmation.ts').replace("from './send'", "from './send.mjs'").replace("from './html'", "from './html.mjs'").replace("from './timezone'", "from './timezone.mjs'").replace("from '@/lib/pricing'", "from './pricing.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  // The owner's own free week: 2026-11-24T07:02:54Z.
  const trialEnd = new Date('2026-11-24T07:02:54Z')
  const mail = (timezone) => JSON.stringify(confirm.buildSubscriptionConfirmationEmail({ trialEnd, cardOnFile: false, percentOff: null, timezone, startedOnOurPage: true, startedAtSignup: true }))
  const local = mail('America/Los_Angeles')
  assert.ok(local.includes('Monday, November 23'), 'the day the app shows')
  assert.ok(local.includes('11:02 PM PST'))
  assert.equal(local.includes('Tuesday, November 24'), false)
  assert.equal(/\bUTC\b/.test(local), false)
  // What the owner received, and what an unknown zone still gets.
  assert.ok(mail(null).includes('Tuesday, November 24'))
  assert.ok(/\bUTC\b/.test(mail(null)))
})

// ── 1. what is in the product ───────────────────────────────────────────────

function fakeDb(rows, { fail = false } = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      const q = { table, ids: [], range: null }
      const api = {
        select() { return api },
        in(_col, ids) { q.ids = ids; return api },
        order() { return api },
        range(from, to) {
          calls.push({ table, ids: q.ids, from, to })
          if (fail) return Promise.resolve({ data: null, error: { message: 'boom' } })
          const mine = rows.filter((r) => q.ids.includes(r.product_id))
          return Promise.resolve({ data: mine.slice(from, to + 1), error: null })
        },
      }
      return api
    },
  }
}

test('the full list comes back in label order, past the 1,000-row page', async () => {
  const { fullIngredientLists } = await load('ingredient-lists', read('src/lib/yuri/ingredient-lists.ts'))
  const rows = []
  for (const id of ['p1', 'p2']) for (let i = 1; i <= 700; i++) rows.push({ product_id: id, position: i, ingredient: { name_inci: `${id}-ing-${i}` } })
  const db = fakeDb(rows)
  const out = await fullIngredientLists(db, ['p1', 'p2', 'p1', null, undefined, 'p3'])
  assert.equal(out.failed, false)
  assert.equal(out.lists.get('p1').length, 700)
  assert.equal(out.lists.get('p2').length, 700)
  assert.equal(out.lists.get('p2')[699], 'p2-ing-700', 'the last ingredient is not cut off by the row cap')
  assert.equal(out.lists.has('p3'), false, 'a product with no rows has no list (not an empty one)')
  assert.deepEqual(db.calls.map((c) => [c.from, c.to]), [[0, 999], [1000, 1999]])
  assert.deepEqual(db.calls[0].ids, ['p1', 'p2', 'p3'])
})

test('a failed lookup is said to be a failure, never an empty list', async () => {
  const { fullIngredientLists, ingredientListsFact } = await load('ingredient-lists', read('src/lib/yuri/ingredient-lists.ts'))
  const realError = console.error
  console.error = () => {}
  try {
    const out = await fullIngredientLists(fakeDb([], { fail: true }), ['p1'])
    assert.deepEqual([out.failed, out.lists.size], [true, 0])
  } finally { console.error = realError }
  assert.match(ingredientListsFact(true), /could not be read/)
  assert.match(ingredientListsFact(true), /not a sign that these products are free of anything/)
  assert.match(ingredientListsFact(false), /`null` means we hold no list/)
  // A fact, not an order: it must not tell Yuri what to do with the list.
  for (const failed of [true, false]) assert.equal(/\b(you must|always|never|do not|don't|make sure|be sure|required)\b/i.test(ingredientListsFact(failed)), false)
  // True whatever else ran this turn: it speaks for this tool only.
  assert.match(ingredientListsFact(false), /This tool compared none of them with this member/)
  assert.deepEqual((await fullIngredientLists(fakeDb([]), [])).failed, false)
})

test('the sunscreen finder and the routine save both hand back the lists', () => {
  const tools = read('src/lib/yuri/tools.ts')
  const finder = tools.slice(tools.indexOf('async function executeFindSunscreenMatch('), tools.indexOf('async function executeFindProductDupes('))
  assert.ok(finder.includes('const held = await fullIngredientLists(getServiceClient(), products.map((r) => r.id))'))
  assert.ok(finder.includes('ingredients: held.failed ? null : held.lists.get(r.id) ?? null,'))
  assert.ok(finder.includes('about_ingredients: ingredientListsFact(held.failed),'))
  // The old note told her to recommend from attributes alone.
  assert.equal(finder.includes("Recommend from them based on the user"), false)
  const save = tools.slice(tools.indexOf('async function executeSaveRoutine('), tools.indexOf('async function executeFindSunscreenMatch('))
  assert.ok(save.includes('if (productId) catalogProductOfStep.set(saved, productId)'))
  assert.ok(finder.includes("note: 'These match the filters you set. None of the filters looks at what is in the formula. Which of them suits this person, if any, is yours to judge.',"))
  assert.ok(save.includes('const saved = await fullIngredientLists(db, [...catalogProductOfStep.values()])'))
  assert.ok(save.includes('ingredients_of_saved_products: ingredientsOfSavedProducts, about_ingredients: ingredientListsFact(saved.failed)'))
})

// ── a narrower place than they named ────────────────────────────────────────

test('both prompts count a narrower place among the facts Yuri does not supply', () => {
  for (const file of ['src/lib/yuri/onboarding.ts', 'src/lib/yuri/advisor.ts']) {
    assert.ok(read(file).includes('a sharper number than they gave, a narrower place than they named, a gender,'), file)
  }
})
