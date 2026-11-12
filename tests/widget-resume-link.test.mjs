/**
 * Guard tests — email links that reopen a widget conversation (Nov 7 2026).
 *
 * The recap email said "pick the conversation right back up" and nurture email 1
 * was titled "Picking up where we left off", but both linked to the bare
 * homepage, which restores a conversation only in the same browser within an
 * hour. A real visitor came back 31 hours later to an empty chat and retyped
 * her question. The links now carry a signed resume token.
 *
 * Guarded here, by EXECUTING the real code:
 *   1. The token: round-trip, tamper, wrong secret, expiry, malformed input,
 *      and no secret -> null (callers fall back to the plain homepage link).
 *   2. The recap: what Yuri is told about the link matches the link she gets.
 *      A homepage link must never be described as reopening the conversation.
 *   3. Nurture email 1: "Picking up where we left off" only with a resume link.
 *   4. Wiring: the transcript endpoint checks ownership and "Start over", the
 *      widget adopts the ids and strips the token, SignedInRedirect stays put.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const NORMALIZE_OFFER_CODE_SRC = `((raw) => { const code = (raw ?? '').trim().toUpperCase(); return /^[A-Z0-9]{3,20}$/.test(code) ? code : null })`

/**
 * Transpile a module. Named imports from project modules are replaced with
 * stubs (or `impls`); `node:` built-ins are left as real imports.
 */
async function load(relPath, impls = {}) {
  // The creator-code format rule is pure; run the real one (pinned to the source below).
  impls = { normalizeOfferCode: NORMALIZE_OFFER_CODE_SRC, ...impls }
  let js = ts.transpileModule(read(...relPath), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  js = js.replace(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g, (m, names, from) => {
    if (from.startsWith('node:')) return m
    return names
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const [orig, alias] = n.split(/\s+as\s+/)
        const local = (alias || orig).trim()
        return `const ${local} = ${impls[orig.trim()] ?? '(() => { throw new Error("stub: ' + orig.trim() + '") })'};`
      })
      .join('\n')
  })
  const dir = mkdtempSync(join(tmpdir(), 'ss-resume-link-'))
  const file = join(dir, 'm.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

const tokenMod = await load(['src', 'lib', 'widget', 'resume-token.ts'])

function withSecret(secret, fn) {
  const prev = process.env.WIDGET_RESUME_SECRET
  if (secret === undefined) delete process.env.WIDGET_RESUME_SECRET
  else process.env.WIDGET_RESUME_SECRET = secret
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.WIDGET_RESUME_SECRET
    else process.env.WIDGET_RESUME_SECRET = prev
  }
}

const VID = '4848fbee-a2cc-407c-93dd-74d1a911485a'
const SID = '0d2c5f1e-9a77-4b8e-9d0a-2f6c1b3e4a55'
const NOW = 1_800_000_000

// ---------------------------------------------------------------------------
// 1. The token
// ---------------------------------------------------------------------------

const SECRET = 'k'.repeat(40)

test('a token round-trips to the same visitor and session, expiring in 30 days', () => {
  withSecret(SECRET, () => {
    const t = tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW })
    assert.equal(typeof t, 'string')
    assert.match(t, /^[A-Za-z0-9_-]+$/, 'one base64url blob: iv || ciphertext || tag')
    const p = tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 60 })
    assert.deepEqual(p, { v: VID, s: SID, exp: NOW + 30 * 24 * 60 * 60 })
  })
})

test('the token is opaque: the ids cannot be read out of it without the key', () => {
  withSecret(SECRET, () => {
    const t = tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW })
    const raw = Buffer.from(t, 'base64url')
    for (const view of [raw.toString('utf8'), raw.toString('latin1'), t]) {
      assert.ok(!view.includes(VID) && !view.includes(SID) && !view.includes('"exp"'))
    }
    // Two tokens for the same pair differ (random IV), so links are not linkable.
    assert.notEqual(t, tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW }))
  })
})

test('any tampered byte, a truncated token, or another secret is rejected', () => {
  withSecret(SECRET, () => {
    const t = tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW })
    const raw = Buffer.from(t, 'base64url')
    for (const pos of [0, 5, 13, 20, raw.length - 17, raw.length - 1]) {
      const bad = Buffer.from(raw)
      bad[pos] ^= 0x01
      assert.equal(tokenMod.verifyResumeToken(bad.toString('base64url'), { nowSeconds: NOW }), null, `byte ${pos}`)
    }
    assert.equal(tokenMod.verifyResumeToken(raw.subarray(0, raw.length - 1).toString('base64url'), { nowSeconds: NOW }), null)
  })
  const t = withSecret(SECRET, () => tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW }))
  withSecret('z'.repeat(40), () => assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW }), null))
})

test('an expired token is rejected', () => {
  withSecret(SECRET, () => {
    const t = tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW, ttlSeconds: 100 })
    assert.ok(tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 99 }))
    assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 100 }), null)
    assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 10_000 }), null)
  })
})

test('malformed input never throws and never verifies', () => {
  withSecret(SECRET, () => {
    for (const bad of [null, undefined, '', '.', 'abc', 'a.b.c', 'not base64!', 'A'.repeat(40), 'x'.repeat(2000), 42]) {
      assert.equal(tokenMod.verifyResumeToken(bad, { nowSeconds: NOW }), null, `input ${String(bad).slice(0, 20)}`)
    }
  })
})

test('with no secret or a secret under 32 characters, no token is created and none verifies', () => {
  const t = withSecret(SECRET, () => tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW }))
  for (const secret of [undefined, '', 'short', 'x'.repeat(31)]) {
    withSecret(secret, () => {
      assert.equal(tokenMod.createResumeToken(VID, SID), null, `secret ${String(secret)}`)
      assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW }), null)
      assert.equal(tokenMod.resumeLinksEnabled(), false)
    })
  }
  withSecret('x'.repeat(32), () => {
    assert.ok(tokenMod.createResumeToken(VID, SID))
    assert.equal(tokenMod.resumeLinksEnabled(), true)
  })
})

test('stored email copies have the token redacted', () => {
  const html = '<a href="https://www.seoulsister.com/?from=recap&amp;resume=AbC_-123">x</a> https://x/?resume=QQQ&from=a'
  const out = tokenMod.redactResumeTokens(html)
  assert.equal(out, '<a href="https://www.seoulsister.com/?from=recap&amp;resume=REDACTED">x</a> https://x/?resume=REDACTED&from=a')
})


test('the email link carries resume only when there is a token', () => {
  assert.equal(tokenMod.widgetEmailLink('recap', null), 'https://www.seoulsister.com/?from=recap')
  const url = new URL(tokenMod.widgetEmailLink('recap', 'abc.def'))
  assert.equal(url.searchParams.get('from'), 'recap', '`from` keeps SignedInRedirect from bouncing a subscriber')
  assert.equal(url.searchParams.get('resume'), 'abc.def')
})

// ---------------------------------------------------------------------------
// 2. The recap: Yuri's fact matches the link she actually gets
// ---------------------------------------------------------------------------

