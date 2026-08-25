/**
 * Guard tests — GSC true totals vs summed query rows.
 *
 * Earned Aug 25 2026 against Scott's own Search Console. Summing the
 * ['query','page'] rows UNDERCOUNTS badly because Google WITHHOLDS rows for
 * rare/anonymized queries. Not a pagination bug: 3,072 rows returned against a
 * 25,000 limit.
 *
 *   28d — console 568 clicks / 63.9K impr   vs   summed 73 / 12,056  (12.9%)
 *   7d  — console 192 clicks                vs   81 across visible rows (42%)
 *
 * Every weekly report since launch described a site earning ~568 clicks as
 * earning 73, which is the baseline every bet is graded against.
 *
 * These EXECUTE the real transpiled functions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { generateKeyPairSync } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function load(rel) {
  const src = readFileSync(join(root, rel), 'utf8')
  // Strip only LOCAL/type imports; keep node builtins (gsc-client signs a JWT
  // with node:crypto, and stripping that import made every test fail on
  // "createSign is not defined" — a harness bug, not a source bug).
  const stripped = src.replace(/^import\s+(?:type\s+)?\{[^}]*\}\s+from\s+'(?!node:)[^']*'\s*$/gm, '')
  const js = ts.transpileModule(stripped, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const gsc = await load('src/lib/seo/gsc-client.ts')

// getAccessToken() really signs a JWT, so the test needs a REAL private key.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const CFG = { siteUrl: 'sc-domain:seoulsister.com', clientEmail: 'a@b.c', privateKey }

test('fetchSiteTotals sends NO dimensions — that is the whole point', async () => {
  // REVERT CHECK: adding dimensions:['query','page'] here makes this fail.
  let captured = null
  const orig = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('oauth') || String(url).includes('token')) {
      return new Response(JSON.stringify({ access_token: 'x', expires_in: 3600 }), { status: 200 })
    }
    captured = JSON.parse(opts.body)
    return new Response(JSON.stringify({ rows: [{ clicks: 568, impressions: 63900, ctr: 0.009, position: 11.4 }] }), { status: 200 })
  }
  try {
    const t = await gsc.fetchSiteTotals(
CFG, '2026-07-26', '2026-08-22')
    assert.equal(captured.dimensions, undefined, 'an undimensioned query is what returns TRUE totals')
    assert.equal(t.clicks, 568)
    assert.equal(t.impressions, 63900)
  } finally { globalThis.fetch = orig }
})

test('a failed totals call returns null — it never throws away the weekly report', async () => {
  // A totals failure must degrade to the summed-row floor, not kill the run.
  const orig = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (String(url).includes('oauth') || String(url).includes('token')) {
      return new Response(JSON.stringify({ access_token: 'x', expires_in: 3600 }), { status: 200 })
    }
    return new Response('rate limited', { status: 429 })
  }
  try {
    const t = await gsc.fetchSiteTotals(
CFG, '2026-07-26', '2026-08-22')
    assert.equal(t, null, 'failure must be null (caller falls back and SAYS so), never a throw')
  } finally { globalThis.fetch = orig }
})

test('an empty rows array returns null rather than a fabricated zero', async () => {
  // Zero clicks and "no data" are different facts. Returning {clicks:0} would
  // let a dead call read as a dead site — the repo's named silent-failure class.
  const orig = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (String(url).includes('oauth') || String(url).includes('token')) {
      return new Response(JSON.stringify({ access_token: 'x', expires_in: 3600 }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }
  try {
    const t = await gsc.fetchSiteTotals(
CFG, '2026-07-26', '2026-08-22')
    assert.equal(t, null)
  } finally { globalThis.fetch = orig }
})

test('the strategist prompt discloses per-query coverage, and never hardcodes volume', () => {
  const src = readFileSync(join(root, 'src', 'lib', 'seo', 'seo-guardian.ts'), 'utf8')
  // Scope to the PROMPT STRING, not the file. A first version matched anywhere
  // in the source and passed against a gutted prompt because the same phrase
  // also appears in a code comment — a test scoped to the wrong region is worse
  // than no test.
  const codeOnly = src.replace(/^\s*\/\/.*$/gm, '')
  assert.match(codeOnly, /coverageNote\s*=/, 'the coverage note must be computed')
  assert.match(codeOnly, /PER-QUERY VISIBILITY: the \$\{/,
    'the note must be INTERPOLATED INTO the prompt, not merely described in a comment')
  assert.match(codeOnly, /\$\{coverageNote\}/, 'and the prompt must actually embed it')
  assert.match(codeOnly, /visible_clicks/, 'true totals and visible totals must both reach the prompt')
  // REVERT CHECK: restoring "~64 clicks per 28 days sitewide" makes this fail.
  assert.doesNotMatch(src, /~64 clicks per 28 days/,
    'a hardcoded volume figure from the UNDERCOUNTED sum must never return')
})
