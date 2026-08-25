/**
 * Guard tests — the crawlable path from a feeder page to the ONE conversion
 * surface (the landing hero widget at `/`).
 *
 * Earned Aug 25 2026, measured against the live site:
 *  - /blog/[slug] shipped ZERO `?ask=` links: both CTAs navigated via
 *    router.push() inside an onClick, so no href existed in the HTML. Blog
 *    posts take ~70% of Google clicks, so the pages earning the traffic had no
 *    crawlable link to `/` and AI crawlers saw the offer text with no
 *    destination.
 *  - /products/[id] shipped ZERO `?ask=` links for a different reason: a
 *    correct <Link> sat behind `if (authLoading || isSubscriber === null)
 *    return null`, so it was absent from server HTML.
 *  - The sitewide nav "Ask Yuri" was a <button>, invisible on ~12,867 pages.
 *  - `/` had NO canonical at all while every `?ask=` variant served
 *    byte-identical HTML with robots:index — thousands of indexable
 *    near-duplicate homepages.
 *
 * These assert on SOURCE because the defect is "does an href exist in the
 * markup" — a property of the JSX, not of runtime behaviour.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const decomment = (s) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

for (const [name, file] of [
  ['BlogYuriCta', 'src/components/blog/BlogYuriCta.tsx'],
  ['BlogInlineYuriPrompt', 'src/components/blog/BlogInlineYuriPrompt.tsx'],
]) {
  test(`${name} emits a real href, not a router.push handler`, () => {
    const src = decomment(read(file))
    assert.match(src, /<Link\s[\s\S]*?href=\{href\}/, 'must render <Link href>')
    assert.doesNotMatch(src, /router\.push/, 'router.push means no crawlable href in HTML')
    // The anonymous branch must carry the prefill AND the source attribution.
    assert.match(src, /\/\?ask=\$\{encodeURIComponent\(prefill\)\}&from=blog/)
    // href swaps on auth rather than preventDefault (no hydration mismatch,
    // middle-click keeps working).
    assert.match(src, /user \? '\/yuri' :/)
    assert.doesNotMatch(src, /preventDefault/)
  })
}

test('the sitewide nav Yuri CTA is a link, not a button', () => {
  const src = decomment(read('src/components/layout/PublicNav.tsx'))
  assert.match(src, /href=\{askYuriHref\}/, 'nav renders on every public page')
  assert.match(src, /askYuriHref = user \? '\/yuri' : '\/\?ask=&from=nav'/)
})

test('the product-page Yuri CTA renders BEFORE auth resolves', () => {
  const src = read('src/components/products/ProductIntelligenceSection.tsx')
  const gate = src.indexOf('if (authLoading || isSubscriber === null)')
  assert.ok(gate > 0, 'the auth gate must still exist')
  const afterGate = src.slice(gate, gate + 700)
  // REVERT CHECK: restoring `return null` here makes this fail.
  assert.match(afterGate, /<AskYuriAboutProduct/,
    'the free CTA must render while auth is unresolved, or crawlers never see it')
  assert.doesNotMatch(afterGate.split('}')[0] + '}', /return null/)
})

test('the homepage declares a canonical, and it is NOT in the root layout', () => {
  const page = read('src/app/page.tsx')
  assert.match(page, /alternates:\s*\{\s*canonical:\s*'\/'\s*\}/,
    'without this, every ?ask= variant is a separately indexable homepage')
  assert.doesNotMatch(page, /^'use client'/m,
    'a Client Component cannot export metadata — that is why the canonical was missing')

  // The trap: layout metadata is INHERITED by every route that sets no
  // canonical of its own. Eight public routes do exactly that, including
  // /privacy, /terms and /support. Putting canonical:'/' in the layout tells
  // Google the legal pages ARE the homepage. This was written and reverted.
  const layout = decomment(read('src/app/layout.tsx'))
  assert.doesNotMatch(layout, /canonical/,
    'canonical must never live in the root layout — it would leak to 8 public routes')
})

test('llms.txt states the real free-message count and a reachable Yuri URL', () => {
  const txt = read('public/llms.txt')
  const constant = read('src/lib/utils/widget-session.ts')
  const max = constant.match(/MAX_FREE_MESSAGES\s*=\s*(\d+)/)?.[1]
  assert.ok(max, 'MAX_FREE_MESSAGES must be findable')
  assert.match(txt, new RegExp(`\\(${max} messages, no signup\\)`),
    `llms.txt must match MAX_FREE_MESSAGES (${max}) — it claimed 20 for weeks`)
  assert.match(txt, /talk to Yuri free at https:\/\/www\.seoulsister\.com\//,
    'AI assistants need a URL to send people to, not just a description')
})
