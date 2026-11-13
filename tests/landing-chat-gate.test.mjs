/**
 * The landing chat is closed behind sign-up, and one setting reopens it
 * (owner decision, Nov 13 2026; src/lib/landing-chat.ts).
 *
 * What must hold:
 *  1. Closed is the default. Only the exact setting "open" opens it.
 *  2. While closed, the server refuses before it makes a visitor row or calls
 *     a model, so the page is not the only thing holding the gate.
 *  3. While closed, no sentence a visitor or a lead can read promises a chat
 *     without an account. Checked by SHAPE across the real nurture emails, and
 *     closed-world across the source tree (a new "no signup" line anywhere fails).
 *  4. A visitor's own question survives sign-up on the same device, once, and
 *     only as their own words to send.
 *
 * The functions are executed, not read. Each assertion was confirmed to fail
 * with its bug put back (see the CHANGELOG entry for which).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'
import { createHash } from 'node:crypto'

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8')
const transpile = (src) =>
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const importJs = (js) => import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

/** The real module, with the environment value it reads at load set to `env`. */
async function loadLandingChat(env) {
  const js = transpile(read('src/lib/landing-chat.ts')).replaceAll(
    'process.env.NEXT_PUBLIC_LANDING_CHAT',
    JSON.stringify(env) ?? 'undefined'
  )
  assert.ok(!js.includes('process.env'), 'the module reads an environment value this test does not control')
  return importJs(js + `\n// ${Math.random()}`)
}

function fakeStore() {
  const map = new Map()
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  }
}

test('closed is the default: only the exact setting "open" opens the chat', async () => {
  for (const env of [undefined, '', ' ', 'true', '1', 'on', 'yes', 'opened', 'signup', 'closed', 'open2']) {
    const m = await loadLandingChat(env)
    assert.equal(m.LANDING_CHAT_OPEN, false, `NEXT_PUBLIC_LANDING_CHAT=${JSON.stringify(env)} must leave the chat closed`)
  }
  for (const env of ['open', 'OPEN', ' open ']) {
    const m = await loadLandingChat(env)
    assert.equal(m.LANDING_CHAT_OPEN, true, `NEXT_PUBLIC_LANDING_CHAT=${JSON.stringify(env)} must open the chat`)
  }
  // Closed world: across every value anyone might plausibly set, the chat is
  // open exactly when the value, trimmed and lowercased, is the word "open".
  // (Review, Nov 13 2026: a version that also opened on 'enabled' and 'y'
  // passed the two lists above.)
  const m = await loadLandingChat(undefined)
  const words = ['open', 'opened', 'opening', 'reopen', 'open ', ' Open', 'OPEN\n', 'o', 'op', 'y', 'yes', 'n', 'no', 'on', 'off',
    'enabled', 'enable', 'disabled', 'true', 'false', 't', 'f', '1', '0', 'live', 'public', 'anonymous', 'free', 'chat', 'all',
    'closed', 'close', 'signup', 'gate', 'gated', 'null', 'undefined', '*', 'open,closed', 'open;', '"open"', "'open'", 'open=1']
  for (const w of words) {
    assert.equal(m.landingChatOpen(w), w.trim().toLowerCase() === 'open', `landingChatOpen(${JSON.stringify(w)})`)
  }
})

test('every access sentence, exactly, in both modes', async () => {
  const closed = await loadLandingChat(undefined)
  assert.deepEqual(
    [closed.yuriAccessPhrase(), closed.yuriAccessSentence(), closed.heroBadge(), closed.heroFootnote(12), closed.talkToYuriLabel(), closed.LANDING_CHAT_CLOSED_ERROR],
    [
      'free to start with an account',
      'Free to start with an account.',
      'Free account. Start with Yuri.',
      'Talking to Yuri starts with a free account.',
      'Start with Yuri',
      'Talking to Yuri now starts with a free account.',
    ]
  )
  const open = await loadLandingChat('open')
  assert.deepEqual(
    [open.yuriAccessPhrase(), open.yuriAccessSentence(), open.heroBadge(), open.heroFootnote(12), open.talkToYuriLabel()],
    ['free, no signup', 'Free, no signup.', 'Free to talk to. No signup.', 'Talk to Yuri free. 12 messages, no signup.', 'Talk to Yuri Free']
  )
})

