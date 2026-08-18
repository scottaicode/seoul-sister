/**
 * Guard test — a Product node carrying `offers` MUST carry `image`.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Google Search Console, Aug 17 2026: "Merchant listings structured data issues
 * detected in seoulsister.com — Missing field 'image'". Critical severity, which
 * means the rich result is suppressed entirely rather than merely degraded.
 *
 * The mechanism: both product-detail routes spread `image` in CONDITIONALLY
 *
 *     ...(product.image_url && { image: product.image_url }),
 *
 * while spreading `offers` in on a SEPARATE condition (a price existing). Google
 * parses any Product node bearing `offers` as a Merchant listing, and `image` is
 * required there. So a product with a price and no image emitted an invalid node.
 *
 * Measured blast radius at the time of the fix: 353 of 6,105 products have no
 * image, but only FIVE also have a price — and it takes a price for the Merchant
 * listing parse to trigger at all. All five were is_verified Anua/COSRX rows,
 * i.e. exactly the high-intent pages worth citing. The staging table has no image
 * column, so the image-health cron's recovery path could not repair these rows;
 * the schema-level fallback is the fix, not a data backfill.
 *
 * WHY THIS TEST IS SHAPED THIS WAY
 *
 * Asserting on source text ("the file contains productImageOrFallback") would pass
 * against broken code — someone could reintroduce a conditional spread elsewhere in
 * the same object, or add a third route. Instead this executes the real helper for
 * the actual failing shape, and parses the real jsonLd object literal out of each
 * route to assert the INVARIANT (offers present => image unconditional), so a new
 * conditional-image route fails here rather than in Search Console six weeks later.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Execute the REAL module — a source-regex test passes against broken code. */
async function loadImageProxy() {
  const src = readFileSync(join(root, 'src/lib/utils/image-proxy.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

/** Every route that emits a Product node with offers. */
const PRODUCT_ROUTES = [
  'src/app/products/[id]/page.tsx',
  'src/app/(app)/browse/[id]/page.tsx',
]

test('productImageOrFallback returns an absolute URL for every empty shape', async () => {
  const { productImageOrFallback } = await loadImageProxy()

  // The exact shapes that produced the GSC error.
  for (const empty of [null, undefined, '', '   ']) {
    const out = productImageOrFallback(empty)
    assert.ok(out, `fallback must be truthy for ${JSON.stringify(empty)}`)
    assert.match(
      out,
      /^https:\/\//,
      'structured data requires an absolute URL — a relative path is not resolvable by Google'
    )
  }

  // A real image must pass through untouched.
  const real = 'https://cdn-image.oliveyoung.com/foo.jpg'
  assert.equal(productImageOrFallback(real), real, 'real images must not be replaced')
})

test('no product route emits image conditionally', () => {
  for (const rel of PRODUCT_ROUTES) {
    const src = readFileSync(join(root, rel), 'utf8')

    // The precise bug: image spread behind a truthiness check.
    assert.doesNotMatch(
      src,
      /\.\.\.\(\s*\w+\.image_url\s*&&\s*\{\s*image\s*:/,
      `${rel}: image is spread conditionally — a priced product with no image emits an ` +
        `invalid Merchant listing. Use productImageOrFallback() so image is always present.`
    )
  }
})

test('every Product node bearing offers also bears an unconditional image', () => {
  for (const rel of PRODUCT_ROUTES) {
    const src = readFileSync(join(root, rel), 'utf8')

    // Only assert on routes that actually build a Merchant-listing-shaped node.
    const emitsOffers = /offers\s*:\s*\{/.test(src) || /\boffers:\s*$/m.test(src)
    if (!emitsOffers) continue

    // The image key must appear as a plain, unconditional property assignment.
    assert.match(
      src,
      /^\s*image:\s*productImageOrFallback\(/m,
      `${rel}: emits offers but has no unconditional image property. Google parses a ` +
        `Product with offers as a Merchant listing, where image is REQUIRED (critical).`
    )
  }
})

test('Seoul Sister is never named as the seller — it sells no products', () => {
  // CLAUDE.md: "Seoul Sister IS NOT an e-commerce store... does not sell products,
  // hold inventory, process product payments, or handle fulfillment."
  // A seller claim in Offer schema asserts the opposite to Google.
  for (const rel of PRODUCT_ROUTES) {
    const src = readFileSync(join(root, rel), 'utf8')
    const sellerBlock = src.match(/seller\s*:\s*\{[^}]*\}/)
    if (sellerBlock) {
      assert.doesNotMatch(
        sellerBlock[0],
        /Seoul Sister/,
        `${rel}: names Seoul Sister as the seller, but we never touch commerce — ` +
          `purchases go to Olive Young / Soko Glam / retailers.`
      )
    }
  }
})
