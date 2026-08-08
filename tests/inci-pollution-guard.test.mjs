/**
 * Guard test — unsplit INCI dumps must never reach a public page.
 *
 * THE DEFECT (July 30 2026)
 *
 * The Feb 2026 parser wrote whole INCI lists into ss_ingredients as single
 * "ingredients". A guard was added (isPollutedIngredientName) that rejected an
 * "@", a bracket, or a name over 100 chars, and it caught 2,027 rows.
 *
 * 15 dumps still escaped it and were LIVE ON THE SITEMAP — each one a URL we
 * were actively asking crawlers to index:
 *
 *   "Glucose■ TeatreeGlycerin"
 *   "Cysteine; PDRN Essence 100: Water"
 *   "Atelocollagen | PDRN Pink One Day Serum: Water"
 *   "Palmitoyl Tripeptide-5; Softener: Water"
 *
 * They carry no "@", no bracket, and sit under 100 chars, so nothing rejected
 * them. `src/app/sitemap.ts` had no pollution guard at all — it filtered only on
 * is_active. For a product whose moat is AI citation, submitting garbage URLs is
 * the expensive version of this bug.
 *
 * THE OVER-CORRECTION THIS ALSO PREVENTS
 * The obvious fix — "reject any name containing a comma" — would have destroyed
 * 979 legitimate ingredients. Measured against the live catalog:
 *
 *   "Niacinamide (50,000ppm)"                    comma+DIGIT      -> KEEP
 *   "Carrot Seed Oil (200 ppm, Beta-Carotene)"   inside parens    -> KEEP
 *   "Caprylic/Capric Triglyceride, PEG-8 ..."     comma+LETTER    -> reject
 *
 * So the comma rule requires a comma followed by a LETTER, OUTSIDE any
 * parenthetical. Verified live: after the change 2,083 rows are rejected (up 56),
 * all 15 public escapees are caught, zero legitimate rows are newly rejected, and
 * 7,650 public ingredient pages survive.
 *
 * This test EXECUTES the real guard rather than asserting on source text — a
 * classifier is exactly the kind of logic a regex over source cannot verify.
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

/** Transpile the pure guard functions out of the parser and import them. */
async function loadGuard() {
  const src = read('src', 'lib', 'pipeline', 'ingredient-parser.ts')

  const start = src.indexOf('export const MAX_INCI_NAME_LENGTH')
  const endMarker = 'export function excludePollutedIngredientRows'
  const end = src.indexOf(endMarker)
  assert.ok(start > -1 && end > start, 'guard block must exist in ingredient-parser.ts')

  const js = ts.transpileModule(src.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText

  const dir = mkdtempSync(join(tmpdir(), 'ss-inci-'))
  const file = join(dir, 'guard.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

test('the dumps that were live on the sitemap are rejected', async () => {
  const { isPollutedIngredientName } = await loadGuard()
  const escapees = [
    'Palmitoyl Tripeptide-5; Softener: Water',
    '■ EggplantGlycerin',
    'Glucose■ TeatreeGlycerin',
    'Serine (250 ppb); Histidine (250ppb)',
    'Cysteine; PDRN Essence 100: Water',
    'Thiamine HCl; Lotion: Water',
    'Atelocollagen | PDRN Pink One Day Serum: Water',
    '■ Petrolatum',
  ]
  for (const name of escapees) {
    assert.equal(
      isPollutedIngredientName(name),
      true,
      `must reject the unsplit dump: ${name}`
    )
  }
})

test('ppm-annotated ingredients survive — the 979-row over-correction', async () => {
  const { isPollutedIngredientName } = await loadGuard()
  const legit = [
    'Niacinamide (50,000ppm)',
    'Kaolin (150,000 ppm)',
    'Carrot Seed Oil (1,000ppm)',
    'Vaccinium Vitis-Idaea Fruit Extract (604,074ppm)',
    'Citrus Limon (Lemon) Fruit Extract (300 ppm, Actual)',
    '1,2-Hexanediol',
    'Sodium Hyaluronate',
  ]
  for (const name of legit) {
    assert.equal(
      isPollutedIngredientName(name),
      false,
      `must KEEP the legitimate ingredient: ${name}`
    )
  }
})

test('a comma only signals a list when followed by a letter outside parentheses', async () => {
  const { isPollutedIngredientName } = await loadGuard()
  // The distinction, stated as a test so it cannot be "simplified" away.
  assert.equal(isPollutedIngredientName('Caprylic/Capric Triglyceride, PEG-8 Glyceryl Isostearate'), true)
  assert.equal(isPollutedIngredientName('Water, Talc'), true)
  assert.equal(isPollutedIngredientName('Retinol (500,000 IU)'), false)
  assert.equal(isPollutedIngredientName('Extract (200 ppm, Actual)'), false)
})

test('the original signals still work', async () => {
  const { isPollutedIngredientName, MAX_INCI_NAME_LENGTH } = await loadGuard()
  assert.equal(isPollutedIngredientName('Water@Glycerin@Talc'), true)
  assert.equal(isPollutedIngredientName('[#03 Concealer] Water'), true)
  assert.equal(isPollutedIngredientName('x'.repeat(MAX_INCI_NAME_LENGTH + 1)), true)
  // A long-but-real INCI name must survive the length rule.
  assert.equal(
    isPollutedIngredientName('Methylene Bis-Benzotriazolyl Tetramethylbutylphenol'),
    false
  )
})

// --- The sitemap is the surface that actually mattered --------------------

test('the sitemap filters polluted ingredient rows', () => {
  const sitemapSrc = read('src', 'app', 'sitemap.ts')
  assert.ok(
    /excludePollutedIngredientRows\(/.test(sitemapSrc),
    'the sitemap ingredient query must apply the SQL-side pollution guard'
  )
  assert.ok(
    /isPollutedIngredientName\(i\.name_inci\)/.test(sitemapSrc),
    'the sitemap must ALSO apply the TS guard — the comma rule cannot be a LIKE pattern'
  )
})

test('the SQL-side filter mirrors the list separators', () => {
  const parserSrc = read('src', 'lib', 'pipeline', 'ingredient-parser.ts')
  assert.ok(
    /for \(const sep of LIST_ONLY_SEPARATORS\)/.test(parserSrc),
    'excludePollutedIngredientRows must exclude every list-only separator'
  )
  // The TS-only gap must stay documented, or a future reader will assume the SQL
  // filter is complete.
  assert.ok(
    /expressed as a LIKE pattern, so it is enforced in TS only/.test(parserSrc),
    'the SQL/TS coverage gap must be stated explicitly'
  )
})

// --- The WRITE path must refuse a dump, not just the read paths -----------

test('the matcher refuses to create a polluted ingredient', () => {
  // The read filter (above) stops dumps being SERVED. It does not stop them
  // being CREATED — which is why 12 new junk rows appeared between February and
  // July 25 2026, long after the original parser bug was "fixed". Every future
  // audit then has to re-classify them. The guard belongs at the write, too.
  const matcherSrc = read('src', 'lib', 'pipeline', 'ingredient-matcher.ts')

  assert.ok(
    /import \{ isPollutedIngredientName \} from '\.\/ingredient-parser'/.test(matcherSrc),
    'the matcher must import the shared guard rather than re-implement one'
  )
  assert.ok(
    /if \(isPollutedIngredientName\(nameInci\)\) \{[\s\S]{0,400}return null/.test(matcherSrc),
    'matchOrCreateIngredient must refuse a polluted name before creating a row'
  )
  // The check must come before the cache/DB/Anthropic work, or a dump still
  // costs an enrichment call.
  const guardIdx = matcherSrc.indexOf('isPollutedIngredientName(nameInci)')
  const cacheIdx = matcherSrc.indexOf('const lower = nameInci.toLowerCase()')
  assert.ok(
    guardIdx > -1 && cacheIdx > -1 && guardIdx < cacheIdx,
    'the guard must run before any lookup or enrichment work'
  )
})

test('a refused ingredient skips the entry instead of failing the product', () => {
  // One bad entry in a 40-ingredient INCI list must not cost the other 39.
  const linkerSrc = read('src', 'lib', 'pipeline', 'ingredient-linker.ts')
  assert.ok(
    /if \(!result\) \{\s*\n\s*pollutedSkipped\+\+\s*\n\s*continue/.test(linkerSrc),
    'the linker must skip a refused entry and continue'
  )
  assert.ok(
    /skipped \$\{pollutedSkipped\} polluted ingredient name/.test(linkerSrc),
    'a skip must be logged — silent loss is the failure class this repo keeps hitting'
  )
})

test('every matcher caller handles the refusal', () => {
  // The nullable return is what surfaced a SECOND write path (scripts/fast-link.ts)
  // that had been calling the matcher directly. If a caller ignores null, tsc
  // fails — but assert it explicitly so the handling is not "simplified" away.
  const fastLinkSrc = read('scripts', 'fast-link.ts')
  assert.ok(
    /if \(!result\) continue/.test(fastLinkSrc),
    'fast-link.ts must skip refused ingredients'
  )
})

/**
 * RUN-TOGETHER PARSE ARTIFACTS (Aug 7 2026)
 *
 * Google Search Console flagged the shape: 14,102 URLs submitted, 2.63K indexed,
 * 11,997 "Discovered - currently not indexed". Sampling the live site found these
 * pages return 200 (so no 404 rule catches them) while rendering titles like
 * "TocopherolChampagne Glazed: Calcium Titanium Borosilicate" over ~700 words of
 * boilerplate. Thin near-duplicates at that volume dilute the ingredient corpus,
 * which is the AI-citation moat.
 *
 * Measured against the live catalog before shipping: 1,521 rows match, 1,359 not
 * already caught, ZERO with rich content, max 5 product links on any row removed.
 */
test('run-together parse artifacts are refused', async () => {
  const { isPollutedIngredientName } = await loadGuard()
  for (const name of [
    'WaterGlycerin',
    'HyaluronicAcid',
    'PotassiumChloride',
    'BetaineSalicylate',
    '01 BlackWater',
    'PDRN AmpouleWater',
    'Asiatic AcidSTEP2) Water',
    'ButylphenylMethylpropional',
    'TocopherolChampagne Glazed: Calcium Titanium Borosilicate',
  ]) {
    assert.equal(isPollutedIngredientName(name), true, `must refuse: ${name}`)
  }
})

test('the run-together rule does not repeat the 4,898-row over-correction', async () => {
  const { isPollutedIngredientName } = await loadGuard()
  // These are the names this repo has already been burned by. A case-boundary
  // rule must not touch hyphens, digits, slashes, or consecutive capitals.
  for (const name of [
    '1,2-Hexanediol',        // 511 links — the July 30 comma over-correction
    'Hexapeptide-9',         // 210 links — flagged by the DISCARDED heuristic
    'Ceramide NP',           // consecutive capitals
    'Sodium Hyaluronate',    // 2,825 links
    'Niacinamide',
    'Centella Asiatica Extract',
    'Butylene Glycol',
    'Caprylic/Capric Triglyceride',
    'PEG-100 Stearate',
    'CI 77491',
    'Niacinamide (50,000ppm)',
    'Drometrizole Trisiloxane Methylene Bis-Benzotriazolyl Tetramethylbutylphenol',
    'Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer',
    '3-O-Ethyl Ascorbic Acid',
  ]) {
    assert.equal(isPollutedIngredientName(name), false, `must KEEP: ${name}`)
  }
})

test('the SQL-side filter mirrors the TS rule case-SENSITIVELY', () => {
  // A read path that filters only in TS leaves holes in count/pagination, and
  // `imatch` (~*) instead of `match` (~) would match every two-letter name and
  // silently empty the catalog. Both are load-bearing.
  const src = read('src', 'lib', 'pipeline', 'ingredient-parser.ts')
  assert.ok(
    /\.not\(column, 'match', '\[a-z\]\[A-Z\]'\)/.test(src),
    'excludePollutedIngredientRows must apply the run-together rule server-side'
  )
  assert.ok(
    !/'imatch', '\[a-z\]\[A-Z\]'/.test(src),
    'must use case-sensitive match (~), never imatch (~*)'
  )
})
