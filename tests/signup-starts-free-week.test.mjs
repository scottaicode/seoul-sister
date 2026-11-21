/**
 * Creating an account starts the free week (Nov 16 2026).
 *
 * Why: the owner's process is "sign up, agree to the terms, get 7 free days;
 * a card only when they want to continue". The app instead made a "free
 * account", then a setup chat, then a membership page where a second press
 * started the week. Two testers and the owner all read sign-up as the start;
 * one tester and the only stranger to sign up at the gate both stopped before
 * the second press. The pages were telling the truth about a step nobody had
 * decided to have.
 *
 * Executed here: the browser marker, the start itself against a fake server
 * in every outcome, the saved code's thirty days, and every sentence.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const transpile = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

async function load() {
  const dir = mkdtempSync(join(tmpdir(), 'ss-signup-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  put('agreement', read('src/lib/signup-agreement.ts'))
  put('start', read('src/lib/start-free-week.ts').replace("from '@/lib/offers'", "from './offers.mjs'"))
  const imp = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)).href)
  return { offers: await imp('offers'), agreement: await imp('agreement'), start: await imp('start') }
}
const store = (init = {}) => {
  const m = new Map(Object.entries(init))
  return { map: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)) }, removeItem: (k) => { m.delete(k) } }
}

// The browser's own zone is sent with the start, for the end time in the confirmation email.
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

test('what the sign-up page says: one sentence, the week starts here, and what happens after', async () => {
  const { offers: o } = await load()
  assert.equal(o.signupStartsLine(null), 'For a new member, creating your account starts your free week: 7 days, no card. After that it is $9.99/month, only if you add a card. One free week per person.')
  assert.equal(o.signupStartsLine(50), 'For a new member, creating your account starts your free week: 7 days, no card. After that it is $4.99 for your first paid month (50% off), then $9.99/month, only if you add a card. One free week per person.')
  assert.equal(o.registerFootnote(50), o.signupStartsLine(50))
  assert.equal(o.accountCtaNote(), 'This creates your account and, for a new member, starts your free week.')
  // The first screen after it.
  assert.equal(o.setupChatLine(true, true), 'Your free week has started. This first chat is where I learn your skin.')
  assert.equal(o.setupChatLine(true, false), 'Setup chat')
  assert.equal(o.setupChatLine(null, true), 'Setup chat', 'never said of someone whose membership is unread')
  assert.equal(o.setupChatLine(false, true), 'Free setup chat. Membership is separate, and starts only if you choose it.', 'a non-member is never told a week started')
  // When it did NOT start, the page says why: the sign-up page had just said it would.
  assert.equal(o.freeWeekNotStartedLine('had_week'), 'Your free week has already been used, so it did not start again. This setup chat is free, and the membership page after it shows what you can start.')
  assert.equal(o.freeWeekNotStartedLine('network'), 'Your free week did not start: several have already been started from this network recently. This setup chat is free, and the membership page after it shows what you can start.')
  assert.equal(o.freeWeekNotStartedLine('code', 'We cannot apply ANNKOREA on this page.'), 'We cannot apply ANNKOREA on this page. Your free week has not started yet. This setup chat is free, and the membership page after it shows what you can start.')
  assert.equal(o.freeWeekNotStartedLine('not_asked'), 'Your free week has not started yet. This setup chat is free, and the membership page after it starts your free week: 7 days, no card.')
  assert.equal(o.freeWeekNotStartedLine('other'), 'Your free week could not be started just now. Nothing was charged. This setup chat is free, and the membership page after it shows what you can start.')
  for (const r of ['had_week', 'network', 'code', 'not_asked', 'other']) assert.doesNotMatch(o.freeWeekNotStartedLine(r), /has started|is running/)
})

test('closed world: no sentence anywhere still says creating an account does not start the week', () => {
  const files = []
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p) } }
  walk(join(root, 'src'))
  assert.ok(files.length > 300)
  const hits = []
  for (const f of files) {
    const text = code(readFileSync(f, 'utf8'))
    // The shape, not three phrases: any sentence that puts the start of the
    // free week AFTER the account ("starts later", "does not start", "then a
    // free week", "choose membership") or calls membership separate from the
    // account for someone who has not been refused one.
    for (const line of text.split('\n')) {
      if (/does not start your free week|free week starts later|membership is your choice after|Membership is separate and optional|after that, membership is their choice|setup chat, then a first-time member's free week/i.test(line)) hits.push(`${relative(root, f)}: ${line.trim().slice(0, 120)}`)
    }
  }
  assert.deepEqual(hits, [])
  // The one "membership is separate" left is shown only to someone who is NOT a member.
  const offers = code(read('src/lib/offers.ts'))
  assert.equal(offers.split('Membership is separate').length - 1, 1)
  assert.ok(offers.includes("return isMember === false ? 'Free setup chat. Membership is separate, and starts only if you choose it.' : 'Setup chat'"))
})

test('executed: the browser marker lasts an hour, is this sign-up only, and never throws', async () => {
  const { agreement: a } = await load()
  const s = store()
  const T = 1_800_000_000_000
  assert.equal(a.hasFreshSignupAgreement(T, s), false)
  a.rememberSignupAgreement(T, s)
  assert.equal(a.hasFreshSignupAgreement(T, s), true)
  assert.equal(a.hasFreshSignupAgreement(T + 59 * 60 * 1000, s), true)
  assert.equal(a.hasFreshSignupAgreement(T + 61 * 60 * 1000, s), false, 'an hour later it is not this sign-up any more')
  assert.equal(a.hasFreshSignupAgreement(T - 1000, s), false, 'a mark from the future is not trusted')
  a.clearSignupAgreement(s)
  assert.equal(a.hasFreshSignupAgreement(T, s), false)
  for (const junk of ['', 'yes', 'NaN', '0', '-5']) assert.equal(a.hasFreshSignupAgreement(T, store({ [a.SIGNUP_AGREEMENT_KEY]: junk })), false, junk)
  const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  assert.equal(a.hasFreshSignupAgreement(T, broken), false)
  a.rememberSignupAgreement(T, broken)
  a.clearSignupAgreement(broken)
  assert.equal(a.hasFreshSignupAgreement(T, null), false)
})

/** A fake server: scripted answers for the two endpoints, and a record of what was asked. */
function server(script) {
  const asked = []
  const facts = [...script.facts]
  const presses = [...(script.presses ?? [])]
  return {
    asked,
    fetch: async (url, init) => {
      asked.push([url, init?.method ?? 'GET', init?.body ? JSON.parse(init.body) : null])
      if (url === '/api/me/trial') { const f = facts.length > 1 ? facts.shift() : facts[0]; return f === null ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => f } }
      const p = presses.shift()
      if (!p) throw new Error('unexpected press')
      return { ok: p.status < 400, status: p.status, json: async () => { if (p.body === 'not json') throw new Error('bad json'); return p.body } }
    },
  }
}
const ELIGIBLE = { eligible: true, no_card: true, direct: true, had_trial: false, network_cap: false, trial: null }
const RUNNING = { ...ELIGIBLE, eligible: false, trial: { ends_at: '2026-11-23T00:00:00Z', card_on_file: false } }
const noWait = async () => {}