test('a carried question survives sign-up once, bounded, and never when stale', async () => {
  const m = await loadLandingChat(undefined)
  const t0 = 1_800_000_000_000

  const store = fakeStore()
  assert.equal(m.stashCarriedQuestion(store, '  Is COSRX snail mucin\n right\u0000 for oily skin?  ', t0), true)
  assert.equal(m.takeCarriedQuestion(store, t0 + 60_000), 'Is COSRX snail mucin right for oily skin?')
  assert.equal(store.map.size, 0, 'the question must be removed when it is read')
  assert.equal(m.takeCarriedQuestion(store, t0 + 60_000), '', 'a second read must find nothing')

  // Nothing usable is never stored.
  for (const junk of [null, undefined, '', '   ', '\n\t']) {
    const s = fakeStore()
    assert.equal(m.stashCarriedQuestion(s, junk, t0), false)
    assert.equal(s.map.size, 0)
  }

  // Older than a day, or stamped in the future: dropped, and still removed.
  for (const readAt of [t0 + 24 * 60 * 60 * 1000 + 1, t0 - 1]) {
    const s = fakeStore()
    m.stashCarriedQuestion(s, 'what about my moisturizer', t0)
    assert.equal(m.takeCarriedQuestion(s, readAt), '')
    assert.equal(s.map.size, 0)
  }

  // Bounded.
  const long = fakeStore()
  m.stashCarriedQuestion(long, 'a'.repeat(5000), t0)
  assert.equal(m.takeCarriedQuestion(long, t0).length, 300)

  // Malformed storage and a throwing store never break sign-up.
  const bad = fakeStore()
  bad.map.set('ss_signup_ask_v1', '{not json')
  assert.equal(m.takeCarriedQuestion(bad, t0), '')
  const wrongShape = fakeStore()
  wrongShape.map.set('ss_signup_ask_v1', JSON.stringify({ q: 5, at: 'x' }))
  assert.equal(m.takeCarriedQuestion(wrongShape, t0), '')
  const throwing = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() {} }
  assert.equal(m.stashCarriedQuestion(throwing, 'hello there', t0), false)
  assert.equal(m.takeCarriedQuestion(throwing, t0), '')
})

test('the sign-up link carries a cleaned source and the question, and nothing else', async () => {
  const m = await loadLandingChat(undefined)
  assert.equal(m.gatedSignupHref(null, ''), '/register?plan=monthly&from=gate')
  assert.equal(m.gatedSignupHref('blog', ''), '/register?plan=monthly&from=gate_blog')
  assert.equal(m.gatedSignupHref('ref_tiktok_com', 'Is this ok?'), '/register?plan=monthly&from=gate_ref_tiktok_com&ask=Is+this+ok%3F')
  // A hostile source cannot add parameters or leave the site.
  const hostile = m.gatedSignupHref('x&next=//evil.example/"><script>', 'q&plan=free#frag')
  const url = new URL(hostile, 'https://www.seoulsister.com')
  assert.equal(url.pathname, '/register')
  assert.deepEqual([...url.searchParams.keys()], ['plan', 'from', 'ask'])
  assert.equal(url.searchParams.get('plan'), 'monthly')
  assert.match(url.searchParams.get('from'), /^gate_[a-z0-9_]{1,40}$/i)
  assert.equal(url.searchParams.get('ask'), 'q&plan=free#frag')
})

