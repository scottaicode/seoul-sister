/**
 * The first-party count of sign-up button presses (Nov 21 2026), and the blog
 * buttons that now go straight to the sign-up form.
 *
 * Why it exists: nothing of ours recorded the step between "read a page" and
 * "created an account". Google Analytics counted 3,358 sessions in nine days
 * against 5 real accounts, because it counts crawlers. A crawler does not press
 * a button.
 *
 * What must stay true:
 *   - a press stores a button name, an arrival tag and a page path, each in a
 *     fixed shape, and NOTHING that identifies a person;
 *   - a failed write is an error, never a quiet success (an empty table must
 *     mean nobody pressed);
 *   - every sign-up button on the landing page and on a blog post records its
 *     press;
 *   - a signed-out blog reader, with the chat closed, goes straight to the
 *     sign-up form with their question carried, and the form shows it back.
 *
 * NOT EXECUTED: the browser's sendBeacon, and the pages themselves.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const out = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const load = (js) => import('data:text/javascript;base64,' + Buffer.from(js + `\n// ${Math.random()}`).toString('base64'))

const LIB = read('src/lib/signup-press.ts')
assert.doesNotMatch(LIB, /^import /m, 'signup-press.ts must stay import-free so this file runs it as it is')
const lib = await load(out(LIB))

test('EXECUTED: every stored value comes from a fixed list; nothing a visitor writes freely survives', () => {
  assert.deepEqual([...lib.SIGNUP_PRESS_BUTTONS], ['nav', 'menu', 'bar', 'final_cta', 'blog_cta', 'blog_inline'])
  assert.deepEqual(lib.signupPressRow({ button: 'bar', arrival: 'tiktok', path: '/' }), { button: 'bar', arrival: 'tiktok', page_path: '/' })
  assert.deepEqual(lib.signupPressRow({ button: 'blog_cta', arrival: 'blog', path: '/blog/best-oils?utm=x#top' }), { button: 'blog_cta', arrival: 'blog', page_path: '/blog/best-oils' })
  // The row is built field by field: nothing else passed in can ride along, in any field.
  const loaded = lib.signupPressRow({ button: 'nav', arrival: null, path: '/', email: 'jane@example.com', user_id: 'u1', ip: '203.0.113.9', visitor_id: 'v' })
  assert.deepEqual(loaded, { button: 'nav', arrival: null, page_path: '/' })
  // A button that is not one of ours: no row. (So a made-up name cannot be counted.)
  for (const bad of [undefined, null, '', 'Bar', 'bar ', 'zz_fake', 'nav;drop', 42, {}, []]) assert.equal(lib.signupPressRow({ button: bad, path: '/' }), null, String(bad))

  // ARRIVAL: reduced to a channel name. Our own tags map by their first word.
  for (const [raw, want] of [['blog', 'blog'], ['landing', 'landing'], ['tiktok', 'tiktok'], ['TikTok', 'tiktok'], ['product_top', 'product'], ['best_cta', 'best'], ['nurture_3', 'nurture'], ['tt_ss', 'tiktok'], ['ig_ss', 'instagram'], ['chatgpt', 'chatgpt'], ['ref_some_site_com', 'referrer']]) {
    assert.equal(lib.pressArrival(raw), want, raw)
  }
  // Anything else becomes 'other': a personalised campaign value or a person's own domain is never kept.
  for (const personal of ['jane_doe_gmail_com', 'jane.doe@gmail.com', 'newsletter-for-jane-smith', 'x'.repeat(80), 'blogger_jane', '203.0.113.9']) {
    assert.equal(lib.pressArrival(personal), 'other', personal)
  }
  assert.equal(lib.pressArrival('ref_jane_smith_substack_com'), 'referrer', 'a referring site is recorded as a kind, never by name')
  for (const none of [undefined, null, '', '   ', 7, {}]) assert.equal(lib.pressArrival(none), null)
  // Whatever goes in, what comes out is in the closed set.
  const allowed = new Set([...lib.SIGNUP_PRESS_ARRIVALS, 'referrer', 'other', null])
  for (const raw of ['blog', 'a@b.c', '../../etc', '<script>', 'ref_', 'ref_x', 'tt', 'ig', 'nurture', 'email_jane', 'google_ads_jane_doe']) assert.ok(allowed.has(lib.pressArrival(raw)), raw)
  // The list covers every AI assistant label the site assigns.
  const labels = [...read('src/lib/widget/ai-referrer.ts').matchAll(/^\s+\['[^']+', '([a-z]+)'\],/gm)].map((m) => m[1])
  assert.ok(labels.length >= 8)
  for (const label of labels) assert.ok(lib.SIGNUP_PRESS_ARRIVALS.includes(label), `${label} missing from SIGNUP_PRESS_ARRIVALS`)

  // PATH: the home page or one blog post. No query (it can hold a visitor's own question), nothing else.
  assert.equal(lib.pressPath('/'), '/')
  assert.equal(lib.pressPath('/?ask=my%20skin%20is'), '/')
  assert.equal(lib.pressPath('/blog/best-korean-cleansing-oils-for-every-skin-type-2026'), '/blog/best-korean-cleansing-oils-for-every-skin-type-2026')
  for (const no of ['/register', '/auth/callback', '/subscribe', '/products/6e1a4ed5-5f3f-482b-9b5c-9a05db838c52', '/blog', '/blog/', '/blog/a/b', '/blog/Has Space', 'https://evil.test/blog/x', '//evil.test/x', 'blog/x', '/blog/' + 'a'.repeat(300), 5, null]) {
    assert.equal(lib.pressPath(no), null, String(no))
  }

  // The table's own checks accept everything this can produce, and it holds nothing that identifies a person.
  const mig = read('supabase/migrations/20261121000001_signup_presses.sql')
  assert.ok(mig.includes("button text NOT NULL CHECK (button ~ '^[a-z0-9_]{1,40}$')"))
  assert.ok(mig.includes("arrival text CHECK (arrival IS NULL OR arrival ~ '^[a-z0-9_]{1,40}$')"))
  assert.ok(mig.includes("page_path text CHECK (page_path IS NULL OR (char_length(page_path) BETWEEN 1 AND 200 AND page_path LIKE '/%'))"))
  for (const v of [...lib.SIGNUP_PRESS_BUTTONS, ...lib.SIGNUP_PRESS_ARRIVALS, 'referrer', 'other']) assert.match(v, /^[a-z0-9_]{1,40}$/)
  const cols = [...mig.matchAll(/^  ([a-z_]+) (?:uuid|timestamptz|text)/gm)].map((m) => m[1])
  assert.deepEqual(cols, ['id', 'pressed_at', 'button', 'arrival', 'page_path'])
  assert.ok(mig.includes('ALTER TABLE ss_signup_presses ENABLE ROW LEVEL SECURITY;'))
  assert.doesNotMatch(mig, /CREATE POLICY/)
})

test('EXECUTED: only a request from our own page is accepted, and only a small one', () => {
  const ok = lib.pressRequestAllowed
  assert.equal(ok({ secFetchSite: 'same-origin', origin: 'https://www.seoulsister.com', host: 'www.seoulsister.com', contentLength: '60' }), true)
  // Another site's page, or a navigation typed by hand, is refused.
  for (const site of ['cross-site', 'same-site', 'none']) assert.equal(ok({ secFetchSite: site, host: 'www.seoulsister.com' }), false, site)
  assert.equal(ok({ origin: 'https://evil.test', host: 'www.seoulsister.com' }), false)
  assert.equal(ok({ origin: 'not a url', host: 'www.seoulsister.com' }), false)
  assert.equal(ok({ origin: 'https://www.seoulsister.com', host: null }), false)
  // Too large, or a length that is not a number.
  assert.equal(lib.SIGNUP_PRESS_MAX_BYTES, 600)
  assert.equal(ok({ secFetchSite: 'same-origin', contentLength: '601' }), false)
  assert.equal(ok({ secFetchSite: 'same-origin', contentLength: 'lots' }), false)
  assert.equal(ok({ secFetchSite: 'same-origin', contentLength: '600' }), true)
  // An old browser that sends neither header is let through; the fixed lists still limit what it can write.
  assert.equal(ok({}), true)
})

/** The real route handler, with its imports supplied. */
function loadRoute({ insert, allowed = true }) {
  const src = read('src/app/api/funnel/press/route.ts')
  const imported = [...src.matchAll(/^import (?:type )?\{([^}]*)\}/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim())).filter(Boolean)
  assert.deepEqual(imported.sort(), ['NextRequest', 'NextResponse', 'SIGNUP_PRESS_MAX_BYTES', 'checkRateLimit', 'getServiceClient', 'networkKey', 'pressRequestAllowed', 'signupPressRow'].sort())
  const body = out(src.replace(/^import [^\n]*\n/gm, '').replace('export async function POST', 'async function POST'))
  class NextResponse { constructor(b, init) { this.body = b; this.status = init?.status ?? 200 } }
  const calls = { inserts: [], limits: [] }
  const getServiceClient = () => ({ from: (table) => ({ insert: async (row) => { calls.inserts.push({ table, row }); return insert(row) } }) })
  const checkRateLimit = async (key, max, windowMs) => { calls.limits.push({ key, max, windowMs }); return { allowed } }
  // The real one-way key from trial.ts, run as it is.
  const trial = read('src/lib/trial.ts')
  const nk = trial.slice(trial.indexOf('export function networkKey'), trial.indexOf('\n}\n', trial.indexOf('export function networkKey')) + 3).replace('export function', 'function')
  const networkKey = new Function(`${out(nk)}\nreturn networkKey`)()
  const quiet = { error() {}, warn() {}, log() {} }
  const POST = new Function('NextResponse', 'getServiceClient', 'checkRateLimit', 'networkKey', 'signupPressRow', 'pressRequestAllowed', 'SIGNUP_PRESS_MAX_BYTES', 'console', `${body}\nreturn POST`)(
    NextResponse, getServiceClient, checkRateLimit, networkKey, lib.signupPressRow, lib.pressRequestAllowed, lib.SIGNUP_PRESS_MAX_BYTES, quiet)
  const req = (text, headers = {}) => {
    const all = { 'x-forwarded-for': '203.0.113.9', 'sec-fetch-site': 'same-origin', origin: 'https://www.seoulsister.com', host: 'www.seoulsister.com', 'content-length': String(text.length), ...headers }
    return { headers: { get: (k) => all[k] ?? null }, text: async () => text }
  }
  return { POST, req, calls }
}

