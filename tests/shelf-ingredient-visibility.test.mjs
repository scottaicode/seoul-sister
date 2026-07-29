/**
 * Guard test — Phase 1 shelf visibility.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * ss_ingredient_conflicts holds a HIGH-severity "Retinol + Glycolic Acid" rule
 * ("significantly increases risk of irritation, redness, peeling, and a
 * compromised skin barrier"). A paying subscriber was running exactly that on a
 * post-Accutane barrier and had told Yuri so.
 *
 * The rule could not fire for her. Both products were custom entries with
 * product_id = NULL, and every catalog-keyed check joins ss_product_ingredients
 * by product_id, so they contributed zero ingredients and the check returned
 * { safe: true, conflicts: [] }. The silence was indistinguishable from an
 * all-clear.
 *
 * Meanwhile the data already existed: a Cetaphil scan captured 11 real INCI
 * strings, and NOTHING read them back except a count on a dashboard widget.
 *
 * Source-structural assertions only — no compile, no API, no DB. `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const memorySrc = read('src', 'lib', 'yuri', 'memory.ts')
const toolsSrc = read('src', 'lib', 'yuri', 'tools.ts')
const advisorSrc = read('src', 'lib', 'yuri', 'advisor.ts')
const scanSrc = read('src', 'app', 'api', 'scan', 'route.ts')
const sunscreenSrc = read('src', 'app', '(app)', 'sunscreen', 'page.tsx')
const uploadSrc = read('src', 'components', 'scan', 'UploadDropZone.tsx')
const migrationSrc = read('scripts', 'migrations', 'add_custom_entry_ingredients.sql')

// --- The context must SHOW the gap -----------------------------------------

test('Yuri is told which products she cannot see into', () => {
  assert.match(
    memorySrc,
    /NO INGREDIENTS ON FILE/,
    'A custom entry with no INCI must render as explicitly blind, not as a normal product.'
  )
  assert.match(
    memorySrc,
    /INGREDIENT VISIBILITY: you have ingredients for/,
    'Lost the running visibility count — Yuri cannot tell how much of the shelf she is reasoning over.'
  )
})

test('the visibility block names the safety consequence, not just the count', () => {
  assert.match(
    memorySrc,
    /means you did not check it — it does not mean it is safe/,
    'The whole point is that a clean result on an unseen product is silence, not an all-clear.'
  )
})

test('ingredient visibility is a FACT, never a command', () => {
  // Same doctrine as cumulative-give.ts: surface the state, hand judgment back.
  // If this becomes "you MUST refuse" or "always say X", it has become a cage.
  const block = memorySrc.slice(
    memorySrc.indexOf('INGREDIENT VISIBILITY'),
    memorySrc.indexOf('INGREDIENT VISIBILITY') + 1600
  )
  assert.match(
    block,
    /This is a fact about your own visibility, not a rule about what to say/,
    'Lost the explicit fact-not-rule framing.'
  )
  assert.ok(
    !/\bYou MUST\b|\bnever recommend\b|\brefuse to\b/i.test(block),
    'The visibility fact must not harden into a command — that breaks Yuri Sole Authority.'
  )
})

test('the new columns are actually SELECTed', () => {
  // learned_from was populated for months and never selected, so an inferred row
  // reached Yuri identical to a confirmed one. Same trap here.
  assert.match(
    memorySrc,
    /\.select\('product_id, custom_name[^']*ingredients_inci, ingredients_source'\)/,
    'ingredients_inci/ingredients_source not selected — every entry will render blind.'
  )
})

// --- Recording ingredients --------------------------------------------------

test('update_user_product can record INCI with provenance', () => {
  assert.match(toolsSrc, /ingredients_inci: \{\s*type: 'array'/, 'Lost the ingredients_inci tool input.')
  assert.match(
    toolsSrc,
    /enum: \['label_scan', 'web_lookup'\]/,
    'Lost the provenance enum on ingredients_source.'
  )
})

test('an ingredient list without a stated provenance is refused', () => {
  assert.match(
    toolsSrc,
    /ingredients_source is required when sending ingredients_inci/,
    'A list whose origin we cannot name must not be stored as fact.'
  )
  assert.match(
    migrationSrc,
    /ss_user_products_ingredients_paired_check/,
    'The DB must also refuse a list without a source (and vice versa).'
  )
})

test('Yuri is warned about the product-line variant trap', () => {
  // Measured: searching "Byoma toner" returns Brightening / Milky / Balancing —
  // different actives. A near-miss INCI makes a safety check LOOK done.
  assert.match(
    advisorSrc,
    /variant trap/i,
    'Lost the variant warning — a sibling product INCI can be recorded as the user’s.'
  )
  assert.match(
    advisorSrc,
    /worse than none/,
    'Must state that a wrong ingredient list is worse than no ingredient list.'
  )
  assert.match(advisorSrc, /Never write a list from memory/, 'Lost the no-fabrication rule.')
})

test('Yuri is told to ask for the BACK of the bottle', () => {
  assert.match(advisorSrc, /BACK of the bottle/, 'Front-of-bottle photos carry no INCI.')
})

// --- The scan must carry its own INCI into the library ----------------------

test('a non-catalog scan attaches its INCI to the library entry', () => {
  assert.match(
    scanSrc,
    /ingredients_source: 'label_scan'/,
    'Scanned INCI is no longer written to the user’s library entry.'
  )
  assert.match(
    scanSrc,
    /!productMatch\?\.id && looksLikeRealInci/,
    'Must only fire for products NOT in the catalog, and only for a real INCI list.'
  )
})

test('placeholder text is never stored as an ingredient list', () => {
  // A front-of-bottle photo produced ingredients_found = ["Not listed on
  // visible label"]. Storing that would make a blind product look examined.
  assert.match(
    scanSrc,
    /\^not listed\|\^unknown/,
    'Lost the placeholder guard — "Not listed on visible label" would be stored as INCI.'
  )
})

test('scanning never creates a library row', () => {
  // Scanning is curiosity, not a statement of ownership.
  const block = scanSrc.slice(scanSrc.indexOf('Carry a non-catalog scan'))
  assert.ok(
    !/\.insert\(/.test(block.slice(0, 2000)),
    'The scan INCI path must only UPDATE an owned entry, never insert one.'
  )
})

// --- Wrong-product hazard ---------------------------------------------------

test('find_product_dupes refuses a weak name match', () => {
  const dupeBlock = toolsSrc.slice(toolsSrc.indexOf('async function executeFindProductDupes'))
  assert.match(
    dupeBlock.slice(0, 2000),
    /match\.match_quality === 'partial'/,
    'Dupes computed against a partial match are dupes for a DIFFERENT product.'
  )
})

// --- Honest sunscreen copy --------------------------------------------------

test('the contradicted sunscreen elegance claim is gone from RENDERED copy', () => {
  // Consumer Reports (Jul 10 2026) sensory panel: the Korean sunscreens
  // "required a fair amount of effort to rub in", "initially felt greasy and
  // left a white cast", and "none stood out as being super lightweight".
  //
  // Strip JSX comments first — the file deliberately QUOTES the retired claim
  // to explain why it was retired, and that must not count as shipping it.
  const rendered = sunscreenSrc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  assert.ok(
    !/lightweight, cosmetically elegant/.test(rendered),
    'The contradicted "lightweight, cosmetically elegant" claim is back in user-visible copy.'
  )
  assert.ok(
    !/years ahead of Western counterparts/.test(rendered),
    'Unsupported blanket superiority claim is back in user-visible copy.'
  )
})

test('sunscreen copy keeps the measured protection finding and the reformulation caveat', () => {
  assert.match(sunscreenSrc, /SPF 36 vs 19/, 'Lost the measured CR figures.')
  assert.match(
    sunscreenSrc,
    /reformulated/,
    'Users must know the US-shelf version is NOT the tested Korean formula.'
  )
})

test('the scanner asks for the ingredients side of the bottle', () => {
  assert.match(
    uploadSrc,
    /back of the bottle/i,
    'Lost the guidance that produced blank scans when a user shot the front.'
  )
})
