/**
 * Guard test — a blog post must never render its FAQ twice, and must never
 * render it zero times.
 *
 * The bug: LGAAS mandates a VISIBLE body FAQ (its stated AI-extraction
 * surface, `api/content-blog.js`) and Seoul Sister ALSO rendered `faq_schema`
 * as collapsed accordions. 39 of 45 published posts showed the same Q&As
 * twice. Neither side was wrong alone — nobody asserted the contract between
 * them. This test is that assertion.
 *
 * Two failure directions, and this test pins BOTH, because a fix for one is
 * the natural way to cause the other:
 *   - accordion renders when the body already has an FAQ  -> duplicate
 *   - accordion suppressed when the body has none         -> no visible FAQ
 *
 * The real module is transpiled and EXECUTED against real rendered-body
 * shapes. A source-regex test would pass against broken code (repo rule,
 * v11.16.0/v11.18.0).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'
import { marked } from 'marked'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

async function loadFaqVisibility() {
  const src = read('src', 'lib', 'utils', 'faq-visibility.ts')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-faq-'))
  const file = join(dir, 'faq-visibility.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

/** Mirrors the page's own pipeline: strip leading H1, then render markdown. */
const render = (md) => marked.parse(md.replace(/^#\s+.+\n+/, ''))

/**
 * Real body shapes, verbatim in structure from published posts (Aug 13 2026).
 * Each `dup` case duplicated in production before this fix.
 */
const BODIES_WITH_FAQ = {
  // 37 posts — the standard LGAAS shape, H3 sub-questions
  'h3 sub-questions': `## Frequently Asked Questions\n\n### Can I use this daily?\n\nYes, if your barrier is intact.\n\n### Does it pill under sunscreen?\n\nOnly if you over-apply.`,
  // 5 posts — questions are BOLD, not H3. Keying on H3s would miss these.
  'bold sub-questions': `## Frequently Asked Questions\n\n**Can I use a Korean cleansing oil if I don't wear makeup?**\n\nAbsolutely. Cleansing oil isn't just for removing makeup.`,
  // 1 post — best-korean-skincare-for-dark-spots-...; was on the work order's
  // "no body FAQ" list. A literal "Frequently Asked Questions" match misses it.
  'Common Questions heading': `## Common Questions\n\n**Q: Can dark spots be completely removed with skincare alone?**\nIt depends on the type and depth.`,
  // 1 post — best-japanese-korean-sunscreens-...
  'bare FAQ heading': `## FAQ\n\n**Is it worth it?**\n\nUsually, yes.`,
}

const BODIES_WITHOUT_FAQ = {
  'no faq at all': `## What to look for\n\nStart with a low percentage.\n\n## The bottom line\n\nPatch test first.`,
  // The detector must not fire on prose. Scoped to heading tags for this reason.
  'faq mentioned only in prose': `## The bottom line\n\nWe answered the most frequently asked questions about this ingredient in our guide, so start there.`,
  'question-shaped heading that is not an FAQ section': `## Why is K-beauty so expensive in the US?\n\nImport margin, mostly.`,
}

const SCHEMA_QS = 5

test('body already has an FAQ -> accordion is suppressed (no duplicate)', async () => {
  const { shouldRenderFaqAccordion } = await loadFaqVisibility()
  for (const [label, md] of Object.entries(BODIES_WITH_FAQ)) {
    assert.equal(
      shouldRenderFaqAccordion(render(md), SCHEMA_QS),
      false,
      `${label}: body has a visible FAQ, so the accordion would be a second copy`
    )
  }
})

test('body has no FAQ -> accordion still renders (the 8 published posts)', async () => {
  const { shouldRenderFaqAccordion } = await loadFaqVisibility()
  for (const [label, md] of Object.entries(BODIES_WITHOUT_FAQ)) {
    assert.equal(
      shouldRenderFaqAccordion(render(md), SCHEMA_QS),
      true,
      `${label}: body has no FAQ, suppressing the accordion leaves NO visible FAQ`
    )
  }
})

test('no schema questions -> nothing renders regardless of body', async () => {
  const { shouldRenderFaqAccordion } = await loadFaqVisibility()
  assert.equal(shouldRenderFaqAccordion(render(BODIES_WITHOUT_FAQ['no faq at all']), 0), false)
  assert.equal(shouldRenderFaqAccordion('', 0), false)
  assert.equal(shouldRenderFaqAccordion(null, 5), true, 'null body cannot be proven to have an FAQ')
})

/**
 * Closed-world assertion on the PAGE, not just the helper. An open-world check
 * ("the gate exists somewhere") cannot see a second, ungated render that
 * someone adds later — the exact hole that made the v11.27.0 guard tests
 * worthless. So: count the `<details>` FAQ renders and require exactly one,
 * and require that it is the gated one.
 */
test('page renders the faq accordion in exactly one place, and it is gated', () => {
  const page = read('src', 'app', 'blog', '[slug]', 'page.tsx')

  // Count the VISIBLE render primitive (<details> accordions), not every
  // getFaqQuestions() call — the JSON-LD block legitimately calls it too.
  const accordionRenders = page.match(/<details\b/g) || []
  assert.equal(
    accordionRenders.length,
    1,
    'expected exactly one visible FAQ accordion; a second one is a duplicate by construction'
  )

  // And that one accordion must be fed by faq_schema inside the gated block.
  const gateStart = page.indexOf('{showFaqAccordion && (')
  assert.ok(gateStart > -1, 'showFaqAccordion gate not found')
  assert.ok(
    page.indexOf('<details', gateStart) > gateStart,
    'the accordion must live INSIDE the showFaqAccordion gate'
  )

  assert.match(
    page,
    /\{showFaqAccordion && \(/,
    'the visible FAQ block must be gated on showFaqAccordion'
  )
  assert.doesNotMatch(
    page,
    /\{getFaqQuestions\(blogPost\.faq_schema\)\.length > 0 && \(/,
    'ungated length-only gate is back — that is the original duplicate-render bug'
  )
})

/**
 * The JSON-LD must NOT be gated. This is the requirement most at risk from a
 * careless refactor: if someone "tidies up" by reusing showFaqAccordion for
 * both blocks, rich results silently disappear on 39 posts and nothing on the
 * page looks different — the repo's most expensive bug shape.
 */
test('FAQPage JSON-LD is emitted from faq_schema on an ungated path', () => {
  const page = read('src', 'app', 'blog', '[slug]', 'page.tsx')

  const jsonLdBlock = page.slice(
    page.indexOf('const jsonLd ='),
    page.indexOf('return (')
  )
  assert.ok(jsonLdBlock.includes("'@type': 'FAQPage'"), 'FAQPage block missing from JSON-LD')
  assert.ok(
    /\.\.\.\(getFaqQuestions\(blogPost\.faq_schema\)\.length\s*\n?\s*\?/.test(jsonLdBlock),
    'FAQPage must key on faq_schema length directly'
  )
  assert.ok(
    !jsonLdBlock.includes('showFaqAccordion'),
    'JSON-LD must NOT depend on the visible-accordion gate — schema emits for every post that has one'
  )
})
