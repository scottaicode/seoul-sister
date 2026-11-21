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

test('EXECUTED: no address saves a code, and a code an address left behind earlier is forgotten', async () => {
  const cfg = await loadConfig()
  const tt = (await cfg.redirects()).find((r) => r.source === '/tt')
  const offers = await loadOffers()
  assert.equal(offers.captureOfferCode, undefined, 'nothing reads a code from an address any more')
  const saved = globalThis.window
  try {
    // Whatever the address says, opening the page leaves nothing saved and reports no code.
    for (const q of [tt.destination.slice(tt.destination.indexOf('?')), '?code=BAILEY', '?from=recap&code=holidayglow', '?utm_source=tiktok&utm_medium=bio&from=tt_ss&code=BAILEY', '']) {
      const w = fakeWindow(q); globalThis.window = w
      assert.equal(offers.getOfferCode(), null, q)
      assert.equal(w.m.size, 0, q)
    }
    // Bailey's phone, Nov 20 2026: BAILEY saved by her old link, never typed. The first read forgets it.
    const hers = fakeWindow('?utm_source=tiktok&utm_medium=bio&from=tt_ss&code=BAILEY')
    hers.m.set(offers.OFFER_STORAGE_KEY, 'BAILEY'); hers.m.set(offers.OFFER_SAVED_AT_KEY, String(Date.now()))
    globalThis.window = hers
    assert.equal(offers.getOfferCode(), null)
    assert.equal(hers.m.size, 0)
    assert.equal(offers.getOfferCode(), null, 'and reloading the same address does not bring it back')
    // Typing it is what saves it, and that survives a reload at any address.
    const typed = fakeWindow(''); globalThis.window = typed
    assert.equal(offers.rememberOfferCode('holidayglow'), true)
    assert.equal(typed.m.get(offers.OFFER_STORAGE_KEY), 'HOLIDAYGLOW')
    assert.equal(typed.m.get(offers.OFFER_TYPED_KEY), '1')
    assert.equal(offers.getOfferCode(), 'HOLIDAYGLOW')
    // Forgetting it forgets the mark too.
    offers.clearOfferCode()
    assert.equal(typed.m.size, 0)
    assert.equal(offers.getOfferCode(), null)
  } finally {
    globalThis.window = saved
  }
})

test('closed world: across all of src, the saved code is written in ONE place, from what the person typed', () => {
  const files = []
  const walk = (dir) => { for (const e of readdirSync(join(root, dir), { withFileTypes: true })) { const p = dir + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) files.push(p) } }
  walk('src')
  assert.ok(files.length > 300, 'the walk must see the app')
  // Only offers.ts names the storage keys, by constant or by their text.
  assert.deepEqual(files.filter((f) => /ss_offer_code/.test(read(f))), ['src/lib/offers.ts'])
  const offers = read('src/lib/offers.ts')
  assert.equal(offers.split('setItem(OFFER_STORAGE_KEY').length - 1, 1)
  assert.equal(offers.split('setItem(OFFER_TYPED_KEY').length - 1, 1)
  // The one writer, whole: the value is what the person typed, and the mark is set with it.
  assert.ok(offers.includes(
    "    const code = normalizeOfferCode(raw)\n" +
    "    if (!code) return false\n" +
    "    window.localStorage.setItem(OFFER_STORAGE_KEY, code)\n" +
    "    window.localStorage.setItem(OFFER_SAVED_AT_KEY, String(Date.now()))\n" +
    "    window.localStorage.setItem(OFFER_TYPED_KEY, '1')\n" +
    "    return window.localStorage.getItem(OFFER_STORAGE_KEY) === code && window.localStorage.getItem(OFFER_TYPED_KEY) === '1'\n"
  ))
  // The reader refuses a code with no mark before it does anything else with it.
  assert.ok(offers.includes(
    "  const code = normalizeOfferCode(store.getItem(OFFER_STORAGE_KEY))\n" +
    "  if (!code) return null\n" +
    "  if (store.getItem(OFFER_TYPED_KEY) !== '1') {\n" +
    "    store.removeItem(OFFER_STORAGE_KEY)\n" +
    "    store.removeItem(OFFER_SAVED_AT_KEY)\n" +
    "    store.removeItem(OFFER_TYPED_KEY)\n" +
    "    return null\n" +
    "  }\n"
  ))
  // Nothing in offers.ts reads the address at all, and rememberOfferCode is called only where a person typed.
  assert.doesNotMatch(offers, /location\.search|URLSearchParams|location\.href/)
  const callers = files.filter((f) => f !== 'src/lib/offers.ts' && /rememberOfferCode/.test(read(f)))
  assert.deepEqual(callers.sort(), ['src/app/(auth)/subscribe/page.tsx', 'src/lib/typed-code.ts'])
  // The check-and-save for a typed code is called from one place, the sign-up form's own Apply
  // button, with what is in the code box. (A review fed it the address's ?code= from an effect on
  // that page, which would have saved a code nobody typed, with the typed mark on it.)
  const typedCallers = files.filter((f) => f !== 'src/lib/typed-code.ts' && /checkTypedCode\(/.test(read(f)))
  assert.deepEqual(typedCallers, ['src/app/(auth)/register/page.tsx'])
  const register = read('src/app/(auth)/register/page.tsx')
  assert.equal(register.split('checkTypedCode(').length - 1, 1)
  // `raw` is what the code box hands its Apply handler, and nothing else.
  assert.ok(register.includes('          <CodeField\n            className="mb-6 text-center"\n            onApply={async (raw) => {\n              const r = await checkTypedCode(raw)\n'))
  // No page or component reads a `code` parameter out of an address. The one reader in src is the
  // public lookup endpoint, which answers a question about a code and saves nothing.
  const readers = files.filter((f) => /\.get\(\s*['"`]code['"`]\s*\)|searchParams\.code\b|\[['"`]code['"`]\]/.test(read(f)))
  assert.deepEqual(readers, ['src/app/api/offer/route.ts'])
  // No source file holds a creator code as a value it could apply by default.
  for (const f of files) {
    const hits = [...read(f).matchAll(/^(?!\s*(\/\/|\*|\/\*)).*['"`](BAILEY|HOLIDAYGLOW)['"`]/gm)].map((m) => m[0].trim())
    assert.deepEqual(hits, [], `${f} holds a creator code outside a comment`)
  }
})
