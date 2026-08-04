/**
 * Guard test — the routine generator was blind to medical history, and
 * invented a skin type when the profile query failed.
 *
 * WHAT WAS BROKEN (verified against the live profiles table, Aug 4 2026)
 *
 * 1. `medical_history`, `sun_history` and `fitzpatrick_scale` were NEVER
 *    SELECTED by /api/routine/generate. Meanwhile the route's own comment on
 *    the catalog query says UV filter choice "matters enormously for users with
 *    skin cancer history, high Fitzpatrick sensitivity, or known chemical-filter
 *    reactions" — a fact it then never loaded.
 *
 *    Live data: one subscriber has "skin cancer history — approximately 25
 *    cancers removed, ongoing treatment since early 30s" with a STATED
 *    Fitzpatrick I. Another is post-Accutane. Both received generated routines
 *    built without either fact. CLAUDE.md is explicit that medical history
 *    REFRAMES advice and is not an allergen list.
 *
 * 2. A failed profile query fell through to the string
 *    "No skin profile available. Recommend a balanced routine for combination
 *    skin." — so a transient error silently DROPPED the user's allergies and
 *    INVENTED a skin type, while still producing a confident routine. This is a
 *    prompt-construction site: there is no tool result for a flag to ride on,
 *    so it now fails closed with a 503.
 *
 * 3. `Allergies: ... || 'None reported'` asserted an absence as a finding. An
 *    empty column is "nothing recorded", not "this person has no allergies".
 *
 * These tests EXECUTE the real prompt-building expression against profile
 * shapes taken from live rows. A regex over source cannot tell whether a
 * clinical fact actually reaches the model.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

/**
 * Lift the real skinInfo/medicalBlock construction out of the route and run it.
 * The route imports Supabase at module scope, so we transpile just this slice.
 */
