/**
 * Guard tests — a safety check that FAILED must never read as one that PASSED.
 *
 * The July 30 v11.18.0 work fixed the specific lines that broke. This closes
 * the siblings on the same paths: queries whose failure produced a confident
 * all-clear, ranked by an independent verification pass against live data.
 *
 * WHAT WAS ACTUALLY BROKEN
 *
 * 1. check_ingredient_conflicts — three queries fed one boolean. The conflict
 *    RULE TABLE, the product ingredient lists, and the allergy profile all
 *    destructured only `data`. If the rule table query died, the match loop ran
 *    zero times and the tool returned:
 *
 *      {"conflicts":[],"allergy_warnings":[],"safe":true,"ingredients_checked":47}
 *
 *    A false all-clear WITH corroborating detail — `ingredients_checked: 47`
 *    actively tells Yuri the check was thorough. Nothing in the payload let her
 *    detect it. 5 real rules live in ss_ingredient_conflicts including a HIGH
 *    severity Retinol + Glycolic Acid.
 *
 * 2. conflict-detector.ts — the July 30 fix instrumented the three `.in()`
 *    calls but left the `.eq()` calls that gate EARLY `return { safe: true }`
 *    statements, which run FIRST. Worse: the throws it did add were swallowed
 *    by a bare `catch {}` at the call site in routine/[id]/route.ts, and again
 *    in the routine page, so the fix was invisible to users. Instrumenting a
 *    library without fixing the swallowing call site ships nothing.
 *
 * 3. scan/route.ts — the conflict query built scannedIds × routineIds `or`
 *    clauses in ONE URL. Measured against live data: a subscriber with 163
 *    routine ingredients and a ~30-ingredient label produces 9,780 clauses,
 *    roughly 880 KB of URL. It could NOT succeed for the users with the most to
 *    lose, and a `catch {}` commented "non-critical" hid that. Replaced with
 *    the two-`.in()` pattern already proven in conflict-detector.ts.
 *
 * 4. get_personalized_match — the tool's own comment calls it "a SAFETY
 *    verdict". A dead ingredient query meant the allergy loop never ran,
 *    `warnings` stayed empty, and it reported a good match for a product
 *    containing the user's allergen.
 *
 * 5. get_routine_context — empty `user_allergies` reads as an affirmative
 *    "this user has no allergies", which is an absence asserting a fact.
 *
 * DESIGN NOTE: throwing is safe inside tools.ts because executeYuriTool wraps
 * dispatch and converts a throw into a tool result Yuri must surface. It is NOT
 * safe in API routes, where throws were being caught and discarded — those use
 * an explicit failure FLAG instead, wired all the way to the UI.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

/** Isolate one function's source so assertions can't match a neighbour. */
function fnSource(src, startMarker, endMarker) {
  const i = src.indexOf(startMarker)
  assert.ok(i > 0, `could not find ${startMarker}`)
  const j = src.indexOf(endMarker, i)
  return src.slice(i, j > 0 ? j : i + 20000)
}

// ---------------------------------------------------------------------------
// 1. check_ingredient_conflicts — the worst site
// ---------------------------------------------------------------------------

test('check_ingredient_conflicts cannot return safe:true when a check failed', () => {
  const tools = read('src', 'lib', 'yuri', 'tools.ts')
  const fn = fnSource(tools, 'async function executeCheckIngredientConflicts', 'Tool: get_trending_products')

  // All three feeding queries must surface their error.
  assert.match(fn, /const \{ data: links, error: linksError \}/, 'ingredient links must check error')
  assert.match(fn, /const \{ data: conflicts, error: conflictsError \}/, 'conflict RULE TABLE must check error')
  assert.match(fn, /const \{ data: profile, error: profileError \}/, 'allergy profile must check error')

  // The verdict must be null — not true — when anything did not run.
  assert.match(
    fn,
    /safe:\s*\n?\s*checkFailures\.length > 0\s*\n?\s*\?\s*null/,
    '`safe` must be null when a check failed, never a boolean'
  )
  assert.match(fn, /check_complete: checkFailures\.length === 0/)
  assert.match(fn, /check_failed_warning/, 'a failed check must carry an explicit warning')

  // The old unconditional verdict must be gone.
  assert.ok(
    !/safe: foundConflicts\.length === 0 && allergyWarnings\.length === 0,/.test(fn),
    'the unconditional safe:true verdict is back'
  )
})

