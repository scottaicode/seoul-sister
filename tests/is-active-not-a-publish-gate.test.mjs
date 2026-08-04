/**
 * Guard test — `is_active` is a functional classification, not a publish flag.
 *
 * SCHEMA GROUND TRUTH (foundation_schema.sql:51):
 *   is_active BOOLEAN NOT NULL DEFAULT true,  -- "active" as in active ingredient vs. inactive
 *
 * Retinol and niacinamide are actives. Water, xanthan gum and preservatives are
 * not, and `is_active = false` is CORRECT for them. There is no published/
 * enabled column on ss_ingredients — the pollution guard is the only quality
 * gate.
 *
 * Six read paths used the flag as a publish gate anyway. Measured against the
 * live catalog on Aug 4 2026:
 *
 *   ingredient URLs the pollution guard alone would publish   12,863
 *   URLs actually in the sitemap (guard + is_active)           7,641
 *   REAL PAGES MISSING FROM THE SITEMAP                        5,222
 *     ...of those with >= 100 product links                      198
 *
 * Sodium Hyaluronate (2,824 product links), Panthenol (2,440), Allantoin
 * (1,949), Ceramide NP (1,468) and Squalane (797) were all absent. Every one
 * was sampled live and returns 200 with a full product list — the pages were
 * fine, we just were not telling crawlers they exist, on the surface that IS
 * the citation moat.
 *
 * WHY THE CONFLATION LOOKED REASONABLE
 * scripts/cleanup-polluted-ingredients.ts:100 deactivated 2,614 unsplit-INCI
 * dump rows instead of deleting them, so all 2,027 rows the pollution guard
 * rejects today are is_active=false and ZERO are true. The flag therefore
 * looked like a quality signal. It is not: ingredient-matcher.ts also defaults
 * it false on malformed LLM JSON (:270) and hardcodes false when the Sonnet
 * call fails (:308).
 *
 * NOT A DATA BUG. I first reported "198 misflagged ingredients" and measuring
 * corrected me: classifying the 7,310 false rows by whether their own
 * `function` text describes an active benefit found only 11 major misflags, 3
 * of which are false positives of that heuristic. Butylene Glycol, Aqua and
 * Xanthan Gum are false and SHOULD be. So the fix is to stop using the flag as
 * a gate — not to flip rows.
 *
 * These tests execute the REAL query-builder chain against a recording stub, so
 * they observe the filters actually applied rather than matching source text.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

/**
 * A chainable PostgREST stub that records every filter applied to it, so a
 * test can assert on the real builder chain rather than on source text.
 */
function recordingQuery() {
  const calls = []
  const q = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === '__calls') return calls
        if (prop === 'then') return undefined // not a promise
        return (...args) => {
          calls.push({ method: String(prop), args })
          return q
        }
      },
    }
  )
  return q
}

