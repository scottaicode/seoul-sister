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

/**
 * Transpile a module. Named imports from project modules are replaced with
 * stubs (or `impls`); `node:` built-ins are left as real imports.
 */
async function load(relPath, impls = {}) {
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

test('a token round-trips to the same visitor and session, expiring in 30 days', () => {
  withSecret('s3cret', () => {
    const t = tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW })
    assert.equal(typeof t, 'string')
    assert.match(t, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'base64url payload.signature')
    const p = tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 60 })
    assert.deepEqual(p, { v: VID, s: SID, exp: NOW + 30 * 24 * 60 * 60 })
  })
})

test('a tampered payload, a tampered signature, or another secret is rejected', () => {
  withSecret('s3cret', () => {
    const t = tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW })
    const [payload, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ v: 'someone-else', s: SID, exp: NOW + 999999 })).toString('base64url')
    assert.equal(tokenMod.verifyResumeToken(`${forged}.${sig}`, { nowSeconds: NOW }), null)
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    assert.equal(tokenMod.verifyResumeToken(`${payload}.${flipped}`, { nowSeconds: NOW }), null)
    assert.equal(tokenMod.verifyResumeToken(`${payload}.${sig.slice(0, 10)}`, { nowSeconds: NOW }), null)
  })
  const t = withSecret('s3cret', () => tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW }))
  withSecret('another', () => assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW }), null))
})

test('an expired token is rejected', () => {
  withSecret('s3cret', () => {
    const t = tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW, ttlSeconds: 100 })
    assert.ok(tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 99 }))
    assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 100 }), null)
    assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW + 10_000 }), null)
  })
})

test('malformed input never throws and never verifies', () => {
  withSecret('s3cret', () => {
    for (const bad of [null, undefined, '', '.', 'abc', 'a.b.c', 'a.', '.b', 'not base64!.x', 'x'.repeat(2000), 42]) {
      assert.equal(tokenMod.verifyResumeToken(bad, { nowSeconds: NOW }), null, `input ${String(bad).slice(0, 20)}`)
    }
  })
})

test('with no secret, no token is created and none verifies', () => {
  const t = withSecret('s3cret', () => tokenMod.createResumeToken(VID, SID, { nowSeconds: NOW }))
  withSecret(undefined, () => {
    assert.equal(tokenMod.createResumeToken(VID, SID), null)
    assert.equal(tokenMod.verifyResumeToken(t, { nowSeconds: NOW }), null)
  })
  withSecret('', () => assert.equal(tokenMod.createResumeToken(VID, SID), null))
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
    PRICING: "({ yuri_allowance_display: 'A', monthly_display: 'M' })",
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

test('the chat route tells Yuri "resumes" exactly when a token was created', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  assert.match(route, /const resumeToken = createResumeToken\(parsed\.visitor_id!, sessionId!\)/)
  assert.match(route, /\{ url: widgetEmailLink\('recap', resumeToken\), resumes: resumeToken !== null \}/)
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

test('the nurture engine resolves the TEXT visitor id from the visitor row uuid, and skips ended conversations', () => {
  const src = read('src', 'lib', 'email', 'nurture.ts')
  assert.match(src, /\.from\('ss_widget_visitors'\)\s*\.select\('visitor_id'\)\s*\.eq\('id', visitorRowId\)/)
  assert.match(src, /\.not\('ended_naturally', 'is', true\)/)
  assert.match(src, /step === 1 && lead\.cohort === 'widget' \? await widgetResumeUrl\(db, lead\.visitor_id\) : null/)
})

// ---------------------------------------------------------------------------
// 4. Wiring
// ---------------------------------------------------------------------------

test('the transcript endpoint checks ownership and never reopens a "Start over" conversation', () => {
  const src = read('src', 'app', 'api', 'widget', 'transcript', 'route.ts')
  const block = src.slice(src.indexOf('async function restoreFromResumeToken'))
  assert.match(block, /verifyResumeToken\(token\)/)
  assert.match(block, /\.eq\('id', payload\.s\)\s*\.eq\('visitor_id', payload\.v\)/)
  assert.match(block, /session\.ended_naturally === true/)
  assert.match(block, /visitor_id: payload\.v/)
})

test('the widget adopts the ids only when it paints, and strips the token from the URL', () => {
  const src = read('src', 'components', 'widget', 'TryYuriSection.tsx')
  assert.match(src, /fetch\(`\/api\/widget\/transcript\?resume=\$\{encodeURIComponent\(token\)\}`\)/)
  assert.match(src, /if \(current\.length > 0\) return current\s*adopt\?\.\(\)/)
  assert.match(src, /adoptVisitorId\(vid\)\s*setWidgetSessionId\(sid\)/)
  assert.match(src, /params\.delete\('resume'\)/)
  assert.match(src, /if \(!cancelled\) stripResumeParam\(\)/)
})

test('SignedInRedirect keeps a signed-in reader on the page for a resume link', () => {
  const src = read('src', 'components', 'auth', 'SignedInRedirect.tsx')
  assert.match(src, /params\.has\('resume'\)/)
})
