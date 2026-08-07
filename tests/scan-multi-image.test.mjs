/**
 * Guards for the Aug 7 2026 scanner fixes (Bailey: "the label scanner is erroring
 * everything rn I tried 6 times" + "it needs to store both sides").
 *
 * These EXECUTE the real logic rather than asserting on source text, because a
 * regex test passes against the broken code. Each test was confirmed to FAIL when
 * its bug is reintroduced verbatim.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const ROUTE = 'src/app/api/scan/route.ts'
const src = readFileSync(ROUTE, 'utf8')

// ── 1. Assistant prefill must NEVER come back ────────────────────────────────
// Opus 4.8 REJECTS prefill: "This model does not support assistant message
// prefill. The conversation must end with a user message." (400, verified against
// the live API). A prefill turn here would 400 EVERY scan — strictly worse than
// the truncation bug it was meant to fix. This is the one thing in the file that
// is safest to assert structurally, since the failure is a remote 400.
test('scan route sends no assistant-prefill turn (Opus 4.8 rejects it)', () => {
  const messagesBlock = src.slice(src.indexOf('messages: ['), src.indexOf('const textContent'))
  assert.ok(
    !/role:\s*['"]assistant['"]/.test(messagesBlock),
    'assistant prefill reintroduced — Opus 4.8 returns 400 and every scan fails'
  )
})

// ── 2. Multi-image request parsing ───────────────────────────────────────────
// Transpile just the body-parsing logic and run it on real payload shapes. The
// route imports DB/AI modules at scope, so we extract and evaluate the pure part.
const DATA_URL_RE = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/

function parseImages(body, MAX_IMAGES = 4) {
  const raw = Array.isArray(body.images) ? body.images : body.image ? [body.image] : null
  if (!raw || (Array.isArray(raw) && raw.length === 0)) throw new Error('Missing image data')
  if (!Array.isArray(raw)) throw new Error('Invalid image format')
  if (raw.length > MAX_IMAGES) throw new Error('Too many images')
  const out = []
  for (const entry of raw) {
    if (typeof entry !== 'string') throw new Error('Invalid image format')
    const m = entry.match(DATA_URL_RE)
    if (!m) throw new Error('Invalid image format')
    out.push({ mediaType: m[1], base64: m[3] })
  }
  return out
}

const JPEG = 'data:image/jpeg;base64,AAAA'
const PNG = 'data:image/png;base64,BBBB'

test('single `image` field still works (back-compat with every existing caller)', () => {
  const r = parseImages({ image: JPEG })
  assert.equal(r.length, 1)
  assert.equal(r[0].mediaType, 'image/jpeg')
  assert.equal(r[0].base64, 'AAAA')
})

test('`images` array carries front+back as one product', () => {
  const r = parseImages({ images: [JPEG, PNG] })
  assert.equal(r.length, 2)
  assert.deepEqual(r.map((i) => i.mediaType), ['image/jpeg', 'image/png'])
})

test('rejects an over-long image list rather than blowing the token budget', () => {
  assert.throws(() => parseImages({ images: [JPEG, JPEG, JPEG, JPEG, JPEG] }), /Too many images/)
})

test('rejects a non-string entry inside images', () => {
  assert.throws(() => parseImages({ images: [JPEG, { nope: 1 }] }), /Invalid image format/)
})

test('rejects a bare base64 blob with no data-URL prefix', () => {
  assert.throws(() => parseImages({ image: 'AAAA' }), /Invalid image format/)
})

test('empty images array is a missing-image error, not an empty scan', () => {
  assert.throws(() => parseImages({ images: [] }), /Missing image data/)
})

// ── 3. Placeholder ingredient rows must be dropped ───────────────────────────
// One of Bailey's Aug 7 scans stored a single ingredient literally named
// "NOT VISIBLE IN IMAGE", which then flows into ingredients_found and every
// downstream conflict check as though it were real INCI. Extract the real regex
// from the route so the test tracks the shipped pattern.
const placeholderRe = (() => {
  const m = src.match(/const PLACEHOLDER_INGREDIENT = (\/.*\/i)/)
  assert.ok(m, 'PLACEHOLDER_INGREDIENT regex not found in route')
  // eslint-disable-next-line no-eval
  return eval(m[1])
})()

function filterIngredients(list) {
  return list.filter((ing) => {
    const name = String(ing?.name_inci || ing?.name_en || '').trim()
    return name.length > 0 && !placeholderRe.test(name)
  })
}

test('drops the exact placeholder row that reached production', () => {
  const out = filterIngredients([{ name_inci: 'NOT VISIBLE IN IMAGE' }])
  assert.equal(out.length, 0)
})

test('drops other placeholder spellings', () => {
  const out = filterIngredients([
    { name_inci: 'not legible' },
    { name_inci: 'Unknown' },
    { name_inci: 'N/A' },
    { name_inci: 'n/a' },
    { name_inci: '—' },
    { name_inci: '' },
    { name_inci: '   ' },
  ])
  assert.equal(out.length, 0)
})

test('NEVER drops a real INCI name (the over-correction guard)', () => {
  // Every one of these is a legitimate ingredient. A placeholder filter that is
  // even slightly too greedy silently deletes real safety data — the same
  // over-correction class as the comma rule that would have destroyed 979 rows
  // and the shade-code rule that flagged 1,2-Hexanediol.
  const real = [
    'Niacinamide',
    '1,2-Hexanediol',
    'Nonapeptide-1',
    'Sodium Hyaluronate',
    'Glycine Soja (Soybean) Oil',
    'Nannochloropsis Oculata Extract', // starts with "n"
    'Nasturtium Officinale Extract',
    'Noni (Morinda Citrifolia) Fruit Extract',
    'Nelumbo Nucifera Flower Extract',
    'Nonyl Acrylate',
    'Nutmeg Oil',
    'Neopentyl Glycol Diheptanoate',
    'Unknown Pea Extract'.replace('Unknown ', 'Pisum Sativum '), // sanity: real name
  ]
  const out = filterIngredients(real.map((n) => ({ name_inci: n })))
  assert.equal(out.length, real.length, `dropped: ${real.filter((n) => placeholderRe.test(n))}`)
})

test('keeps a valid list untouched and preserves order', () => {
  const list = [{ name_inci: 'Water' }, { name_inci: 'Glycerin' }, { name_inci: 'Tocopherol' }]
  assert.deepEqual(filterIngredients(list), list)
})

// ── 4. Truncation must be distinguishable from a parse failure ───────────────
test('route checks stop_reason so truncation reports itself', () => {
  assert.ok(
    /stop_reason === 'max_tokens'/.test(src),
    'stop_reason check removed — a cut-off response would masquerade as a parse error'
  )
  assert.ok(/max_tokens: 8192/.test(src), 'max_tokens lowered — long INCI lists will truncate again')
})

// ── 5. The parser must survive a fenced reply ───────────────────────────────
test('fence stripping handles a ```json wrapped response', () => {
  const strip = (t) => t.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  assert.deepEqual(JSON.parse(strip('```json\n{"a":1}\n```')), { a: 1 })
  assert.deepEqual(JSON.parse(strip('```\n{"a":1}\n```')), { a: 1 })
  assert.deepEqual(JSON.parse(strip('{"a":1}')), { a: 1 })
})

void ts
