/**
 * Funnel repair, Nov 10 2026: every promise on the path from the free chat to a
 * card is tied here to the code that makes it true.
 *
 * WHY. Two design reviews (Opus 5.5 and Fable 5.2) found the path contradicting
 * itself: the landing page offered "Build me a routine on a budget" while Yuri
 * was told not to deliver one; the paywall said "I've built your skin profile
 * and your first routine" when onboarding builds no routine; the onboarding
 * button said "See My Personalized Recommendations" and led to the payment
 * page; and Yuri had no fact telling her that an account and setup are free.
 *
 * Where the defect is logic, the real function is executed (transpiled). Where
 * it is wording, the assertion is scoped to the element's own text.
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
const read = (p) => readFileSync(join(root, p), 'utf8')

async function load(rel, name) {
  const js = ts.transpileModule(read(rel), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-funnel-'))
  const file = join(dir, `${name}.mjs`)
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

const widget = read('src/components/widget/TryYuriSection.tsx')
const surface = read('src/lib/widget/subscriber-surface.ts')
const route = read('src/app/api/widget/chat/route.ts')
const subscribe = read('src/app/(auth)/subscribe/page.tsx')
const onboardingPage = read('src/app/(app)/onboarding/page.tsx')
const onboardingPrompt = read('src/lib/yuri/onboarding.ts')
const register = read('src/app/(auth)/register/page.tsx')
const checkout = read('src/app/api/stripe/checkout/route.ts')
const home = read('src/components/home/HomeClient.tsx')

/** The path paragraph inside the subscriber-surface block. */
function pathParagraph() {
  const para = surface.split('\n').find((l) => l.startsWith('If a visitor asks how to continue or what it costs'))
  assert.ok(para, 'the path paragraph must exist in the subscriber-surface block')
  return para
}

/**
 * CLOSED WORLD. The paragraph is exactly these sentences, in this order, and
 * nothing else. A ban list cannot see an ADDED sentence: in review (Nov 10
 * 2026) "Members also get a board-certified dermatologist review within 24
 * hours, and most visitors who get this far start the trial the same day" was
 * appended and every test still passed. Adding or changing a sentence now means
 * editing this list, which is the moment to ask whether it is true.
 */
const PATH_SENTENCES = [
  'If a visitor asks how to continue or what it costs, these are the facts.',
  'An account is free and needs no card.',
  'It opens a free setup chat with you, and if they sign up in this browser and confirm the preview was theirs, you will have it in front of you there.',
  'Membership is ${PRICING.monthly_display_long} and includes ${PRICING.yuri_allowance_display}.',
  "A first-time member's first ${PRICING.trial_days} days are free, and a card is needed to start them.",
  'The complete routine is built after they become a member, and it is the first thing offered to them then.',
  'It is not built during setup.',
  'The link under this chat is where an account starts.',
  'Mentioning the account, the link or the price counts toward the frequency note below.',
]

// ---------------------------------------------------------------------------
// The landing page must not offer what the preview does not hand over.
// ---------------------------------------------------------------------------
test('no quick prompt is a request for a routine build (executes the real detector)', async () => {
  const { detectBuildRequest } = await load('src/lib/widget/cumulative-give.ts', 'give')
  const m = widget.match(/const QUICK_PROMPTS = \[([\s\S]*?)\n\]/)
  assert.ok(m, 'QUICK_PROMPTS not found')
  const prompts = [...m[1].matchAll(/^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),?\s*$/gm)].map((x) => x[1] ?? x[2])
  assert.equal(prompts.length, 4, `expected 4 quick prompts, parsed ${prompts.length}`)
  for (const p of prompts) {
    const r = detectBuildRequest(p)
    assert.ok(!r.asked && !r.fullDay, `quick prompt invites the one thing the preview holds for members: ${JSON.stringify(p)}`)
  }
})

