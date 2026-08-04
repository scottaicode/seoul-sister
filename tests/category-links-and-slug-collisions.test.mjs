/**
 * Guard test — two live 404s found in Vercel request logs, Aug 4 2026.
 *
 * Both surfaced while identifying a traffic spike that turned out to be a
 * logging artifact. The 404s were real.
 *
 * DEFECT 1 — /best/lip%20cares  (src/app/products/[id]/page.tsx)
 *
 *   href={`/best/${categoryLabel.toLowerCase()}s`}
 *
 * The href was built from the DISPLAY LABEL ("Lip Care"), lowercased, with a
 * naive "s" appended. Two bugs compound: the space is never slugified, and the
 * canonical slug for compound categories is SINGULAR (`lip-care`, not
 * `lip-cares`). The browser percent-encodes the space, producing
 * `/best/lip%20cares` -> 404.
 *
 * 8 of 15 DB categories broke, across ~860 product pages:
 *   lip_care (284 products), eye_care (213), spot_treatment (208) -> space+plural
 *   mist (82), not_skincare (57), oil (16)  -> no /best/ page exists at all
 *
 * The sitemap was NOT the source (it uses hardcoded correct slugs), so this was
 * pure internal-link rot: ~860 pages linking to their own 404s, and the real
 * category pages receiving zero internal link equity from the products that
 * should feed them. On a site whose moat is AI citation, that is a real cost.
 *
 * The slugs are NOT derivable from the label — they are irregular (`mask` ->
 * `masks` plural, `lip_care` -> `lip-care` singular), which is exactly why an
 * explicit map is the fix and any clever derivation is not.
 *
 * DEFECT 2 — /ingredients/red-spot-acrylates-copolymer  (ingredients/[slug])
 *
 * Two rows slugify identically:
 *   "#Red Spot Acrylates Copolymer"   -> not polluted
 *   "[Red Spot]Acrylates Copolymer"   -> polluted (brackets)
 *
 * The resolver used `.find()` — the FIRST slug match in an UNORDERED Postgres
 * result — then nulled it if polluted. Landing on the bracketed twin 404'd the
 * page even though a usable row existed.
 *
 * Measured against the live catalog: 290 slugs collide, 112 of them between two
 * or more ACTIVE ingredients, because toSlug strips footnote artifacts scraped
 * off ingredient tables:
 *   "Glycerin" (4,378 product links)  vs  "Glycerin⁴" (1 link)
 *   "Ceramide NP" (1,468)             vs  "Ceramide NP+" (1)
 *   "Citric Acid" (1,161)             vs  "Citric Acid²" (3)
 *
 * All eight checked were live-serving the CORRECT row at the time of the fix —
 * but on luck, not logic. An unordered `.find()` means a query-plan change or a
 * new row could silently flip /ingredients/glycerin to the 1-link artifact.
 * That is the "nothing wrong vs nothing checked" class: it looks fine until it
 * doesn't, and nothing would tell you.
 *
 * These tests EXECUTE the real functions. A regex over source text passes
 * against the broken code — the selection logic is precisely what source
 * matching cannot verify.
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

async function importSnippet(tsSource, filename) {
  const js = ts.transpileModule(tsSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-slug-'))
  const file = join(dir, filename)
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

/** Extract the real category->slug map from the product page. */
async function loadCategoryMap() {
  const src = read('src', 'app', 'products', '[id]', 'page.tsx')
  const m = src.match(
    /const bestOfSlugByCategory: Record<string, string> = \{[\s\S]*?\n\}/
  )
  assert.ok(m, 'bestOfSlugByCategory map not found in products/[id]/page.tsx')
  return importSnippet(`export ${m[0]}`, 'catmap.mjs')
}