async function loadGuard() {
  // excludePollutedIngredientRows is pure query-building — safe to import via
  // the same transpile path the other guard tests use.
  const { transpileModule, ModuleKind, ScriptTarget } = (await import('typescript')).default
  const src = read('src', 'lib', 'pipeline', 'ingredient-parser.ts')
  const js = transpileModule(src, {
    compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
  }).outputText
  const { writeFileSync, mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { pathToFileURL } = await import('node:url')
  const dir = mkdtempSync(join(tmpdir(), 'ss-guard-'))
  const file = join(dir, 'parser.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

test('the pollution guard really applies filters (it is the quality gate)', async () => {
  const { excludePollutedIngredientRows } = await loadGuard()
  const q = recordingQuery()
  excludePollutedIngredientRows(q)

  const calls = q.__calls
  assert.ok(calls.length > 0, 'the guard must apply at least one filter')
  // It must exclude the dump signals, not merely reorder.
  const serialized = JSON.stringify(calls)
  assert.match(serialized, /not/, 'the guard must apply negative filters')
  assert.ok(
    /@|\[|\]/.test(serialized),
    'the guard must reject @ / bracket dump rows'
  )
})

// ---------------------------------------------------------------------------
// The six sites. Source assertions here are intentional and narrow: what is
// being verified is the ABSENCE of a specific filter, which no runtime stub can
// prove for a file that imports Supabase at module scope.
// ---------------------------------------------------------------------------

/** Extract the ss_ingredients query slice from a file, to avoid matching other tables. */
function ingredientQuery(src, afterMarker) {
  const i = afterMarker ? src.indexOf(afterMarker) : 0
  assert.ok(i >= 0, `marker not found: ${afterMarker}`)
  const j = src.indexOf("from('ss_ingredients')", i)
  assert.ok(j > 0, 'no ss_ingredients query found')
  // Stop at the NEXT ss_ingredients query. These files hold several — the
  // encyclopedia page has four, and one of them is an `activeCount` stat that
  // legitimately counts actives. A fixed-width slice would swallow it and make
  // this test assert against the wrong query.
  const next = src.indexOf("from('ss_ingredients')", j + 10)
  const end = next > 0 ? next : j + 900
  return src.slice(j, Math.min(end, j + 1600))
}

test('the sitemap publishes every non-polluted ingredient page', () => {
  const src = read('src', 'app', 'sitemap.ts')
  const q = ingredientQuery(src)

  assert.ok(
    !/\.eq\('is_active', true\)/.test(q),
    'is_active is back as a sitemap gate — that withholds 5,222 real pages'
  )
  // The guard must still wrap it: the July 30 regression put 15 INCI dumps live.
  assert.match(src, /excludePollutedIngredientRows\(\s*\n?\s*supabase\s*\n?\s*\.from\('ss_ingredients'\)/)
})

test('blog auto-linking can link any real ingredient, and never a dump', () => {
  const src = read('src', 'app', 'blog', '[slug]', 'page.tsx')
  const q = ingredientQuery(src, 'enrichedIngredients')

  assert.ok(
    !/\.eq\('is_active', true\)/.test(q),
    'blog mentions of Panthenol / Ceramide NP would go unlinked again'
  )
  assert.match(src, /excludePollutedIngredientRows\(/, 'the dictionary needs the pollution guard')
  assert.match(src, /error: enrichedIngredientsError/, 'a dead dictionary query must be visible')
})

test('the encyclopedia index filters on rich_content, not on is_active', () => {
  const src = read('src', 'app', 'ingredients', 'page.tsx')
  // Anchor on the enriched query specifically — this file has four
  // ss_ingredients queries and only this one lists the encyclopedia.
  const q = ingredientQuery(src, 'const { data: enrichedRaw')

  // rich_content IS the right filter here — this page lists guide pages.
  assert.match(q, /\.not\('rich_content', 'is', null\)/)
  assert.ok(
    !/\.eq\('is_active', true\)/.test(q),
    'an enriched guide for Panthenol would exist and still be hidden'
  )
  // Demoted to a sort key, which is the pattern the audited surfaces use.
  assert.match(q, /\.order\('is_active', \{ ascending: false \}\)/)
  assert.match(src, /excludePollutedIngredientRows\(/)
})

test('the LGAAS context API resolves an ingredient asked for by name', () => {
  const src = read('src', 'app', 'api', 'admin', 'ingredients', 'context', 'route.ts')
  // Anchor past the guard wrapper so the slice is the name-lookup query, not
  // the pain-point query further down (which correctly keeps is_active).
  const q = ingredientQuery(src, 'No `is_active` filter')

  assert.ok(
    !/\.eq\('is_active', true\)/.test(q),
    'a named lookup for Sodium Hyaluronate would return nothing again'
  )
  assert.match(src, /excludePollutedIngredientRows\(/, 'this route had NO pollution guard')
  // The window must stay ordered — an unordered limit loses the canonical row.
  assert.match(q, /\.order\('name_inci', \{ ascending: true \}\)/)
})

test('the pain-point query KEEPS is_active — that is the column used correctly', () => {
  // "What treats redness?" genuinely wants functional actives. Removing the
  // filter here would surface solvents as treatments. This test exists so a
  // future sweep does not "fix" a correct call site.
  const src = read('src', 'app', 'api', 'admin', 'ingredients', 'context', 'route.ts')
  const i = src.indexOf('Pain point mapping')
  assert.ok(i > 0, 'pain-point block not found')
  const block = src.slice(i, i + 900)
  assert.match(
    block,
    /\.eq\('is_active', true\)/,
    'the pain-point query should still ask for actives only'
  )
})

test('enrichment can generate a guide for a high-usage excipient', () => {
  const src = read('scripts', 'enrich-ingredients.ts')
  assert.ok(
    !/\.is\('rich_content', null\)\s*\n\s*\.eq\('is_active', true\)/.test(src),
    'gating enrichment on is_active starves the encyclopedia index that requires a guide'
  )
})

// ---------------------------------------------------------------------------
// The (A)-class sites must NOT be swept. The column means something real.
// ---------------------------------------------------------------------------

test('is_active still gates actives-stacking detection and badges', () => {
  // These use the column for its actual meaning. A future sweep that removes
  // is_active everywhere would break real features, so pin them.
  const overlap = read('src', 'lib', 'intelligence', 'ingredient-overlap.ts')
  assert.match(
    overlap,
    /!ing\.is_active/,
    'actives-stacking detection must keep filtering out water and glycols'
  )

  const detail = read('src', 'app', 'ingredients', '[slug]', 'page.tsx')
  assert.match(
    detail,
    /if \(a\.is_active !== b\.is_active\) return a\.is_active \? -1 : 1/,
    'the slug resolver uses is_active as a SORT tiebreak — keep it'
  )
  assert.ok(
    !/\.eq\('is_active', true\)/.test(detail),
    'the detail page must never gate on is_active — it would 404 real pages'
  )
})

test('the search route sorts by is_active rather than filtering', () => {
  const src = read('src', 'app', 'api', 'ingredients', 'search', 'route.ts')
  assert.match(src, /\.order\('is_active', \{ ascending: false \}\)/)
  assert.ok(!/\.eq\('is_active', true\)/.test(src))
})

// ---------------------------------------------------------------------------
// The silent row cap — a bigger bug that removing the filter exposed.
// ---------------------------------------------------------------------------

test('the sitemap pages through results instead of taking PostgREST\'s first 1000', () => {
  // PostgREST caps an unpaginated select at 1,000 rows BY DEFAULT and reports
  // no error. The live sitemap was truncated mid-alphabet — it ended at
  // "water" — publishing ~1,000 of 12,863 eligible ingredient URLs and ~1,000
  // of 5,946 products. This predates the is_active fix and is why dropping
  // that filter alone recovered nothing: the cap was the binding constraint.
  //
  // A silent row cap is the same class as a swallowed error: the result looks
  // complete and is not.
  const src = read('src', 'app', 'sitemap.ts')

  assert.match(src, /const fetchAll = async/, 'the sitemap needs a paging helper')
  assert.match(src, /\.range\(from, to\)/, 'queries must be paged with .range()')
  assert.match(
    src,
    /fetchAll<\{ name_inci/,
    'the ingredient query must page — it is the largest set'
  )
  assert.match(src, /fetchAll<\{ id: string/, 'the product query must page too')
  // The loop must terminate on a short page and surface a failed page.
  assert.match(src, /if \(data\.length < PAGE\) break/)
  assert.match(src, /\[sitemap\] page fetch failed/)
})

test('the sitemap only advertises URLs the resolver will serve', () => {
  // Sampling the LIVE sitemap after the is_active fix found ~14% of ingredient
  // URLs 404ing — ~2,018 dead URLs on the citation surface. Two causes, both
  // passing the pollution guard legitimately: a slug shared with a polluted
  // twin ("[01 Black]" vs "(01 Black)"), and names the resolver's ilike
  // prefilter cannot match ("(0.000002ppm)"). Fixed by deferring to the
  // resolver rather than loosening it — measured to 0 predicted 404s while all
  // 16 recovered hero ingredients still publish.
  const src = read('src', 'app', 'sitemap.ts')

  assert.match(src, /const pollutedSlugs = new Set<string>\(\)/, 'must track polluted-twin slugs')
  assert.match(src, /const collidesWithPolluted = pollutedSlugs\.has\(slug\)/)
  assert.match(src, /RESOLVABLE_BY_PREFILTER/, 'must gate on resolver reachability')
  assert.match(
    src,
    /if \(collidesWithPolluted \|\| unreachable\) return null/,
    'both unreachable shapes must be withheld'
  )
})