test('executed: it says "started" only when a free week is known to be running, and otherwise says why', async () => {
  const { start, offers: o } = await load()
  const run = async (script, codeSaved = null) => { const s = server(script); return [await start.startFreeWeekAfterSignup('tok', codeSaved, s.fetch, noWait), s.asked] }

  // The ordinary case, and exactly what is sent.
  const [ok, asked] = await run({ facts: [ELIGIBLE], presses: [{ status: 200, body: { started: true, ends_at: 'x' } }] }, 'BAILEY')
  assert.deepEqual(ok, { started: true })
  assert.deepEqual(asked, [
    ['/api/me/trial', 'GET', null],
    ['/api/stripe/checkout', 'POST', { plan: 'monthly', expect_free_week: true, via: 'direct', agreed_terms: true, terms_shown: 'signup', timezone: TZ, offer_code: 'BAILEY' }],
  ])
  assert.deepEqual((await run({ facts: [ELIGIBLE], presses: [{ status: 200, body: { started: true } }] }))[1][1][2], { plan: 'monthly', expect_free_week: true, via: 'direct', agreed_terms: true, terms_shown: 'signup', timezone: TZ })

  // Nothing is pressed for someone who cannot have one, and they are told why.
  for (const [facts, reason] of [
    [{ ...ELIGIBLE, eligible: false, had_trial: true }, 'had_week'],
    [{ ...ELIGIBLE, eligible: false, network_cap: true }, 'network'],
    [{ ...ELIGIBLE, direct: false }, 'other'],
    [{ ...ELIGIBLE, no_card: false }, 'other'],
    [{ ...ELIGIBLE, eligible: null }, 'other'],
    [null, 'other'],
  ]) {
    const [out, calls] = await run({ facts: [facts] })
    assert.deepEqual(out, { started: false, note: o.freeWeekNotStartedLine(reason), retry: reason === 'other' }, JSON.stringify(facts))
    assert.equal(calls.length, 1, 'only the facts were read')
  }
  // Already in a free week (a second tab, a reload): started, nothing pressed.
  const [again, againCalls] = await run({ facts: [RUNNING] })
  assert.deepEqual(again, { started: true })
  assert.equal(againCalls.length, 1)

  // "Already a member" is the route's answer for a running free week AND for a
  // paid or half-made subscription. Only the account's own facts say which.
  assert.deepEqual((await run({ facts: [ELIGIBLE, RUNNING], presses: [{ status: 409, body: { already_member: true } }] }))[0], { started: true })
  // Another tab started it a moment ago and its records are still being written: looked at once more.
  const [late, lateCalls] = await run({ facts: [ELIGIBLE, { ...ELIGIBLE, eligible: false }, RUNNING], presses: [{ status: 409, body: { already_member: true } }] })
  assert.deepEqual(late, { started: true })
  assert.equal(lateCalls.filter((c) => c[0] === '/api/me/trial').length, 3)
  assert.deepEqual((await run({ facts: [ELIGIBLE, { ...ELIGIBLE, eligible: false }], presses: [{ status: 409, body: { already_member: true } }] }))[0], { started: false, note: o.freeWeekNotStartedLine('other'), retry: true })
  assert.deepEqual((await run({ facts: [ELIGIBLE, null], presses: [{ status: 409, body: { already_member: true } }] }))[0], { started: false, note: o.freeWeekNotStartedLine('other'), retry: true })

  // Stripe has it, our records do not: the same call, once more, finishes it.
  const [retried, retriedCalls] = await run({ facts: [ELIGIBLE], presses: [{ status: 503, body: { started_not_recorded: true } }, { status: 200, body: { started: true } }] })
  assert.deepEqual(retried, { started: true })
  assert.equal(retriedCalls.filter((c) => c[0] === '/api/stripe/checkout').length, 2)
  assert.deepEqual((await run({ facts: [ELIGIBLE], presses: [{ status: 503, body: { started_not_recorded: true } }, { status: 503, body: { started_not_recorded: true } }] }))[0], { started: false, note: o.freeWeekNotStartedLine('other'), retry: true })

  // A code this path cannot apply is never dropped silently: the checkout's own sentence is passed on.
  for (const flag of ['code_not_applied', 'offer_ended', 'offer_failed']) {
    assert.deepEqual((await run({ facts: [ELIGIBLE], presses: [{ status: 409, body: { [flag]: true, error: 'We cannot apply ANNKOREA on this page.' } }] }, 'ANNKOREA'))[0], { started: false, note: o.freeWeekNotStartedLine('code', 'We cannot apply ANNKOREA on this page.'), retry: false }, flag)
  }
  // Every other refusal, and an unreadable answer: not started, nothing claimed.
  for (const p of [{ status: 409, body: { free_week_changed: true } }, { status: 502, body: { direct_failed: true } }, { status: 400, body: { error: 'x' } }, { status: 500, body: 'not json' }, { status: 200, body: { started: 'yes' } }, { status: 200, body: {} }]) {
    assert.deepEqual((await run({ facts: [ELIGIBLE], presses: [p] }))[0], { started: false, note: o.freeWeekNotStartedLine('other'), retry: true }, JSON.stringify(p))
  }
})