/** Extract the real collision-resolution logic from the ingredient page. */
async function loadPicker() {
  const page = read('src', 'app', 'ingredients', '[slug]', 'page.tsx')
  const picker = page.match(/function pickBestSlugMatch\([\s\S]*?\n\}/)
  assert.ok(picker, 'pickBestSlugMatch not found in ingredients/[slug]/page.tsx')

  const slugSrc = read('src', 'lib', 'utils', 'slug.ts')
  const parser = read('src', 'lib', 'pipeline', 'ingredient-parser.ts')

  // Pull the real pollution guard + its dependencies, dropping DB-importing code.
  const guardPieces = [
    /const MAX_INCI_NAME_LENGTH[\s\S]*?\n/,
    /(?:export )?function looksLikeIngredientList\([\s\S]*?\n\}/,
    /(?:export )?function isPollutedIngredientName\([\s\S]*?\n\}/,
  ]
    .map((re) => {
      const hit = parser.match(re)
      assert.ok(hit, `guard piece not found: ${re}`)
      return hit[0].replace(/^export /, '')
    })
    .join('\n\n')

  const separators = parser.match(/const LIST_ONLY_SEPARATORS = \[.*?\]/)
  assert.ok(separators, 'LIST_ONLY_SEPARATORS not found in ingredient-parser.ts')

  const src = [
    slugSrc.replace(/export function/, 'function'),
    separators[0],
    guardPieces,
    `type IngredientRow = { id: string; name_inci: string; is_active: boolean }`,
    `export ${picker[0]}`,
  ].join('\n\n')

  return importSnippet(src, 'picker.mjs')
}

// ---------------------------------------------------------------------------
// DEFECT 1 — category links
// ---------------------------------------------------------------------------

test('every mapped category slug is a real /best/ page', async () => {
  const { bestOfSlugByCategory } = await loadCategoryMap()

  // Canonical list, read from the page that actually serves /best/[category].
  const bestPage = read('src', 'app', 'best', '[category]', 'page.tsx')
  const canonical = new Set(
    [...bestPage.matchAll(/slug: '([a-z-]+)'/g)].map((m) => m[1])
  )
  assert.ok(canonical.size >= 12, `expected canonical slugs, got ${canonical.size}`)

  for (const [category, slug] of Object.entries(bestOfSlugByCategory)) {
    assert.ok(
      canonical.has(slug),
      `category "${category}" maps to "${slug}", which is not a real /best/ page`
    )
  }
})

test('the exact URLs seen 404ing in the logs are no longer generated', async () => {
  const { bestOfSlugByCategory } = await loadCategoryMap()

  // These are the real display labels; the old code did label.toLowerCase()+'s'.
  const labels = { lip_care: 'Lip Care', eye_care: 'Eye Care', spot_treatment: 'Spot Treatment' }

  for (const [category, label] of Object.entries(labels)) {
    const broken = `/best/${label.toLowerCase()}s`
    const actual = `/best/${bestOfSlugByCategory[category]}`
    assert.notEqual(actual, broken, `${category} still generates the 404 URL`)
    assert.ok(!actual.includes(' '), `${category} href contains a space: ${actual}`)
  }

  assert.equal(bestOfSlugByCategory.lip_care, 'lip-care')
  assert.equal(bestOfSlugByCategory.eye_care, 'eye-care')
  assert.equal(bestOfSlugByCategory.spot_treatment, 'spot-treatments')
})

test('categories with no /best/ page are absent so no link renders', async () => {
  const { bestOfSlugByCategory } = await loadCategoryMap()
  for (const category of ['oil', 'mist', 'not_skincare']) {
    assert.equal(
      bestOfSlugByCategory[category],
      undefined,
      `"${category}" has no /best/ page and must not be mapped`
    )
  }
})

