/**
 * Typing a creator code (Nov 16 2026).
 *
 * Why: once creating an account started the free week, a new person never met
 * the membership page, which had the only code box. Someone who heard "use
 * code BAILEY" in a video and came to the site directly, not by the creator's
 * link, had nowhere to enter it, and a card added later was charged full
 * price. Two places now take a code: the sign-up page, and the notice at the
 * top of the app during the free week.
 *
 * Executed here against fakes: the check before sign-up, and adding a code to
 * a running free week in every outcome, including "Stripe has it but our row
 * was not written".
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const transpile = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

async function load() {
  const dir = mkdtempSync(join(tmpdir(), 'ss-code-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  put('typed', read('src/lib/typed-code.ts').replace("from '@/lib/offers'", "from './offers.mjs'"))
  put('apply', read('src/lib/apply-offer.ts').replace("from '@/lib/offers'", "from './offers.mjs'"))
  const imp = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)).href)
  return { offers: await imp('offers'), typed: await imp('typed'), apply: await imp('apply') }
}

test('a code is not case sensitive, and stray spaces around it are ignored', async () => {
  const { offers: o } = await load()
  for (const typed of ['BAILEY', 'bailey', 'Bailey', '  bAiLeY ', 'bailey\n']) assert.equal(o.normalizeOfferCode(typed), 'BAILEY', JSON.stringify(typed))
  // Not a code: too short, too long, or anything but letters and numbers inside it.
  for (const bad of ['', 'ab', 'x'.repeat(21), 'BAI LEY', 'BAILEY!', 'BAI-LEY', null, undefined]) assert.equal(o.normalizeOfferCode(bad), null, JSON.stringify(bad))
})

test('executed: a code typed on the sign-up page is kept only when Stripe confirms it, and "saved" is said only if it was', async () => {
  const { typed, offers: o } = await load()
  const run = async (raw, answer, keeps = true) => {
    const asked = [], kept = []
    const fetcher = async (url) => { asked.push(url); if (answer === 'throw') throw new Error('offline'); return { ok: answer.status < 400, status: answer.status, json: async () => answer.body } }
    return [await typed.checkTypedCode(raw, fetcher, (c) => { kept.push(c); return keeps }), asked, kept]
  }
  const ACTIVE = { status: 200, body: { state: 'active', code: 'BAILEY', percent_off: 50, line: 'Code BAILEY applied: your first paid month is $4.99 instead of $9.99 (50% off), then $9.99/month.', saved_line: 'Code BAILEY is saved in this browser: 50% off your first paid month.' } }
  // Typed in lower case with a space: asked and kept in capitals. Nothing is
  // applied yet, so the sentence is "saved", never "applied".
  const [ok, asked, kept] = await run(' bailey ', ACTIVE)
  assert.deepEqual(ok, { ok: true, code: 'BAILEY', percentOff: 50, line: 'Code BAILEY is saved in this browser: 50% off your first paid month.' })
  assert.deepEqual(asked, ['/api/offer?code=BAILEY'])
  assert.deepEqual(kept, ['BAILEY'])
  assert.doesNotMatch(ok.line, /applied/)
  // The browser would not keep it (private mode): the discount is NOT stated, and they are told where to enter it after sign-up.
  const [blocked] = await run('BAILEY', ACTIVE, false)
  assert.deepEqual(blocked, { ok: false, line: 'Your browser would not save BAILEY, so it cannot be carried into sign-up. Create your account, then enter it with "Have a code?" at the top of the app.' })
  // With nothing injected, the real rememberOfferCode runs; outside a browser it keeps nothing and says so.
  assert.equal(o.rememberOfferCode('BAILEY'), false)
  assert.deepEqual(await typed.checkTypedCode('BAILEY', async () => ({ ok: true, status: 200, json: async () => ACTIVE.body })), { ok: false, line: o.codeNotSavedLine('BAILEY') })
  // Everything else: a sentence, and nothing is kept (a kept code that sign-up
  // cannot apply would stop the free week from starting over a typo).
  for (const [raw, answer, line] of [
    ['BAILEY', { status: 200, body: { state: 'ended', code: 'BAILEY', line: 'Code BAILEY is no longer available, so membership is $9.99/month.' } }, 'Code BAILEY is no longer available, so membership is $9.99/month.'],
    ['BALEY', { status: 200, body: { state: 'unknown' } }, o.codeNeedsHelpLine('BALEY')],
    ['annkorea', { status: 200, body: { state: 'unknown' } }, o.codeNeedsHelpLine('ANNKOREA')],
    ['BAILEY', { status: 429, body: {} }, o.codeTooManyTriesLine()],
    ['BAILEY', { status: 503, body: {} }, o.codeCheckFailedLine()],
    ['BAILEY', 'throw', o.codeCheckFailedLine()],
    ['BAILEY', { status: 200, body: { state: 'active', percent_off: '50', saved_line: 'x' } }, o.codeNeedsHelpLine('BAILEY')],
    ['BAILEY', { status: 200, body: { state: 'active', percent_off: 50, line: 'applied' } }, o.codeNeedsHelpLine('BAILEY')],
    ['BAILEY', { status: 200, body: null }, o.codeNeedsHelpLine('BAILEY')],
  ]) {
    const [r, , k] = await run(raw, answer)
    assert.deepEqual(r, { ok: false, line }, `${raw} ${JSON.stringify(answer)}`)
    assert.deepEqual(k, [], 'not kept')
  }
  // Not a code at all: Stripe is not even asked.
  const [shape, none] = await run('bai ley!', ACTIVE)
  assert.deepEqual(shape, { ok: false, line: o.codeShapeLine() })
  assert.deepEqual(none, [])
  // What an unrecognised code is told: it may be a typo or a code we gave them; it is not called wrong.
  assert.equal(o.codeNeedsHelpLine('BALEY'), 'We could not apply BALEY here. Check the spelling. If Seoul Sister gave you this code directly, email team@seoulsister.com and we will apply it for you.')
  assert.doesNotMatch(o.codeNeedsHelpLine('X'), /invalid|does not exist|wrong|not a real/i, 'it must not say whether such a code exists')
  assert.ok(read('src/lib/contact.ts').includes("export const CONTACT_EMAIL = 'team@seoulsister.com'"), 'the address in that sentence is the one that reaches a person')
  // The limits run for an hour, and the sentence says an hour.
  assert.equal(o.codeTooManyTriesLine(), 'Too many tries. Please try the code again in an hour.')
})

/** A fake database holding this member's subscription row and ledger row, and another member's. */
function fakeDb(sub, fail = {}) {
  const tables = {
    ss_subscriptions: [...(sub ? [{ id: 'row1', user_id: 'u1', ...sub }] : []), { id: 'row2', user_id: 'u2', status: 'trialing', stripe_subscription_id: 'sub_other', offer_code: null, offer_percent_off: null }],
    ss_trial_starts: [{ stripe_subscription_id: sub?.stripe_subscription_id ?? 'x', offer_code: null, offer_percent_off: null }, { stripe_subscription_id: 'sub_other', offer_code: null, offer_percent_off: null }],
  }
  const writes = []
  return {
    tables, writes,
    from(table) {
      const filters = []
      const q = {
        select: () => q,
        eq(c, v) { filters.push((r) => r[c] === v); return q },
        maybeSingle: () => Promise.resolve(fail[`read:${table}`] ? { data: null, error: { message: 'boom' } } : { data: tables[table].find((r) => filters.every((f) => f(r))) ?? null, error: null }),
        update(values) {
          const uf = []
          const run = () => {
            // A named failure can be limited to one kind of write: "claim" (sets offer_code only) or "stamp" (sets the percent).
            const kind = 'offer_percent_off' in values ? 'stamp' : values.offer_code === null ? 'release' : 'claim'
            if (fail[`write:${table}`] === true || fail[`write:${table}`] === kind) return { data: null, error: { message: 'boom' } }
            const hit = tables[table].filter((r) => uf.every((f) => f(r)))
            for (const r of hit) Object.assign(r, values)
            writes.push([table, kind, hit.length])
            return { data: hit.map((r) => ({ id: r.id })), error: null }
          }
          const u = {
            eq(c, v) { uf.push((r) => r[c] === v); return u },
            is(c, v) { uf.push((r) => (r[c] ?? null) === v); return u },
            select: () => Promise.resolve(run()),
            then: (done) => done(run()),
          }
          return u
        },
      }
      return q
    },
  }
}
const NOW = Date.parse('2026-11-18T00:00:00Z')
const IN_WEEK = { status: 'trialing', trial_end: '2026-11-23T00:00:00Z', stripe_subscription_id: 'sub_1', offer_code: null, offer_percent_off: null }
const ACTIVE_OFFER = { state: 'active', code: 'BAILEY', promotionCodeId: 'promo_1', percentOff: 50 }
const LIVE = { status: 'trialing', cancelling: false, discount: null }