test('executed: one start per account per page; a second account in the same tab gets its own; a failure can be tried again', async () => {
  const { start } = await load()
  let runs = 0
  const slow = (answer) => async () => { runs += 1; await new Promise((r) => setTimeout(r, 5)); return answer }
  // The effect runs twice (React in development): one start, one answer.
  const [a1, a2] = await Promise.all([start.startFreeWeekOnce('user-a', 't', null, slow({ started: true })), start.startFreeWeekOnce('user-a', 't', null, slow({ started: true }))])
  assert.deepEqual([a1, a2, runs], [{ started: true }, { started: true }, 1])
  // A different person in the same tab is not handed the first one's answer.
  const b = await start.startFreeWeekOnce('user-b', 't', null, slow({ started: false, note: 'used', retry: false }))
  assert.deepEqual([b, runs], [{ started: false, note: 'used', retry: false }, 2])
  assert.deepEqual(await start.startFreeWeekOnce('user-a', 't', null, slow({ started: false, note: 'x', retry: false })), { started: true }, 'user-a still has user-a\'s')
  // A lasting refusal is kept for the page; it is not asked again.
  assert.deepEqual(await start.startFreeWeekOnce('user-b', 't', null, slow({ started: true })), { started: false, note: 'used', retry: false })
  assert.equal(runs, 2)
  // A failure is not kept: the next ask tries again, and a thrown error is a failure.
  const c1 = await start.startFreeWeekOnce('user-c', 't', null, async () => { runs += 1; throw new Error('network') })
  assert.equal(c1.started, false)
  assert.equal(c1.retry, true)
  assert.deepEqual(await start.startFreeWeekOnce('user-c', 't', null, slow({ started: true })), { started: true })
  assert.equal(runs, 4)
})