test('the chat endpoint refuses first while closed: before rate limits, a visitor row, or a model', () => {
  const src = read('src/app/api/widget/chat/route.ts')
  const post = src.slice(src.indexOf('export async function POST('))
  const gate = post.indexOf('if (!LANDING_CHAT_OPEN) {')
  assert.ok(gate > 0, 'the closed check is gone from the chat endpoint')
  // The first statement of the handler body: nothing but the opening `try {`
  // and comments may come before it.
  const before = post.slice(post.indexOf('{') + 1, gate).replace(/\/\/.*$/gm, '').replace(/\s+/g, '')
  assert.equal(before, 'try{', `something runs before the closed check: ${before}`)
  for (const later of ['checkRateLimit(', 'getOrCreateVisitor(', 'request.json(', 'messages.stream(', 'getAnthropicClient(']) {
    const at = post.indexOf(later)
    if (at === -1) continue
    assert.ok(at > gate, `${later} runs before the closed check`)
  }
  assert.ok(post.indexOf('getOrCreateVisitor(') > gate, 'the visitor lookup this test guards has moved or been renamed')
  // The refusal itself, WHOLE: the condition, nothing before the return, and
  // the shape the client turns into the sign-up card. (Review, Nov 13 2026: a
  // header bypass wrapped around the return, and a call added inside the block
  // before it, both passed a test that only looked for the JSON.)
  assert.ok(post.includes(`  try {
    // The landing chat is closed (src/lib/landing-chat.ts): refuse before a
    // visitor row is made or a model is called, so the page is not the only
    // thing holding the gate. Same shape as the per-visitor cap, which the
    // client already turns into the sign-up card.
    if (!LANDING_CHAT_OPEN) {
      return new Response(
        JSON.stringify({ error: LANDING_CHAT_CLOSED_ERROR, limitReached: true, chatClosed: true }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // IP rate limiting (25/IP/day abuse prevention)
`), 'the closed check is no longer exactly: if closed, return the 429, with nothing else in the block')
  assert.equal((src.match(/LANDING_CHAT_OPEN/g) ?? []).length, 2, 'LANDING_CHAT_OPEN is used somewhere else in the chat endpoint')
  // And the constant it tests is the module's, not a local one.
  assert.match(src, /import \{ LANDING_CHAT_OPEN, LANDING_CHAT_CLOSED_ERROR \} from '@\/lib\/landing-chat'/)
  assert.doesNotMatch(src.replace(/import \{ LANDING_CHAT_OPEN[^\n]*\n/, ''), /(const|let|var)\s+LANDING_CHAT_OPEN\b/)
})

// ---- The nurture emails, executed in both modes ---------------------------

async function loadNurtureCopy(open) {
  let js = transpile(read('src/lib/email/nurture-copy.ts'))
  js = js
    .replace(/import \{ PRICING \} from '@\/lib\/pricing';?/, "const PRICING = { trial_days: 7, monthly_display: '$9.99/mo', monthly_display_long: '$9.99/month' };")
    .replace(/import \{ LANDING_CHAT_OPEN \} from '@\/lib\/landing-chat';?/, `const LANDING_CHAT_OPEN = ${open};`)
    .replace(
      /import \{ normalizeOfferCode \} from '@\/lib\/offers';?/,
      "const normalizeOfferCode = (raw) => { const c = (raw ?? '').trim().toUpperCase(); return /^[A-Z0-9]{3,20}$/.test(c) ? c : null };"
    )
  assert.doesNotMatch(js, /^import /m, 'nurture-copy.ts gained an import this test does not stub')
  return importJs(js + `\n// ${Math.random()}`)
}

function everyNurtureEmail(m) {
  const out = []
  for (const step of [1, 2, 3]) {
    for (const cohort of ['registered', 'widget']) {
      for (const options of [
        {},
        { offerCode: 'BAILEY' },
        { resumeUrl: 'https://www.seoulsister.com/?resume=tok', resumeRemaining: 8 },
        { resumeUrl: 'https://www.seoulsister.com/?resume=tok', resumeRemaining: 0 },
        { resumeUrl: 'https://www.seoulsister.com/?resume=tok', resumeRemaining: null },
      ]) {
        const e = m.buildNurtureEmail(step, cohort, 'unsubtoken', options)
        out.push({ step, cohort, options, text: `${e.subject}\n${e.bodyHtml}` })
      }
    }
  }
  return out
}

// The SHAPE of a promise that needs the open chat, not one wording: talking
// with no account, right now for free, or carrying a saved chat on.
const NEEDS_OPEN_CHAT =
  /no (account|login|log-in|sign-?up)|without (an account|signing|logging)|talk to (me|yuri)[^.<]{0,30}(right now|anytime|, free)|free (chat|conversation) on the homepage (is|stays|remains|will|still)|pick(ing)? up (our|where)|carry on (right|here)|keep (chatting|talking) (here|free)/i

test('closed: no nurture email promises a chat without an account, in any step, cohort or link state', async () => {
  const m = await loadNurtureCopy(false)
  const emails = everyNurtureEmail(m)
  assert.equal(emails.length, 30)
  for (const e of emails) {
    const hit = e.text.match(NEEDS_OPEN_CHAT)
    assert.equal(hit, null, `email ${e.step} / ${e.cohort} / ${JSON.stringify(e.options)} says: "${hit?.[0]}"`)
    // No link opens the bare homepage chat: every link to the site is a page
    // that works while closed (a saved conversation, a blog post, sign-up,
    // sign-in, unsubscribe).
    for (const href of e.text.match(/href="[^"]+"/g) ?? []) {
      assert.match(
        href,
        /href="https:\/\/www\.seoulsister\.com\/(\?resume=tok|blog\/|register\?|login\?|api\/email\/unsubscribe)/,
        `email ${e.step} / ${e.cohort} links to ${href}`
      )
    }
  }
  // And every closed email by fingerprint. The pattern above bans a SHAPE, but
  // "you can jump straight in on the homepage, nothing to create" has none of
  // its words (review, Nov 13 2026). Any change to what a lead reads while the
  // chat is closed fails here and needs a second-model review before the
  // fingerprint is updated.
  assert.equal(
    sha256(emails.map((e) => `${e.step}|${e.cohort}|${JSON.stringify(e.options)}\n${e.text}`).join('\n=====\n')),
    '88e3d4585dd4e97099c9dc2c75d35765680f6a9c484edad1fc5794d0708d1081'
  )
  // A reopened conversation is described as readable, with the true reason.
  const withMessagesLeft = m.buildNurtureEmail(1, 'widget', 't', { resumeUrl: 'https://www.seoulsister.com/?resume=tok', resumeRemaining: 8 })
  assert.equal(withMessagesLeft.subject, 'Your conversation with Yuri is saved')
  assert.ok(withMessagesLeft.bodyHtml.includes('The free chat on the homepage has closed, so you can read it back. Carrying it on means a free account, and new members get 7 days free.'))
  assert.ok(!withMessagesLeft.bodyHtml.includes("You've used the free messages"), 'someone with messages left is told they used them')
  const usedUp = m.buildNurtureEmail(1, 'widget', 't', { resumeUrl: 'https://www.seoulsister.com/?resume=tok', resumeRemaining: 0 })
  assert.ok(usedUp.bodyHtml.includes("You've used the free messages that come with the preview, so you can read it back."))
})

test('open: the nurture emails are word for word what they were before the gate', async () => {
  const m = await loadNurtureCopy(true)
  const e1 = m.buildNurtureEmail(1, 'widget', 't', {})
  assert.equal(e1.subject, 'You can talk to me anytime, no account needed')
  assert.ok(e1.bodyHtml.includes("So here's the part we should have led with: you can talk to me right now, no account needed. Ask me anything you'd ask a friend"))
  assert.ok(e1.bodyHtml.includes('<a href="https://www.seoulsister.com/?from=nurture_1" style='))
  assert.ok(e1.bodyHtml.includes('>Talk to Yuri, free</a>'))
  const resumed = m.buildNurtureEmail(1, 'widget', 't', { resumeUrl: 'https://www.seoulsister.com/?resume=tok', resumeRemaining: 8 })
  assert.equal(resumed.subject, 'Picking up where we left off')
  assert.ok(resumed.bodyHtml.includes('>Pick up our conversation</a>'))
  assert.ok(m.buildNurtureEmail(2, 'widget', 't', {}).bodyHtml.includes("describe it to me on the <a href=\"https://www.seoulsister.com/?from=nurture_2\" style=\"color:#C9A55C;\">homepage</a>. Free, no login, and I'll tell you straight."))
  assert.ok(m.buildNurtureEmail(3, 'widget', 't', {}).bodyHtml.includes("The free conversation on the homepage is real. I'll diagnose, recommend, and warn you off wasted money, and none of that changes."))
})

// ---- Closed world: where a no-account promise may appear in the source -----

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx|txt|json|md)$/.test(name)) out.push(p)
  }
  return out
}