test('EXECUTED: the endpoint writes one row from the fixed lists, never the address, and a failed write is an error', async () => {
  const ok = loadRoute({ insert: async () => ({ error: null }) })
  let res = await ok.POST(ok.req(JSON.stringify({ button: 'bar', arrival: 'jane_doe_gmail_com', path: '/?ask=private%20question', email: 'a@b.c' })))
  assert.equal(res.status, 204)
  assert.deepEqual(ok.calls.inserts, [{ table: 'ss_signup_presses', row: { button: 'bar', arrival: 'other', page_path: '/' } }])
  // The address reaches NEITHER table as itself: the rate-limit key is a short one-way key.
  assert.equal(ok.calls.limits.length, 1)
  assert.match(ok.calls.limits[0].key, /^signup-press:[a-z0-9]{1,12}$/)
  assert.deepEqual([ok.calls.limits[0].max, ok.calls.limits[0].windowMs], [60, 3600000])
  assert.equal(JSON.stringify(ok.calls).includes('203.0.113'), false, 'the raw address must not appear in anything written')
  // With no arrival sent, the row's arrival is null, not something taken from the request.
  const bare = loadRoute({ insert: async () => ({ error: null }) })
  await bare.POST(bare.req(JSON.stringify({ button: 'nav', path: '/' })))
  assert.deepEqual(bare.calls.inserts[0].row, { button: 'nav', arrival: null, page_path: '/' })
  // Not JSON, not an object, or not one of our buttons: refused, nothing written.
  for (const bad of ['', 'not json', '[]', '"bar"', '{}', '{"button":"zz_fake"}', 'null']) {
    const r = loadRoute({ insert: async () => ({ error: null }) })
    res = await r.POST(r.req(bad))
    assert.equal(res.status, 400, bad)
    assert.equal(r.calls.inserts.length, 0, bad)
  }
  // From another site: refused before anything else happens.
  const cross = loadRoute({ insert: async () => ({ error: null }) })
  res = await cross.POST(cross.req(JSON.stringify({ button: 'bar' }), { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' }))
  assert.equal(res.status, 403)
  assert.deepEqual([cross.calls.inserts.length, cross.calls.limits.length], [0, 0])
  // A body larger than it claims: refused, nothing written.
  const big = loadRoute({ insert: async () => ({ error: null }) })
  res = await big.POST(big.req(JSON.stringify({ button: 'bar', pad: 'x'.repeat(2000) }), { 'content-length': '50' }))
  assert.equal(res.status, 400)
  assert.equal(big.calls.inserts.length, 0)
  // Over the limit: refused, nothing written.
  const limited = loadRoute({ insert: async () => ({ error: null }), allowed: false })
  res = await limited.POST(limited.req(JSON.stringify({ button: 'bar' })))
  assert.equal(res.status, 429)
  assert.equal(limited.calls.inserts.length, 0)
  // The write fails (the table is missing, say): that is a 500, never a quiet 204.
  const broken = loadRoute({ insert: async () => ({ error: { message: 'relation "ss_signup_presses" does not exist' } }) })
  res = await broken.POST(broken.req(JSON.stringify({ button: 'bar' })))
  assert.equal(res.status, 500)
})

test('EXECUTED: in a browser, a press is actually sent', () => {
  const saved = { window: globalThis.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), Blob: globalThis.Blob, fetch: globalThis.fetch }
  const beacons = [], fetches = []
  class FakeBlob { constructor(parts, opts) { this.text = parts.join(''); this.type = opts?.type } }
  try {
    globalThis.window = { location: { pathname: '/blog/best-oils' } }
    globalThis.Blob = FakeBlob
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: (url, blob) => { beacons.push({ url, body: blob.text, type: blob.type }); return true } } })
    globalThis.fetch = async (url, init) => { fetches.push({ url, init }); return { ok: true } }
    lib.recordSignupPress('blog_cta', 'blog')
    assert.deepEqual(beacons, [{ url: '/api/funnel/press', body: JSON.stringify({ button: 'blog_cta', arrival: 'blog', path: '/blog/best-oils' }), type: 'application/json' }])
    assert.equal(fetches.length, 0)
    // The browser refuses the beacon: it falls back to a kept-alive request with the same body.
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: () => false } })
    lib.recordSignupPress('bar', 'tiktok')
    assert.equal(fetches.length, 1)
    assert.equal(fetches[0].url, '/api/funnel/press')
    assert.equal(fetches[0].init.keepalive, true)
    assert.equal(fetches[0].init.body, JSON.stringify({ button: 'bar', arrival: 'tiktok', path: '/blog/best-oils' }))
    // Not one of our buttons: nothing is sent at all. And nothing here can throw into the click.
    lib.recordSignupPress('zz_fake', 'blog')
    assert.deepEqual([beacons.length, fetches.length], [1, 1])
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: () => { throw new Error('blocked') } } })
    assert.doesNotThrow(() => lib.recordSignupPress('bar', 'blog'))
  } finally {
    globalThis.window = saved.window; globalThis.Blob = saved.Blob; globalThis.fetch = saved.fetch
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator); else delete globalThis.navigator
  }
})