async function runRecap(link) {
  let captured = null
  globalThis.__recapCapture = (params) => {
    captured = params
  }
  const mod = await load(['src', 'lib', 'email', 'lead-email.ts'], {
    getAnthropicClient: `(() => ({ messages: { create: async (p) => { globalThis.__recapCapture(p); return {
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'text', text: JSON.stringify({ should_send: true, address_is_visitors_own: true, reason: 'r', subject: 'your recap', body_html: '<p>Hi, it is Yuri.</p>' }) }],
    } } } }))`,
    callAnthropicWithRetry: '((fn) => fn())',
    MODELS: "({ primary: 'test-model' })",
    logAIUsage: '(() => Promise.resolve())',
    PRICING: "({ yuri_allowance_display: 'A', monthly_display: 'M', trial_days: 7 })",
    noCardTrialEnabled: '(() => globalThis.__noCardTrial !== false)',
  })
  const conversation = [
    { role: 'user', content: 'my chin keeps breaking out' },
    { role: 'assistant', content: 'Let us look at your sunscreen.' },
  ]
  const args = [{}, conversation, 'visitor@example.com', VID]
  if (link !== undefined) args.push(link)
  const result = await mod.generateLeadEmail(...args)
  return { mod, result, prompt: captured.messages[0].content, system: captured.system }
}

test('with a resume link, Yuri is told the button reopens THIS conversation and the button is appended', async () => {
  const url = 'https://www.seoulsister.com/?from=recap&resume=abc.def'
  const { mod, result, prompt } = await runRecap({ url, resumes: true })
  assert.ok(prompt.includes(mod.recapLinkFact({ url, resumes: true })))
  assert.match(prompt, /reopens this exact conversation/)
  assert.match(prompt, /30 days/)
  assert.equal(result.outcome, 'send')
  assert.ok(result.email.bodyHtml.includes('href="https://www.seoulsister.com/?from=recap&amp;resume=abc.def"'))
  assert.ok(result.email.bodyHtml.includes('>Continue our conversation</a>'))
})

test('without a resume link, Yuri is told the chat will NOT be there, and no continuity is claimed', async () => {
  for (const link of [{ url: 'https://www.seoulsister.com/?from=recap', resumes: false }, undefined]) {
    const { mod, result, prompt } = await runRecap(link)
    const fact = mod.recapLinkFact({ url: 'x', resumes: false })
    assert.ok(prompt.includes(fact), 'the homepage fact (also the default when no link is passed)')
    assert.match(fact, /will not be there/)
    assert.doesNotMatch(fact, /reopens this exact conversation|30 days/)
    assert.doesNotMatch(prompt, /reopens this exact conversation/)
    assert.ok(result.email.bodyHtml.includes('>Chat with Yuri</a>'))
    assert.doesNotMatch(result.email.bodyHtml, /resume=/)
    assert.doesNotMatch(result.email.bodyHtml, /Continue our conversation/)
  }
})

test('the recap prompt no longer invites Yuri to add her own homepage link', async () => {
  const { system } = await runRecap({ url: 'x', resumes: false })
  assert.doesNotMatch(system, /maybe one link to https:\/\/seoulsister\.com/)
})

test('no em dashes in the customer-facing recap fact or buttons', async () => {
  const { mod } = await runRecap({ url: 'x', resumes: true })
  for (const resumes of [true, false]) {
    const text = mod.recapLinkFact({ url: 'x', resumes }) + mod.recapLinkButtonHtml({ url: 'x', resumes })
    assert.doesNotMatch(text, /[—–]/)
  }
})

test('the recap fact states the remaining free messages, and never invites chatting on at 0', async () => {
  const { mod } = await runRecap({ url: 'x', resumes: true })
  const none = mod.recapLinkFact({ url: 'x', resumes: true, remainingMessages: 0 })
  assert.match(none, /used all of their free preview messages/)
  assert.match(none, /read but not continued there; continuing means the free account and free week linked under your email/)
  assert.match(mod.recapLinkFact({ url: 'x', resumes: true, remainingMessages: 3 }), /They have 3 free preview messages left/)
  assert.match(mod.recapLinkFact({ url: 'x', resumes: true, remainingMessages: 1 }), /1 free preview message left/)
  assert.doesNotMatch(mod.recapLinkFact({ url: 'x', resumes: true, remainingMessages: null }), /free preview message/)
  const { prompt } = await runRecap({ url: 'x', resumes: true, remainingMessages: 0 })
  assert.match(prompt, /used all of their free preview messages/)
})

test('the fixed account line: appended to the real email body, true for the recipient, absent for a child (executed)', async () => {
  const { mod, result, prompt } = await runRecap({ url: 'https://www.seoulsister.com/?from=recap', resumes: false })
  const line = mod.accountLineHtml('free_week', true)
  assert.equal(
    line,
    '<p style="margin:16px 0 0;font-size:14px;color:#444;">Your routine is built in your first week as a member. For a new member that week is free, with no card needed to start. <a href="https://www.seoulsister.com/register?plan=monthly&amp;from=recap&amp;utm_source=recap&amp;utm_medium=email" style="color:#8a6a1f;font-weight:600;">Create your free account</a></p>'
  )
  // The email that would actually be sent ends with it. (A source-text check
  // still passed with the line removed from the body and left in a comment.)
  assert.ok(result.email.bodyHtml.endsWith(line), 'the recap that is sent must end with the account line')
  // Yuri is told exactly what the line says, so she does not write her own.
  assert.equal(
    mod.accountLineFact('free_week', true),
    'Under that button Seoul Sister adds one fixed line: "Your routine is built in your first week as a member. For a new member that week is free, with no card needed to start." with a link labelled "Create your free account". So you do not need to explain how to sign up or what it costs, and you should not paste a link. The line is left off when the visitor said they are under 13.'
  )
  assert.ok(prompt.includes(mod.accountLineFact('free_week', true)))

  // Someone whose inbox already used its trial is not told the week is free.
  assert.equal(mod.accountLineText('member', true), 'Your routine is built with Yuri once you are a member.')
  const member = mod.composeRecapBody('<p>b</p>', { url: 'x', resumes: false, accountLine: 'member' }, false)
  assert.ok(member.endsWith(mod.accountLineHtml('member', true)))
  assert.doesNotMatch(member, /that week is free|no card/, 'no free-week promise to an inbox that already used its trial')

  // A visitor who said they are under 13 gets no account line at all.
  const child = mod.composeRecapBody('<p>b</p>', { url: 'x', resumes: false }, true)
  assert.doesNotMatch(child, /Create your free account|register/)
  assert.ok(child.endsWith(mod.recapLinkButtonHtml({ url: 'x', resumes: false })))

  // With the card-required setting the line says so.
  globalThis.__noCardTrial = false
  try {
    assert.equal(mod.accountLineText('free_week', false), 'Your routine is built in your first week as a member. For a new member that week is free; a card is needed to start it, and nothing is charged if you cancel before it ends.')
    assert.doesNotMatch(mod.composeRecapBody('<p>b</p>', { url: 'x', resumes: false }, false), /no card/)
  } finally { delete globalThis.__noCardTrial }
  assert.doesNotMatch(mod.accountLineText('free_week', true) + mod.accountLineText('member', true), /[—–]/)
})

