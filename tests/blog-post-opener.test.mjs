/**
 * Guard tests for the per-post "Ask Yuri" opener (Oct 12 2026,
 * src/components/blog/blog-prefill.ts + ss_content_posts.yuri_opener).
 *
 * Executes the real buildBlogPrefill. The invariants:
 *  - a stored opener is used VERBATIM (trimmed) as the visitor's first message;
 *  - a missing or blank opener falls back to the old template, so posts without
 *    one (and the site before the migration) behave exactly as before.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const src = fs.readFileSync(path.join(process.cwd(), 'src/components/blog/blog-prefill.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { buildBlogPrefill, postOpener } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)

const OPENER = 'I bought COSRX Snail Mucin on Amazon. How do I check if mine is real?'

test('a stored opener is the prefill, verbatim', () => {
  assert.equal(buildBlogPrefill({ primaryKeyword: 'snail mucin', opener: OPENER }), OPENER)
})

test('the opener is trimmed', () => {
  assert.equal(buildBlogPrefill({ primaryKeyword: 'x', opener: `  ${OPENER}\n` }), OPENER)
})

test('null, undefined and blank openers fall back to the old keyword template', () => {
  const old = buildBlogPrefill({ primaryKeyword: 'snail mucin' })
  assert.match(old, /^I just read your guide on snail mucin/)
  for (const opener of [null, undefined, '', '   ']) {
    assert.equal(buildBlogPrefill({ primaryKeyword: 'snail mucin', opener }), old)
  }
})

test('postOpener returns null for blank, the trimmed text otherwise', () => {
  assert.equal(postOpener('  '), null)
  assert.equal(postOpener(null), null)
  assert.equal(postOpener(` ${OPENER} `), OPENER)
})

// --- CTA wiring (Fable review Oct 12: the first version tested only the
// prefill builder, so a component that ignored the opener still passed). ---

const { blogCtaHref, shownOpener } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)

test('out-of-bounds openers are ignored, not shown or sent', () => {
  assert.equal(postOpener('too short'), null)
  assert.equal(postOpener('x'.repeat(241)), null)
  assert.equal(postOpener('x'.repeat(240)), 'x'.repeat(240))
})

test('anonymous blog href carries the opener, from=blog and the post path', () => {
  const href = blogCtaHref(OPENER, false, '/blog/cosrx-fake')
  const u = new URL(href, 'https://x.test')
  assert.equal(u.pathname, '/')
  assert.equal(u.searchParams.get('ask'), OPENER)
  assert.equal(u.searchParams.get('from'), 'blog')
  assert.equal(u.searchParams.get('fp'), '/blog/cosrx-fake')
})

test('signed-in readers go to /yuri and are not shown the opener', () => {
  assert.equal(blogCtaHref(OPENER, true, '/blog/x'), '/yuri')
  assert.equal(shownOpener(OPENER, true), null)
  assert.equal(shownOpener(OPENER, false), OPENER)
})

const prodSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/products/product-ask-href.ts'), 'utf8')
const prodJs = ts.transpileModule(prodSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { productTopHref } = await import('data:text/javascript;base64,' + Buffer.from(prodJs).toString('base64'))

test('product top link is tagged product_top and names WHICH product', () => {
  const u = new URL(productTopHref('abc-123', 'COSRX', 'Snail Mucin', false), 'https://x.test')
  assert.equal(u.searchParams.get('from'), 'product_top')
  assert.equal(u.searchParams.get('fp'), '/products/abc-123')
  assert.equal(u.searchParams.get('ask'), 'Is COSRX Snail Mucin right for my skin?')
  assert.equal(productTopHref('abc-123', 'COSRX', 'Snail Mucin', true), '/yuri')
})

// The components must route through the tested helpers rather than build
// their own links, or the tests above say nothing about what renders.
for (const [file, helpers] of [
  ['src/components/blog/BlogInlineYuriPrompt.tsx', ['blogCtaHref(', 'shownOpener(yuriOpener', 'opener: yuriOpener']],
  ['src/components/blog/BlogYuriCta.tsx', ['blogCtaHref(', 'shownOpener(yuriOpener', 'opener: yuriOpener']],
  ['src/components/products/ProductTopAskYuri.tsx', ['productTopHref(productId']],
]) {
  test(`${path.basename(file)} uses the tested helpers and builds no ?ask= link itself`, () => {
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')
    for (const h of helpers) assert.ok(code.includes(h), `${file} must call ${h}`)
    assert.ok(!code.includes('?ask='), `${file} builds its own ?ask= link`)
  })
}

test('every blog CTA on the post page receives the opener', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'src/app/blog/[slug]/page.tsx'), 'utf8')
  const ctas = page.match(/<Blog(?:InlineYuriPrompt|YuriCta)\b[\s\S]*?\/>/g) || []
  assert.equal(ctas.length, 3)
  for (const c of ctas) assert.match(c, /yuriOpener=\{blogPost\.yuri_opener\}/)
})