test('executed: who is started at sign-up, and what a reload says to someone who was not', async () => {
  const { agreement: a } = await load()
  const NOW = Date.parse('2026-11-16T22:40:00Z')
  const base = { member: false, hasToken: true, accountCreatedAt: '2026-11-16T22:33:34Z', hasMark: true, now: NOW }
  assert.equal(a.shouldStartAtSignup(base), true)
  // Each of the four is needed.
  assert.equal(a.shouldStartAtSignup({ ...base, member: true }), false)
  assert.equal(a.shouldStartAtSignup({ ...base, hasToken: false }), false)
  assert.equal(a.shouldStartAtSignup({ ...base, hasMark: false }), false)
  // An older free account that passes through the sign-up page is not started without being asked.
  assert.equal(a.shouldStartAtSignup({ ...base, accountCreatedAt: '2026-11-16T21:39:00Z' }), false, '61 minutes old')
  assert.equal(a.shouldStartAtSignup({ ...base, accountCreatedAt: '2026-11-14T03:52:06Z' }), false, 'the stranger who signed up two days ago')
  // A date that cannot be read is not "just created": nobody is started on a guess.
  for (const bad of [null, undefined, '', 'yesterday', '2026-11-16T23:40:00Z']) assert.equal(a.shouldStartAtSignup({ ...base, accountCreatedAt: bad }), false, String(bad))
  assert.equal(a.isJustCreated('2026-11-16T22:33:34Z', NOW), true)
  assert.equal(a.isJustCreated('2026-11-16T21:40:00Z', NOW), false, 'exactly an hour is no longer just created')

  // The reason is kept per account for the tab, so a reload repeats it and not a different one.
  const s = store()
  assert.equal(a.readStartNote('u1', s), null)
  a.rememberStartNote('u1', 'Your free week has already been used.', s)
  assert.equal(a.readStartNote('u1', s), 'Your free week has already been used.')
  assert.equal(a.readStartNote('u2', s), null, 'another account in the same tab has none')
  const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  a.rememberStartNote('u1', 'x', broken)
  assert.equal(a.readStartNote('u1', broken), null)
})

test('executed: a saved code is kept thirty days, a code saved before dates were kept starts its thirty days now', async () => {
  const { offers: o } = await load()
  const DAY = 24 * 60 * 60 * 1000
  const T = 1_800_000_000_000
  assert.equal(o.OFFER_KEEP_DAYS, 30)
  const fresh = store({ [o.OFFER_STORAGE_KEY]: 'bailey', [o.OFFER_SAVED_AT_KEY]: String(T) })
  assert.equal(o.readSavedOffer(fresh, T + 29 * DAY), 'BAILEY')
  assert.equal(o.readSavedOffer(fresh, T + 31 * DAY), null)
  assert.equal(fresh.map.size, 0, 'forgotten, with its date')
  const legacy = store({ [o.OFFER_STORAGE_KEY]: 'BAILEY' })
  assert.equal(o.readSavedOffer(legacy, T), 'BAILEY')
  assert.equal(legacy.map.get(o.OFFER_SAVED_AT_KEY), String(T))
  assert.equal(o.readSavedOffer(legacy, T + 31 * DAY), null)
  assert.equal(o.readSavedOffer(store(), T), null)
  assert.equal(o.readSavedOffer(store({ [o.OFFER_STORAGE_KEY]: 'not a code!' }), T), null)
  assert.equal(o.offerSavedLine('BAILEY', 50), 'Code BAILEY is saved in this browser: 50% off your first paid month.')
})

