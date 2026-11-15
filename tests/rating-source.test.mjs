/**
 * A product's stars say whose rating they are, and no surface shows a bare
 * "Verified" badge.
 *
 * Nov 15 2026: a member's product page showed "5.0 (2 reviews)" beside a green
 * "Verified" shield. The reviews were Olive Young's (no member had reviewed
 * it), and "Verified" only meant the catalog row was complete, which is not
 * even true of the ingredient list for 67 of the 5,311 rows carrying the flag.
 * Executes the real helper; the page wiring is checked by source text.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const js = ts.transpileModule(read('src', 'lib', 'rating-source.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { ratingSourceNote } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('every rating names its source: these three outcomes and nothing else', () => {
  // Member reviews win, whatever count the retailer left behind.
  assert.equal(ratingSourceNote(1, 15201), '1 member review')
  assert.equal(ratingSourceNote(3, 0), '3 member reviews')
  // No member review: the stored count is Olive Young's.
  assert.equal(ratingSourceNote(0, 2), '2 reviews on Olive Young')
  assert.equal(ratingSourceNote(0, 1), '1 review on Olive Young')
  assert.equal(ratingSourceNote(0, 5800), '5,800 reviews on Olive Young')
  // A rating with no count recorded still says where it is from.
  assert.equal(ratingSourceNote(0, 0), 'rated on Olive Young')
  // Closed world: nothing comes back unlabelled.
  for (const m of [0, 1, 2, 40]) {
    for (const c of [0, 1, 2, 999, 12345]) {
      assert.match(ratingSourceNote(m, c), /member reviews?$|on Olive Young$/, `${m}/${c}`)
    }
  }
})

test('both product pages label their stars through the helper, and only through it', () => {
  const pub = read('src', 'app', 'products', '[id]', 'page.tsx')
  assert.ok(pub.includes('({ratingSourceNote(reviewRes.count ?? 0, product.review_count ?? 0)})'))
  const member = read('src', 'app', '(app)', 'browse', '[id]', 'page.tsx')
  assert.ok(member.includes('({ratingSourceNote(review_summary?.count ?? 0, product.review_count ?? 0)})'))
  // No hand-written "(N reviews)" in either file, however the count is spelled.
  // (The member page's "N reviews on Olive Young" sentence names its source.)
  for (const [name, src] of [['public', pub], ['member', member]]) {
    assert.doesNotMatch(src, /\} reviews\)/, `${name} page writes an unlabelled review count`)
    assert.doesNotMatch(src, /\breviews\b(?! on Olive Young)[^\n]{0,3}\)\s*\n\s*<\/span>/, `${name} page writes an unlabelled review count`)
  }
})

test('the word "Verified" is not shown on any product surface', () => {
  for (const f of [
    ['src', 'app', 'products', '[id]', 'page.tsx'],
    ['src', 'app', '(app)', 'browse', '[id]', 'page.tsx'],
    ['src', 'components', 'products', 'ProductCard.tsx'],
    ['src', 'components', 'sunscreen', 'SunscreenCard.tsx'],
  ]) {
    // Comments stripped, so a note about the removed badge does not count.
    const src = read(...f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.doesNotMatch(src, /Verified/, `${f.join('/')} still says Verified`)
    assert.doesNotMatch(src, /is_verified\s*(&&|\?)/, `${f.join('/')} renders something from is_verified`)
  }
})