test('the hero does not say the routine is built in the free chat', () => {
  assert.doesNotMatch(home, /then builds a routine that fits/, 'the hero promised a routine with no mention of membership')
  assert.match(home, /Members get a routine built around all of it/, 'the routine must be named as what members get')
})

// ---------------------------------------------------------------------------
// The widget prompt must not carry instructions that contradict the gate.
// ---------------------------------------------------------------------------
test('the "best general version" guardrail no longer covers a personalized routine', () => {
  const line = route.split('\n').find((l) => l.includes('give the best general version you can'))
  assert.ok(line, 'guardrail line not found')
  assert.doesNotMatch(line, /routine|conflicts/i, 'this line told Yuri to give a general routine/conflict read while the gate placed both elsewhere')
  assert.match(route, /Do NOT deliver that complete blueprint in the preview/, 'the gate itself must still be there')
})

// ---------------------------------------------------------------------------
// Yuri's path facts: each one is true in code, and none is a command.
// ---------------------------------------------------------------------------
test('CLOSED WORLD: the path paragraph is exactly the approved sentences', () => {
  assert.equal(pathParagraph(), PATH_SENTENCES.join(' '))
  assert.match(surface, /import \{ PRICING \} from '@\/lib\/pricing'/)
  // Price, allowance and trial length come from pricing.ts, never a typed number.
  assert.doesNotMatch(pathParagraph(), /\$\d|\b\d+\s+(days|messages)\b/)
})

test('path facts are conditional and counted, not a pitch delivered every turn', () => {
  assert.match(PATH_SENTENCES[0], /^If a visitor asks/)
  assert.match(PATH_SENTENCES.at(-1), /counts toward the frequency note/)
  assert.match(surface, /one or two replies, not most of them/, 'the frequency note it points at must exist')
  assert.match(surface, /it changes nothing about when, or whether, to say it/)
})

test('path fact "free, no card": registration and the setup chat never start a checkout', () => {
  assert.doesNotMatch(register, /api\/stripe\/checkout/, 'registration must not start a checkout')
  assert.doesNotMatch(onboardingPage, /api\/stripe\/checkout/, 'the setup chat must not start a checkout')
  assert.match(register, /router\.push\('\/onboarding'\)/, 'sign-up must lead to the free setup chat, not the paywall')
})

test('path fact "first-time member": matches the checkout rule and the Stripe session', () => {
  assert.match(checkout, /const withTrial = !priorSub/, 'the checkout rule the claim rests on')
  assert.match(read('src/lib/stripe.ts'), /trial_period_days/, 'the trial must actually be set on the Stripe session')
})

test('path fact "sign up in this browser and confirm": that is how the carryover works', () => {
  assert.match(onboardingPage, /CarryoverPrompt/, 'the confirmation step must exist')
  assert.match(onboardingPage, /widget_visitor_id: consentedVisitorId\(userId\)/, 'the preview is sent only after consent')
})

test('path fact "not built during setup, first thing offered to a member"', () => {
  assert.match(onboardingPrompt, /The complete build is the subscriber side of Seoul Sister and is not delivered here/)
  // A buyer returning from Stripe with setup done lands in Yuri with the request prefilled.
  assert.match(
    onboardingPage,
    /justPaidRef\.current\s*\?\s*`\/yuri\?ask=\$\{encodeURIComponent\(FIRST_MEMBER_ASK\)\}`\s*:\s*'\/dashboard'/,
    'a just-paid member whose setup is complete must land on the routine request, not the dashboard'
  )
  assert.match(onboardingPage, /const FIRST_MEMBER_ASK = "[^"]*routine[^"]*"/)
})