const stripComments = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')

test('closed world: a no-account promise appears only where the switch decides it', () => {
  const PROMISE = /no ?sign-?up|no account needed|without (an )?account|free, no login|free preview messages before|messages, no signup/gi
  const found = {}
  for (const file of [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'public'))]) {
    const n = (stripComments(readFileSync(file, 'utf8')).match(PROMISE) ?? []).length
    if (n) found[relative(ROOT, file)] = n
  }
  // Every one of these sits in a branch chosen by LANDING_CHAT_OPEN (or, in
  // TryYuriSection, inside the `!chatClosed` greeting and reply box, which a
  // closed page never renders). /install's line is about the install page
  // itself. A new entry, or a changed count, means a new promise was written:
  // route it through src/lib/landing-chat.ts and then update this table.
  // The privacy page's line is about conversations people ALREADY had without
  // an account ("If you talked to Yuri without an account"), which stay stored.
  assert.deepEqual(found, {
    'src/app/(legal)/privacy/page.tsx': 1,
    'src/app/install/page.tsx': 1,
    'src/components/blog/BlogYuriCta.tsx': 1,
    'src/components/home/HomeClient.tsx': 2,
    'src/components/pricing/PricingCards.tsx': 1,
    'src/components/widget/TryYuriSection.tsx': 3,
    'src/lib/email/nurture-copy.ts': 3,
    'src/lib/landing-chat.ts': 4,
  })
})