test('the recap asks the model whether the visitor said they are under 13, and the chat route picks the line from the trial ledger', async () => {
  const { system } = await runRecap({ url: 'x', resumes: false })
  assert.match(system, /"visitor_said_under_13": true\|false/)
  assert.match(system, /Set visitor_said_under_13 to true only when the visitor themselves said they are under 13/)
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /accountLine: await recapAccountLine\(email\),/)
  const fn = route.slice(route.indexOf('async function recapAccountLine'), route.indexOf('function simpleHash'))
  assert.match(fn, /\.eq\('email_canonical', canonicalizeEmail\(email\)\)/)
  assert.equal((fn.match(/return 'member'/g) || []).length, 2, 'a failed lookup must fall back to the line that promises nothing')
})

test('the chat route passes remaining messages and stores the recap with the token redacted', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /remainingMessages: visitor\s*\?\s*Math\.max\(0, MAX_FREE_MESSAGES - \(visitor\.total_messages \+ 1\)\)/)
  assert.match(route, /bodyHtml: redactResumeTokens\(result\.email\.bodyHtml\)/)
})

test("Yuri's live prompt names the email path only when links work, and states a long gap as a fact", () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /\$\{resumeLinksEnabled\(\) \? ' Separately, a recap email sent from now on carries a link that reopens the conversation it was sent from \(not a later one\), on any device, for 30 days\.' : ''\}/)
  assert.match(route, /This conversation was reopened from an email link; the previous message was at \$\{prevIso\}\./)
  assert.match(route, /Date\.now\(\) - Date\.parse\(prevIso\) > RESUME_WINDOW_MS/)
  assert.match(route, /\$\{reopenedFact\}`?/)
  const session = read('src', 'lib', 'widget', 'session.ts')
  assert.match(session, /intent_signals_detected, source, last_message_at'/)
})

test('the chat route tells Yuri "resumes" exactly when a token was created', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /const resumeToken = createResumeToken\(parsed\.visitor_id!, sessionId!\)/)
  assert.match(route, /url: widgetEmailLink\('recap', resumeToken, recapOfferCode\),\s*resumes: resumeToken !== null,\s*offerCode: recapOfferCode,/)
})

// ---------------------------------------------------------------------------
// 3. Nurture email 1
// ---------------------------------------------------------------------------

test('nurture email 1 says "Picking up where we left off" only when the button reopens the conversation', async () => {
  const mod = await load(['src', 'lib', 'email', 'nurture-copy.ts'], {
    PRICING: "({ monthly_display_long: 'M' })",
  })
  const resumeUrl = 'https://www.seoulsister.com/?from=nurture_1&resume=abc.def'
  const withLink = mod.buildNurtureEmail(1, 'widget', 'tok', { resumeUrl })
  assert.equal(withLink.subject, 'Picking up where we left off')
  assert.ok(withLink.bodyHtml.includes('href="https://www.seoulsister.com/?from=nurture_1&amp;resume=abc.def"'))
  assert.ok(withLink.bodyHtml.includes('Pick up our conversation'))

  for (const opts of [undefined, {}, { resumeUrl: null }]) {
    const plain = mod.buildNurtureEmail(1, 'widget', 'tok', opts)
    assert.doesNotMatch(plain.subject, /where we left off|pick(ing)? up/i)
    assert.doesNotMatch(plain.bodyHtml, /resume=|Pick up our conversation/)
    assert.ok(plain.bodyHtml.includes('?from=nurture_1'))
  }

  const registered = mod.buildNurtureEmail(1, 'registered', 'tok', { resumeUrl })
  assert.equal(registered.subject, 'The part we should have led with')
  assert.doesNotMatch(registered.bodyHtml, /resume=/, 'registered cohort has no widget conversation')

  for (const e of [withLink, mod.buildNurtureEmail(1, 'widget', 'tok')]) {
    assert.doesNotMatch(e.subject + e.bodyHtml, /—/)
  }
})

function fakeDb(tables) {
  return {
    from(table) {
      const rows = tables[table] || []
      const f = []
      let lim = Infinity
      let ord = null
      let asc = true
      const run = () => {
        if (tables.__error) return { data: null, error: { message: 'boom' } }
        let out = rows.filter((r) => f.every((fn) => fn(r)))
        if (ord) out = [...out].sort((x, y) => (x[ord] < y[ord] ? (asc ? -1 : 1) : asc ? 1 : -1))
        return { data: out.slice(0, lim), error: null }
      }
      const chain = {
        select() { return chain },
        eq(k, v) { f.push((r) => r[k] === v); return chain },
        gt(k, v) { f.push((r) => r[k] > v); return chain },
        in(k, vs) { f.push((r) => vs.includes(r[k])); return chain },
        not(k, op, v) { f.push((r) => !(op === 'is' && r[k] === v)); return chain },
        order(k, o) { ord = k; asc = o?.ascending !== false; return chain },
        limit(n) { lim = n; return Promise.resolve(run()) },
        maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error } },
      }
      return chain
    },
  }
}

const nurtureMod = await load(['src', 'lib', 'email', 'nurture.ts'], {
  createResumeToken: "((v, s) => `TOK-${v}-${s}`)",
  widgetEmailLink: "((from, t) => `https://www.seoulsister.com/?from=${from}&resume=${t}`)",
  MAX_FREE_MESSAGES: '12',
})

test('widgetResumeUrl links the latest open conversation of the TEXT visitor id, with remaining messages', async () => {
  const db = fakeDb({
    ss_widget_visitors: [{ id: 'row-uuid', visitor_id: 'text-vid', total_messages: 12 }],
    ss_widget_sessions: [
      { id: 'old', visitor_id: 'text-vid', message_count: 3, ended_naturally: false, last_message_at: '2026-10-01' },
      { id: 'ended', visitor_id: 'text-vid', message_count: 3, ended_naturally: true, last_message_at: '2026-11-01' },
      { id: 'newest', visitor_id: 'text-vid', message_count: 2, ended_naturally: false, last_message_at: '2026-10-20' },
      { id: 'empty', visitor_id: 'text-vid', message_count: 0, ended_naturally: false, last_message_at: '2026-11-02' },
      { id: 'foreign', visitor_id: 'other', message_count: 5, ended_naturally: false, last_message_at: '2026-11-03' },
    ],
  })
  const r = await nurtureMod.widgetResumeUrl(db, 'row-uuid')
  assert.deepEqual(r, { url: 'https://www.seoulsister.com/?from=nurture_1&resume=TOK-text-vid-newest', remaining: 0 })

  const r2 = await nurtureMod.widgetResumeUrl(
    fakeDb({
      ss_widget_visitors: [{ id: 'row-uuid', visitor_id: 'text-vid', total_messages: 4 }],
      ss_widget_sessions: [{ id: 's1', visitor_id: 'text-vid', message_count: 4, ended_naturally: false, last_message_at: '2026-10-20' }],
    }),
    'row-uuid'
  )
  assert.equal(r2.remaining, 8)

  assert.equal(await nurtureMod.widgetResumeUrl(db, null), null)
  assert.equal(await nurtureMod.widgetResumeUrl(db, 'missing-row'), null)
  assert.equal(await nurtureMod.widgetResumeUrl(fakeDb({ __error: true }), 'row-uuid'), null)
  assert.equal(
    await nurtureMod.widgetResumeUrl(
      fakeDb({ ss_widget_visitors: [{ id: 'row-uuid', visitor_id: 'text-vid', total_messages: 1 }], ss_widget_sessions: [] }),
      'row-uuid'
    ),
    null
  )
})

