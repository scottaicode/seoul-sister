/**
 * A creator code is typed, never handed out (Bailey's decision, Nov 20 2026).
 *
 * From Nov 10 her TikTok bio link (`/tt`) added `code=BAILEY`, so everyone who
 * tapped it got 50% off the first paid month without asking. Bailey met it
 * herself twice. The link now carries no code.
 *
 * A second-model review of the first guard (a regex over next.config.js) walked
 * around it three ways: the code built by string concatenation, built in a
 * template literal, and seeded in the browser from the link's `from=tt_ss` with
 * nothing in the redirect at all. So this file RUNS the real config and the real
 * capture function, and counts the writers of the saved code across all of src.
 *
 * NOT covered: what Stripe holds for a code, and a real redemption.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const require = createRequire(import.meta.url)

async function loadConfig() {
  const cfg = require(join(root, 'next.config.js'))
  return typeof cfg === 'function' ? await cfg('phase-production-build', { defaultConfig: {} }) : cfg
}

/** offers.ts, transpiled and loaded as it is (its one import is pricing). */
async function loadOffers() {
  const dir = mkdtempSync(join(tmpdir(), 'ss-code-typed-'))
  const out = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  writeFileSync(join(dir, 'pricing.mjs'), out(read('src/lib/pricing.ts')))
  const offersSrc = read('src/lib/offers.ts')
  assert.deepEqual([...offersSrc.matchAll(/^import [^\n]*from '([^']+)'/gm)].map((m) => m[1]), ['@/lib/pricing'], 'offers.ts gained an import this harness does not supply')
  writeFileSync(join(dir, 'offers.mjs'), out(offersSrc.replace("from '@/lib/pricing'", "from './pricing.mjs'")))
  return import(pathToFileURL(join(dir, 'offers.mjs')).href)
}

function fakeWindow(search) {
  const m = new Map()
  return { m, location: { search }, localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) } }
}

test('EXECUTED: no redirect or rewrite in the real config hands out a code', async () => {
  const cfg = await loadConfig()
  const redirects = await cfg.redirects()
  assert.ok(redirects.length >= 2)
  const rewrites = typeof cfg.rewrites === 'function' ? await cfg.rewrites() : []
  const rewriteRows = Array.isArray(rewrites) ? rewrites : [...(rewrites.beforeFiles ?? []), ...(rewrites.afterFiles ?? []), ...(rewrites.fallback ?? [])]
  for (const row of [...redirects, ...rewriteRows]) {
    assert.equal(/[?&]code=/i.test(String(row.destination)), false, `${row.source} -> ${row.destination} carries a code`)
    assert.equal(/BAILEY|HOLIDAYGLOW/i.test(JSON.stringify(row)), false, `${row.source} names a creator code`)
  }
  const tt = redirects.find((r) => r.source === '/tt')
  assert.equal(tt.destination, '/?utm_source=tiktok&utm_medium=bio&from=tt_ss')
  assert.equal(tt.permanent, false)
  // There is no middleware that could add one on the way.
  assert.equal(readdirSync(root).some((f) => /^middleware\.(ts|js|mjs)$/.test(f)), false)
  assert.equal(readdirSync(join(root, 'src')).some((f) => /^middleware\.(ts|js|mjs)$/.test(f)), false)
})

test('EXECUTED: arriving from the TikTok link saves no code; a code in the address still does', async () => {
  const cfg = await loadConfig()
  const tt = (await cfg.redirects()).find((r) => r.source === '/tt')
  const offers = await loadOffers()
  const saved = globalThis.window
  try {
    // Exactly what the link lands on.
    const arrival = fakeWindow(tt.destination.slice(tt.destination.indexOf('?')))
    globalThis.window = arrival
    offers.captureOfferCode()
    assert.equal(arrival.m.size, 0, 'the TikTok link must leave no code in the browser')
    assert.equal(offers.getOfferCode(), null)
    // Other tracking-only arrivals leave nothing either.
    for (const q of ['?from=tt_ss', '?utm_source=tiktok', '?from=gate_hero_button', '?utm_source=instagram&utm_medium=bio&from=ig_ss', '']) {
      const w = fakeWindow(q); globalThis.window = w
      offers.captureOfferCode()
      assert.equal(w.m.size, 0, q)
    }
    // The mechanism itself is intact: a code in the address is kept (our lead emails use it).
    const coded = fakeWindow('?from=recap&code=holidayglow'); globalThis.window = coded
    offers.captureOfferCode()
    assert.equal(coded.m.get(offers.OFFER_STORAGE_KEY), 'HOLIDAYGLOW')
    assert.equal(offers.getOfferCode(), 'HOLIDAYGLOW')
  } finally {
    globalThis.window = saved
  }
})

test('closed world: across all of src, the saved code is written in two places, both from what the person brought', () => {
  const files = []
  const walk = (dir) => { for (const e of readdirSync(join(root, dir), { withFileTypes: true })) { const p = dir + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) files.push(p) } }
  walk('src')
  assert.ok(files.length > 300, 'the walk must see the app')
  // Only offers.ts names the storage key, by constant or by its text.
  assert.deepEqual(files.filter((f) => /ss_offer_code/.test(read(f))), ['src/lib/offers.ts'])
  const offers = read('src/lib/offers.ts')
  assert.equal(offers.split('setItem(OFFER_STORAGE_KEY').length - 1, 2)
  // capture: the value comes from the address's own `code` parameter and nothing else.
  assert.ok(offers.includes(
    "    const code = normalizeOfferCode(new URLSearchParams(window.location.search).get('code'))\n" +
    "    if (code) {\n" +
    "      window.localStorage.setItem(OFFER_STORAGE_KEY, code)\n"
  ))
  // remember: the value is what the person typed.
  assert.ok(offers.includes(
    "    const code = normalizeOfferCode(raw)\n" +
    "    if (!code) return false\n" +
    "    window.localStorage.setItem(OFFER_STORAGE_KEY, code)\n"
  ))
  // No source file holds a creator code as a value it could apply by default.
  for (const f of files) {
    const hits = [...read(f).matchAll(/^(?!\s*(\/\/|\*|\/\*)).*['"`](BAILEY|HOLIDAYGLOW)['"`]/gm)].map((m) => m[0].trim())
    assert.deepEqual(hits, [], `${f} holds a creator code outside a comment`)
  }
})