async function loadSkinInfoBuilder() {
  const src = read('src', 'app', 'api', 'routine', 'generate', 'route.ts')

  const medical = src.match(/const medicalHistory = [\s\S]*?const medicalBlock = [\s\S]*?\n      : ''/)
  assert.ok(medical, 'medicalBlock construction not found')

  const skinInfo = src.match(/const skinInfo = profile\n[\s\S]*?Budget: \$\{budget_range \?\? 'mid-range'\}`/)
  assert.ok(skinInfo, 'skinInfo construction not found')

  const body = `
export function buildSkinInfo(profile, concerns, budget_range) {
  ${medical[0]}
  ${skinInfo[0]}
  return skinInfo
}`
  const js = ts.transpileModule(body, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-routine-'))
  const file = join(dir, 'skininfo.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

// Shapes taken from real ss_user_profiles rows.
const SKIN_CANCER_USER = {
  skin_type: 'dry',
  skin_concerns: ['dryness'],
  allergies: [],
  climate: 'temperate',
  age_range: '55-64',
  budget_range: 'mid-range',
  experience_level: 'intermediate',
  medical_history: ['skin cancer history — approximately 25 cancers removed, ongoing treatment since early 30s'],
  sun_history: 'heavy lifetime sun exposure',
  fitzpatrick_scale: 1,
  fitzpatrick_source: 'stated',
}

const ACCUTANE_USER = {
  skin_type: 'combination',
  skin_concerns: ['acne'],
  allergies: ['fragrance'],
  climate: 'humid',
  age_range: '25-34',
  budget_range: 'mid-range',
  experience_level: 'beginner',
  medical_history: ['took accutane in college', 'acne re-developed in twenties'],
  sun_history: null,
  fitzpatrick_scale: 1,
  fitzpatrick_source: 'estimated',
}

test('a skin cancer history reaches the routine prompt', async () => {
  const { buildSkinInfo } = await loadSkinInfoBuilder()
  const out = buildSkinInfo(SKIN_CANCER_USER, undefined, undefined)

  assert.match(out, /approximately 25 cancers removed/, 'the medical fact must be in the prompt')
  assert.match(out, /REFRAME the routine, they are NOT allergens/, 'and must be framed correctly')
  assert.match(out, /sun protection the treatment rather than a footnote/)
  assert.match(out, /heavy lifetime sun exposure/, 'sun history must reach the prompt')
})

test('a STATED Fitzpatrick is distinguishable from an ESTIMATED one', async () => {
  const { buildSkinInfo } = await loadSkinInfoBuilder()

  const stated = buildSkinInfo(SKIN_CANCER_USER, undefined, undefined)
  assert.match(stated, /Fitzpatrick: 1 \(stated\)/)

  const estimated = buildSkinInfo(ACCUTANE_USER, undefined, undefined)
  assert.match(estimated, /Fitzpatrick: 1 \(estimated — treat as provisional\)/)
})

test('an unknown Fitzpatrick is never defaulted to a number', async () => {
  const { buildSkinInfo } = await loadSkinInfoBuilder()
  const out = buildSkinInfo(
    { ...ACCUTANE_USER, fitzpatrick_scale: null, fitzpatrick_source: null },
    undefined,
    undefined
  )
  assert.match(out, /Fitzpatrick: NOT ESTABLISHED — do not guess one/)
  assert.ok(!/Fitzpatrick: [1-6]/.test(out), 'a guessed Fitzpatrick drives retinoid strength and PIH risk')
})

test('an empty allergy list is not reported as "no allergies"', async () => {
  const { buildSkinInfo } = await loadSkinInfoBuilder()
  const out = buildSkinInfo(SKIN_CANCER_USER, undefined, undefined)

  assert.ok(!/None reported/.test(out), '"None reported" asserts an absence as a finding')
  assert.match(out, /none recorded on file/)
  assert.match(out, /do not tell them they have no allergies/)
})

test('a real allergy still reaches the prompt verbatim', async () => {
  const { buildSkinInfo } = await loadSkinInfoBuilder()
  const out = buildSkinInfo(ACCUTANE_USER, undefined, undefined)
  assert.match(out, /Allergies: fragrance/)
})

test('no profile builds a conservative routine without inventing a skin type', async () => {
  const { buildSkinInfo } = await loadSkinInfoBuilder()
  const out = buildSkinInfo(null, undefined, undefined)

  assert.ok(
    !/balanced routine for combination skin/.test(out),
    'the invented "assume combination skin" default is back'
  )
  assert.match(out, /do NOT assume a skin type/)
  assert.match(out, /not personalized yet/)
})

test('a user with no medical history gets no medical block at all', async () => {
  const { buildSkinInfo } = await loadSkinInfoBuilder()
  const out = buildSkinInfo({ ...ACCUTANE_USER, medical_history: [] }, undefined, undefined)
  assert.ok(!/STANDING MEDICAL FACTS/.test(out), 'an empty block must not render')
})

// ---------------------------------------------------------------------------
// Fail-closed behaviour (source-level: these are throw sites, not expressions)
// ---------------------------------------------------------------------------

test('the generator refuses rather than building from a broken profile read', () => {
  const src = read('src', 'app', 'api', 'routine', 'generate', 'route.ts')

  assert.match(src, /const \{ data: profile, error: profileError \}/)
  assert.match(src, /if \(profileError\) \{[\s\S]{0,400}?throw new AppError/)
  assert.match(src, /const \{ data: conflicts, error: conflictsError \}/)
  assert.match(src, /if \(conflictsError\) \{[\s\S]{0,400}?throw new AppError/)
  // 503 — transient, retryable. Not a 500.
  assert.equal((src.match(/\s503\s*\n?\s*\)/g) || []).length, 2, 'both refusals must be 503')
})

test('the clinical columns are actually selected', () => {
  const src = read('src', 'app', 'api', 'routine', 'generate', 'route.ts')
  for (const col of ['medical_history', 'sun_history', 'fitzpatrick_scale', 'fitzpatrick_source']) {
    assert.ok(
      new RegExp(`select\\([\\s\\S]{0,300}${col}`).test(src),
      `${col} must be selected — it was silently absent`
    )
  }
})

test('scan enrichment surfaces a failed ingredient resolve', () => {
  // A dead resolve returns zero rows, which silently drops the comedogenic and
  // irritant warnings while the allergy check (raw-name matching) still runs —
  // so the scan looks personalized with a warning missing.
  const src = read('src', 'lib', 'scanning', 'enrich-scan.ts')
  assert.match(src, /if \(byEn\.error\)/)
  assert.match(src, /if \(byInci\.error\)/)
  assert.match(src, /ingredient resolve by name_en failed/)
  assert.match(src, /ingredient resolve by name_inci failed/)
})
