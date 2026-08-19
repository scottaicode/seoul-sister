/**
 * Guard: on /products/[id], the FREE Yuri offer must render BEFORE the locked
 * "Subscribe to unlock" teasers and before the register wall.
 *
 * Why a guard and not a preference: this page is the surface AI assistants cite
 * most for specific product queries, and it is where a cold stranger lands. The
 * CTA has existed since July 27 but rendered FIFTH — beneath four locked panels
 * — which is why the placement went unnoticed for three weeks.
 *
 * This asserts ORDER of source positions. That is a legitimate use of source
 * inspection: for sibling nodes in a single JSX return, source order IS DOM
 * order. It deliberately does NOT assert on wording — a copy edit must not fail
 * it, and banning specific phrases would police yesterday's wording rather than
 * the shape (CLAUDE.md: never enumerate the bad thing).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/components/products/ProductIntelligenceSection.tsx'),
  'utf8'
)

/** Slice starting at the anonymous-visitor return block, so the subscriber
 *  branch above it can never satisfy these assertions. */
function anonBlock(src) {
  const marker = src.indexOf('product-gated-content')
  assert.ok(marker > 0, 'anonymous gated container must exist')
  const ret = src.lastIndexOf('return (', marker)
  assert.ok(ret > 0, 'anonymous return block must exist')
  return src.slice(ret)
}

test('free Yuri CTA renders before the locked teasers', () => {
  const block = anonBlock(SRC)
  const cta = block.indexOf('<AskYuriAboutProduct')
  const firstTeaser = block.indexOf('<GatedTeaser')
  assert.ok(cta > 0, 'AskYuriAboutProduct must render in the anonymous branch')
  assert.ok(firstTeaser > 0, 'GatedTeaser must still render')
  assert.ok(cta < firstTeaser, 'the FREE Yuri CTA must come before the first locked teaser')
})

test('free Yuri CTA renders before the paid register wall', () => {
  const block = anonBlock(SRC)
  const cta = block.indexOf('<AskYuriAboutProduct')
  const register = block.indexOf('href="/register"')
  assert.ok(register > 0, 'register CTA must still exist')
  assert.ok(cta < register, 'free Yuri must precede the $-wall')
})

test('the Yuri CTA is not itself a locked teaser', () => {
  // Regression guard for the pre-July-27 state, where "Ask Yuri About This
  // Product" was a GatedTeaser whose only action was /register.
  const block = anonBlock(SRC)
  const cta = block.indexOf('<AskYuriAboutProduct')
  const before = block.slice(Math.max(0, cta - 200), cta)
  assert.ok(!/<GatedTeaser[^>]*$/.test(before), 'must not be nested inside a GatedTeaser')
})

test('the free CTA routes to Yuri, not to registration', () => {
  // Scope to THIS function only. An earlier version of this test sliced a
  // fixed byte count and swept in the NEXT function (GatedTeaser), whose
  // href="/register" then failed the negative assertion — a test bug that
  // looked exactly like a code bug. Bound the slice at the next top-level
  // `function ` instead.
  const defIdx = SRC.indexOf('function AskYuriAboutProduct')
  assert.ok(defIdx > 0, 'AskYuriAboutProduct must be defined here')
  const nextFn = SRC.indexOf('\nfunction ', defIdx + 1)
  const body = SRC.slice(defIdx, nextFn > 0 ? nextFn : undefined)
  assert.ok(body.includes('ask='), 'CTA must carry an ?ask= prefill to the landing widget')
  assert.ok(body.includes('from=product'), 'CTA must tag its feeder source')
  assert.ok(!/href="\/register"/.test(body), 'the FREE CTA must not point at the register wall')
})