test('closed world: every sign-up button records its press, and nothing else writes the table', () => {
  const home = read('src/components/home/HomeClient.tsx')
  // The landing page's four buttons all go through one counter, which records before anything else.
  assert.deepEqual([...home.matchAll(/trackSignupClick\('([a-z_]+)'\)/g)].map((m) => m[1]), ['nav', 'menu', 'bar', 'final_cta'])
  assert.ok(home.includes("    if (LANDING_CHAT_OPEN) return\n    // Our own count first (ss_signup_presses): the one that crawlers do not inflate.\n    recordSignupPress(button, arrivalSource)\n"))
  assert.equal(home.split('recordSignupPress(').length - 1, 1)
  // The two blog buttons record theirs, for a signed-out reader with the chat closed (the only case that leads to sign-up).
  const cta = read('src/components/blog/BlogYuriCta.tsx')
  const inline = read('src/components/blog/BlogInlineYuriPrompt.tsx')
  assert.ok(cta.includes("onClick={() => { trackEvent(BlogEvent.ctaClick, { placement: 'hero_cta', authed: !!user }); if (!user && !LANDING_CHAT_OPEN) recordSignupPress('blog_cta', 'blog') }}"))
  assert.ok(inline.includes("onClick={() => { trackEvent(BlogEvent.ctaClick, { placement: 'inline_prompt', authed: !!user }); if (!user && !LANDING_CHAT_OPEN) recordSignupPress('blog_inline', 'blog') }}"))
  // In all three files the name means the real function: imported from the one place, never defined or shadowed locally.
  for (const [name, src] of [['HomeClient', home], ['BlogYuriCta', cta], ['BlogInlineYuriPrompt', inline]]) {
    assert.ok(src.includes("import { recordSignupPress } from '@/lib/signup-press'\n"), name)
    assert.doesNotMatch(src, /(?:function|const|let|var)\s+recordSignupPress\b/, `${name} defines its own recordSignupPress`)
    assert.doesNotMatch(src, /recordSignupPress\s*=[^=]/, `${name} reassigns recordSignupPress`)
  }
  // Every button name a page passes is one the endpoint accepts.
  for (const name of ['nav', 'menu', 'bar', 'final_cta', 'blog_cta', 'blog_inline']) assert.ok(lib.SIGNUP_PRESS_BUTTONS.includes(name))
  // One writer of the table in the whole of src, and it writes exactly the row the helper built.
  const route = read('src/app/api/funnel/press/route.ts')
  assert.ok(route.includes("  const row = signupPressRow((body && typeof body === 'object' ? body : {}) as { button?: unknown; arrival?: unknown; path?: unknown })\n  if (!row) return new NextResponse(null, { status: 400 })\n\n  const { error } = await getServiceClient().from('ss_signup_presses').insert(row)\n  if (error) {\n    console.error('[signup-press] write failed:', error.message)\n    return new NextResponse(null, { status: 500 })\n  }\n"))
  assert.equal(route.split('.insert(').length - 1, 1)
  assert.doesNotMatch(route, /row\.[a-z_]+\s*=|\.\.\.row|Object\.assign/, 'the row is not altered after it is built')
  // The address is read once, for the limit, and only its one-way key goes anywhere.
  assert.ok(route.includes("  const limit = await checkRateLimit(`signup-press:${networkKey(ip) ?? 'unknown'}`, 60, 60 * 60 * 1000)\n"))
  assert.deepEqual(route.match(/(?<![-\w])ip\b(?!-)/g), ['ip', 'ip'], 'declared, and passed to networkKey: nowhere else')
  assert.doesNotMatch(route, /cookies|authorization|user-agent|referer/i)
})

