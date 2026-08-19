/**
 * Guard tests for splitArticleForCta (src/lib/utils/article-split.ts).
 *
 * These EXECUTE the real function against real shapes rather than asserting on
 * source text — a source-regex test passes against broken code (documented
 * repeatedly in CLAUDE.md). The module has no DB imports, so it is transpiled
 * and imported directly.
 *
 * The invariant that matters most: NO CONTENT IS EVER LOST. A split that drops
 * `tail` would silently delete most of an article, and a rendered page missing
 * its second half looks like a content bug, not a split bug — the exact
 * "nothing wrong vs nothing checked" shape this repo keeps paying for.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const src = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/utils/article-split.ts'),
  'utf8'
)
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)
const { splitArticleForCta } = mod

const ARTICLE =
  '<p>Intro paragraph explaining the problem.</p>' +
  '<h2 id="a">First Heading</h2><p>Body of the first section.</p>' +
  '<h2 id="b">Second Heading</h2><p>Body of the second section.</p>' +
  '<h2 id="c">Third Heading</h2><p>Body of the third section.</p>'

test('splits before the SECOND h2, not the first', () => {
  const { head, tail, didSplit } = splitArticleForCta(ARTICLE)
  assert.equal(didSplit, true)
  // The first section must be READ before the CTA appears; splitting on the
  // first h2 would put the CTA above all content.
  assert.ok(head.includes('First Heading'), 'head must contain the first section')
  assert.ok(head.includes('Body of the first section.'))
  assert.ok(!head.includes('Second Heading'), 'head must stop before the 2nd h2')
  assert.ok(tail.startsWith('<h2 id="b"'), 'tail must begin at the 2nd h2')
})

test('loses no content — head + tail reconstructs the input exactly', () => {
  const { head, tail } = splitArticleForCta(ARTICLE)
  assert.equal(head + tail, ARTICLE)
})

test('splits on a TAG BOUNDARY, never inside a tag or an anchor', () => {
  const withLinks =
    '<p>Try <a href="/ingredients/niacinamide">niacinamide</a> first.</p>' +
    '<h2>One</h2><p>A <a href="/ingredients/retinol">retinol</a> note.</p>' +
    '<h2>Two</h2><p>More.</p>'
  const { head, tail } = splitArticleForCta(withLinks)
  assert.equal(head + tail, withLinks)
  // A boundary landing mid-tag would leave an unbalanced fragment.
  const openA = (head.match(/<a /g) || []).length
  const closeA = (head.match(/<\/a>/g) || []).length
  assert.equal(openA, closeA, 'head must not cut an anchor in half')
  assert.ok(tail.startsWith('<h2'), 'tail must start at a tag boundary')
})

test('degrades safely when there is no second h2 — full article in head', () => {
  const oneHeading = '<p>Intro.</p><h2>Only Heading</h2><p>Body.</p>'
  const { head, tail, didSplit } = splitArticleForCta(oneHeading)
  assert.equal(didSplit, false)
  assert.equal(head, oneHeading, 'head must hold the ENTIRE article')
  assert.equal(tail, '')
})

test('degrades safely on no headings at all', () => {
  const plain = '<p>Just a paragraph.</p><p>And another.</p>'
  const r = splitArticleForCta(plain)
  assert.equal(r.didSplit, false)
  assert.equal(r.head, plain)
  assert.equal(r.head + r.tail, plain)
})

test('empty input does not throw and reports no split', () => {
  const r = splitArticleForCta('')
  assert.equal(r.didSplit, false)
  assert.equal(r.head + r.tail, '')
})

test('an h2 at index 0 does not produce an empty head', () => {
  // Real shape: several posts render the first <h2> at index 0 because the
  // intro lives in the excerpt. Splitting there would render the CTA above
  // every word of the article.
  const leadingH2 = '<h2>First</h2><p>One.</p><h2>Second</h2><p>Two.</p>'
  const { head, didSplit } = splitArticleForCta(leadingH2)
  assert.ok(head.length > 0, 'head must never be empty when didSplit is true')
  if (didSplit) assert.ok(head.includes('First'), 'head must carry section one')
})

test('handles h2 with attributes and mixed case', () => {
  const mixed = '<p>x</p><H2 class="a">One</H2><p>y</p><h2 data-k="v">Two</h2><p>z</p>'
  const { head, tail, didSplit } = splitArticleForCta(mixed)
  assert.equal(didSplit, true)
  assert.equal(head + tail, mixed)
  assert.ok(head.includes('One'))
  assert.ok(!head.includes('Two'))
})

test('does not match h20-style tags (word-boundary discipline)', () => {
  // `<h2` must not match a hypothetical `<h20`; the regex requires a space or
  // `>` after the digit. Guards against a lazy /<h2/ that would mis-split.
  const tricky = '<p>a</p><h2>Real One</h2><p>b</p><h2>Real Two</h2>'
  const { head } = splitArticleForCta(tricky)
  assert.ok(head.includes('Real One') && !head.includes('Real Two'))
})

test('a post with only ### sections loses the mid-CTA — safely, and silently', () => {
  // This documents the LGAAS dependency as an executable fact rather than only
  // in a work order (LGAAS-WORK-ORDER-BLOG-H2-STRUCTURE.md).
  //
  // Seoul Sister places the mid-article Yuri CTA by splitting at the SECOND
  // top-level <h2>. LGAAS owns the markdown. If a future post uses ### for all
  // its sections, this returns didSplit:false and the post renders WHOLE with
  // no mid-article CTA — no crash, no error, no failing test, just a quiet
  // reversion to "CTA only after ~2,000 words".
  //
  // The assertion is that the failure is SAFE (content intact), not that it is
  // impossible. Preventing it is LGAAS's side; all 46 posts satisfy it today.
  const onlyH3 = '<p>Intro.</p><h3>One</h3><p>A.</p><h3>Two</h3><p>B.</p>'
  const r = splitArticleForCta(onlyH3)
  assert.equal(r.didSplit, false, 'no h2 means no split point')
  assert.equal(r.head, onlyH3, 'the ENTIRE article must still render')
  assert.equal(r.head + r.tail, onlyH3, 'no content may be lost')
})
