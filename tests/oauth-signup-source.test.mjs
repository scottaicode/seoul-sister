/**
 * A Google sign-up records where it came from (Nov 14 2026).
 *
 * The first stranger to start a free week after the landing chat closed signed
 * up with Google, and her account carried no attribution, no visitor id and no
 * `signup_from`: `signInWithOAuth` was handed a `data` option it does not have,
 * behind a type cast, and dropped it silently. The callback page now writes
 * the three facts once, for a new account only.
 *
 * NOT proven by this file: that a real Google sign-up in production ends up
 * with the keys on `auth.users`. Name that row before calling it working.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const js = ts.transpileModule(read('src/lib/auth/oauth-signup-source.ts').replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const { oauthSignupMetadata, WINDOW } = new Function(`${js}; return { oauthSignupMetadata, WINDOW: OAUTH_NEW_ACCOUNT_WINDOW_MS }`)()

const NOW = Date.parse('2026-11-14T01:09:20Z')
const fresh = (meta = {}) => ({ created_at: '2026-11-14T01:09:06Z', user_metadata: { name: 'E', email_verified: true, ...meta } })
const found = { attribution: { utm_source: 'google', landing_path: '/blog/x' }, widgetVisitorId: '809359e2-aaaa', signupFrom: 'gate_blog' }

test('a new Google account gets all three source facts', () => {
  assert.deepEqual(oauthSignupMetadata(fresh(), found, NOW), {
    attribution: { utm_source: 'google', landing_path: '/blog/x' },
    widget_visitor_id: '809359e2-aaaa',
    signup_from: 'gate_blog',
  })
})

test('a member signing in from a tagged link is not counted as a sign-up', () => {
  const old = { created_at: '2026-07-21T10:00:00Z', user_metadata: {} }
  assert.equal(oauthSignupMetadata(old, found, NOW), null)
  const justOutside = { created_at: new Date(NOW - WINDOW - 1000).toISOString(), user_metadata: {} }
  assert.equal(oauthSignupMetadata(justOutside, found, NOW), null)
  const justInside = { created_at: new Date(NOW - WINDOW + 1000).toISOString(), user_metadata: {} }
  assert.ok(oauthSignupMetadata(justInside, found, NOW))
})

test('what is already on the account is never replaced, and unknown is never written as empty', () => {
  assert.deepEqual(oauthSignupMetadata(fresh({ signup_from: 'nurture_3', attribution: { utm_source: 'tiktok' } }), found, NOW), { widget_visitor_id: '809359e2-aaaa' })
  assert.equal(oauthSignupMetadata(fresh(), { attribution: null, widgetVisitorId: null, signupFrom: undefined }, NOW), null)
  assert.equal(oauthSignupMetadata(fresh(), { attribution: 'google', widgetVisitorId: '  ', signupFrom: '' }, NOW), null)
  // A tag that is not one of ours (letters, digits, underscore) is dropped.
  assert.equal(oauthSignupMetadata(fresh(), { signupFrom: 'gate blog<script>' }, NOW), null)
  assert.deepEqual(oauthSignupMetadata(fresh(), { signupFrom: 'gate_nav' }, NOW), { signup_from: 'gate_nav' })
})

test('no account, no creation time or a nonsense one writes nothing', () => {
  for (const u of [null, undefined, {}, { created_at: 'yesterday' }, { created_at: new Date(NOW + 60 * 60 * 1000).toISOString() }]) {
    assert.equal(oauthSignupMetadata(u, found, NOW), null)
  }
})

test('the callback records the source on BOTH paths, before it redirects, and never blocks sign-in', () => {
  const page = read('src/app/auth/callback/page.tsx')
  assert.equal((page.match(/await recordSignupSource\(/g) ?? []).length, 2)
  assert.equal((page.match(/await redirectBasedOnProfile\(/g) ?? []).length, 2)
  for (const m of page.matchAll(/await redirectBasedOnProfile\((\w+)\.user\.id\)/g)) {
    const before = page.slice(0, m.index).trimEnd()
    assert.ok(before.endsWith(`await recordSignupSource(${m[1]}.user)`), 'each redirect is preceded by the record call for the same session')
  }
  const fn = page.slice(page.indexOf('async function recordSignupSource'), page.indexOf('async function redirectBasedOnProfile'))
  assert.match(fn, /oauthSignupMetadata\(\s*user,\s*\{ attribution: getAttribution\(\), widgetVisitorId: getExistingVisitorId\(\), signupFrom \},\s*Date\.now\(\)\s*\)/)
  assert.match(fn, /if \(!data\) return\s*const \{ error: updateError \} = await supabase\.auth\.updateUser\(\{ data \}\)/)
  assert.ok(!/throw /.test(fn), 'a measurement failure must not break sign-in')
  assert.match(fn, /console\.error\('\[auth\/callback\] could not record sign-up source:'/)
})

test('signInWithOAuth is handed only options it has, with no type cast', () => {
  const ctx = read('src/contexts/AuthContext.tsx')
  const a = ctx.indexOf('supabase.auth.signInWithOAuth({')
  const call = ctx.slice(a, ctx.indexOf('if (error) throw error', a)).replace(/^\s*\/\/.*$/gm, '')
  const keys = [...call.matchAll(/^\s+([a-zA-Z]+):/gm)].map((m) => m[1])
  assert.deepEqual(keys, ['provider', 'options', 'redirectTo'])
  assert.ok(!/ as /.test(call), 'a cast is how the dropped option hid for months')
})