test('wiring: the mark is made only once the account exists, and the start is for a new account that came through sign-up', () => {
  const register = read('src/app/(auth)/register/page.tsx')
  // Email: after signUp resolves, so a failed sign-up leaves no mark.
  assert.ok(register.indexOf('await signUp(email, password, captchaToken ?? undefined)') < register.indexOf('      rememberSignupAgreement()\n      await settleWithin(pendingClaim, CLAIM_WAIT_MS)'))
  assert.equal(register.split('rememberSignupAgreement()').length - 1, 2, 'the form and the Google button')
  assert.ok(register.includes('By creating an account you agree to our'))

  const page = read('src/app/(app)/onboarding/page.tsx')
  // The decision is the executed function above, given the account's own creation time.
  assert.ok(page.includes("      if (shouldStartAtSignup({ member, hasToken: !!token, accountCreatedAt: createdAt, hasMark: hasFreshSignupAgreement(), now: Date.now() })) {\n"))
  assert.ok(page.includes('      const createdAt = data.session?.user?.created_at\n'))
  assert.ok(page.includes('        const outcome = await startFreeWeekOnce(id, token as string, getOfferCode())\n'))
  // A lasting reason ends it and is kept for a reload; a failure keeps the mark so a reload tries again.
  assert.ok(page.includes('        if (!outcome.retry) {\n          clearSignupAgreement()\n          rememberStartNote(id, outcome.note)\n        }\n'))
  // A new account with nothing in progress: what this tab was told before, else that it has not started.
  assert.ok(page.includes("        setStartNote(readStartNote(id) ?? freeWeekNotStartedLine('not_asked'))\n"))
  // "Started" is the only thing that makes the page say member here.
  assert.equal(page.split('setFreeWeekJustStarted(true)').length - 1, 1)
  assert.ok(page.includes('        if (outcome.started) {\n          clearSignupAgreement()\n          if (!live) return\n          setIsMember(true)\n          setFreeWeekJustStarted(true)\n'))
  // Yuri's greeting is asked for only after membership has settled, so it is never written for a non-member a second before the week starts.
  const settle = page.indexOf("        await Promise.race([membershipSettledRef.current ?? Promise.resolve(), new Promise((r) => setTimeout(r, 12000))])")
  const greet = page.indexOf("body: JSON.stringify({ action: 'start_onboarding'")
  assert.ok(settle > 0 && greet > settle, 'the wait must come before the greeting request')
  assert.ok(page.includes('    membershipSettledRef.current = (async () => {\n'))
  // Finishing setup: a member to the member chat with the routine request ready; anyone else to membership.
  assert.ok(page.includes("      router.push(isMember === true ? `/yuri?ask=${encodeURIComponent(FIRST_MEMBER_ASK)}` : '/subscribe?from=onboarding')\n"))
  // The server records where they agreed, and the email says how the week started.
  const route = read('src/app/api/stripe/checkout/route.ts')
  assert.ok(route.includes("termsShown: parsed.data.terms_shown === 'signup' ? 'signup' : 'membership_page', timezone: validTimeZone(parsed.data.timezone) })"))
  assert.ok(read('src/app/(legal)/terms/page.tsx').includes('starting when you create your account, or, if it did not start then, when you start it on our membership page'))
  // The banner looks again when the week starts under it.
  assert.ok(read('src/components/layout/TrialNotice.tsx').includes("window.addEventListener('ss:trial-changed', onChange)"))
  assert.ok(page.includes("window.dispatchEvent(new Event('ss:trial-changed'))"))
})