test('the open-only lines really are behind the switch', () => {
  const home = read('src/components/home/HomeClient.tsx')
  assert.ok(home.includes("{LANDING_CHAT_OPEN ? 'Talk to her free, no signup.' : 'It starts with a free account.'} She just gets sharper once she really knows you."))
  assert.ok(home.includes("desc: `Tell her about your skin, your products, and your goals. ${LANDING_CHAT_OPEN ? 'Free to start, no signup.' : yuriAccessSentence()}` }"))
  const blog = read('src/components/blog/BlogYuriCta.tsx')
  assert.ok(blog.includes("(LANDING_CHAT_OPEN ? 'Start a free chat right now, no account needed.' : 'It starts with a free account.') +"))
  const card = read('src/components/pricing/PricingCards.tsx')
  assert.ok(card.includes(`        {LANDING_CHAT_OPEN && (
          <p className="text-center text-xs text-white/50 mt-3">
            Try {MAX_FREE_MESSAGES} free preview messages before subscribing.
          </p>
        )}`))
  const widget = read('src/components/widget/TryYuriSection.tsx')
  // The module constant, not something a prop or a query string can flip.
  assert.ok(widget.includes('  const chatClosed = !LANDING_CHAT_OPEN\n'))
  assert.ok(widget.includes('  const isAtLimit = chatClosed || messageCount >= MAX_FREE_MESSAGES || serverLimitReached\n'))
  // The greeting, quick prompts and example are the open branch; the closed
  // branch is GatedYuriIntro. The reply box hangs off isAtLimit.
  assert.ok(widget.includes('        {!showLive && chatClosed && (\n          <GatedYuriIntro\n'))
  assert.ok(widget.includes('        {!showLive && !chatClosed && (\n'))
  const greeting = widget.indexOf('I&apos;ll give you my real read. Free, no signup.')
  const openBranch = widget.indexOf('        {!showLive && !chatClosed && (\n')
  const live = widget.indexOf('        {showLive && (\n')
  assert.ok(openBranch > 0 && greeting > openBranch && greeting < live, 'the "Free, no signup" greeting is outside the open-only branch')
  assert.ok(widget.includes(`            {chatClosed
              ? 'Your honest AI K-beauty advisor. It starts with a free account.'
              : 'Ask her anything about Korean skincare. No signup required.'}`), 'the section heading promises no signup in both modes')
  const box = widget.indexOf("'Type here to ask about your skin. Free, no signup.'")
  const boxGate = widget.lastIndexOf('      {!isAtLimit && (\n', box)
  assert.ok(box > 0 && boxGate > live && boxGate < box, 'the reply box is no longer behind isAtLimit')
})