test('nurture email 1 at 0 remaining links the saved conversation without promising more chat', async () => {
  const copy = await load(['src', 'lib', 'email', 'nurture-copy.ts'], { PRICING: "({ monthly_display_long: 'M' })" })
  const url = 'https://www.seoulsister.com/?from=nurture_1&resume=abc'
  const e = copy.buildNurtureEmail(1, 'widget', 'tok', { resumeUrl: url, resumeRemaining: 0 })
  assert.equal(e.subject, 'Your conversation with Yuri is saved')
  assert.ok(e.bodyHtml.includes('>See our conversation</a>'))
  assert.ok(e.bodyHtml.includes(`href="${url.replace('&', '&amp;')}"`))
  assert.doesNotMatch(e.bodyHtml, /talk to me right now|Pick up our conversation|try the conversation first|Talk to Yuri, free/)
  assert.doesNotMatch(e.subject + e.bodyHtml, /[—–]/)
  const some = copy.buildNurtureEmail(1, 'widget', 'tok', { resumeUrl: url, resumeRemaining: 5 })
  assert.equal(some.subject, 'Picking up where we left off')
  assert.ok(some.bodyHtml.includes('>Pick up our conversation</a>'))
})

// ---------------------------------------------------------------------------
// 4. Wiring
// ---------------------------------------------------------------------------

const restoreMod = await load(['src', 'lib', 'widget', 'resume-restore.ts'], {
  getServiceClient: '(() => globalThis.__db)',
  verifyResumeToken: '((t) => globalThis.__payload)',
  MAX_FREE_MESSAGES: '12',
  logAIUsage: '(() => Promise.resolve())',
})

function restoreDb() {
  return fakeDb({
    ss_widget_sessions: [
      { id: 'S', visitor_id: 'V', ended_naturally: false },
      { id: 'ENDED', visitor_id: 'V', ended_naturally: true },
    ],
    ss_widget_visitors: [{ visitor_id: 'V', total_messages: 9 }],
    ss_widget_messages: [
      { session_id: 'S', role: 'user', content: 'hi', created_at: '1' },
      { session_id: 'S', role: 'assistant', content: 'hello', created_at: '2' },
      { session_id: 'S', role: 'tool', content: 'x', created_at: '3' },
      { session_id: 'OTHER', role: 'user', content: 'not yours', created_at: '0' },
    ],
  })
}

test('restoreFromResumeToken returns the conversation, both ids and the remaining messages', async () => {
  globalThis.__db = restoreDb()
  globalThis.__payload = { v: 'V', s: 'S', exp: 9e9 }
  const r = await restoreMod.restoreFromResumeToken('t')
  assert.deepEqual(r, {
    messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
    session_id: 'S',
    visitor_id: 'V',
    remaining_messages: 3,
  })
})

test('restoreFromResumeToken refuses a foreign visitor, an ended conversation, a bad token, and a failed query', async () => {
  globalThis.__db = restoreDb()
  globalThis.__payload = { v: 'SOMEONE-ELSE', s: 'S', exp: 9e9 }
  assert.equal(await restoreMod.restoreFromResumeToken('t'), null)
  globalThis.__payload = { v: 'V', s: 'ENDED', exp: 9e9 }
  assert.equal(await restoreMod.restoreFromResumeToken('t'), null)
  globalThis.__payload = null
  assert.equal(await restoreMod.restoreFromResumeToken('t'), null)
  globalThis.__db = fakeDb({ __error: true })
  globalThis.__payload = { v: 'V', s: 'S', exp: 9e9 }
  assert.equal(await restoreMod.restoreFromResumeToken('t'), null)
})

test('a used-up preview restores with remaining 0, never negative', async () => {
  const db = restoreDb()
  globalThis.__db = fakeDb({
    ss_widget_sessions: [{ id: 'S', visitor_id: 'V', ended_naturally: false }],
    ss_widget_visitors: [{ visitor_id: 'V', total_messages: 15 }],
    ss_widget_messages: [{ session_id: 'S', role: 'user', content: 'hi', created_at: '1' }],
  })
  void db
  globalThis.__payload = { v: 'V', s: 'S', exp: 9e9 }
  assert.equal((await restoreMod.restoreFromResumeToken('t')).remaining_messages, 0)
})

test('the transcript endpoint returns resume_failed (not an error) when the link is unusable', () => {
  const src = read('src', 'app', 'api', 'widget', 'transcript', 'route.ts')
  assert.match(src, /if \(restored\) return NextResponse\.json\(restored\)\s*return NextResponse\.json\(\{ messages: \[\], session_id: null, resume_failed: true \}\)/)
})

test('the widget strips the token synchronously, adopts ids only when it paints, and is honest about quota and failure', () => {
  const src = read('src', 'components', 'widget', 'TryYuriSection.tsx')
  // Synchronous strip at the start of the effect, token kept at module level.
  assert.match(src, /\/\/ Synchronous, first thing: see takeResumeTokenFromUrl\.\s*const resumeToken = takeResumeTokenFromUrl\(\)/)
  assert.match(src, /pendingResumeToken = token\s*params\.delete\('resume'\)\s*const qs/)
  assert.match(src, /fetch\(`\/api\/widget\/transcript\?resume=\$\{encodeURIComponent\(token\)\}`\)/)
  assert.match(src, /if \(current\.length > 0\) return current\s*adopt\?\.\(\)/)
  assert.match(src, /adoptVisitorId\(vid\)\s*setWidgetSessionId\(sid\)\s*reopenedFromEmailPending = true/)
  assert.match(src, /if \(data\.remaining_messages <= 0\) setServerLimitReached\(true\)/)
  assert.match(src, /setError\('That link has expired, so this is a fresh chat\.'\)/)
  assert.match(src, /\.\.\.\(reopenedFromEmailPending \? \{ reopened_from_email: true \} : \{\}\)/)
})

test('SignedInRedirect keeps a signed-in reader on the page for a resume link', () => {
  const src = read('src', 'components', 'auth', 'SignedInRedirect.tsx')
  assert.match(src, /params\.has\('resume'\)/)
})

// ---------------------------------------------------------------------------
// 5. "Create your free account" carries the conversation to any browser
//    (Nov 11 2026). The owner chatted in one browser, opened the recap in
//    another, and the setup chat greeted him as a stranger.
// ---------------------------------------------------------------------------


