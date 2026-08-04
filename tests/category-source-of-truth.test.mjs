/**
 * Guard test — the category slug/dbCategory mapping must not drift.
 *
 * The Aug 4 2026 `/best/lip%20cares` 404 (live on ~860 product pages) was a
 * DRIFT bug. The category list existed in FIVE places:
 *
 *   1. src/app/best/[category]/page.tsx   CategoryMeta[] — the canonical one
 *   2. src/app/best/page.tsx              CategoryInfo[] — a second copy
 *   3. src/app/sitemap.ts                 bare slug strings
 *   4. src/app/products/[id]/page.tsx     a display-label map
 *   5. src/app/products/page.tsx          `slug` field that actually held DB values
 *
 * No copy knew the mapping was irregular (`mask` -> `masks` plural,
 * `lip_care` -> `lip-care` SINGULAR), so #4 derived the URL from the display
 * label with `label.toLowerCase() + 's'` and produced a literal space.
 *
 * src/lib/catalog/categories.ts is now the single source of truth. #3, #4 and
 * #5 consume it directly. #1 and #2 keep their own arrays because they carry
 * page-specific editorial copy (h1, description, skinTip, keyIngredients) —
 * so this test pins their slug/dbCategory pairs to the shared module instead.
 *
 * If someone adds a category to one file and not the others, this fails.
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

/** Import the real shared module (pure data + pure functions, no imports). */
async function loadShared() {
  const src = read('src', 'lib', 'catalog', 'categories.ts')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-cat-'))
  const file = join(dir, 'categories.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

/** Pull { slug, dbCategory } pairs out of a page's own category array. */
function pairsFrom(source) {
  const pairs = new Map()
  for (const m of source.matchAll(
    /slug:\s*'([a-z-]+)',\s*\n?\s*dbCategory:\s*'([a-z_]+)'/g
  )) {
    pairs.set(m[2], m[1]) // dbCategory -> slug
  }
  return pairs
}

test('the shared module maps every category to a distinct slug', async () => {
  const { PRODUCT_CATEGORIES, BEST_OF_SLUGS } = await loadShared()

  const dbValues = PRODUCT_CATEGORIES.map((c) => c.dbCategory)
  assert.equal(new Set(dbValues).size, dbValues.length, 'duplicate dbCategory')
  assert.equal(new Set(BEST_OF_SLUGS).size, BEST_OF_SLUGS.length, 'duplicate slug')

  for (const slug of BEST_OF_SLUGS) {
    assert.ok(!slug.includes(' '), `slug "${slug}" contains a space`)
    assert.ok(!slug.includes('_'), `slug "${slug}" contains an underscore`)
    assert.equal(slug, encodeURIComponent(slug), `slug "${slug}" is not URL-safe`)
  }
})

test('the irregular mappings that caused the 404 are pinned', async () => {
  const { bestOfSlugFor } = await loadShared()
  // Singular + hyphenated, NOT label+"s".
  assert.equal(bestOfSlugFor('lip_care'), 'lip-care')
  assert.equal(bestOfSlugFor('eye_care'), 'eye-care')
  assert.equal(bestOfSlugFor('spot_treatment'), 'spot-treatments')
  // Regular plural, to prove the map is not blanket-singular either.
  assert.equal(bestOfSlugFor('mask'), 'masks')
  assert.equal(bestOfSlugFor('serum'), 'serums')
})

test('categories with no /best/ page resolve to null, never a guess', async () => {
  const { bestOfSlugFor } = await loadShared()
  for (const c of ['oil', 'mist', 'not_skincare', 'totally_unknown']) {
    assert.equal(bestOfSlugFor(c), null, `"${c}" must not produce a slug`)
  }
})

test('best/[category] pairs match the shared module exactly', async () => {
  const { bestOfSlugFor, BEST_OF_SLUGS } = await loadShared()
  const pairs = pairsFrom(read('src', 'app', 'best', '[category]', 'page.tsx'))

  assert.ok(pairs.size >= 12, `expected >=12 pairs, parsed ${pairs.size}`)
  for (const [dbCategory, slug] of pairs) {
    assert.equal(
      bestOfSlugFor(dbCategory),
      slug,
      `best/[category] maps ${dbCategory}->${slug}; shared module disagrees`
    )
  }
  // Every servable slug must have a real page behind it.
  for (const slug of BEST_OF_SLUGS) {
    assert.ok(
      [...pairs.values()].includes(slug),
      `shared module serves /best/${slug} but best/[category] has no such page`
    )
  }
})

test('best/page.tsx index pairs match the shared module exactly', async () => {
  const { bestOfSlugFor } = await loadShared()
  const pairs = pairsFrom(read('src', 'app', 'best', 'page.tsx'))

  assert.ok(pairs.size >= 12, `expected >=12 pairs, parsed ${pairs.size}`)
  for (const [dbCategory, slug] of pairs) {
    assert.equal(
      bestOfSlugFor(dbCategory),
      slug,
      `best/page.tsx maps ${dbCategory}->${slug}; shared module disagrees`
    )
  }
})

test('sitemap and product pages consume the shared module, not a local copy', () => {
  const sitemap = read('src', 'app', 'sitemap.ts')
  assert.ok(
    /BEST_OF_SLUGS/.test(sitemap) && /catalog\/categories/.test(sitemap),
    'sitemap.ts must import BEST_OF_SLUGS'
  )
  assert.ok(
    !/const BEST_OF_CATEGORIES/.test(sitemap),
    'sitemap.ts still holds its own category list'
  )

  const detail = read('src', 'app', 'products', '[id]', 'page.tsx')
  assert.ok(
    /catalog\/categories/.test(detail),
    'products/[id] must import the shared module'
  )
  assert.ok(
    !/const categoryLabels/.test(detail),
    'products/[id] still holds a local label map'
  )

  const list = read('src', 'app', 'products', 'page.tsx')
  assert.ok(
    /catalog\/categories/.test(list),
    'products/page.tsx must import the shared module'
  )
})

test('public pages never link into the auth-gated /browse', () => {
  // /browse lives in the (app) auth group and renders an empty shell to
  // logged-out visitors and crawlers. Public pages must route to /products.
  for (const file of [
    ['src', 'app', 'products', 'page.tsx'],
    ['src', 'app', 'products', '[id]', 'page.tsx'],
  ]) {
    const src = read(...file)
    assert.ok(
      !/href=\{`\/browse\?/.test(src),
      `${file.join('/')} links to the auth-gated /browse`
    )
  }
})