test('closed world: below desktop width the landing page has ONE sign-up button, the bar, always shown', () => {
  // Bailey, Nov 16 2026: "there's just a lot of create your free account... do we
  // need all the others then?" The first answer hid the bar while another button
  // was on screen. Nov 20 she circled each in-page button and wrote "Erase".
  //
  // NOT EXECUTED here: this pins the source. The rendered count is checked in a
  // real browser by scripts/count-landing-signup-buttons.cjs. A second-model
  // review got six wrong versions past the first form of this test (the bar on
  // scroll again, a hardcoded /register link, a /subscribe link, `hidden` on the
  // bar, the menu link at every width, a margin cancelling the padding), so each
  // thing below is pinned whole or counted closed-world.
  const home = read('src/components/home/HomeClient.tsx')
  const card = read('src/components/pricing/PricingCards.tsx')
  const intro = read('src/components/widget/GatedYuriIntro.tsx')
  const count = (s, needle) => s.split(needle).length - 1

  // WHEN the bar shows. Closed: for a visitor with no sign-in, with no scroll rule.
  assert.ok(home.includes("  const showStickyCTA = LANDING_CHAT_OPEN ? openChatBarShown : signedOut\n"))
  assert.equal(count(home, 'showStickyCTA'), 2, 'defined once, used once')
  assert.equal(count(home, 'setSignedOut('), 2, 'set from the session read, and from its failure')
  assert.ok(home.includes("      .then(({ data }) => { if (!cancelled) setSignedOut(!data.session) })\n"))
  assert.ok(home.includes("    if (!LANDING_CHAT_OPEN) return\n"), 'the scroll rule belongs to the open chat only')
  // The bar's own element, whole: below lg, fixed to the bottom, moved only by showStickyCTA.
  assert.ok(home.includes("<div className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-seoul-dark/95 backdrop-blur-md border-t border-gold/20 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 ${showStickyCTA ? 'translate-y-0' : 'translate-y-full'}`} id=\"mobile-sticky-cta\">"))
  // The page leaves room for it, and nothing else on the root line takes that room back.
  assert.ok(home.includes("    <div className={`min-h-screen bg-seoul-dark font-sans${LANDING_CHAT_OPEN ? '' : ' pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0'}`}>\n"))

  // WHICH sign-up links exist. Every one goes through a helper; none is written by hand.
  const calls = [...home.matchAll(/(gatedSignupHref|signupHref)\(([^)]*)\)/g)].map((m) => `${m[1]}(${m[2]})`)
  assert.deepEqual(calls, [
    "gatedSignupHref(source, '')",          // signupHref's own definition
    "signupHref('nav')",
    "signupHref('menu')",
    "gatedSignupHref(arrivalSource || 'sticky', '')",
    "signupHref('final_cta')",
  ])
  // Every quoted sign-up or membership address in the file: signupHref's open-chat
  // address, and the open chat's selector for other buttons. No link is written by hand.
  assert.deepEqual([...home.matchAll(/['"`]\/(?:register|subscribe)[^'"`]*['"`]/g)].map((m) => m[0]), ["'/register'", '"/register"'])
  assert.equal(count(home, 'data-sticky-signup'), 2, 'the bar, and that selector')
  // Every primary (gold) button on the page, in order, with what shows it below lg.
  const gold = [...home.matchAll(/^.*glass-button-primary.*$/gm)].map((m) => m[0].trim())
  assert.deepEqual(gold, [
    "<Link href={signupHref('nav')} className={`${LANDING_CHAT_OPEN ? 'hidden sm:inline-flex md:hidden lg:inline-flex' : 'hidden lg:inline-flex'} glass-button-primary text-sm py-2 px-5 whitespace-nowrap`}>",
    'className="sm:hidden mb-2 glass-button-primary text-sm py-2.5 px-3 text-center"',   // inside the menu a visitor opens
    '<Link href="#pricing" className="glass-button-primary text-sm py-3 px-6">',          // View Plans: not a sign-up
    'className="glass-button-primary w-full text-sm py-3"',                               // open chat's bar button
    'className="glass-button-primary w-full text-sm py-3 block text-center"',             // the bar
    "className={`${LANDING_CHAT_OPEN ? 'inline-flex' : 'hidden lg:inline-flex'} items-center gap-2 glass-button-primary text-base py-3.5 px-10`}",
  ])
  // The bar keeps what the card's button recorded: where they came from, and the click.
  assert.ok(home.includes('            <TryYuriSection variant="hero" onArrivalSource={setArrivalSource} />\n'))
  assert.ok(home.includes("onClick={() => trackEvent(DemoEvent.gateSignupClick, { source: arrivalSource || 'unknown', has_question: new URLSearchParams(window.location.search).has('ask'), position: 'bar' })}"))
  const widget = read('src/components/widget/TryYuriSection.tsx')
  assert.ok(widget.includes("    setArrivalSource(sourceRef.current)\n    onArrivalSource?.(sourceRef.current)\n"))

  // The pricing card's button and the note that refers to it: desktop only for a signed-out visitor.
  assert.ok(card.includes("  const phoneBarIsTheButton = !isAuthenticated && !LANDING_CHAT_OPEN\n"))
  assert.ok(card.includes("className={`${phoneBarIsTheButton ? 'hidden lg:block ' : ''}glass-button-primary w-full text-center text-sm py-3 disabled:opacity-50`}"))
  assert.ok(card.includes("{!isAuthenticated && <p className={`${phoneBarIsTheButton ? 'hidden lg:block ' : ''}text-center text-xs text-white/60 mt-3`}>{lines.accountNote}</p>}"))
  // Yuri's card: the box holding its button and the price sentence is desktop only, as one piece
  // (Bailey, Nov 20 2026: the sentence circled and marked "Erase" once the button was gone).
  assert.ok(intro.includes('      <div className="hidden lg:block bg-gold/5 rounded-2xl p-4 border border-gold/20 text-center">\n'))
  // The box comes LAST in the card, after the example. Between Yuri's greeting and the example it sat
  // in the middle of what reads as one chat (Bailey, Nov 20 2026: "why in middle?").
  const at = (needle) => { const i = intro.indexOf(needle); assert.ok(i > 0, needle); return i }
  assert.ok(at('I give my') < at('>{exampleTag}</p>') && at('>{exampleTag}</p>') < at('{example.messages.map(') && at('{example.messages.map(') < at('<div className="hidden lg:block bg-gold/5'), 'greeting, example, then the sign-up box')
  assert.ok(at("{question && (") < at('>{exampleTag}</p>'), "a visitor's own carried question stays next to Yuri's greeting")
  // The word that says it is an example comes BEFORE the exchange; only the description may follow it.
  assert.ok(at('>{exampleTag}</p>') < at('{example.messages.map(') && at('{example.messages.map(') < at('{exampleCaption}</p>'))
  assert.ok(intro.includes("  const exampleTag = colon > 0 ? example.label.slice(0, colon) : example.label\n"), 'a label with no colon is shown whole, above')
  assert.ok(intro.includes("  const exampleCaption = colon > 0 ? example.label.slice(colon + 2) : ''\n"))
  assert.equal(intro.split('{exampleTag}').length - 1, 1)
  assert.equal(intro.split('example.label').length - 1, 4, 'the label is only ever split in those three lines, never dropped or replaced')
  // Both illustrative labels start with the word, so it is what lands above the exchange.
  assert.match(read('src/components/widget/TryYuriSection.tsx'), /\? 'Example: a new member’s first session with Yuri'\s*: 'Example: Yuri with a subscriber she’s known for months',/)
  // Closed world: that line is the ONLY thing in the card that hides anything, by any means.
  const HIDES = /\b(hidden|invisible|sr-only|opacity-0|collapse|display:\s*["']?none|visibility)\b/g
  assert.deepEqual(intro.match(HIDES), ['hidden'], 'one switch for the whole box; the sentence cannot be hidden at every width another way')
  assert.equal(intro.split('widgetMembershipLine(percentOff)').length - 1, 1)
  // What an account starts and costs is still said before anyone creates one: on the sign-up form itself.
  const register = read('src/app/(auth)/register/page.tsx')
  assert.ok(register.includes('<p className="text-white/70 text-sm leading-relaxed mb-3">{registerFootnote(typedPercent ?? savedOffer.percentOff)}</p>'))
  // Closed world: nothing on the sign-up page hides anything, at any width, by any means. (A review
  // put a `hidden sm:block` wrapper a few lines above the sentence and the first form of this passed.)
  assert.equal(register.match(HIDES), null, 'the sign-up page must not hide any of its content')
  assert.equal(register.split('{registerFootnote(').length - 1, 1)
  // NOT EXECUTED here. scripts/count-landing-signup-buttons.cjs looks at the rendered pages.
})