test('the closed hero: only real, approved conversations may be labelled real', () => {
  const content = read('src/content/yuri-example.ts')
  // Until a member has approved exact text, nothing is published as real.
  const m = content.match(/export const REAL_YURI_EXAMPLE: RealYuriExample \| null = ([\s\S]*)$/)
  assert.ok(m, 'REAL_YURI_EXAMPLE is missing')
  if (m[1].trim() !== 'null') {
    assert.match(m[1], /approvedBy: '[^']{10,}'/, 'a real example is published with no record of who approved it')
  }
  const intro = read('src/components/widget/GatedYuriIntro.tsx')
  // Both files WHOLE, by fingerprint. Everything a closed-mode visitor reads in
  // the hero is in these two files, and review (Nov 13 2026) got four false
  // lines past assertions that named what must be present: an anonymous-chat
  // promise in new words, "No card, ever", "saved on every device", and a real
  // example published with an invented approval. Publishing a real example, or
  // changing one word of the hero, means a second-model review and then a new
  // fingerprint here.
  assert.equal(sha256(intro), 'f273b4012e4a0116e81fe254abd96591b127045d615b6b0d9e708daaf0377d3d', 'GatedYuriIntro.tsx changed')
  assert.equal(sha256(content), 'b20d58dd7614ee56d931b3b1b4aff66586de0e9b8c0c477892d7f5dea9ceeb63', 'src/content/yuri-example.ts changed')
  assert.ok(intro.includes('  const example = REAL_YURI_EXAMPLE ?? fallbackExample\n'))
  // The fallback keeps the label that says it is an example.
  const widget = read('src/components/widget/TryYuriSection.tsx')
  const at = widget.indexOf('<GatedYuriIntro')
  const call = widget.slice(at, widget.indexOf('/>', at))
  assert.match(call, /\? 'Example: a new member’s first session with Yuri'\s*: 'Example: Yuri with a subscriber she’s known for months',/)
  // Display and navigation only: no fetch, no model, no generated text.
  assert.doesNotMatch(intro, /fetch\(|anthropic|useEffect|dangerouslySetInnerHTML/i)
  // The price line is the shared, already-reviewed one.
  assert.ok(intro.includes('<p className="text-xs text-white/50 mt-2">{widgetMembershipLine(percentOff)}</p>'))
  assert.doesNotMatch(intro, /\$\d|PRICING\./, 'the closed hero states a price of its own')
})

test('sign-up keeps the question and takes it out of the address bar; the setup chat only prefills it', () => {
  const register = read('src/app/(auth)/register/page.tsx')
  assert.ok(register.includes("      stashCarriedQuestion(window.localStorage, params.get('ask'), Date.now())\n      params.delete('ask')\n"))
  const onboarding = read('src/app/(app)/onboarding/page.tsx')
  // The whole effect, and every use of the value. (Review, Nov 13 2026: a line
  // added inside the effect that sent the question through a renamed variable
  // passed a test that pinned two lines.)
  assert.ok(onboarding.includes(`  const [carriedAsk, setCarriedAsk] = useState<string | null>(null)
  useEffect(() => {
    try {
      const question = takeCarriedQuestion(window.localStorage, Date.now())
      if (question) setCarriedAsk(question)
    } catch (err) {
      console.warn('[onboarding] carried question not read:', err)
    }
  }, [])
`), 'the effect that reads the carried question is no longer exactly: read it, keep it in state')
  assert.equal((onboarding.match(/carriedAsk/gi) ?? []).length, 5, 'the carried question is used somewhere new in the setup page')
  assert.equal((onboarding.match(/takeCarriedQuestion/g) ?? []).length, 2, 'takeCarriedQuestion is called somewhere new')
  assert.ok(onboarding.includes('          restoredValue={carriedAsk}\n          onRestoreConsumed={() => setCarriedAsk(null)}\n'))
  // Prefill only: the carried question is never passed to sendMessage or the API by the page itself.
  assert.doesNotMatch(onboarding, /sendMessage\(carriedAsk|message: carriedAsk|carriedAsk\s*\)/)
})

test('the lead follow-up judge is told the truth about the link in both modes', () => {
  const src = read('src/lib/proactive/lead-reengage.ts')
  assert.ok(src.includes("        : `Seoul Sister is a paid subscription at ${PRICING.monthly_display}; talking to Yuri now starts with a free account.`,"))
  assert.ok(src.includes(`      !LANDING_CHAT_OPEN
        ? \`WHAT THE LINK OPENS: the sign-up page on seoulsister.com. The free chat on the homepage closed to new messages after they wrote to you, for everyone, and the conversation you had is not shown to them there. Continuing means creating a free account, which opens a free setup chat and then a \${PRICING.trial_days}-day free trial that needs no card. If they create the account on the device they open this email on, your one-line opener is put in the setup chat's box for them to send. Don't promise them a free conversation that picks up where you left off.\`
        : left > 0`))
  // The button matches the fact: sign-up while closed, the homepage chat while open.
  assert.ok(src.includes(`  if (!LANDING_CHAT_OPEN) params.set('plan', 'monthly')
  const href = LANDING_CHAT_OPEN ? \`\${SITE}/?\${params.toString()}\` : \`\${SITE}/register?\${params.toString()}\`
`))
  assert.ok(src.includes("${LANDING_CHAT_OPEN ? 'Pick this up with Yuri' : 'Create a free account'}</a></p>`"))
  assert.ok(src.includes("; ${LANDING_CHAT_OPEN ? 'the free preview is a short conversation' : 'talking with you now starts with a free account'}. Don't hide that"))
})

test('each sign-up records which link led to it, so the closed chat can be graded by account rows', async () => {
  const m = await loadLandingChat(undefined)
  const store = fakeStore()
  assert.equal(m.readSignupFrom(store), undefined)
  assert.equal(m.rememberSignupFrom(store, 'gate_blog'), true)
  assert.equal(m.readSignupFrom(store), 'gate_blog')
  // First tag in the tab wins; junk is never stored or returned.
  assert.equal(m.rememberSignupFrom(store, 'nurture_3'), false)
  assert.equal(m.readSignupFrom(store), 'gate_blog')
  for (const junk of [null, undefined, '', 'has space', 'a&b=c', '<script>', 'x'.repeat(61)]) {
    const s2 = fakeStore()
    assert.equal(m.rememberSignupFrom(s2, junk), false, JSON.stringify(junk))
    assert.equal(s2.map.size, 0)
  }
  const tampered = fakeStore()
  tampered.map.set('ss_signup_from_v1', 'not a tag!')
  assert.equal(m.readSignupFrom(tampered), undefined)
  assert.equal(m.readSignupFrom(null), undefined)
  assert.equal(m.readSignupFrom({ getItem() { throw new Error('blocked') } }), undefined)
  // The closed hero's link produces a tag this accepts.
  const from = new URL(m.gatedSignupHref('ref_tiktok_com', ''), 'https://x.test').searchParams.get('from')
  assert.equal(m.cleanSignupFrom(from), 'gate_ref_tiktok_com')
  // Wiring: read at the sign-up page, written onto the account.
  assert.ok(read('src/app/(auth)/register/page.tsx').includes("      rememberSignupFrom(window.sessionStorage, params.get('from'))\n"))
  assert.ok(read('src/contexts/AuthContext.tsx').includes("          signup_from: readSignupFrom(typeof window === 'undefined' ? null : window.sessionStorage),\n"))
})

test('a signed-in member following a feeder link is never shown the sign-up card', async () => {
  const m = await loadLandingChat(undefined)
  const d = m.signedInLandingDestination
  // Closed: feeder links go to their own Yuri chat, question carried.
  assert.equal(d('?from=blog', '', false), '/yuri?from=blog')
  assert.equal(d('?ask=Is+this+ok%3F&from=product', '', false), '/yuri?ask=Is+this+ok%3F&from=product')
  assert.equal(d('?ask=', '', false), '/yuri')
  assert.equal(d('?from=x%26next%3D//evil', '', false), '/yuri', 'a malformed tag is dropped, never passed on')
  // Open: feeder links stay on the landing chat, exactly as before the gate.
  assert.equal(d('?from=blog', '', true), null)
  assert.equal(d('?ask=hello&from=product', '', true), null)
  // Both modes: a bare visit goes to the dashboard; resume links and section links stay.
  for (const open of [true, false]) {
    assert.equal(d('', '', open), '/dashboard')
    assert.equal(d('?utm_source=tiktok', '', open), '/dashboard')
    assert.equal(d('?resume=tok&from=nurture_1', '', open), null)
    assert.equal(d('', '#pricing', open), null)
    assert.equal(d('?from=blog', '#pricing', open), null)
  }
  // Every destination is a same-site path under /yuri or /dashboard.
  for (const search of ['?from=blog', '?ask=a&from=b', '?ask=%2F%2Fevil.example', '']) {
    const dest = d(search, '', false)
    assert.match(dest, /^\/(yuri(\?[^#]*)?|dashboard)$/)
  }
  const redirect = read('src/components/auth/SignedInRedirect.tsx')
  assert.ok(redirect.includes(`    const destination = signedInLandingDestination(window.location.search, window.location.hash)
    if (!destination) return
`))
  assert.ok(redirect.includes('        if (session?.user) router.replace(destination)\n'))
  assert.doesNotMatch(redirect, /router\.(replace|push)\('\/dashboard'\)/)
})

test('closed, on a phone: sign-up is one tap away and the sign-up card has no scroll area of its own', async () => {
  // Owner's iPhone, Nov 13 2026: the card kept the chat window's fixed height
  // and inner scroll, which clipped Yuri's greeting under the card header; the
  // sticky bar scrolled to a card whose only action was the same button; and
  // the first button in the page was "View Plans".
  const widget = read('src/components/widget/TryYuriSection.tsx')
  assert.ok(widget.includes("        style={chatClosed && !showLive ? undefined : { minHeight: '520px', maxHeight: '640px' }}\n"))
  const home = read('src/components/home/HomeClient.tsx')
  assert.ok(home.includes(`              {!LANDING_CHAT_OPEN && (
                <Link href={gatedSignupHref('hero_button', '')} className="lg:hidden glass-button-primary text-sm py-3 px-6">
                  Create my free account
                </Link>
              )}
              <Link href="#pricing" className={\`\${LANDING_CHAT_OPEN ? '' : 'hidden lg:inline-flex '}glass-button-primary text-sm py-3 px-6\`}>
                View Plans
              </Link>`))
  assert.ok(home.includes(`            <Link href={gatedSignupHref('sticky', '')} className="glass-button-primary w-full text-sm py-3 block text-center">
              Create my free account
            </Link>`))
  // Open mode keeps the old sticky button, which scrolls to the chat.
  assert.ok(home.includes(`          {LANDING_CHAT_OPEN ? (
            <button
              onClick={() => {
                document.getElementById('hero-yuri')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="glass-button-primary w-full text-sm py-3"
            >
              Ask Yuri About Your Skin
            </button>
          ) : (`))
  const m = await loadLandingChat(undefined)
  assert.equal(m.gatedSignupHref('hero_button', ''), '/register?plan=monthly&from=gate_hero_button')
  assert.equal(m.gatedSignupHref('sticky', ''), '/register?plan=monthly&from=gate_sticky')
})