test('just-paid is set only for a real Stripe return, and the URL is cleaned before any redirect can race it', () => {
  // Order matters, so assert ORDER. Review moved `justPaidRef.current = true`
  // above the session check (every returning user then went to /yuri?ask) and
  // a source-presence test still passed.
  const guard = onboardingPage.indexOf("if (!sessionId) return")
  const flag = onboardingPage.indexOf('justPaidRef.current = true')
  const clean = onboardingPage.indexOf("window.history.replaceState({}, '', '/onboarding')")
  const confirm = onboardingPage.indexOf("await fetch('/api/stripe/confirm'")
  assert.ok(guard > 0 && flag > guard, 'the flag must come AFTER the session-id guard')
  assert.ok(clean > flag && clean < confirm, 'the URL must be cleaned synchronously, BEFORE the confirm fetch: cleaning it after wiped the prefilled ?ask= on /yuri')
  assert.equal(onboardingPage.split("window.history.replaceState({}, '', '/onboarding')").length - 1, 1, 'no second, late URL rewrite')
  assert.equal(onboardingPage.split('justPaidRef.current = true').length - 1, 1)
})

test('path fact "the link under this chat": it exists, is a real tap target, and yields to the email gate', () => {
  const at = widget.indexOf('href="/register?plan=monthly&from=widget_chat"')
  assert.ok(at > 0, 'the under-chat link must exist')
  const gate = widget.lastIndexOf('{!isAtLimit && showLive', at)
  const cond = widget.slice(gate, at)
  assert.match(cond, /!emailGateActive/, 'must not compete with the email ask: the recap email is the only thing that has converted anyone')
  assert.match(cond, /messages\.some\(\(m\) => m\.role === 'assistant' && !m\.isStreaming\)/, 'shown once Yuri has answered')
  const link = widget.slice(at, at + 400)
  assert.match(link, /text-xs py-2/, 'its own padded line: 10px inline text failed the tap-target minimum')
  assert.match(link, /Create a free account and pick this up with Yuri\. No card needed\./)
})

// ---------------------------------------------------------------------------
// Nothing on the path claims a routine or recommendations that do not exist.
// ---------------------------------------------------------------------------
test('no screen claims a routine was built before membership', () => {
  for (const [name, src] of [['subscribe', subscribe], ['register', register], ['onboarding page', onboardingPage]]) {
    // Strip comments: the history of the false claim is recorded in them.
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
    assert.doesNotMatch(code, /built your skin profile and your first routine/i, `${name}: false claim is back`)
    assert.doesNotMatch(code, /builds your skin profile and first routine/i, `${name}: false claim is back`)
    assert.doesNotMatch(code, /See My Personalized Recommendations/, `${name}: the button led to the payment page, not to recommendations`)
  }
})