test('the account link carries the recap token only when the recap link really resumes (executed)', async () => {
  const { mod } = await runRecap({ url: 'x', resumes: false })
  const token = withSecret(SECRET, () => tokenMod.createResumeToken(VID, SID))
  const recap = { url: tokenMod.widgetEmailLink('recap', token), resumes: true }
  assert.equal(mod.resumeTokenOf(recap), token)
  assert.equal(mod.accountLinkUrl(token), `${mod.ACCOUNT_LINK_URL}&resume=${token}`)
  // The composed email: the same token under the button and in the account link, nowhere else.
  const body = mod.composeRecapBody('<p>b</p>', recap, false)
  assert.equal(body.split(token).length - 1, 2)
  assert.ok(body.includes(`href="${(mod.ACCOUNT_LINK_URL + '&resume=' + token).replace(/&/g, '&amp;')}"`))
  // No token to carry: the plain link, exactly as before.
  for (const link of [{ url: 'https://www.seoulsister.com/?from=recap', resumes: false }, { url: 'not a url', resumes: true }, { url: `https://www.seoulsister.com/?resume=${token}`, resumes: false }]) {
    assert.equal(mod.resumeTokenOf(link), null)
    assert.ok(mod.composeRecapBody('<p>b</p>', link, false).includes(`href="${mod.ACCOUNT_LINK_URL.replace(/&/g, '&amp;')}"`))
  }
  // Nothing but a token-shaped value may be appended to a link we email.
  for (const bad of [null, undefined, '', 'short', 'a b c d e f g h i j k l m n', '"><script>alert(1)</script>xxxxxxxxxx', 'x'.repeat(1001), 'aaaaaaaaaaaaaaaaaaaaaaaa&plan=free']) {
    assert.equal(mod.accountLinkUrl(bad), mod.ACCOUNT_LINK_URL, String(bad).slice(0, 30))
  }
  // A child is still never pointed at an account, token or not.
  assert.doesNotMatch(mod.composeRecapBody('<p>b</p>', recap, true), /register/)
  // The stored copy of the email must not hold the credential in either link.
  assert.ok(!tokenMod.redactResumeTokens(body).includes(token))
})

test('the recap footer says follow-ups may come, and never that they will not', async () => {
  const { mod } = await runRecap({ url: 'x', resumes: false })
  assert.match(mod.RECAP_FOOTER_HTML, /We may send you a few short follow-ups, and each of those has a one-click unsubscribe link\./)
  assert.doesNotMatch(mod.RECAP_FOOTER_HTML, /won't follow up|will not follow up|never hear|ignore this/i)
  assert.doesNotMatch(mod.RECAP_FOOTER_HTML, /[—–]/)
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /wrapEmailHtml\(result\.email\.bodyHtml, RECAP_FOOTER_HTML\)/)
  // The promise it replaces is made by the shared default footer; the recap was its only user.
  const callers = ['src/app/api/widget/chat/route.ts', 'src/lib/email/nurture.ts', 'src/lib/proactive/lead-reengage.ts', 'src/lib/email/nudge-email.ts']
  for (const f of callers) assert.doesNotMatch(read(...f.split('/')), /wrapEmailHtml\([^,()]*\)\s*[,)\n]/, `${f} sends with the default footer`)
  // And the follow-ups it mentions do carry that link.
  assert.match(read('src', 'lib', 'email', 'nurture-copy.ts'), /Unsubscribe with one click/)
  assert.match(read('src', 'lib', 'proactive', 'lead-reengage.ts'), /Unsubscribe with one click/)
})

const signupMod = await load(['src', 'lib', 'widget', 'signup-link.ts'])
function signupEnv(search, fetchImpl) {
  const env = {
    location: { pathname: '/register', search, hash: '#top' },
    replaced: [], fetched: [], adopted: [],
    history: { state: { k: 1 }, replaceState: (...a) => env.replaced.push(a) },
    fetch: async (url) => { env.fetched.push(url); return fetchImpl(url) },
    adopt: (id) => { env.adopted.push(id); return env.adoptAnswer },
    adoptAnswer: true,
    isSignedIn: false,
    signedIn: async () => env.isSignedIn,
  }
  return env
}
const TOKEN_OK = 'A'.repeat(60)

test('sign-up page: the token leaves the address bar at once and every other parameter stays (executed)', () => {
  const env = signupEnv(`?plan=monthly&from=recap&resume=${TOKEN_OK}&utm_source=recap`)
  assert.equal(signupMod.takeSignupResumeToken(env), TOKEN_OK)
  assert.deepEqual(env.replaced, [[{ k: 1 }, '', '/register?plan=monthly&from=recap&utm_source=recap#top']])
  // Something that is not a token is still removed from the address bar, and not used.
  const junk = signupEnv('?resume=%22%3E%3Cscript%3E&plan=monthly')
  assert.equal(signupMod.takeSignupResumeToken(junk), null)
  assert.deepEqual(junk.replaced, [[{ k: 1 }, '', '/register?plan=monthly#top']])
  // No token: the URL is left alone.
  const none = signupEnv('?plan=monthly')
  assert.equal(signupMod.takeSignupResumeToken(none), null)
  assert.deepEqual(none.replaced, [])
  const only = signupEnv(`?resume=${TOKEN_OK}`)
  signupMod.takeSignupResumeToken(only)
  assert.equal(only.replaced[0][2], '/register#top')
})

test('sign-up page: a good token makes this browser that visitor; anything else changes nothing (executed)', async () => {
  const ok = signupEnv('', async () => ({ ok: true, json: async () => ({ visitor_id: VID }) }))
  assert.equal(await signupMod.claimPreviewForSignup(TOKEN_OK, ok), true)
  assert.deepEqual(ok.fetched, [`/api/widget/transcript?for=account&resume=${TOKEN_OK}`])
  assert.deepEqual(ok.adopted, [VID])
  const cases = {
    'no token': [null, async () => ({ ok: true, json: async () => ({ visitor_id: VID }) })],
    'expired link': [TOKEN_OK, async () => ({ ok: true, json: async () => ({ visitor_id: null, resume_failed: true }) })],
    'server error': [TOKEN_OK, async () => ({ ok: false, json: async () => ({ visitor_id: VID }) })],
    'network failure': [TOKEN_OK, async () => { throw new Error('offline') }],
    'junk body': [TOKEN_OK, async () => ({ ok: true, json: async () => null })],
    'not a visitor id': [TOKEN_OK, async () => ({ ok: true, json: async () => ({ visitor_id: '../../etc/passwd' }) })],
    'bad json': [TOKEN_OK, async () => ({ ok: true, json: async () => { throw new Error('x') } })],
  }
  for (const [name, [token, impl]] of Object.entries(cases)) {
    const env = signupEnv('', impl)
    assert.equal(await signupMod.claimPreviewForSignup(token, env), false, name)
    assert.deepEqual(env.adopted, [], name)
    if (token === null) assert.deepEqual(env.fetched, [], name)
  }
  // Someone already signed in here: the link is not for making their account. Nothing is asked of the server.
  const member = signupEnv('', async () => ({ ok: true, json: async () => ({ visitor_id: VID }) }))
  member.isSignedIn = true
  assert.equal(await signupMod.claimPreviewForSignup(TOKEN_OK, member), false)
  assert.deepEqual([member.fetched, member.adopted], [[], []])
  // The browser declined (it has a preview chat of its own): that is not a claim.
  const declined = signupEnv('', async () => ({ ok: true, json: async () => ({ visitor_id: VID }) }))
  declined.adoptAnswer = false
  assert.equal(await signupMod.claimPreviewForSignup(TOKEN_OK, declined), false)
  // A visitor id is exactly a UUID: nothing looser reaches storage.
  for (const bad of ['abc', 'a'.repeat(36), `${VID}x`, ` ${VID}`, '11111111-2222-4333-8444-55555555555g']) {
    const env = signupEnv('', async () => ({ ok: true, json: async () => ({ visitor_id: bad }) }))
    assert.equal(await signupMod.claimPreviewForSignup(TOKEN_OK, env), false, bad)
    assert.deepEqual(env.adopted, [], bad)
  }
  // And a token is exactly the token alphabet, bounded.
  for (const bad of ['short', 'A'.repeat(19), 'A'.repeat(1001), `${'A'.repeat(30)} `, `${'A'.repeat(30)}.`, `${'A'.repeat(30)}/x`]) {
    const env = signupEnv(`?resume=${encodeURIComponent(bad)}`)
    assert.equal(signupMod.takeSignupResumeToken(env), null, bad)
  }
})