test('executed: adding a code during the free week, in every outcome', async () => {
  const { apply, offers: o } = await load()
  const run = async (raw, sub, { offer = ACTIVE_OFFER, stripe = 'applied', live = LIVE, fail = {} } = {}) => {
    const db = fakeDb(sub, fail)
    const calls = []
    const result = await apply.applyCodeToFreeWeek(db, 'u1', raw, {
      resolve: async (c) => { calls.push(['resolve', c]); if (offer === 'throw') throw new Error('stripe down'); return offer },
      readFreeWeek: async (s) => { calls.push(['read', s]); if (live === 'throw') throw new Error('stripe down'); return live },
      applyToFreeWeek: async (s, p) => { calls.push(['apply', s, p]); if (stripe === 'throw') throw new Error('promotion code used up'); return stripe },
      now: NOW,
    })
    return { result, db, calls, mine: db.tables.ss_subscriptions.find((r) => r.user_id === 'u1'), other: db.tables.ss_subscriptions.find((r) => r.user_id === 'u2') }
  }

  // The ordinary case, typed in lower case. Stripe is read first, then the code checked, then applied.
  const good = await run('bailey', IN_WEEK)
  assert.deepEqual(good.result, { ok: true, code: 'BAILEY', percentOff: 50, line: 'Code BAILEY applied: your first paid month is $4.99 instead of $9.99 (50% off), then $9.99/month.' })
  assert.deepEqual(good.calls, [['read', 'sub_1'], ['resolve', 'BAILEY'], ['apply', 'sub_1', 'promo_1']])
  assert.deepEqual([good.mine.offer_code, good.mine.offer_percent_off], ['BAILEY', 50])
  assert.deepEqual([good.db.tables.ss_trial_starts[0].offer_code, good.db.tables.ss_trial_starts[0].offer_percent_off], ['BAILEY', 50])
  assert.deepEqual([good.other.offer_code, good.db.tables.ss_trial_starts[1].offer_code], [null, null], 'another member is untouched')

  // Refused on our own record, before Stripe is asked anything.
  for (const [label, raw, sub, line, status] of [
    ['not a code', 'bai ley', IN_WEEK, o.codeShapeLine(), 400],
    ['not a string', 12345, IN_WEEK, o.codeShapeLine(), 400],
    ['no subscription', 'BAILEY', null, o.codeNotInFreeWeekLine(), 409],
    ['paying, not in a free week', 'BAILEY', { ...IN_WEEK, status: 'active' }, o.codeNotInFreeWeekLine(), 409],
    ['free week over', 'BAILEY', { ...IN_WEEK, trial_end: '2026-11-17T23:59:59Z' }, o.codeNotInFreeWeekLine(), 409],
    ['cancelled row', 'BAILEY', { ...IN_WEEK, status: 'canceled' }, o.codeNotInFreeWeekLine(), 409],
  ]) {
    const r = await run(raw, sub)
    assert.deepEqual(r.result, { ok: false, status, line }, label)
    assert.deepEqual(r.calls, [], `${label}: Stripe was not asked`)
    assert.deepEqual(r.db.writes, [], label)
  }
  // Refused on what Stripe holds, before the code is even looked up (no place is spent, nothing written).
  for (const [label, sub, live, line] of [
    ['Stripe says it is no longer a free week', IN_WEEK, { ...LIVE, status: 'active' }, o.codeNotInFreeWeekLine()],
    ['the member cancelled: it stops at the end of the week', IN_WEEK, { ...LIVE, cancelling: true }, 'Your membership is set to stop when the free week ends, so a code would not be used.'],
    ['our row already has a code', { ...IN_WEEK, offer_code: 'OTHER', offer_percent_off: 30 }, LIVE, 'Code OTHER is already on your membership.'],
    ['our row was claimed by another tab', { ...IN_WEEK, offer_code: 'OTHER' }, LIVE, 'Code OTHER is already on your membership.'],
  ]) {
    const r = await run('BAILEY', sub, { live })
    assert.deepEqual(r.result, { ok: false, status: 409, line }, label)
    assert.deepEqual(r.calls, [['read', 'sub_1']], label)
    assert.deepEqual(r.db.writes, [], label)
  }
  assert.deepEqual((await run('BAILEY', IN_WEEK, { live: 'throw' })).result, { ok: false, status: 503, line: o.codeCheckFailedLine() })

  // Stripe ALREADY has a code on, and our row does not know (a reply that
  // never arrived, a write that failed). Our rows are brought up to Stripe,
  // and the answer is about what is on: never "no longer available" to
  // someone who will in fact be charged the discounted price.
  const healed = await run('BAILEY', IN_WEEK, { live: { ...LIVE, discount: { code: 'BAILEY', percentOff: 50 } }, offer: { state: 'ended', code: 'BAILEY' } })
  assert.deepEqual(healed.result, { ok: true, code: 'BAILEY', percentOff: 50, line: o.offerAppliedLine('BAILEY', 50) })
  assert.deepEqual(healed.calls, [['read', 'sub_1']], 'neither looked up nor applied again')
  assert.deepEqual([healed.mine.offer_code, healed.mine.offer_percent_off], ['BAILEY', 50])
  const otherOn = await run('BAILEY', IN_WEEK, { live: { ...LIVE, discount: { code: 'SUMMER', percentOff: 30 } } })
  assert.deepEqual(otherOn.result, { ok: false, status: 409, line: 'Code SUMMER is already on your membership.' })
  assert.deepEqual(otherOn.calls, [['read', 'sub_1']])
  assert.deepEqual([otherOn.mine.offer_code, otherOn.mine.offer_percent_off], ['SUMMER', 30], 'the row now says what Stripe says')

  // Stripe's answer about the code itself.
  assert.deepEqual((await run('BAILEY', IN_WEEK, { offer: { state: 'ended', code: 'BAILEY' } })).result, { ok: false, status: 409, line: o.offerEndedLine('BAILEY') })
  assert.deepEqual((await run('BALEY', IN_WEEK, { offer: { state: 'unknown', code: 'BALEY' } })).result, { ok: false, status: 404, line: o.codeNeedsHelpLine('BALEY') })
  assert.deepEqual((await run('BAILEY', IN_WEEK, { offer: 'throw' })).result, { ok: false, status: 503, line: o.codeCheckFailedLine() })

  // Stripe would not take it: the claim is released, so the row is as it was and they can try again.
  for (const [stripe, line] of [['throw', 'Code BAILEY could not be applied just now. Nothing was changed. Please try again in a few minutes.'], ['not_in_free_week', o.codeNotInFreeWeekLine()], ['has_discount', o.codeAlreadyOnLine(null)]]) {
    const r = await run('BAILEY', IN_WEEK, { stripe })
    assert.deepEqual(r.result, { ok: false, status: 409, line }, stripe)
    assert.deepEqual([r.mine.offer_code, r.mine.offer_percent_off], [null, null], `${stripe}: released`)
    assert.deepEqual(r.db.writes.map((w) => w[1]), ['claim', 'release'], stripe)
  }
  assert.doesNotMatch(o.codeNotAppliedNowLine('BAILEY'), /button|\$9\.99/, 'the notice has no "continue without it" button')

  // The claim: only the request that takes an unclaimed row goes on to Stripe.
  const cantClaim = await run('BAILEY', IN_WEEK, { fail: { 'write:ss_subscriptions': 'claim' } })
  assert.deepEqual(cantClaim.result, { ok: false, status: 503, line: o.codeCheckFailedLine() })
  assert.deepEqual(cantClaim.calls.map((c) => c[0]), ['read', 'resolve'], 'Stripe was not asked to apply')
  // Our own read failing is not "no free week".
  assert.deepEqual((await run('BAILEY', IN_WEEK, { fail: { 'read:ss_subscriptions': true } })).result, { ok: false, status: 503, line: o.codeCheckFailedLine() })
  // Stripe HAS it and our percent could not be written: the charge will be discounted, so the member is told it was applied.
  const half = await run('BAILEY', IN_WEEK, { fail: { 'write:ss_subscriptions': 'stamp' } })
  assert.equal(half.result.ok, true)
  assert.equal(half.db.tables.ss_trial_starts[0].offer_code, 'BAILEY', 'the ledger row is still written')
})

