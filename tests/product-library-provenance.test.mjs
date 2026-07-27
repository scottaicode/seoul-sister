/**
 * Guard test — the product library must never present a GUESS as a FACT.
 *
 * July 27 2026. Bailey: "I don't even own the Beplain Makiol. Idk where that
 * came from I've never even heard of it."
 *
 * WHAT ACTUALLY HAPPENED (this was NOT a hallucination — the product is real):
 *   1. Yuri saved a routine step literally named "Shower / cleanse".
 *   2. resolveProductByName tokenized it to ["shower","cleanse"], found no
 *      product containing both, fell through to a loose OR search over 276
 *      candidates, and tie-broke on shortest name → Beplain Makiol Foaming
 *      Cleanser. Because the query was a contiguous substring, it scored
 *      'exact'.
 *   3. save_routine wrote that product into ss_user_products as a product
 *      Bailey OWNS (learned_from='conversation').
 *   4. memory.ts never SELECTed learned_from, so seven weeks later the row
 *      reached Yuri as a bare line under "These are products the user
 *      currently owns and uses."
 *   5. Yuri, with no instrument to doubt it, called it "your nightly cleanser,
 *      the one I keep telling you to reach for."
 *
 * Yuri was not overconfident. She was lied to by her own context. 11 of 19
 * active library rows were mis-joined this way across BOTH users — including a
 * device ("LED Mask" → Laneige Water Sleeping Mask), an instruction ("Cool
 * water rinse" → a Sun Cream), and a placeholder ("Moisturizer (TBD)" → an
 * SPF50+ product).
 *
 * This is the SAME defect class as the July 21 clinical-honesty bug, in the
 * SAME FILE ~80 lines away: a value the system guessed rendered identically to
 * one the user confirmed. The clinical sweep was scoped to ss_user_profiles and
 * never checked ss_user_products.
 *
 * LIMITS: this asserts the code shape, not model behavior. It cannot prove Yuri
 * heeds the hedge. The real teacher is whether users stop being told they own
 * things they don't.
 *
 * Pure — no compile, no DB, no network. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const memory = read('src', 'lib', 'yuri', 'memory.ts')
const tools = read('src', 'lib', 'yuri', 'tools.ts')
const libraryApi = read('src', 'app', 'api', 'library', 'route.ts')

// ---------------------------------------------------------------------------
// 1. PROVENANCE MUST SURVIVE THE READ PATH.
// ---------------------------------------------------------------------------

test('learned_from is SELECTed from ss_user_products', () => {
  const sel = memory.match(/\.from\('ss_user_products'\)\s*\n\s*(?:\/\/[^\n]*\n\s*)*\.select\(([^)]*)\)/)
  assert.ok(sel, 'could not find the ss_user_products select in memory.ts')
  assert.ok(
    sel[1].includes('learned_from'),
    'learned_from is not selected — provenance is dropped at the query, which is ' +
      'the exact bug: an inferred row then reaches Yuri identical to a confirmed one.'
  )
})

test('learned_from survives into the UserProduct type and mapper', () => {
  assert.ok(
    /export interface UserProduct\b[\s\S]{0,600}?learned_from/.test(memory),
    'UserProduct interface is missing learned_from'
  )
  assert.ok(
    /learned_from:\s*\(r\.learned_from/.test(memory),
    'the row mapper drops learned_from, so the render can never see it'
  )
})

// ---------------------------------------------------------------------------
// 2. THE RENDER MUST DISTINGUISH CONFIRMED FROM INFERRED.
// ---------------------------------------------------------------------------

test('the inventory header no longer asserts blanket ownership', () => {
  assert.ok(
    !/These are products the user currently owns and uses\./.test(memory),
    'the old unconditional "products the user currently owns and uses" header is back — ' +
      'it presents fuzzy-matched guesses as confirmed fact'
  )
})

test('inferred products render under an explicit not-confirmed heading', () => {
  assert.ok(
    /Inferred from conversation — NOT confirmed/.test(memory),
    'lost the inferred-products section heading'
  )
  assert.ok(
    /Confirmed — they told you about these directly/.test(memory),
    'lost the confirmed-products section heading'
  )
})

test('Yuri is told not to claim ownership of inferred entries', () => {
  assert.ok(
    /[Dd]o not say "your X" or claim they own these/.test(memory),
    'the inferred block no longer forbids claiming ownership — this is the exact ' +
      'sentence Bailey needed ("your nightly cleanser") to never be written'
  )
})

test('the hedge INVITES a question rather than filtering rows out', () => {
  // Yuri Sole Authority: surface the fact + confidence, let her judge. A rule
  // that silently drops low-confidence rows would hide data from her instead.
  assert.ok(
    /are you actually using X, or did I pick that up wrong/.test(memory),
    'lost the ask-to-confirm guidance'
  )
  assert.ok(
    !/\.filter\([^)]*learned_from[^)]*\)\s*\/\/\s*drop/i.test(memory),
    'inferred rows appear to be filtered out of context entirely — surface them with ' +
      'a confidence marker instead; hiding data removes Yuri judgment'
  )
})

// ---------------------------------------------------------------------------
// 3. THE WRITE PATH MUST REQUIRE AN IDENTIFYING TERM.
// ---------------------------------------------------------------------------

test('generic category/step words are enumerated', () => {
  assert.ok(/const GENERIC_PRODUCT_WORDS = new Set\(\[/.test(tools), 'GENERIC_PRODUCT_WORDS is gone')
  for (const w of ['cleanse', 'serum', 'toner', 'shower', 'rinse', 'tbd', 'led', 'roller']) {
    assert.ok(
      new RegExp(`'${w}'`).test(tools.slice(tools.indexOf('GENERIC_PRODUCT_WORDS'), tools.indexOf('GENERIC_PRODUCT_WORDS') + 2000)),
      `"${w}" missing from GENERIC_PRODUCT_WORDS — it was one of the real failure terms`
    )
  }
})

test('the identity floor runs BEFORE the substring exact-match tests', () => {
  const fnStart = tools.indexOf('let match_quality:')
  assert.ok(fnStart !== -1, 'could not locate match_quality assignment')
  const block = tools.slice(fnStart, fnStart + 1800)
  const floorAt = block.indexOf('hasIdentifyingTerm')
  const exactAt = block.indexOf('combinedLower.includes(queryLower)')
  assert.ok(floorAt !== -1, 'the identity floor is missing from resolveProductByName')
  assert.ok(exactAt !== -1, 'could not locate the exact-match test')
  assert.ok(
    floorAt < exactAt,
    'the identity floor must be checked BEFORE the substring test — otherwise a bare ' +
      '"Serum" still scores exact (it is a substring of 668 catalog products) and gets written'
  )
})

test('an all-generic query is demoted to partial, which write paths refuse', () => {
  assert.ok(
    /if \(terms\.length > 0 && !hasIdentifyingTerm\(terms\)\) \{\s*\n\s*match_quality = 'partial'/.test(tools),
    'an all-generic query no longer resolves to partial'
  )
  // The existing write guard must still be the thing that refuses partial.
  assert.ok(
    /match_quality !== 'partial'/.test(tools),
    'save_routine lost its partial-match write guard'
  )
})

// ---------------------------------------------------------------------------
// 4. THE MISMATCH MUST BE VISIBLE SERVER-SIDE.
// ---------------------------------------------------------------------------

test('loose/unmatched routine steps are logged, not just narrated', () => {
  assert.ok(
    /\[save_routine\] step not confidently matched/.test(tools),
    'the loose-match console.warn is gone — save_routine computes this mismatch and, ' +
      'without the log, the only trace is Yuri prose nobody audits (it survived 7 weeks)'
  )
})

// ---------------------------------------------------------------------------
// 5. THE UI MUST SHOW THE USER THEIR OWN WORDS.
// ---------------------------------------------------------------------------

test("inferred library rows display the user's own name, not the catalog's", () => {
  assert.ok(
    !/display_name:\s*linked\?\.name_en \|\| row\.custom_name \|\| 'Unnamed item'/.test(libraryApi),
    'catalog name unconditionally beats the user\'s words again — this is why Bailey saw ' +
      '"Makiol Foaming Cleanser" where she had written "Shower / cleanse"'
  )
  assert.ok(
    /conversation_inferred[\s\S]{0,200}row\.custom_name/.test(libraryApi),
    'inferred rows no longer prefer custom_name for display'
  )
})
