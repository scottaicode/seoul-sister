/**
 * Guard tests — SEO Guardian current-page-state facts (page-state.ts).
 *
 * Executes the real module (and the real execution-verifier helpers it reuses)
 * against a saved copy of the live BoJ sunscreen review from Oct 19 2026, the
 * page four bets asked to change and which never changed.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const tx = (f) =>
  ts.transpileModule(readFileSync(join(root, 'src', 'lib', 'seo', f), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
const asUrl = (js) => 'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
const verifierUrl = asUrl(tx('execution-verifier.ts'))
const pageStateJs = tx('page-state.ts').replace(/from ['"]\.\/execution-verifier['"]/, `from '${verifierUrl}'`)
assert.ok(pageStateJs.includes(verifierUrl), 'import rewrite must apply, or every test below is meaningless')
const ps = await import(asUrl(pageStateJs))

const BOJ = '/blog/beauty-of-joseon-aqua-fresh-sunscreen-full-review'
const bojHtml = readFileSync(join(__dirname, 'fixtures', 'seo-boj-review-2026-10-19.html'), 'utf8')

test('reads the real content headings of the live page', () => {
  const s = ps.parsePageState(BOJ, bojHtml)
  assert.equal(s.ok, true)
  assert.ok(s.headings.some((h) => h.includes("What's Actually in This Sunscreen")), s.headings.join('\n'))
  assert.ok(s.headings.some((h) => h.includes('Frequently Asked Questions')))
})

test('the template "Key Ingredients Mentioned" heading is NOT reported as page content', () => {
  // Kept, it reads as a shipped ingredients section on a page that has none.
  const s = ps.parsePageState(BOJ, bojHtml)
  assert.ok(bojHtml.includes('Key Ingredients Mentioned'), 'fixture must contain the template heading')
  assert.ok(!s.headings.some((h) => /Key Ingredients Mentioned/i.test(h)), s.headings.join('\n'))
})

test('the never-shipped work reads as absent: no mineral/chemical heading, no #full-ingredients-list', () => {
  const s = ps.parsePageState(BOJ, bojHtml)
  assert.ok(!s.headings.some((h) => /mineral or chemical/i.test(h)))
  assert.ok(!s.anchorIds.includes('full-ingredients-list'))
})

test('anchor ids are read from raw attributes', () => {
  const s = ps.parsePageState('/x', '<h2 id="best-serum-for-pie">Best serum</h2><p>x</p>')
  assert.deepEqual(s.anchorIds, ['best-serum-for-pie'])
  assert.deepEqual(s.headings, ['h2: Best serum'])
})

test('a failed fetch reads as UNKNOWN, never as an empty page', () => {
  const out = ps.formatPageStates([{ path: '/a', ok: false, error: 'HTTP 503' }], '2026-10-19')
  assert.match(out, /State UNKNOWN, not empty/)
  const none = ps.formatPageStates(null, '2026-10-19')
  assert.match(none, /UNAVAILABLE/)
  assert.match(none, /do not conclude from this block that anything is missing/)
})

test('the block discloses that unlisted pages were not checked', () => {
  const out = ps.formatPageStates([ps.parsePageState(BOJ, bojHtml)], '2026-10-19')
  assert.match(out, /NOT listed here were not checked/)
})

test('selectPages: top pages by clicks plus bet targets, deduped, external and null dropped, capped at 25', () => {
  const aggs = Array.from({ length: 40 }, (_, i) => ({ page: `/p${i}`, clicks: i }))
  const sel = ps.selectPages(aggs, ['/p39', null, 'https://evil.com/x', '/bet-target'])
  assert.equal(sel[0], '/p39')
  assert.equal(sel.filter((p) => p === '/p39').length, 1)
  assert.ok(sel.includes('/bet-target'))
  assert.ok(!sel.some((p) => p.startsWith('http')))
  const many = ps.selectPages(aggs, Array.from({ length: 40 }, (_, i) => `/b${i}`))
  assert.equal(many.length, 25)
})

test('a page drawn entirely by site code still shows its headings, labelled as code-drawn', () => {
  const html = '<h1 class="x">Best Korean Moisturizers</h1><h2 class="y">Top 20 Highest-Rated</h2>'
  const out = ps.formatPageStates([ps.parsePageState('/best/moisturizers', html)], '2026-10-19')
  assert.match(out, /Top 20 Highest-Rated/)
  assert.match(out, /site code draws this page/)
})

test("React's internal ids are not reported as anchors", () => {
  const s = ps.parsePageState('/x', '<div id="_r_"></div><div id=":r0:"></div><h2 id="faq">FAQ</h2>')
  assert.deepEqual(s.anchorIds, ['faq'])
})

test('a 404 is reported as a missing page, not as unknown', () => {
  const out = ps.formatPageStates([{ path: '/gone', ok: false, error: 'HTTP 404: the page does not exist' }], '2026-10-19')
  assert.match(out, /does not exist/)
  assert.doesNotMatch(out, /UNKNOWN/)
})

test('fetchPageStates maps a real 404 response to "does not exist" and a 503 to unknown', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async (url) => new Response('x', { status: String(url).endsWith('/gone') ? 404 : 503 })
  const errs = console.error
  console.error = () => {}
  try {
    const out = ps.formatPageStates(await ps.fetchPageStates(['/gone', '/flaky']), '2026-10-19')
    assert.match(out, /\/gone\n  \(HTTP 404: the page does not exist\)/)
    assert.match(out, /\/flaky\n  \(could not fetch: HTTP 503\. State UNKNOWN, not empty\)/)
  } finally {
    globalThis.fetch = real
    console.error = errs
  }
})


test('every content heading and the title/meta of the real page are read (h1 included)', () => {
  const s = ps.parsePageState(BOJ, bojHtml)
  assert.equal(s.headings.length, 19)
  assert.equal(s.title, 'Beauty of Joseon Aqua Fresh: Ingredients | Seoul Sister')
  assert.match(s.metaDescription, /full INCI list/)
  const h1 = ps.parsePageState('/x', '<h1>Top</h1>')
  assert.deepEqual(h1.headings, ['h1: Top'])
})

test('all anchors on a well-anchored page are returned; framework ids are not', () => {
  const ids = ['best-serum-for-pie', 'best-toner-for-pie', 'best-moisturizer-for-pie', 'best-ingredients-for-pie', 'pie-routine', 'how-long', 'faq']
  const html = ids.map((i) => `<h2 id="${i}">x</h2>`).join('') + '<div id="b:0"></div><div id="_r_"></div>'
  assert.deepEqual(ps.parsePageState('/x', html).anchorIds, ids)
})

test('a blog post with no written headings reads as UNKNOWN, not as a code-drawn page', () => {
  const out = ps.formatPageStates([ps.parsePageState('/blog/x', '<h2 class="a">Key Ingredients Mentioned</h2>')], '2026-10-19')
  assert.match(out, /Headings UNKNOWN, not absent/)
  assert.doesNotMatch(out, /site code draws this page/)
})

test('fetches carry a timeout and run at most 4 at a time', async () => {
  const real = globalThis.fetch
  let inFlight = 0, maxInFlight = 0, allSignals = true
  globalThis.fetch = async (_url, init) => {
    if (!(init?.signal instanceof AbortSignal)) allSignals = false
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((r) => setTimeout(r, 5))
    inFlight--
    return new Response('<h2>x</h2>', { status: 200 })
  }
  try {
    await ps.fetchPageStates(Array.from({ length: 10 }, (_, i) => `/p${i}`))
  } finally {
    globalThis.fetch = real
  }
  assert.equal(allSignals, true)
  assert.equal(maxInFlight, 4)
})

test('bet targets written as absolute URLs or with trailing slashes are matched to the same page', () => {
  const sel = ps.selectPages([], ['https://www.seoulsister.com/blog/a/', '/blog/a', 'https://seoulsister.com/blog/a?x=1'])
  assert.deepEqual(sel, ['/blog/a'])
  assert.deepEqual(ps.selectPages([], ['https://www.seoulsister.com/blog/b/']), ['/blog/b'])
  const counts = ps.countBetsByPage([
    { target_page: '/blog/a', date: '2026-09-01' },
    { target_page: 'https://www.seoulsister.com/blog/a/', date: '2026-07-24' },
    { target_page: null, date: '2026-07-01' },
  ])
  assert.deepEqual(counts.get('/blog/a'), { count: 2, since: '2026-07-24' })
  const out = ps.formatPageStates([ps.parsePageState('/blog/a', '<h2>x</h2>')], '2026-10-19', counts)
  assert.match(out, /prior bets on this page \(last 12 reports\): 2 since 2026-07-24/)
})

test('WIRING: the strategist prompt includes the block and the stored facts keep it', () => {
  const g = readFileSync(join(root, 'src', 'lib', 'seo', 'seo-guardian.ts'), 'utf8')
  assert.match(g, /\$\{input\.pageState\}/)
  assert.match(g, /pageState: formatPageStates\(pageStates, today, betsByPage\)/)
  assert.match(g, /pageChats: pageChatFacts, pageStates \}/)
})