test('the link is rendered conditionally on a mapped category', () => {
  const src = read('src', 'app', 'products', '[id]', 'page.tsx')
  assert.ok(
    /\{bestOfSlugByCategory\[product\.category\] && \(/.test(src),
    'the /best/ link must be guarded so unmapped categories render nothing'
  )
  assert.ok(
    !/\/best\/\$\{categoryLabel\.toLowerCase\(\)\}s/.test(src),
    'the label-derived href is back — it produces /best/lip%20cares'
  )
})

// ---------------------------------------------------------------------------
// DEFECT 2 — slug collisions
// ---------------------------------------------------------------------------

const row = (id, name_inci, is_active = true) => ({ id, name_inci, is_active })

test('a polluted twin never shadows a usable row (the red-spot 404)', async () => {
  const { pickBestSlugMatch } = await loadPicker()
  const slug = 'red-spot-acrylates-copolymer'

  // Bracketed row FIRST, which is the order that produced the live 404.
  const rows = [
    row('b04b998b', '[Red Spot]Acrylates Copolymer', false),
    row('bb0d22a2', '#Red Spot Acrylates Copolymer', false),
  ]

  const picked = pickBestSlugMatch(rows, slug, new Map())
  assert.ok(picked, 'a usable row existed but the resolver returned null')
  assert.equal(picked.name_inci, '#Red Spot Acrylates Copolymer')
})

test('the real ingredient wins over its footnote twin regardless of order', async () => {
  const { pickBestSlugMatch } = await loadPicker()
  const links = new Map([['real', 4378], ['twin', 1]])

  const real = row('real', 'Glycerin')
  const twin = row('twin', 'Glycerin⁴') // Glycerin⁴

  for (const rows of [[real, twin], [twin, real]]) {
    const picked = pickBestSlugMatch(rows, 'glycerin', links)
    assert.equal(picked.id, 'real', 'the 1-link footnote artifact won the slug')
  }
})

test('an active row beats an inactive one even with fewer links', async () => {
  const { pickBestSlugMatch } = await loadPicker()
  // Mirrors ceramide-np: the high-link row is inactive, the low-link one active.
  const rows = [
    row('inactive', 'Ceramide NP', false),
    row('active', 'Ceramide NP+', true),
  ]
  const picked = pickBestSlugMatch(rows, 'ceramide-np', new Map([['inactive', 1468], ['active', 1]]))
  assert.equal(picked.id, 'active')
})

test('selection is deterministic when rows are otherwise identical', async () => {
  const { pickBestSlugMatch } = await loadPicker()
  const rows = [row('zzz', 'Arginine'), row('aaa', 'Arginine')]
  const a = pickBestSlugMatch(rows, 'arginine', new Map())
  const b = pickBestSlugMatch([...rows].reverse(), 'arginine', new Map())
  assert.equal(a.id, b.id, 'resolution depends on row order — it is a lottery')
  assert.equal(a.id, 'aaa')
})

test('an all-polluted collision still 404s (INCI dumps stay unreachable)', async () => {
  const { pickBestSlugMatch } = await loadPicker()
  const rows = [
    row('x', '[Plaster Band]Acrylates Copolymer', false),
    row('y', '@Talc@Mica@Titanium Dioxide', false),
  ]
  assert.equal(
    pickBestSlugMatch(rows, 'plaster-band-acrylates-copolymer', new Map()),
    null
  )
})

test('rows whose slug does not match are never returned', async () => {
  const { pickBestSlugMatch } = await loadPicker()
  const rows = [row('a', 'Niacinamide'), row('b', 'Retinol')]
  assert.equal(pickBestSlugMatch(rows, 'glycerin', new Map()), null)
})

test('both ingredient queries surface errors instead of 404ing silently', () => {
  const src = read('src', 'app', 'ingredients', '[slug]', 'page.tsx')
  // A failed query that only destructures `data` reads as "not found".
  assert.ok(
    /const \{ data: exact, error: exactError \}/.test(src),
    'exact lookup must destructure error'
  )
  assert.ok(
    /const \{ data: broad, error: broadError \}/.test(src),
    'broad lookup must destructure error'
  )
  assert.ok(
    /\[ingredient page\] exact lookup failed/.test(src) &&
      /\[ingredient page\] broad lookup failed/.test(src),
    'both failures must be logged'
  )
})