test('wiring: the two places a code can be typed, and the Stripe rule', () => {
  const register = read('src/app/(auth)/register/page.tsx')
  // Shown only while no code is on, and the sentence above it follows the code just typed.
  assert.ok(register.includes('{registerFootnote(typedPercent ?? savedOffer.percentOff)}'))
  assert.ok(register.includes('        {(typedPercent ?? savedOffer.percentOff) == null ? (\n          <CodeField'))
  assert.ok(register.includes('              const r = await checkTypedCode(raw)\n              if (r.ok) {\n                setTypedPercent(r.percentOff)\n                setTypedLine(r.line)\n'))
  const notice = read('src/components/layout/TrialNotice.tsx')
  assert.ok(notice.includes('    (facts.percent_off ?? null) === null ? (\n      <CodeField onApply={applyCode} className="mt-1" />\n    ) : codeLine ? (\n'))
  // The confirming sentence outlives the field, which closes once a code is on (seen in a browser: it vanished).
  assert.ok(notice.includes('    if (ok) setCodeLine(line)\n'))
  assert.ok(register.includes('        ) : typedLine ? (\n          <p className="text-xs text-gold-light text-center mb-6" role="status">{typedLine}</p>\n'))
  assert.ok(notice.includes("    if (ok) window.dispatchEvent(new Event('ss:trial-changed'))\n"))
  assert.equal(notice.split('{codeField}').length - 1, 2, 'with a card on file, and without one; not once cancelled')
  // The field is closed until asked for and states nothing of its own.
  const field = read('src/components/offers/CodeField.tsx').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(field.includes('  const [open, setOpen] = useState(false)\n'))
  assert.doesNotMatch(field, /\$\d|% off|spots?|left|hurry|limited/i)
  // The endpoint: signed in, limited per account, and Stripe decides.
  const route = read('src/app/api/me/offer-code/route.ts')
  assert.ok(route.includes("    const limit = await checkRateLimit(`offer-apply:${user.id}`, 10, 60 * 60 * 1000)\n"))
  assert.ok(route.includes('{ resolve: resolveOffer, readFreeWeek: readFreeWeekDiscount, applyToFreeWeek: applyPromotionToFreeWeek }'))
  // Cancelling is read from Stripe: at the period end, or at a set date.
  assert.ok(read('src/lib/stripe.ts').includes('    cancelling: sub.cancel_at_period_end === true || sub.cancel_at != null,\n'))
  // The row is claimed only while it has no code, which is what stops two tabs putting on two.
  assert.match(read('src/lib/apply-offer.ts'), /\.update\(\{ offer_code: offer\.code \}\)\s*\.eq\('user_id', userId\)\s*\.eq\('stripe_subscription_id', subscriptionId\)\s*\.is\('offer_code', null\)\s*\.select\('id'\)/)
  // A code goes only onto a subscription still in its free week with no discount on it.
  const stripe = read('src/lib/stripe.ts')
  assert.match(stripe, /if \(sub\.status !== 'trialing'\) return 'not_in_free_week'\n  if \(sub\.discount\) return 'has_discount'\n  await stripe\.subscriptions\.update\(subscriptionId, \{ promotion_code: promotionCodeId \}\)\n  return 'applied'/)
  // Never how many are left, on either surface.
  for (const f of ['src/lib/apply-offer.ts', 'src/lib/typed-code.ts', 'src/app/api/me/offer-code/route.ts']) assert.doesNotMatch(read(f), /times_redeemed|max_redemptions|remaining/, f)
})