test('each failed check names what was not screened, not just that it failed', () => {
  const tools = read('src', 'lib', 'yuri', 'tools.ts')
  const fn = fnSource(tools, 'async function executeCheckIngredientConflicts', 'Tool: get_trending_products')
  // Three distinct pushes, so Yuri can say WHICH half is unknown.
  assert.equal((fn.match(/checkFailures\.push\(/g) || []).length, 3)
  assert.match(fn, /NO conflict check ran at all/)
  assert.match(fn, /allergy list on file could not be read/)
})

// ---------------------------------------------------------------------------
// 2. conflict-detector — the early returns, and the swallowing call sites
// ---------------------------------------------------------------------------

test('every query gating an early safe:true surfaces its error', () => {
  const src = read('src', 'lib', 'intelligence', 'conflict-detector.ts')

  for (const name of [
    'newProductIngredientsError',
    'routineProductsError',
    'existingIngredientsError',
    'candidateRulesError',
  ]) {
    assert.ok(src.includes(name), `${name} must be destructured`)
  }

  // No bare destructure may remain on a query that gates a verdict. The two
  // name lookups are exempt: they run AFTER conflicts are found and only
  // degrade names to "Unknown", so they log instead of throwing.
  const bare = [...src.matchAll(/const \{ data: (\w+) \} = await supabase/g)].map((m) => m[1])
  assert.deepEqual(bare, [], `bare destructures remain: ${bare.join(', ')}`)
})

test('the name lookups log but do NOT throw — they degrade a real warning', () => {
  const src = read('src', 'lib', 'intelligence', 'conflict-detector.ts')
  // Both name lookups: destructured, guarded, and logged (3 refs each).
  assert.equal(
    (src.match(/const \{ data: allNames, error: allNamesError \}/g) || []).length,
    2,
    'both name lookups must destructure error'
  )
  assert.equal(
    (src.match(/console\.error\('\[conflict-detector\] ingredient-name lookup failed:/g) || []).length,
    2,
    'both name-lookup failures must be logged'
  )
  assert.ok(
    !/if \(allNamesError\) \{[\s\S]{0,120}?throw/.test(src),
    'a name-lookup failure must not suppress a conflict that WAS found'
  )
})

test('the routine API no longer discards the conflict-check failure', () => {
  const src = read('src', 'app', 'api', 'routine', '[id]', 'route.ts')
  assert.ok(
    !/catch \{\s*\n\s*\/\/ Non-critical\s*\n\s*\}/.test(src),
    'the bare catch that neutralized the July 30 throws is back'
  )
  assert.match(src, /conflictCheckFailed = true/)
  assert.match(src, /conflict_check_failed: conflictCheckFailed/, 'the flag must reach the response')
})

test('the routine UI renders the failure instead of nothing', () => {
  const page = read('src', 'app', '(app)', 'routine', 'page.tsx')
  assert.match(page, /setConflictCheckFailed\(Boolean\(data\.conflict_check_failed\)\)/)
  assert.match(page, /conflicts\.length > 0 \|\| conflictCheckFailed/, 'must render when the check failed')
  assert.match(page, /checkFailed=\{conflictCheckFailed\}/)

  const cmp = read('src', 'components', 'routine', 'ConflictWarning.tsx')
  assert.match(cmp, /checkFailed = false/, 'component must accept the flag')
  assert.match(cmp, /if \(checkFailed\)/, 'component must branch on it BEFORE the empty-list early return')
  assert.match(cmp, /doesn&apos;t mean it&apos;s clear/, 'copy must not imply the routine is fine')

  // The failure branch must come first — otherwise conflicts.length === 0
  // returns null and the failure never renders.
  assert.ok(
    cmp.indexOf('if (checkFailed)') < cmp.indexOf('if (conflicts.length === 0) return null'),
    'the checkFailed branch must precede the empty-list return'
  )
})

// ---------------------------------------------------------------------------
// 3. scan route — the O(n²) URL and the silent catch
// ---------------------------------------------------------------------------

test('scan conflict lookup no longer builds an unbounded or() URL', () => {
  const src = read('src', 'app', 'api', 'scan', 'route.ts')
  assert.ok(
    !/scannedIds\.map\(\(sid\) =>[\s\S]{0,200}?routineIds\.map/.test(src),
    'the scannedIds x routineIds or() construction is back — it cannot succeed at real scale'
  )
  assert.match(src, /\.in\('ingredient_a_id', bothSides\)/)
  assert.match(src, /\.in\('ingredient_b_id', bothSides\)/)
  // Pairing now happens in memory, spanning scanned <-> routine in either order.
  assert.match(src, /scannedIdSet\.has\(c\.ingredient_a_id\) && routineIdSet\.has\(c\.ingredient_b_id\)/)
})

test('scan reports a failed conflict check instead of an empty list', () => {
  const src = read('src', 'app', 'api', 'scan', 'route.ts')
  assert.ok(
    !/\} catch \{\s*\n\s*\/\/ Conflict detection is non-critical/.test(src),
    'the silent catch is back'
  )
  assert.match(src, /conflictCheckFailed = true/)
  assert.match(src, /conflict_check_failed: conflictCheckFailed/)
  // Both gating queries must rethrow into that catch.
  assert.match(src, /scanned-ingredient lookup failed/)
  assert.match(src, /routine-ingredient lookup failed/)
  assert.match(src, /conflict rule lookup failed/)
})

// ---------------------------------------------------------------------------
// 4 & 5. the remaining Yuri safety surfaces
// ---------------------------------------------------------------------------

test('get_personalized_match refuses rather than clearing a product blindly', () => {
  const tools = read('src', 'lib', 'yuri', 'tools.ts')
  const fn = fnSource(tools, 'async function executeGetPersonalizedMatch', 'async function executeGetRoutineContext')

  assert.match(fn, /const \{ data: profile, error: profileError \}/)
  assert.match(fn, /const \{ data: ingredientLinks, error: ingredientLinksError \}/)
  assert.match(fn, /if \(ingredientLinksError\) \{[\s\S]{0,300}?throw new Error/)
  assert.match(fn, /cannot be screened against allergies/)
})

test('get_routine_context says "not loaded" instead of implying "none"', () => {
  const tools = read('src', 'lib', 'yuri', 'tools.ts')
  const fn = fnSource(tools, 'async function executeGetRoutineContext', 'Tool: save_routine')

  assert.match(fn, /const \{ data: conflictsData, error: conflictsDataError \}/)
  assert.match(fn, /const \{ data: profile, error: profileError \}/)
  assert.match(fn, /context_complete: contextGaps\.length === 0/)
  assert.match(fn, /context_warning/)
  assert.match(
    fn,
    /mean NOT LOADED, not "none"/,
    'the warning must say an empty list is not an assertion of absence'
  )
  // Context, not a verdict — must NOT throw and kill routine building.
  assert.ok(
    !/if \(conflictsDataError\) \{[\s\S]{0,200}?throw/.test(fn),
    'a degraded context read must not abort routine building'
  )
})

// ---------------------------------------------------------------------------
// The prompt half — a flag nothing reads is not a fix
// ---------------------------------------------------------------------------

test('Yuri is told a failed check is not a passed check', () => {
  const src = read('src', 'lib', 'yuri', 'advisor.ts')

  assert.match(src, /A CHECK THAT FAILED IS NOT A CHECK THAT PASSED \(NON-NEGOTIABLE\)/)
  // It must name the exact signals the tools now emit, or it cannot be applied.
  for (const signal of ['safe: null', 'check_complete: false', 'context_complete: false', 'check_failed_warning', 'context_warning']) {
    assert.ok(src.includes(signal), `the rule must name the ${signal} signal`)
  }
  assert.match(src, /NOTHING WAS CHECKED, not that nothing is wrong/)
  // And it must forbid the specific phrasings that would paper over it.
  assert.match(src, /no conflicts/)
  assert.match(src, /safe to layer/)
})

test('the machinery rule still cannot be read as license to hide a failed check', () => {
  // "NEVER narrate the machinery" governs REGISTER, not content. If that
  // reconciling clause is ever removed, the new honesty rule becomes ambiguous.
  const src = read('src', 'lib', 'yuri', 'advisor.ts')
  assert.match(src, /This never licenses hiding a fact the user needs/)
  assert.match(src, /governs the REGISTER, not the content/)
})