test('sign-up waits for the claim, but never long (executed)', async () => {
  const t0 = Date.now()
  await signupMod.settleWithin(null, 5000)
  await signupMod.settleWithin(Promise.resolve(true), 5000)
  await signupMod.settleWithin(Promise.reject(new Error('x')), 5000)
  assert.ok(Date.now() - t0 < 200, 'a settled or absent claim is not waited on')
  let landed = false
  const slow = new Promise((r) => setTimeout(() => { landed = true; r(true) }, 60))
  await signupMod.settleWithin(slow, 2000)
  assert.equal(landed, true, 'a claim that lands inside the limit is waited for')
  const t1 = Date.now()
  await signupMod.settleWithin(new Promise(() => {}), 80)
  const waited = Date.now() - t1
  assert.ok(waited >= 70 && waited < 600, `a claim that never lands is given up on (${waited}ms)`)
})

test('the sign-up claim passes the same checks as reopening the chat, and is counted separately (executed)', async () => {
  const logged = []
  globalThis.__logUsage = (e) => { logged.push(e.feature); return Promise.resolve() }
  const m = await load(['src', 'lib', 'widget', 'resume-restore.ts'], {
    getServiceClient: '(() => globalThis.__db)',
    verifyResumeToken: '((t) => globalThis.__payload)',
    MAX_FREE_MESSAGES: '12',
    logAIUsage: '((e) => globalThis.__logUsage(e))',
  })
  globalThis.__db = restoreDb()
  globalThis.__payload = { v: 'V', s: 'S', exp: 9e9 }
  assert.equal((await m.restoreFromResumeToken('t', { purpose: 'account' })).visitor_id, 'V')
  assert.equal((await m.restoreFromResumeToken('t')).visitor_id, 'V')
  assert.deepEqual(logged, ['widget_account_link_opened', 'widget_resume_link_opened'])
  // Refused exactly where a chat reopen is refused: someone else's session, an ended one, a bad token.
  for (const payload of [{ v: 'OTHER', s: 'S', exp: 9e9 }, { v: 'V', s: 'ENDED', exp: 9e9 }, null]) {
    globalThis.__payload = payload
    assert.equal(await m.restoreFromResumeToken('t', { purpose: 'account' }), null)
  }
  assert.equal(logged.length, 2)
})

test('the transcript route answers a sign-up claim with the visitor id and nothing else', () => {
  const route = read('src', 'app', 'api', 'widget', 'transcript', 'route.ts')
  const block = route.slice(route.indexOf("if (req.nextUrl.searchParams.get('for') === 'account') {"), route.indexOf('const restored = await restoreFromResumeToken(resume)'))
  assert.match(block, /const claimed = await restoreFromResumeToken\(resume, \{ purpose: 'account' \}\)\n\s+return NextResponse\.json\(claimed \? \{ visitor_id: claimed\.visitor_id \} : \{ visitor_id: null, resume_failed: true \}\)/)
  assert.doesNotMatch(block, /messages|session_id|email/)
})