test('the paywall button claims a trial only when the user is known to be eligible', () => {
  assert.match(subscribe, /trialEligible === true \? `Start \$\{PRICING\.trial_days\} days free` : 'Start membership'/)
  assert.match(subscribe, /setTrialEligible\(\(subRes\.data \?\? \[\]\)\.length === 0\)/, 'eligible = no subscription history, the checkout rule')
  // A failed read must leave it unknown, never eligible.
  assert.match(subscribe, /useState<boolean \| null>\(null\)/)
  assert.match(subscribe, /if \(subRes\.error\) \{\s*console\.error/)
})

test('the paywall claims Yuri has their profile only when rows exist to show', () => {
  assert.match(subscribe, /const hasProfile = rows\.length > 0/)
  assert.match(subscribe, /\{hasProfile\s*\?\s*"I have what I need from our setup chat\./)
})

// ---------------------------------------------------------------------------
// The on-file card is data display: stated values only (executes the function).
// ---------------------------------------------------------------------------
test('on-file rows: an empty or missing profile shows nothing', async () => {
  const { onFileRows } = await load('src/lib/paywall/on-file.ts', 'onfile')
  assert.deepEqual(onFileRows(null), [])
  assert.deepEqual(onFileRows({}), [])
  assert.deepEqual(onFileRows({ skin_concerns: [], current_routine: ['  '], allergies: [] }), [])
})

test('on-file rows: only what was captured, never medical history, age or a skin-tone estimate', async () => {
  const { onFileRows } = await load('src/lib/paywall/on-file.ts', 'onfile2')
  const rows = onFileRows({
    skin_type: 'combination',
    skin_concerns: ['acne', 'dark spots'],
    age_range: '25-30',
    fitzpatrick_scale: 3,
    fitzpatrick_source: 'estimated',
    climate: 'humid',
    location_text: 'Austin, TX',
    current_routine: ['a', 'b', 'c', 'd', 'e', 'f'],
    allergies: ['fragrance'],
    medical_history: ['skin cancer history'],
    sun_history: ['burns easily'],
  })
  const text = JSON.stringify(rows)
  assert.match(text, /combination/)
  assert.match(text, /Austin, TX/)
  assert.doesNotMatch(text, /humid/, 'a stated location replaces the climate bucket')
  assert.match(text, /a, b, c, d and 2 more/)
  assert.doesNotMatch(text, /cancer|25-30|fitzpatrick|burns easily|"3"/i, 'clinical and sensitive fields stay off the paywall')
  const src = read('src/lib/paywall/on-file.ts')
  assert.doesNotMatch(src, /(\|\||\?\?)\s*['"`]/, 'no default values: unknown must stay absent')
})

// ---------------------------------------------------------------------------
// Each step leaves a row, and a missing row means "did not happen".
// ---------------------------------------------------------------------------
/** PostgREST-shaped fake so the REAL stamp function is executed. */
function fakeVisitors(row, { failWrite = false } = {}) {
  const log = { updates: [] }
  const db = {
    from(table) {
      assert.equal(table, 'ss_widget_visitors')
      const eq = []
      const q = {
        select: () => q,
        eq(c, v) { eq.push([c, v]); return q },
        maybeSingle: () => Promise.resolve({ data: row && eq.every(([c, v]) => row[c] === v) ? row : null, error: null }),
        update(values) {
          const u = { values, eq: [], is: [] }
          const uq = {
            eq(c, v) { u.eq.push([c, v]); return uq },
            is(c, v) {
              u.is.push([c, v])
              if (failWrite) return Promise.resolve({ error: { message: 'boom' } })
              log.updates.push(u)
              return Promise.resolve({ error: null })
            },
          }
          return uq
        },
        insert() { throw new Error('must never insert a visitor') },
        upsert() { throw new Error('must never upsert a visitor') },
      }
      return q
    },
  }
  return { db, log }
}

test('register click (executed): stamps an existing visitor once, with their message count', async () => {
  const { stampRegisterClick } = await load('src/lib/widget/register-click.ts', 'regclick')
  const V = '11111111-2222-3333-4444-555555555555'
  const { db, log } = fakeVisitors({ visitor_id: V, register_clicked_at: null, total_messages: 5 })
  assert.equal(await stampRegisterClick(db, V, '2026-11-10T00:00:00Z'), 'recorded')
  assert.equal(log.updates.length, 1)
  assert.deepEqual(log.updates[0].values, { register_clicked_at: '2026-11-10T00:00:00Z', register_click_messages: 5 })
  assert.deepEqual(log.updates[0].eq, [['visitor_id', V]], 'the update must target THIS visitor by visitor_id')
  assert.deepEqual(log.updates[0].is, [['register_clicked_at', null]], 'set-once')
})

test('register click (executed): never creates a visitor, never re-stamps, and a failed write is an error', async () => {
  const { stampRegisterClick } = await load('src/lib/widget/register-click.ts', 'regclick2')
  const V = '11111111-2222-3333-4444-555555555555'
  const unknown = fakeVisitors(null)
  assert.equal(await stampRegisterClick(unknown.db, V, 'now'), 'unknown_visitor')
  assert.equal(unknown.log.updates.length, 0, 'a crawler following the link must not mint or stamp anything')
  const again = fakeVisitors({ visitor_id: V, register_clicked_at: '2026-11-01T00:00:00Z', total_messages: 9 })
  assert.equal(await stampRegisterClick(again.db, V, 'now'), 'already')
  assert.equal(again.log.updates.length, 0, 'the FIRST click stays on record')
  const broken = fakeVisitors({ visitor_id: V, register_clicked_at: null, total_messages: 1 }, { failWrite: true })
  assert.equal(await stampRegisterClick(broken.db, V, 'now'), 'error', '"write failed" must not look like "no click"')
})

test('register click: the route is rate limited and both chat links record the click', () => {
  const src = read('src/app/api/widget/register-click/route.ts')
  assert.match(src, /checkRateLimit\(`widget-register-click:\$\{ip\}`/)
  assert.match(src, /if \(outcome === 'error'\) return NextResponse\.json\(\{ ok: false \}, \{ status: 500 \}\)/)
  assert.equal((widget.match(/onClick=\{recordRegisterClick\}/g) || []).length, 2, 'both sign-up links in the chat must record the click')
  // The client helper must send only when a visitor id exists.
  assert.match(widget, /const visitorId = getExistingVisitorId\(\)\n\s*if \(!visitorId\) return\n/)
})

test('the limit card body is exactly the approved text (no routine promised at the free step)', () => {
  // Review appended "and I\'ll sketch your full routine in setup" to this card
  // and every test passed. Pin the whole body.
  const start = widget.indexOf('{isAtLimit && (')
  const body = widget.slice(start, start + 2000).match(/<p className="text-xs text-white\/50 mb-3">([\s\S]*?)<\/p>/)
  assert.ok(body, 'limit card body not found')
  assert.equal(
    body[1].replace(/\s+/g, ' ').trim(),
    'Sign up on this device and we pick up where we left off: I&apos;ll have this conversation in front of me when we set up your account, so you won&apos;t be starting from scratch. The account and the setup chat are free, no card. Once you&apos;re a member I build your routine and adjust it as your skin responds.'
  )
  const card = widget.slice(start, start + 2000)
  assert.match(card, /Create my free account/)
  assert.match(card, /Membership is \{PRICING\.monthly_display\}\. New members get the first \{PRICING\.trial_days\} days free\./)
})

test('the paywall claims "I have what I need" only for a FINISHED setup', () => {
  assert.match(subscribe, /\.select\('skin_profile_data, onboarding_status'\)/)
  assert.match(subscribe, /progressRes\.data\?\.onboarding_status === 'completed'\s*\?/, 'mid-setup accounts also land on this page')
})

test('final message, under-13 and specialist facts match the new path', () => {
  assert.doesNotMatch(route, /unless they subscribe you will not remember them/, 'false since a free account carries the preview into setup')
  assert.match(route, /unless they create an account in this browser, which is free, this conversation is not carried forward/)
  assert.doesNotMatch(route, /already shows them the price and a button/, 'the button is now a free account, with the price under it')
  assert.match(route, /it needs an email address, so don\'t point an under-13 visitor to one/)
  assert.doesNotMatch(route, /naturally weave in ONE brief mention/, 'a per-turn instruction to mention the paid side drove the over-mention')
})

test('the gate says which side an owned shelf is on', () => {
  assert.match(route, /Reading a shelf they already own, saying what clashes, what to drop and what order those same products go in, is the give: it is the diagnosis\./)
  assert.match(route, /The build is what needs new picks for empty slots, a multi-week introduction schedule, and revising it as their skin responds\./)
  assert.doesNotMatch(route, /conflict-checking their whole lineup, and adjusting/, 'that clause contradicted "saying what clashes is the give"')
})

test('checkout start is stamped server-side, set-once, and never blocks checkout', () => {
  assert.match(checkout, /update\(\{ checkout_clicked_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]{0,120}\.is\('checkout_clicked_at', null\)/)
  assert.match(checkout, /if \(stampErr\) console\.error/)
  const migration = read('supabase/migrations/20261110000001_funnel_step_stamps.sql')
  for (const col of ['register_clicked_at', 'register_click_messages', 'registered_user_id', 'registered_at', 'checkout_clicked_at']) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`), `migration must add ${col}`)
  }
})