test('EXECUTED: a signed-out blog reader goes straight to the sign-up form with their question; the form shows it back', async () => {
  const chatSrc = read('src/lib/landing-chat.ts')
  const closed = await load(out(chatSrc).replaceAll('process.env.NEXT_PUBLIC_LANDING_CHAT', 'undefined'))
  const Q = 'Which Korean cleansing oil would suit my skin type without leaving a film?'
  for (const placement of ['cta', 'inline']) {
    const href = closed.gatedSignupHref(closed.gateButtonTag('blog', placement), Q)
    const u = new URL(href, 'https://x.test')
    assert.equal(u.pathname, '/register')
    assert.equal(u.searchParams.get('from'), `gate_blog_${placement}`)
    assert.equal(u.searchParams.get('ask'), Q)
    assert.equal(u.searchParams.get('plan'), 'monthly')
  }
  // Both buttons build it that way for a signed-out reader while the chat is closed, and keep the old
  // destinations otherwise (the landing chat when it is open, /yuri for a member).
  for (const [file, placement] of [['src/components/blog/BlogYuriCta.tsx', 'cta'], ['src/components/blog/BlogInlineYuriPrompt.tsx', 'inline']]) {
    assert.ok(read(file).includes(`  const href = LANDING_CHAT_OPEN || user ? blogCtaHref(prefill, !!user, feederPath) : gatedSignupHref(gateButtonTag('blog', '${placement}'), prefill)\n`), file)
  }
  // The inline button says an account comes first, because the press now lands on a form (Nov 22
  // 2026: "Ask Yuri, free:" led a reader to expect an answer). The words come from one place.
  assert.equal(closed.askYuriLabel(), 'Ask Yuri, free to start with an account:')
  assert.equal(closed.askYuriLabel(), `Ask Yuri, ${closed.yuriAccessPhrase()}:`, 'built from the shared phrase, so the two cannot drift')
  const inlineSrc = read('src/components/blog/BlogInlineYuriPrompt.tsx')
  assert.ok(inlineSrc.includes('            <span className="block text-xs font-medium text-amber-300 mb-0.5">{askYuriLabel()}</span>\n'))
  assert.equal(inlineSrc.split('askYuriLabel()').length - 1, 1)
  assert.doesNotMatch(inlineSrc.replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/g, ''), /Ask Yuri, free|>\s*Ask Yuri[^<{]*:\s*</, 'the label is not written by hand')
  // A post with no question of its own to show gets the same notice under its line, for a signed-out reader only.
  assert.ok(inlineSrc.includes("            {!user && !LANDING_CHAT_OPEN && <span className=\"block text-xs text-amber-300/80 mt-0.5\">{yuriAccessSentence()}</span>}\n"))
  assert.equal(closed.yuriAccessSentence(), 'Free to start with an account.')
  // Closed world: the notice appears once in the component, behind that condition. A member never gets it.
  assert.equal(inlineSrc.split('yuriAccessSentence()').length - 1, 1)
  // The ingredient page's button also leads to a page that asks for an account, and now says so beside it.
  assert.ok(read('src/app/ingredients/[slug]/page.tsx').includes('works with your specific skin type, routine, and concerns. {yuriAccessSentence()}\n'))
  // What the sign-up form does with it: holds it, then shows back what it holds.
  const mem = new Map()
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
  const NOW = 1_800_000_000_000
  assert.equal(closed.peekCarriedQuestion(store, NOW), '')
  closed.stashCarriedQuestion(store, Q, NOW)
  assert.equal(closed.peekCarriedQuestion(store, NOW + 1000), Q)
  assert.equal(closed.peekCarriedQuestion(store, NOW + 2000), Q, 'showing it does not take it')
  assert.equal(closed.peekCarriedQuestion(store, NOW + 25 * 60 * 60 * 1000), '', 'a day-old question is not shown')
  assert.equal(closed.takeCarriedQuestion(store, NOW + 3000), Q, 'and the setup chat still gets it')
  assert.equal(closed.peekCarriedQuestion(store, NOW + 4000), '')
  assert.equal(closed.peekCarriedQuestion({ getItem: () => 'not json' }, NOW), '')
  assert.equal(closed.peekCarriedQuestion({ getItem() { throw new Error('blocked') } }, NOW), '')
  assert.equal(closed.peekCarriedQuestion(null, NOW), '')
  // The sentence beside it is the one the landing card already used, from one place.
  assert.equal(closed.CARRIED_QUESTION_NOTE, 'Create your account on this device and this question will be waiting in the box, ready to send.')
  const register = read('src/app/(auth)/register/page.tsx')
  assert.equal(register.split('{CARRIED_QUESTION_NOTE}').length - 1, 1)
  assert.equal(read('src/components/widget/GatedYuriIntro.tsx').split('{CARRIED_QUESTION_NOTE}').length - 1, 1)
  assert.ok(register.includes('        {carriedQuestion && (\n          <div className="mb-4 flex flex-col items-end gap-1">\n'))
  // The question is rendered as text, from what is held on the device, in one place.
  assert.doesNotMatch(register, /dangerouslySetInnerHTML|innerHTML/)
  assert.ok(register.includes('            <div className="max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-gradient-to-br from-gold to-gold-light text-seoul-dark">\n              {carriedQuestion}\n            </div>\n'))
  assert.equal(register.split('{carriedQuestion}').length - 1, 1)
  assert.equal(register.split("params.get('ask')").length - 1, 1, 'the address value goes to the stash and nowhere else')
  // The blog links to the form are marked nofollow, so each post's question is not a new page to index.
  for (const file of ['src/components/blog/BlogYuriCta.tsx', 'src/components/blog/BlogInlineYuriPrompt.tsx']) {
    assert.ok(read(file).includes("rel={LANDING_CHAT_OPEN || user ? undefined : 'nofollow'}\n"), file)
  }
})