test('the sign-up page takes the token before anything else, then waits for the claim before leaving', () => {
  const page = read('src', 'app', '(auth)', 'register', 'page.tsx')
  const effect = page.slice(page.indexOf('  useEffect(() => {\n    // Always look:'), page.indexOf("  const [email, setEmail] = useState('')"))
  // The strip is the first statement of the effect: no timer, no await, no promise before it.
  assert.match(effect, /^  useEffect\(\(\) => \{\n    \/\/ Always look:[^\n]*\n    let fresh: string \| null = null\n    try \{\n      fresh = takeSignupResumeToken\(\{ location: window\.location, history: window\.history \}\)\n/)
  // A new token on a later arrival replaces the old claim, so it is taken and claimed too.
  assert.match(effect, /if \(fresh\) \{\n      pendingSignupToken = fresh\n      pendingClaim = null\n    \}/)
  const beforeStrip = effect.slice(0, effect.indexOf('takeSignupResumeToken('))
  assert.doesNotMatch(beforeStrip, /setTimeout|await|\.then\(|requestAnimationFrame|queueMicrotask/)
  assert.match(effect, /\}, \[\]\)\n\s*$/)
  assert.match(effect, /adopt: adoptPreviewForSignup,\n\s+signedIn: async \(\) => Boolean\(\(await supabase\.auth\.getSession\(\)\)\.data\.session\),/)
  assert.doesNotMatch(page, /useSearchParams/, 'reading the query through the router would keep the token in the URL until hydration')
  // Both ways off the page wait for the claim first.
  assert.match(page, /await signUp\(email, password, captchaToken \?\? undefined\)\n\s+await settleWithin\(pendingClaim, CLAIM_WAIT_MS\)\n/)
  assert.match(page, /setIsLoading\(true\)\n\s+await settleWithin\(pendingClaim, CLAIM_WAIT_MS\)\n\s+await signInWithGoogle\(\)/)
  assert.match(page, /const CLAIM_WAIT_MS = 2000\n/)
})

test('the account purpose is refused for a used-up visitor exactly as little as the chat purpose is', async () => {
  // Having used all 12 messages does not stop someone creating an account from the link.
  globalThis.__db = fakeDb({
    ss_widget_sessions: [{ id: 'S', visitor_id: 'V', ended_naturally: false }],
    ss_widget_visitors: [{ visitor_id: 'V', total_messages: 15 }],
    ss_widget_messages: [{ session_id: 'S', role: 'user', content: 'hi', created_at: '1' }],
  })
  globalThis.__payload = { v: 'V', s: 'S', exp: 9e9 }
  const r = await restoreMod.restoreFromResumeToken('t', { purpose: 'account' })
  assert.equal(r.visitor_id, 'V')
  assert.equal(r.remaining_messages, 0)
})

test('the follow-ups the recap footer mentions really unsubscribe (executed)', async () => {
  const copy = await load(['src', 'lib', 'email', 'nurture-copy.ts'], { PRICING: '({ monthly_price: 9.99, monthly_price_display: "$9.99" })', postalAddress: '(() => "1 Main St")', escapeHtml: '((s) => s)', widgetEmailLink: '(() => "https://www.seoulsister.com/")' }).catch(() => null)
  const reengage = read('src', 'lib', 'proactive', 'lead-reengage.ts')
  // The link in each footer IS the unsubscribe endpoint with the lead's own token, not just the words.
  assert.match(reengage, /const unsubscribeUrl = `\$\{SITE\}\/api\/email\/unsubscribe\?token=\$\{lead\.unsubscribe_token\}`/)
  assert.match(reengage, /<a href="\$\{unsubscribeUrl\}" style="color:#999;">Unsubscribe with one click<\/a>/)
  const nurtureCopy = read('src', 'lib', 'email', 'nurture-copy.ts')
  assert.match(nurtureCopy, /<a href="\$\{unsubscribeUrl\}" style="color:#999;">Unsubscribe with one click<\/a>/)
  assert.match(nurtureCopy, /api\/email\/unsubscribe\?token=/)
  void copy
})

// ---------------------------------------------------------------------------
// 7. The creator code follows the lead into every email link (Nov 12 2026)
//
// Found on the owner's walkthrough: arrived by Bailey's link, opened the recap
// email's account link in another browser, and the membership page showed full
// price with no code. The code lived only in the first browser.
// ---------------------------------------------------------------------------

test('the code-format rule these tests run is the real one', () => {
  const src = read('src', 'lib', 'offers.ts')
  assert.match(
    src,
    /export function normalizeOfferCode\(raw: string \| null \| undefined\): string \| null \{\n  const code = \(raw \?\? ''\)\.trim\(\)\.toUpperCase\(\)\n  return \/\^\[A-Z0-9\]\{3,20\}\$\/\.test\(code\) \? code : null\n\}/
  )
})

test('an email link carries the creator code, and only a code in the accepted format (executed)', () => {
  const { widgetEmailLink } = tokenMod
  assert.equal(widgetEmailLink('recap', 'TOKEN', 'BAILEY'), 'https://www.seoulsister.com/?from=recap&resume=TOKEN&code=BAILEY')
  assert.equal(widgetEmailLink('recap', null, 'bailey'), 'https://www.seoulsister.com/?from=recap&code=BAILEY')
  for (const none of [undefined, null, '', 'AB', 'BAILEY&plan=x', 'x"><script>', 'A'.repeat(21)]) {
    assert.equal(widgetEmailLink('recap', 'TOKEN', none), 'https://www.seoulsister.com/?from=recap&resume=TOKEN', `no code for ${JSON.stringify(none)}`)
  }
})

test('the recap that is sent: BOTH links carry the code, and neither does without one (executed)', async () => {
  const token = 'A'.repeat(40)
  const withCode = await runRecap({
    url: `https://www.seoulsister.com/?from=recap&resume=${token}&code=BAILEY`,
    resumes: true,
    offerCode: 'BAILEY',
  })
  const hrefs = [...withCode.result.email.bodyHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
  assert.equal(hrefs.length, 2, 'the button and the account link, nothing else')
  for (const h of hrefs) {
    const u = new URL(h)
    assert.equal(u.searchParams.get('code'), 'BAILEY', `missing on ${u.pathname}`)
    assert.equal(u.searchParams.get('resume'), token, 'the conversation still comes along')
  }
  assert.deepEqual(hrefs.map((h) => new URL(h).pathname).sort(), ['/', '/register'])

  const without = await runRecap({ url: `https://www.seoulsister.com/?from=recap&resume=${token}`, resumes: true })
  assert.doesNotMatch(without.result.email.bodyHtml, /code=/)
  // A code that is not in the accepted format never reaches a link.
  assert.equal(withCode.mod.accountLinkUrl(token, 'x"><b>'), withCode.mod.accountLinkUrl(token))
  assert.equal(withCode.mod.accountLinkUrl(null, 'BAILEY'), 'https://www.seoulsister.com/register?plan=monthly&from=recap&utm_source=recap&utm_medium=email&code=BAILEY')
})

test('the follow-up emails: every link to the site carries the code (executed)', async () => {
  const mod = await load(['src', 'lib', 'email', 'nurture-copy.ts'], {
    PRICING: "({ monthly_display_long: 'M', trial_days: 7 })",
  })
  const siteLinks = (html) =>
    [...html.matchAll(/href="(https:\/\/www\.seoulsister\.com\/[^"]*)"/g)]
      .map((m) => new URL(m[1].replace(/&amp;/g, '&')))
      // The blog article is content, not a way in; a code there does nothing useful.
      .filter((u) => !u.pathname.startsWith('/blog/') && !u.pathname.startsWith('/unsubscribe') && !u.pathname.startsWith('/api/'))
  let checked = 0
  for (const step of [1, 2, 3]) {
    const coded = mod.buildNurtureEmail(step, 'widget', 'tok', { offerCode: 'BAILEY' })
    const plain = mod.buildNurtureEmail(step, 'widget', 'tok')
    const links = siteLinks(coded.bodyHtml)
    assert.ok(links.length >= 1, `email ${step} has a link back to the site`)
    for (const u of links) {
      assert.equal(u.searchParams.get('code'), 'BAILEY', `email ${step}: ${u.pathname}${u.search}`)
      checked++
    }
    assert.doesNotMatch(plain.bodyHtml, /code=/, `email ${step} adds nothing without a code`)
    // The code changes links only: not one word of what the lead reads.
    assert.equal(coded.bodyHtml.replaceAll('&code=BAILEY', ''), plain.bodyHtml)
    assert.equal(coded.subject, plain.subject)
    // A code that is not in the accepted format never reaches a link.
    for (const junk of ['x"><b>', 'BAILEY&plan=x', 'AB']) {
      assert.equal(mod.buildNurtureEmail(step, 'widget', 'tok', { offerCode: junk }).bodyHtml, plain.bodyHtml, `email ${step}: ${junk}`)
    }
  }
  assert.ok(checked >= 3)
})

test('leadOfferCode reads the code from the lead row, and a failed read is not a code (executed)', async () => {
  const row = (data, error = null) => ({
    from: (t) => {
      assert.equal(t, 'ss_widget_visitors')
      return { select: (c) => { assert.equal(c, 'offer_code'); return { eq: (col, v) => { assert.equal(col, 'id'); assert.equal(v, 'row-uuid'); return { maybeSingle: async () => ({ data, error }) } } } } }
    },
  })
  const errs = []
  const orig = console.error
  console.error = (...a) => errs.push(a.join(' '))
  try {
    assert.equal(await nurtureMod.leadOfferCode(row({ offer_code: 'BAILEY' }), 'row-uuid'), 'BAILEY')
    assert.equal(await nurtureMod.leadOfferCode(row({ offer_code: null }), 'row-uuid'), null)
    assert.equal(await nurtureMod.leadOfferCode(row(null), 'row-uuid'), null)
    assert.equal(await nurtureMod.leadOfferCode(row({ offer_code: 'not a code' }), 'row-uuid'), null)
    assert.equal(errs.length, 0)
    assert.equal(await nurtureMod.leadOfferCode(row(null, { message: 'boom' }), 'row-uuid'), null)
    assert.equal(errs.length, 1, 'a failed lookup is logged')
    assert.equal(await nurtureMod.leadOfferCode({ from: () => { throw new Error('must not query') } }, null), null)
  } finally {
    console.error = orig
  }
})

test('widgetResumeUrl puts the code into the REAL follow-up link (executed)', async () => {
  // The other widgetResumeUrl tests stub the link builder; this one runs the real one.
  const real = await load(['src', 'lib', 'email', 'nurture.ts'], {
    createResumeToken: "((v, s) => `TOK-${v}-${s}`)",
    widgetEmailLink: tokenMod.widgetEmailLink.toString().replace(/^function widgetEmailLink/, 'function').replace(/\bSITE\b/g, "'https://www.seoulsister.com'").replace(/^/, '(').concat(')'),
    MAX_FREE_MESSAGES: '12',
  })
  const db = () => fakeDb({
    ss_widget_visitors: [{ id: 'row-uuid', visitor_id: 'text-vid', total_messages: 3 }],
    ss_widget_sessions: [{ id: 'sess', visitor_id: 'text-vid', message_count: 3, ended_naturally: false, last_message_at: '2026-11-01' }],
  })
  const coded = await real.widgetResumeUrl(db(), 'row-uuid', 'BAILEY')
  assert.equal(coded.url, 'https://www.seoulsister.com/?from=nurture_1&resume=TOK-text-vid-sess&code=BAILEY')
  const plain = await real.widgetResumeUrl(db(), 'row-uuid')
  assert.equal(plain.url, 'https://www.seoulsister.com/?from=nurture_1&resume=TOK-text-vid-sess')
})

test('the lead row: a code is stored exactly as given, a write that stores nothing is not a success, and it reads back (executed)', async () => {
  const calls = []
  globalThis.__offerDb = { rows: 1, error: null, stored: null }
  const mod = await load(['src', 'lib', 'widget', 'visitor.ts'], {
    getServiceClient: `(() => ({ from: (t) => ({
      update: (v) => ({ eq: (c, id) => ({ select: async () => { globalThis.__offerCalls.push(['update', t, v, c, id]); const d = globalThis.__offerDb; if (!d.error && d.rows) d.stored = v.offer_code; return { data: d.error ? null : Array(d.rows).fill({ visitor_id: id }), error: d.error } } }) }),
      select: (cols) => ({ eq: (c, id) => ({ maybeSingle: async () => { globalThis.__offerCalls.push(['select', t, cols, c, id]); const d = globalThis.__offerDb; return { data: d.error ? null : { offer_code: d.stored }, error: d.error } } }) }),
    }) }))`,
  })
  globalThis.__offerCalls = calls
  const errs = []
  const orig = console.error
  console.error = (...a) => errs.push(a.join(' '))
  try {
    assert.equal(await mod.recordOfferCode('vid-1', 'BAILEY'), true)
    assert.deepEqual(calls[0], ['update', 'ss_widget_visitors', { offer_code: 'BAILEY' }, 'visitor_id', 'vid-1'])
    assert.equal(await mod.readOfferCode('vid-1'), 'BAILEY')
    assert.deepEqual(calls[1], ['select', 'ss_widget_visitors', 'offer_code', 'visitor_id', 'vid-1'])
    assert.equal(errs.length, 0)
    // No row matched: nothing was stored, and that is said, not passed off as done.
    globalThis.__offerDb.rows = 0
    assert.equal(await mod.recordOfferCode('vid-none', 'BAILEY'), false)
    assert.equal(errs.length, 1)
    globalThis.__offerDb = { rows: 1, error: { message: 'boom' }, stored: 'BAILEY' }
    assert.equal(await mod.recordOfferCode('vid-1', 'BAILEY'), false)
    assert.equal(await mod.readOfferCode('vid-1'), null, 'a failed read is not a code')
    assert.equal(errs.length, 3)
    // Whatever is on the row, only a code in the accepted format comes back.
    for (const bad of [null, '', 'bailey', 'x"><b>', 'AB']) {
      globalThis.__offerDb = { rows: 1, error: null, stored: bad }
      assert.equal(await mod.readOfferCode('vid-1'), null, JSON.stringify(bad))
    }
  } finally {
    console.error = orig
    delete globalThis.__offerDb
    delete globalThis.__offerCalls
  }
})

test('a code goes into email links only on Stripe\'s word: open creator offers, nothing else (executed)', async () => {
  globalThis.__stripePromo = null
  const mod = await load(['src', 'lib', 'offers-server.ts'], {
    getStripeClient: `(() => ({ promotionCodes: { list: async () => { const p = globalThis.__stripePromo; if (p instanceof Error) throw p; return { data: p ? [p] : [] } } } }))`,
    offerFactForYuri: '((o) => `fact:${o.state}`)',
  })
  const open = { id: 'promo_1', active: true, metadata: { creator_offer: '1' }, max_redemptions: 50, times_redeemed: 3, expires_at: null, coupon: { valid: true, percent_off: 50, duration: 'repeating', duration_in_months: 1 } }
  const cases = [
    ['OPENCODE', open, 'OPENCODE'],
    ['ENDEDONE', { ...open, active: false }, null],
    ['FULLCODE', { ...open, times_redeemed: 50 }, null],
    ['PRIVATE1', { ...open, metadata: {} }, null],
    ['NOSUCH99', null, null],
    ['STRIPEDOWN', new Error('stripe is down'), null],
  ]
  const orig = console.error
  console.error = () => {}
  try {
    for (const [code, promo, expected] of cases) {
      assert.equal(mod.confirmedOfferCode(code, 1000), null, `${code}: nothing is confirmed before Stripe is asked`)
      globalThis.__stripePromo = promo
      await mod.offerFactLine(code, 1000)
      assert.equal(mod.confirmedOfferCode(code, 1001), expected, code)
      assert.equal(mod.confirmedOfferCode(code.toLowerCase(), 1001), expected, 'same code, any case')
    }
    // Stripe's answer is trusted only while it is fresh.
    assert.equal(mod.confirmedOfferCode('OPENCODE', 1000 + 5 * 60 * 1000 + 1), null)
    assert.equal(mod.confirmedOfferCode('x"><b>', 1001), null)
    assert.equal(mod.confirmedOfferCode(null, 1001), null)
  } finally {
    console.error = orig
    delete globalThis.__stripePromo
  }
})

test('wiring: the chat keeps only a code Stripe confirmed, the recap falls back to the stored one, and every lead email passes it on', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /const offerFact = await offerFactLine\(parsed\.offer_code\)\n(?:    \/\/[^\n]*\n)+    const liveOfferCode = confirmedOfferCode\(parsed\.offer_code\)\n    if \(liveOfferCode && parsed\.visitor_id && \(hasEmail \|\| extractEmail\(parsed\.message\)\)\) \{\n      await recordOfferCode\(parsed\.visitor_id, liveOfferCode\)\n    \}\n/)
  assert.equal((route.match(/recordOfferCode\(/g) ?? []).length, 1)
  assert.match(route, /const recapOfferCode = liveOfferCode \?\? \(await readOfferCode\(parsed\.visitor_id!\)\)\n/)
  assert.ok(route.indexOf('const hasEmail = Boolean(visitor?.captured_email)') < route.indexOf('const liveOfferCode'), 'hasEmail is read from the row before it is used')
  const nurture = read('src', 'lib', 'email', 'nurture.ts')
  assert.match(nurture, /const offerCode = lead\.cohort === 'widget' \? await leadOfferCode\(db, lead\.visitor_id\) : null\n/)
  assert.match(nurture, /await widgetResumeUrl\(db, lead\.visitor_id, offerCode\)/)
  assert.match(nurture, /resumeRemaining: resume\?\.remaining \?\? null, offerCode \}/)
  assert.match(read('src', 'lib', 'proactive', 'run.ts'), /buildLeadEmail\(decision, l, tag, address, l\.cohort === 'widget' \? await leadOfferCode\(db, l\.visitor_id\) : null\)/)
  assert.match(read('supabase', 'migrations', '20261112000001_widget_visitor_offer_code.sql'), /ADD COLUMN IF NOT EXISTS offer_code text\n  CONSTRAINT ss_widget_visitors_offer_code_format CHECK \(offer_code ~ '\^\[A-Z0-9\]\{3,20\}\$'\)/)
})
