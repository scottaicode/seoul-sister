/**
 * No-card 7-day trial (Nov 10 2026).
 *
 * Until now the free trial needed a card: 29 accounts reached the payment page
 * and about 1 paid. The trial now starts with no card and Stripe ends it on its
 * last day unless the member adds one.
 *
 * WHY THESE TESTS EXECUTE CODE. The first version of this file was mostly
 * regexes over source text. A second-model review (Opus 5.5) wrote six clearly
 * wrong versions of the code and five of them passed: a trial counted as a paid
 * conversion, the end behaviour switched to 'create_invoice', a failed
 * eligibility lookup treated as eligible (twice), "You will never be charged."
 * appended to the consent text, and the notice claiming a card it could not
 * see. So the rules, the Stripe parameters, the first-payment handler and the
 * notice's state are now run for real against fakes, and the outputs are
 * compared exactly.
 */
import { createHash as sha } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const transpile = (src) =>
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

/** Transpile the real modules into one temp dir with their imports rewired. */
async function loadModules(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ss-trial-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('email-normalize', read('src/lib/utils/email-normalize.ts'))
  put(
    'trial',
    read('src/lib/trial.ts')
      .replace("from '@/lib/utils/email-normalize'", "from './email-normalize.mjs'")
      .replace("from '@/lib/pricing'", "from './pricing.mjs'")
  )
  put('trial-events', read('src/lib/trial-events.ts').replace("from '@/lib/trial'", "from './trial.mjs'"))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  put(
    'stripe-params',
    read('src/lib/stripe-params.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'")
  )
  put('funnel', read('src/lib/proactive/campaign-funnel.ts'))
  const saved = { ...process.env }
  Object.assign(process.env, env)
  const load = (name) => import(pathToFileURL(join(dir, `${name}.mjs`)).href)
  return {
    trial: await load('trial'),
    events: await load('trial-events'),
    params: await load('stripe-params'),
    funnel: await load('funnel'),
    offers: await load('offers'),
    restore: () => { process.env = saved },
  }
}

/**
 * PostgREST-shaped fake. `tables` are arrays that updates really mutate, so a
 * second call sees the first call's effect (that is what makes "exactly once"
 * testable). `fail[table]` makes every query on that table error.
 */
function fakeDb(tables = {}, fail = {}) {
  const log = []
  const db = {
    log,
    tables,
    from(table) {
      const filters = []
      const match = (r) => filters.every((f) => f(r))
      const err = () => ({ data: null, error: { message: `${table} boom` } })
      const q = {
        select: () => q,
        eq(c, v) { filters.push((r) => r[c] === v); return q },
        is(c, v) { filters.push((r) => (r[c] ?? null) === v); return q },
        gte(c, v) { filters.push((r) => r[c] >= v); return q },
        limit(n) {
          if (fail[table]) return Promise.resolve(err())
          return Promise.resolve({ data: (tables[table] ?? []).filter(match).slice(0, n), error: null })
        },
        maybeSingle() {
          if (fail[table]) return Promise.resolve(err())
          return Promise.resolve({ data: (tables[table] ?? []).filter(match)[0] ?? null, error: null })
        },
        upsert(values, opts) {
          log.push({ table, op: 'upsert', values, opts })
          if (fail[table]) return Promise.resolve({ error: { message: 'boom' } })
          const key = opts?.onConflict
          const rows = (tables[table] ??= [])
          if (!(key && opts.ignoreDuplicates && rows.some((r) => r[key] === values[key]))) rows.push({ ...values })
          return Promise.resolve({ error: null })
        },
        update(values) {
          const uf = []
          const run = () => {
            log.push({ table, op: 'update', values })
            if (fail[table]) return { data: null, error: { message: `${table} boom` } }
            const hit = (tables[table] ?? []).filter((r) => uf.every((f) => f(r)))
            for (const r of hit) Object.assign(r, values)
            return { data: hit.map((r) => ({ id: r.id })), error: null }
          }
          const uq = {
            eq(c, v) { uf.push((r) => r[c] === v); return uq },
            is(c, v) { uf.push((r) => (r[c] ?? null) === v); return uq },
            select() { return Promise.resolve(run()) },
            then(res, rej) { return Promise.resolve(run()).then(res, rej) },
          }
          return uq
        },
      }
      return q
    },
  }
  return db
}

const NOW = Date.parse('2026-11-10T12:00:00Z')
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString()

const webhook = read('src/app/api/stripe/webhook/route.ts')
const checkout = read('src/app/api/stripe/checkout/route.ts')
const stripe = read('src/lib/stripe.ts')

// ---------------------------------------------------------------------------
// One trial per person, a few per network (executed)
// ---------------------------------------------------------------------------
test('eligibility: a brand-new person gets the trial', async () => {
  const m = await loadModules()
  try {
    assert.deepEqual(await m.trial.checkTrialEligibility(fakeDb(), { id: 'u1', email: 'New.Person@gmail.com' }, { ipHash: 'net1', now: NOW }), { eligible: true })
  } finally { m.restore() }
})

test('eligibility: subscription history on the account rules it out', async () => {
  const m = await loadModules()
  try {
    const db = fakeDb({ ss_subscriptions: [{ id: 's1', user_id: 'u1' }] })
    assert.deepEqual(await m.trial.checkTrialEligibility(db, { id: 'u1', email: 'a@b.com' }), { eligible: false, reason: 'subscription_history' })
  } finally { m.restore() }
})

test('eligibility: deleting the account and registering again does NOT earn a second trial', async () => {
  const m = await loadModules()
  try {
    const db = fakeDb({ ss_trial_starts: [{ id: 't1', email_canonical: 'janedoe@gmail.com', user_id: 'deleted', started_at: daysAgo(40) }] })
    assert.deepEqual(
      await m.trial.checkTrialEligibility(db, { id: 'u2', email: 'Jane.Doe+skin@googlemail.com' }),
      { eligible: false, reason: 'trial_used' }
    )
    assert.deepEqual(await m.trial.checkTrialEligibility(db, { id: 'u3', email: 'someone@else.com' }), { eligible: true })
  } finally { m.restore() }
})

test('eligibility: the network cap counts trials that STARTED, inside the window, and nothing else', async () => {
  const m = await loadModules()
  try {
    const started = (n, ip, age) => ({ id: `t${n}`, email_canonical: `p${n}@x.com`, ip_hash: ip, started_at: daysAgo(age) })
    // Two recent trials from this network: a third person is still eligible.
    const two = fakeDb({ ss_trial_starts: [started(1, 'net1', 2), started(2, 'net1', 5)] })
    assert.deepEqual(await m.trial.checkTrialEligibility(two, { id: 'u9', email: 'new@x.com' }, { ipHash: 'net1', now: NOW }), { eligible: true })
    // Three: capped.
    const three = fakeDb({ ss_trial_starts: [started(1, 'net1', 2), started(2, 'net1', 5), started(3, 'net1', 9)] })
    assert.deepEqual(await m.trial.checkTrialEligibility(three, { id: 'u9', email: 'new@x.com' }, { ipHash: 'net1', now: NOW }), { eligible: false, reason: 'network_cap' })
    // Old trials and other networks do not count.
    const old = fakeDb({ ss_trial_starts: [started(1, 'net1', 31), started(2, 'net1', 45), started(3, 'net1', 60), started(4, 'net2', 1)] })
    assert.deepEqual(await m.trial.checkTrialEligibility(old, { id: 'u9', email: 'new@x.com' }, { ipHash: 'net1', now: NOW }), { eligible: true })
    assert.equal(m.trial.TRIAL_NETWORK_CAP, 3)
  } finally { m.restore() }
  // Button presses must not be what is counted: that charged a hesitant person
  // on a button that said "Start 7 days free".
  assert.doesNotMatch(checkout, /checkRateLimit/, 'the checkout must not count presses against the trial')
})

test('eligibility: any failed lookup is NOT eligible and says so (never a silent yes)', async () => {
  const m = await loadModules()
  try {
    for (const table of ['ss_subscriptions', 'ss_trial_starts']) {
      assert.deepEqual(
        await m.trial.checkTrialEligibility(fakeDb({}, { [table]: true }), { id: 'u1', email: 'a@b.com' }, { ipHash: 'n', now: NOW }),
        { eligible: false, reason: 'lookup_failed' },
        `${table} failure must not read as eligible`
      )
    }
  } finally { m.restore() }
  assert.match(checkout, /if \(!eligibility\.eligible && eligibility\.reason === 'lookup_failed'\) \{\s*return NextResponse\.json\(\{ error: 'Could not start checkout\. Please try again in a minute\.' \}, \{ status: 503 \}\)\s*\}\s*const withTrial = eligibility\.eligible\n/)
})

test('the trial ledger is written once per inbox, with the network, and a failed write is reported', async () => {
  const m = await loadModules()
  try {
    const db = fakeDb()
    const t = { userId: 'u1', email: 'J.Doe@gmail.com', subscriptionId: 'sub_1', cardRequired: false, trialEnd: '2026-11-17T00:00:00Z', ipHash: 'net1' }
    assert.equal(await m.trial.recordTrialStart(db, t), true)
    assert.equal(await m.trial.recordTrialStart(db, { ...t, subscriptionId: 'sub_RETRY' }), true)
    assert.equal(db.tables.ss_trial_starts.length, 1, 'a retried webhook must not add or overwrite')
    assert.deepEqual(db.tables.ss_trial_starts[0], { email_canonical: 'jdoe@gmail.com', user_id: 'u1', stripe_subscription_id: 'sub_1', card_required: false, trial_end: '2026-11-17T00:00:00Z', ip_hash: 'net1', offer_code: null, offer_percent_off: null })
    // A creator code is recorded with the trial, so "who used the code, who paid" is one table.
    const coded = fakeDb()
    await m.trial.recordTrialStart(coded, { ...t, email: 'other@x.com', offerCode: 'BAILEY', offerPercentOff: 50 })
    assert.deepEqual([coded.tables.ss_trial_starts[0].offer_code, coded.tables.ss_trial_starts[0].offer_percent_off], ['BAILEY', 50])
    assert.equal(await m.trial.recordTrialStart(fakeDb({}, { ss_trial_starts: true }), t), false)
  } finally { m.restore() }
  assert.match(webhook, /if \(!recorded\) throw new Error\(`could not record trial start/)
  assert.doesNotMatch(webhook, /no-email\.invalid/, 'a made-up address can never match an eligibility lookup')
})

test('kill switch: pricing.ts is the setting, the env var is an emergency stop', async () => {
  const on = await loadModules({ NO_CARD_TRIAL_ENABLED: '' })
  try { assert.equal(on.trial.noCardTrialEnabled(), true) } finally { on.restore() }
  const off = await loadModules({ NO_CARD_TRIAL_ENABLED: 'false' })
  try { assert.equal(off.trial.noCardTrialEnabled(), false) } finally { off.restore() }
  assert.match(read('src/lib/pricing.ts'), /trial_requires_card: false,/)
})

// ---------------------------------------------------------------------------
// What Stripe actually receives (executed, compared exactly)
// ---------------------------------------------------------------------------
const base = { userId: 'u1', email: 'a@b.com', plan: 'monthly', priceId: 'price_1', successUrl: 'https://s', cancelUrl: 'https://c', ipHash: 'net1' }

test('no-card trial session: no payment method collected, CANCEL at the end, exact consent text', async () => {
  const m = await loadModules()
  try {
    const p = m.params.buildCheckoutParams({ ...base, withTrial: true, noCard: true })
    assert.equal(p.payment_method_collection, 'if_required')
    assert.deepEqual(p.subscription_data, {
      trial_period_days: 7,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      metadata: { user_id: 'u1', plan: 'monthly', ip_hash: 'net1', no_card: '1' },
    })
    assert.deepEqual(p.metadata, { user_id: 'u1', plan: 'monthly', ip_hash: 'net1', no_card: '1' })
    assert.deepEqual(p.custom_text, {
      submit: {
        message:
          'Your 7-day free trial starts today. No card is needed and nothing is charged. The trial ends after 7 days and your membership stops then, unless you have added a card with the "Add a card" button inside Seoul Sister. If you add one, it is charged $9.99/month when the trial ends and every month after that until you cancel. If you enter a promotion code on this page, the discounted price shown on this page is what is charged instead.',
      },
    })
    assert.equal(p.mode, 'subscription')
  } finally { m.restore() }
})

test('a checkout with NO trial always takes a card and says it is charged today, even if noCard is passed', async () => {
  const m = await loadModules()
  try {
    const p = m.params.buildCheckoutParams({ ...base, withTrial: false, noCard: true })
    assert.equal('payment_method_collection' in p, false, 'a paid checkout must collect a card')
    assert.deepEqual(p.subscription_data, { metadata: { user_id: 'u1', plan: 'monthly', ip_hash: 'net1' } })
    assert.equal(
      p.custom_text.submit.message,
      'Your card will be charged $9.99/month today and every month after that until you cancel. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email. If you enter a promotion code on this page, the discounted price shown on this page is what is charged instead.'
    )
    // Emergency stop: a trial that needs a card says so.
    const card = m.params.buildCheckoutParams({ ...base, withTrial: true, noCard: false })
    assert.equal('payment_method_collection' in card, false)
    assert.equal('trial_settings' in card.subscription_data, false)
    assert.equal('no_card' in card.metadata, false, 'a card trial must not be marked no-card')
    assert.match(card.custom_text.submit.message, /^Your 7-day free trial starts today\. Unless you cancel before it ends, your card will be charged \$9\.99\/month on day 8/)
  } finally { m.restore() }
  // The real session is built from exactly this function, with nothing added.
  assert.match(stripe, /stripe\.checkout\.sessions\.create\(\s*buildCheckoutParams\(\{/)
  assert.equal((stripe.match(/checkout\.sessions\.create\(/g) || []).length, 2, 'only the subscription session and the add-card session')
  assert.match(checkout, /withTrial,\s*noCard,\s*ipHash,/)
  assert.match(checkout, /const noCard = noCardTrialEnabled\(\)/)
})

test('add-a-card session: setup mode, tied to the subscription, exact terms', async () => {
  const m = await loadModules()
  try {
    const p = m.params.buildAddCardParams({ userId: 'u1', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', trialEnd: new Date('2026-11-17T18:00:00Z'), successUrl: 'https://s', cancelUrl: 'https://c' })
    assert.deepEqual(p, {
      mode: 'setup',
      customer: 'cus_1',
      payment_method_types: ['card'],
      custom_text: {
        submit: {
          message:
            'Saving this card keeps your Seoul Sister membership going. It will be charged $9.99/month when your free trial ends on November 17, 2026, and every month after that until you cancel. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.',
        },
      },
      setup_intent_data: { metadata: { user_id: 'u1', subscription_id: 'sub_1' } },
      metadata: { user_id: 'u1', purpose: 'trial_add_card' },
      success_url: 'https://s',
      cancel_url: 'https://c',
    })
  } finally { m.restore() }
  assert.match(stripe, /stripe\.checkout\.sessions\.create\(buildAddCardParams\(params\)\)/)
})

// ---------------------------------------------------------------------------
// A trial is not a paid conversion. The first PAID invoice is, exactly once.
// ---------------------------------------------------------------------------
function paymentHarness(m, tables, fail) {
  const calls = { attribute: [], notify: [] }
  const db = fakeDb(tables, fail)
  const deps = {
    attributeConversion: async (email, userId) => { calls.attribute.push([email, userId]); return 'widget' },
    notifyPaid: async (info) => { calls.notify.push(info) },
    emailForUser: async () => 'kim@example.com',
  }
  const pay = (amountPaid, subscriptionId = 'sub_1') => m.events.onInvoicePaid(db, deps, { subscriptionId, amountPaid }, 'T')
  return { db, calls, pay }
}
const trialTables = () => ({
  ss_trial_starts: [{ id: 't1', stripe_subscription_id: 'sub_1', paid_at: null, lapsed_at: null }],
  ss_subscriptions: [{ id: 's1', user_id: 'u1', stripe_subscription_id: 'sub_1', lead_source: null }],
})

test('the $0 invoice a free trial starts with is NOT a conversion', async () => {
  const m = await loadModules()
  try {
    const h = paymentHarness(m, trialTables())
    assert.equal(await h.pay(0), 'nothing_paid')
    assert.equal(h.calls.attribute.length, 0, 'the One Metric must not move on a trial start')
    assert.equal(h.calls.notify.length, 0)
    assert.equal(h.db.tables.ss_trial_starts[0].paid_at, null)
  } finally { m.restore() }
})

test('the first paid invoice converts the trial ONCE; a retry or a renewal does nothing', async () => {
  const m = await loadModules()
  try {
    const h = paymentHarness(m, trialTables())
    assert.equal(await h.pay(999), 'converted')
    assert.equal(await h.pay(999), 'not_first_payment', 'a retried webhook')
    assert.equal(await h.pay(999), 'not_first_payment', 'next month')
    assert.deepEqual(h.calls.attribute, [['kim@example.com', 'u1']])
    assert.equal(h.calls.notify.length, 1)
    assert.equal(h.db.tables.ss_trial_starts[0].paid_at, 'T')
    assert.equal(h.db.tables.ss_subscriptions[0].lead_source, 'widget')
  } finally { m.restore() }
})

test('a subscription that never had a trial is not converted here (it was stamped at checkout)', async () => {
  const m = await loadModules()
  try {
    const h = paymentHarness(m, { ss_trial_starts: [], ss_subscriptions: [{ id: 's1', user_id: 'u1', stripe_subscription_id: 'sub_1' }] })
    assert.equal(await h.pay(999), 'not_first_payment')
    assert.equal(h.calls.attribute.length, 0)
  } finally { m.restore() }
})

test('a database failure throws BEFORE the once-only switch is used, so the retry still converts', async () => {
  const m = await loadModules()
  try {
    const tables = trialTables()
    const broken = paymentHarness(m, tables, { ss_subscriptions: true })
    await assert.rejects(() => broken.pay(999), /subscription lookup for first payment failed/)
    assert.equal(tables.ss_trial_starts[0].paid_at, null, 'the ledger must be untouched or the conversion is lost for good')
    const retry = paymentHarness(m, tables)
    assert.equal(await retry.pay(999), 'converted')
    assert.equal(retry.calls.attribute.length, 1)
    await assert.rejects(() => m.trial.markFirstPayment(fakeDb({}, { ss_trial_starts: true }), 'sub_1', 999, 'T'), /paid_at write failed/)
  } finally { m.restore() }
})

test('a declined card is not a conversion: a trial that lapses is marked lapsed, and one that paid never is', async () => {
  const m = await loadModules()
  try {
    const db = fakeDb({ ss_trial_starts: [{ id: 't1', stripe_subscription_id: 'sub_1', paid_at: null, lapsed_at: null }, { id: 't2', stripe_subscription_id: 'sub_2', paid_at: 'PAID', lapsed_at: null }] })
    await m.trial.markTrialLapsed(db, 'sub_1', 'L')
    await m.trial.markTrialLapsed(db, 'sub_2', 'L')
    assert.equal(db.tables.ss_trial_starts[0].lapsed_at, 'L')
    assert.equal(db.tables.ss_trial_starts[1].lapsed_at, null, 'a trial that paid is never marked lapsed')
    // An old invoice settled after the trial lapsed is not a conversion: that
    // subscription has no access.
    const h = paymentHarness(m, { ss_trial_starts: [{ id: 't1', stripe_subscription_id: 'sub_1', paid_at: null, lapsed_at: 'L' }], ss_subscriptions: [{ id: 's1', user_id: 'u1', stripe_subscription_id: 'sub_1' }] })
    assert.equal(await h.pay(999), 'not_first_payment')
    assert.equal(h.calls.attribute.length, 0)
    assert.equal(h.db.tables.ss_trial_starts[0].paid_at, null)
  } finally { m.restore() }
})

test('the webhook: the trial path never stamps a conversion; only a paid invoice does', () => {
  // attributeConversion is CALLED in exactly one place (a checkout with no
  // trial, which is paid today) and handed to the paid-invoice handler in one
  // other. A second call anywhere (the attack that passed the first tests)
  // changes this count.
  assert.equal((webhook.match(/attributeConversion\(/g) || []).length, 1)
  assert.match(webhook, /const leadSource = isTrial\s*\? await leadSourceForEmail\(buyerEmail\)\s*: await attributeConversion\(buyerEmail, userId\)/)
  assert.doesNotMatch(webhook, /previous_attributes/, 'status going active is not proof of payment: Stripe marks it active before charging')
  // The live Stripe endpoint sends `invoice.paid` and is NOT subscribed to
  // `invoice.payment_succeeded` (asked of Stripe, Nov 10 2026). A handler under
  // only the second name never runs.
  assert.match(webhook, /case 'invoice\.paid':\s*case 'invoice\.payment_succeeded': \{/)
  const paid = webhook.slice(webhook.indexOf("case 'invoice.paid'"), webhook.indexOf("case 'invoice.payment_failed'"))
  assert.match(paid, /await onInvoicePaid\(/)
  assert.match(paid, /amountPaid: invoiceAmountPaid\(event\.data\.object\)/)
  const lookup = read('src/lib/widget/visitor.ts')
  const fn = lookup.slice(lookup.indexOf('export async function leadSourceForEmail'))
  assert.doesNotMatch(fn, /\.update\(|converted_at/, 'the trial-time lookup must not write anything')
})

test('"who paid?" counts exclude an unpaid trial everywhere', async () => {
  const m = await loadModules()
  try {
    const trials = [{ stripe_subscription_id: 'sub_trial', paid_at: null }, { stripe_subscription_id: 'sub_paid', paid_at: 'T' }]
    assert.equal(m.funnel.isUnpaidTrialSubscription('sub_trial', trials), true)
    assert.equal(m.funnel.isUnpaidTrialSubscription('sub_paid', trials), false)
    assert.equal(m.funnel.isUnpaidTrialSubscription('sub_direct', trials), false, 'a subscription with no trial was paid at checkout')
    assert.equal(m.funnel.isUnpaidTrialSubscription(null, trials), false)
  } finally { m.restore() }
  assert.match(read('src/lib/proactive/campaign-funnel.ts'), /const subs = allSubs\.filter\(\(s\) => !isUnpaidTrialSubscription\(s\.stripe_subscription_id, trials\)\)/)
  assert.match(read('src/lib/proactive/run.ts'), /\.filter\(\(r\) => !isUnpaidTrialSubscription\(r\.stripe_subscription_id as string \| null, trialRows\)\)/)
})

test('the owner is told "trial started, no money has moved", and "paying" only when money moves', () => {
  const alert = read('src/lib/email/new-subscriber-alert.ts')
  assert.match(webhook, /kind: isTrial \? 'trial_started' : 'paid'/)
  assert.match(alert, /`Free trial started \(not yet paying\): /)
  assert.match(alert, /Someone started the free trial\. No money has moved\./)
})

// ---------------------------------------------------------------------------
// Event order: an old subscription must not lock out a paying member (executed)
// ---------------------------------------------------------------------------
test('stale events: a late event for a lapsed trial is ignored once the person is on a newer subscription', async () => {
  const m = await loadModules()
  try {
    const stale = m.trial.isStaleSubscriptionEvent
    const current = { stripe_subscription_id: 'sub_new', status: 'active' }
    assert.equal(stale(current, { subscriptionId: 'sub_old', status: 'canceled' }), true, 'would overwrite the paid row and clear the plan')
    assert.equal(stale(current, { subscriptionId: 'sub_new', status: 'canceled' }), false, 'their real cancellation must go through')
    assert.equal(stale({ stripe_subscription_id: 'sub_old', status: 'canceled' }, { subscriptionId: 'sub_new', status: 'active' }), false, 'the new subscription replaces the lapsed one')
    assert.equal(stale(null, { subscriptionId: 'sub_new', status: 'trialing' }), false)
    assert.equal(stale({ stripe_subscription_id: null, status: null }, { subscriptionId: 'sub_new', status: 'trialing' }), false)
    // With creation times the rule is exact, whatever the statuses say. The
    // case the first guard missed: the row on file is CANCELLED and a late
    // "trialing" event for an older subscription would have re-opened access.
    const onFile = { stripe_subscription_id: 'sub_B', status: 'canceled', stripe_created_at: '2026-11-20T00:00:00Z' }
    assert.equal(stale(onFile, { subscriptionId: 'sub_A', status: 'trialing', createdAt: '2026-11-10T00:00:00Z' }), true)
    assert.equal(stale(onFile, { subscriptionId: 'sub_A', status: 'canceled', createdAt: '2026-11-10T00:00:00Z' }), true)
    assert.equal(stale(onFile, { subscriptionId: 'sub_C', status: 'active', createdAt: '2026-12-01T00:00:00Z' }), false, 'a NEWER subscription replaces the row')
    assert.equal(stale(onFile, { subscriptionId: 'sub_B', status: 'active', createdAt: '2026-11-20T00:00:00Z' }), false, 'same subscription always applies')
  } finally { m.restore() }
  assert.match(webhook, /isStaleSubscriptionEvent\(storedSub, \{ subscriptionId: subscription\.id, status: subscription\.status, createdAt: stripeCreatedAt\(subscription\) \}\)/)
  assert.equal((webhook.match(/stripe_created_at: stripeCreatedAt\(subscription\)/g) || []).length, 2, 'both writers of the row must store the creation time')
  const upd = webhook.slice(webhook.indexOf("case 'customer.subscription.updated'"), webhook.indexOf("case 'customer.subscription.deleted'"))
  assert.ok(upd.indexOf('isStaleSubscriptionEvent(') > 0 && upd.indexOf('isStaleSubscriptionEvent(') < upd.indexOf('.upsert('), 'the guard must run BEFORE the upsert')
  const del = webhook.slice(webhook.indexOf("case 'customer.subscription.deleted'"), webhook.indexOf("case 'invoice.paid'"))
  assert.match(del, /\.eq\('user_id', userId\)[\s\S]{0,400}\.eq\('stripe_subscription_id', subscription\.id\)/)
  assert.match(del, /if \(!canceledRows \|\| canceledRows\.length === 0\) break/)
  assert.match(del, /if \(planClearError\) \{[\s\S]{0,200}throw new Error/, 'a silent failure here leaves a lapsed trial with full access')
  assert.match(del, /await markTrialLapsed\(supabase, subscription\.id/)
})

// ---------------------------------------------------------------------------
// What the paywall and the notice may say (executed, including Stripe failing)
// ---------------------------------------------------------------------------
const trialing = (endIso) => ({ ss_subscriptions: [{ id: 's1', user_id: 'u1', status: 'trialing', trial_end: endIso, stripe_subscription_id: 'sub_1' }], ss_trial_starts: [{ id: 't1', user_id: 'u1', email_canonical: 'a@b.com', stripe_subscription_id: 'sub_1', paid_at: null }] })
const me = { id: 'u1', email: 'a@b.com' }

test('trial facts: when Stripe cannot be asked, the card status is UNKNOWN, never yes or no', async () => {
  const m = await loadModules()
  try {
    const f = await m.trial.trialFacts(fakeDb(trialing('2026-11-17T00:00:00Z')), me, { liveState: async () => { throw new Error('stripe down') }, now: NOW })
    assert.deepEqual(f.trial, { ends_at: '2026-11-17T00:00:00Z', card_on_file: null, cancelled: null, percent_off: null })
    const ok = await m.trial.trialFacts(fakeDb(trialing('2026-11-17T00:00:00Z')), me, { liveState: async () => ({ status: 'trialing', hasPaymentMethod: true, cancelAtPeriodEnd: true }), now: NOW })
    assert.deepEqual(ok.trial, { ends_at: '2026-11-17T00:00:00Z', card_on_file: true, cancelled: true, percent_off: null })
    // A trial that started with a creator code reports its discount, so the notice states the right price.
    const coded = trialing('2026-11-17T00:00:00Z')
    coded.ss_subscriptions[0].offer_percent_off = '50'
    const c = await m.trial.trialFacts(fakeDb(coded), me, { liveState: async () => ({ status: 'trialing', hasPaymentMethod: false, cancelAtPeriodEnd: false }), now: NOW })
    assert.equal(c.trial.percent_off, 50)
  } finally { m.restore() }
})

test('trial facts: a trial whose end date has passed is over, even if the cancel webhook is late', async () => {
  const m = await loadModules()
  try {
    const f = await m.trial.trialFacts(fakeDb(trialing('2026-11-09T00:00:00Z')), me, { liveState: async () => ({ status: 'trialing', hasPaymentMethod: false, cancelAtPeriodEnd: false }), now: NOW })
    assert.equal(f.trial, null, 'the notice must not show a past end date with an Add a card button')
  } finally { m.restore() }
})

test('trial facts: "your free trial has ended" only for someone who HAD a trial', async () => {
  const m = await loadModules()
  try {
    const live = async () => ({ status: 'canceled', hasPaymentMethod: false, cancelAtPeriodEnd: false })
    // A paying member who cancelled: subscription history, no trial.
    const cancelledPayer = await m.trial.trialFacts(fakeDb({ ss_subscriptions: [{ id: 's1', user_id: 'u1', status: 'canceled', trial_end: null, stripe_subscription_id: 'sub_x' }] }), me, { liveState: live, now: NOW })
    assert.equal(cancelledPayer.had_trial, false)
    assert.equal(cancelledPayer.eligible, false)
    // A lapsed trial.
    const lapsed = await m.trial.trialFacts(fakeDb({ ss_subscriptions: [{ id: 's1', user_id: 'u1', status: 'canceled', trial_end: '2026-11-01T00:00:00Z', stripe_subscription_id: 'sub_1' }], ss_trial_starts: [{ id: 't1', user_id: 'u1', email_canonical: 'a@b.com' }] }), me, { liveState: live, now: NOW })
    assert.equal(lapsed.had_trial, true)
    // A new account on an inbox that already used its trial.
    const reReg = await m.trial.trialFacts(fakeDb({ ss_trial_starts: [{ id: 't1', user_id: 'gone', email_canonical: 'a@b.com' }] }), { id: 'u2', email: 'a@b.com' }, { liveState: live, now: NOW })
    assert.deepEqual([reReg.eligible, reReg.had_trial], [false, true])
  } finally { m.restore() }
})

test('trial facts: unknown eligibility is null (no trial claim), and a member on a trial still sees it', async () => {
  const m = await loadModules()
  try {
    const db = fakeDb(trialing('2026-11-17T00:00:00Z'))
    // Fail only the eligibility read of the ledger by canonical inbox: simulate with a broken second table read.
    const failing = fakeDb({ ss_subscriptions: [] }, { ss_trial_starts: true })
    const f = await m.trial.trialFacts(failing, me, { liveState: async () => ({ status: 'trialing', hasPaymentMethod: false, cancelAtPeriodEnd: false }), now: NOW })
    assert.equal(f.eligible, null, 'a failed lookup must not read as eligible')
    const g = await m.trial.trialFacts(db, me, { liveState: async () => ({ status: 'trialing', hasPaymentMethod: false, cancelAtPeriodEnd: false }), ipHash: 'net1', now: NOW })
    assert.equal(g.eligible, false)
    assert.ok(g.trial, 'the notice must still show')
  } finally { m.restore() }
  // The endpoint is only a wrapper: no second copy of the rules to drift.
  const route = read('src/app/api/me/trial/route.ts')
  assert.match(route, /const facts = await trialFacts\(getServiceClient\(\), user, \{ liveState: liveTrialState, ipHash: networkKey\(ip\) \}\)\s*return NextResponse\.json\(facts\)/)
  assert.doesNotMatch(route, /eligible:|card_on_file|had_trial/, 'no logic of its own')
  const subscribe = read('src/app/(auth)/subscribe/page.tsx')
  assert.match(subscribe, /setTrialEligible\(t\.eligible === true\)/)
  assert.match(subscribe, /setNoCardTrial\(t\.eligible === true && t\.no_card === true\)/)
})

async function loadNoticeState() {
  const src = read('src/components/layout/TrialNotice.tsx')
  const a = src.indexOf('export function trialNoticeState')
  const b = src.indexOf('export default function TrialNotice')
  assert.ok(a > 0 && b > a)
  const dir = mkdtempSync(join(tmpdir(), 'ss-notice-'))
  writeFileSync(join(dir, 'n.mjs'), transpile(src.slice(a, b).replace(/trial: TrialFacts\['trial'\]/, 'trial: any').replace(/: TrialNoticeState/, '')))
  return (await import(pathToFileURL(join(dir, 'n.mjs')).href)).trialNoticeState
}

test('the in-app notice: each state makes its own promise, and unknown is never yes or no', async () => {
  const state = await loadNoticeState()
  const t = (card, cancelled = false) => ({ ends_at: 'x', card_on_file: card, cancelled })
  assert.equal(state(null, false), 'none')
  assert.equal(state(t(true), false), 'card_on_file')
  assert.equal(state(t(false), false), 'no_card')
  assert.equal(state(t(null), false), 'unknown_card')
  assert.equal(state(t(false), true), 'card_just_saved', 'seconds after saving a card it must not say "no card is on file"')
  assert.equal(state(t(null), true), 'card_just_saved')
  assert.equal(state(t(true, true), false), 'cancelled', 'a member who cancelled must not be told they will be charged')
  assert.equal(state(t(false, true), true), 'cancelled')
  const notice = read('src/components/layout/TrialNotice.tsx')
  assert.match(notice, /state === 'no_card'\s*\? `You have not added a card, so your membership will stop on that day and nothing will be charged\./)
  assert.match(notice, /You cancelled\. Your free trial runs until it ends \{until\}, and nothing will be charged\./)
  assert.match(read('src/components/layout/AppShell.tsx'), /<TrialNotice \/>/)
})

// ---------------------------------------------------------------------------
// Adding a card, emails, account deletion, migration
// ---------------------------------------------------------------------------
test('a saved card is attached only to an OPEN subscription; a closed one is reported, not retried forever', () => {
  const fn = stripe.slice(stripe.indexOf('export async function applySavedCardToSubscription'), stripe.indexOf('export interface LiveTrialState'))
  assert.match(fn, /if \(sub\.status !== 'trialing' && sub\.status !== 'active'\) \{\s*return \{ applied: false, subscriptionId, reason: 'subscription_not_open' \}/)
  assert.match(fn, /await stripe\.subscriptions\.update\(subscriptionId, \{ default_payment_method: paymentMethod \}\)/)
  const setup = webhook.slice(webhook.indexOf("session.mode === 'setup'"), webhook.indexOf("if (!userId || session.mode !== 'subscription') break"))
  assert.match(setup, /if \(!saved\.applied\) \{[\s\S]{0,400}console\.error\([\s\S]{0,300}break/)
  assert.match(setup, /sendSubscriptionConfirmation\(\s*cardEmail,[\s\S]{0,160}\{ cardOnFile: true, percentOff: /, 'saving the card starts auto-renewal: the terms, with any discount, go to the member in writing')
  const route = read('src/app/api/stripe/add-card/route.ts')
  assert.match(route, /const ended = sub\.trial_end \? new Date\(sub\.trial_end\)\.getTime\(\) <= Date\.now\(\) : false/)
  assert.match(route, /if \(ended \|\| !live \|\| live\.status !== 'trialing'\)/)
})

test('emails never promise a charge to a card that does not exist, and a lapsed trial is told nothing was charged', () => {
  const confirm = read('src/lib/email/subscription-confirmation.ts')
  const branch = confirm.slice(confirm.indexOf('const firstCharge = noCardTrial'), confirm.indexOf(': params.trialEnd'))
  assert.match(branch, /No card is on file and you will not be charged\./)
  assert.match(branch, /with the "Add a card" button at the top of any page/)
  assert.doesNotMatch(branch, /your card will be charged|Profile page/i)
  assert.match(webhook, /sendSubscriptionConfirmation\(buyerEmail, trialEnd, \{ cardOnFile: !noCardTrial, percentOff: offerPercentOff, timezone: await timezoneForUser\(supabase, userId\) \}\)/)
  assert.match(webhook, /const noCardTrial = isTrial && subscription\.metadata\?\.no_card === '1'/, 'stated by the checkout, not guessed from Stripe state')
  // "No card was on file" is only sent to a trial that began with no card and
  // never had one added. A cancelled card trial, or a card added then
  // declined, ends in the same handler.
  const lapseQuery = webhook.slice(webhook.indexOf(".from('ss_trial_starts')", webhook.indexOf('await markTrialLapsed(')), webhook.indexOf('await sendTrialEndedEmail('))
  assert.match(lapseQuery, /\.eq\('card_required', false\)\s*\.is\('card_added_at', null\)\s*\.is\('paid_at', null\)\s*\.not\('lapsed_at', 'is', null\)/)
  const ended = read('src/lib/email/trial-emails.ts')
  assert.match(ended, /<strong>Nothing was charged<\/strong>, and nothing will be: no card was on file\./)
  // The email body only (the file's comment describes what it avoids).
  const endedBody = ended.slice(ended.indexOf('const html = wrapEmailHtml('), ended.indexOf('return { subject'))
  assert.doesNotMatch(endedBody, /\b(hurry|last chance|don't lose|before it's too late|offer|discount)\b/i, 'it states what is true; it does not push')
  assert.match(webhook, /await sendTrialEndedEmail\(lapsedEmail, \{ offerCode: \(lapsed\?\.\[0\] as \{ offer_code\?: string \| null \} \| undefined\)\?\.offer_code \?\? null \}\)/)
  assert.match(lapseQuery, /\.select\('id, offer_code'\)/)
})

test('deleting an account cancels its Stripe subscription first', () => {
  // The order is EXECUTED in tests/account-erasure.test.mjs (Stripe down means
  // nothing removed, photos included). Here: the route gives the erasure the
  // real Stripe cancel, and the erasure cancels before anything else.
  const del = read('src/app/api/account/delete/route.ts')
  assert.match(del, /cancelSubscription: cancelSubscriptionForDeletedAccount,/)
  const erase = read('src/lib/account/erase.ts')
  const body = erase.slice(erase.indexOf('export async function eraseAccount'))
  const cancel = body.indexOf('await deps.cancelSubscription(')
  const photos = body.indexOf('await deps.purgePhotos(')
  const wipe = body.search(/\.delete\(\)|\.update\(/)
  assert.ok(body.indexOf('await deps.deleteStripeCustomer(') > cancel && body.indexOf('await deps.deleteStripeCustomer(') < wipe)
  assert.ok(cancel > 0 && cancel < wipe && cancel < photos, 'cancel in Stripe BEFORE anything is removed, or a member with a card is billed with no account')
})

test('migrations: the ledger has RLS on, no account foreign key, and the network column', () => {
  const m1 = read('supabase/migrations/20261110000002_trial_starts.sql')
  assert.match(m1, /email_canonical text NOT NULL UNIQUE/)
  assert.match(m1, /ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(m1, /REFERENCES/i)
  assert.doesNotMatch(m1, /CREATE POLICY/i)
  assert.match(read('supabase/migrations/20261110000003_trial_starts_network.sql'), /ADD COLUMN IF NOT EXISTS ip_hash text/)
})

// ---------------------------------------------------------------------------
// Creator offer codes (Bailey's decision, Nov 10 2026): 50% off the first PAID
// month, first 50 people, no end date. The free trial stays 7 days for everyone.
// ---------------------------------------------------------------------------
test('offer codes: only a plain 3-20 character code is accepted from a URL', async () => {
  const m = await loadModules()
  try {
    const n = m.offers.normalizeOfferCode
    assert.equal(n('bailey'), 'BAILEY')
    assert.equal(n(' Bailey50 '), 'BAILEY50')
    for (const bad of [null, '', 'ab', 'a'.repeat(21), 'BAILEY!', 'bai ley', '<script>', 'BAILEY&x=1']) assert.equal(n(bad), null, `must reject ${JSON.stringify(bad)}`)
  } finally { m.restore() }
})

test('offer codes: every charge sentence names the discounted first month AND the price after it, and is unchanged without a code', async () => {
  const m = await loadModules()
  try {
    const o = m.offers
    assert.equal(o.firstMonthPrice(50), '$4.99', 'Stripe charged 499 on 999 in a live check')
    assert.equal(o.chargePhrase(null, 'today'), '$9.99/month today and every month after that until you cancel')
    assert.equal(o.chargePhrase(null, 'on that day,'), '$9.99/month on that day, and every month after that until you cancel')
    assert.equal(o.chargePhrase(50, 'today'), '$4.99 for your first paid month (50% off) today, then $9.99/month until you cancel')
    assert.equal(o.chargePhrase(50, 'on that day,'), '$4.99 for your first paid month (50% off) on that day, then $9.99/month until you cancel')
    assert.equal(o.addCardPhrase(null), '$9.99/month, starting when the trial ends')
    assert.equal(o.addCardPhrase(50), '$4.99 for your first paid month (50% off) when the trial ends, then $9.99/month')
    assert.equal(o.priceWithOffer(50), '$4.99 for your first paid month (50% off), then $9.99/month')
    assert.equal(o.priceWithOffer(null), '$9.99/month')
    // The two price lines under the free chat.
    assert.equal(o.widgetAccountLine(null), 'Create a free account and continue with Yuri. New members get 7 days free with no card. $9.99/mo after that, only if you add a card.')
    assert.equal(o.widgetAccountLine(50), 'Create a free account and continue with Yuri. New members get 7 days free with no card. After that, $4.99 for your first paid month (50% off), then $9.99/month, only if you add a card.')
    assert.equal(o.widgetMembershipLine(null), 'Membership is $9.99/mo. New members get the first 7 days free, no card needed to start.')
    assert.equal(o.widgetMembershipLine(50), 'Membership is $4.99 for your first paid month (50% off), then $9.99/month. New members get the first 7 days free, no card needed to start.')
    for (const bad of [0, 100, 0.5, '50', undefined, NaN]) {
      assert.equal(o.widgetAccountLine(bad), o.widgetAccountLine(null), `must ignore ${bad}`)
      assert.equal(o.widgetMembershipLine(bad), o.widgetMembershipLine(null), `must ignore ${bad}`)
    }
    assert.equal(o.offerFailedLine('BAILEY'), 'Code BAILEY could not be applied just now. Press the button again to continue without it at $9.99/month, or try again in a few minutes to use the code.')
    for (const bad of [0, 100, 150, -5, 0.4, 99.5, 12.5, '50', undefined, NaN]) {
      assert.equal(o.firstMonthPrice(bad), null, `must ignore ${bad}`)
      assert.equal(o.chargePhrase(bad, 'today'), '$9.99/month today and every month after that until you cancel')
    }
    assert.equal(o.offerAppliedLine('BAILEY', 50), 'Code BAILEY applied: your first paid month is $4.99 instead of $9.99 (50% off), then $9.99/month.')
    assert.equal(o.offerSavedLine('BAILEY', 50), 'Code BAILEY saved: 50% off your first paid month.')
    assert.equal(o.offerEndedLine('BAILEY'), 'Code BAILEY is no longer available, so membership is $9.99/month.')
    // What the public endpoint returns is a closed set of keys.
    assert.deepEqual(o.offerResponse({ state: 'active', code: 'BAILEY', promotionCodeId: 'promo_1', percentOff: 50, times_redeemed: 49, max_redemptions: 50 }), {
      state: 'active', code: 'BAILEY', percent_off: 50,
      line: 'Code BAILEY applied: your first paid month is $4.99 instead of $9.99 (50% off), then $9.99/month.',
      saved_line: 'Code BAILEY saved: 50% off your first paid month.',
    })
    assert.deepEqual(o.offerResponse({ state: 'ended', code: 'BAILEY', times_redeemed: 50 }), { state: 'ended', code: 'BAILEY', line: 'Code BAILEY is no longer available, so membership is $9.99/month.' })
    assert.deepEqual(o.offerResponse({ state: 'unknown', code: 'ANNKOREA' }), { state: 'unknown' }, 'a private code is not even echoed back')
    // Nothing the app writes may say how many spots are left or that it is about to run out.
    const src = read('src/lib/offers.ts')
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
    assert.doesNotMatch(code, /spots? left|almost gone|running out|hurry|only \$\{|last chance/i)
  } finally { m.restore() }
})

test('offer codes: Stripe applies the exact promotion code, the consent text states the discount, and the trial is still 7 days with no card', async () => {
  const m = await loadModules()
  try {
    const offer = { code: 'BAILEY', promotionCodeId: 'promo_123', percentOff: 50 }
    const p = m.params.buildCheckoutParams({ ...base, withTrial: true, noCard: true, offer })
    assert.deepEqual(p.discounts, [{ promotion_code: 'promo_123' }])
    assert.equal('allow_promotion_codes' in p, false, 'Stripe accepts only one of the two')
    assert.equal(p.subscription_data.trial_period_days, 7, 'a code never lengthens the free trial')
    assert.equal(p.payment_method_collection, 'if_required')
    assert.deepEqual(p.metadata, { user_id: 'u1', plan: 'monthly', offer_code: 'BAILEY', offer_percent_off: '50', ip_hash: 'net1', no_card: '1' })
    assert.equal(
      p.custom_text.submit.message,
      'Your 7-day free trial starts today. No card is needed and nothing is charged. The trial ends after 7 days and your membership stops then, unless you have added a card with the "Add a card" button inside Seoul Sister. If you add one, it is charged $4.99 for your first paid month (50% off) when the trial ends, then $9.99/month until you cancel.'
    )
    assert.doesNotMatch(p.custom_text.submit.message, /promotion code/, 'with a confirmed code there is no code box to talk about')
    // Without a code the page keeps its code box and the plain price, and says a typed code changes it.
    const plain = m.params.buildCheckoutParams({ ...base, withTrial: true, noCard: true })
    assert.equal(plain.allow_promotion_codes, true)
    for (const v of [{ withTrial: true, noCard: true }, { withTrial: true, noCard: false }, { withTrial: false, noCard: false }]) {
      assert.ok(m.params.buildCheckoutParams({ ...base, ...v }).custom_text.submit.message.endsWith(' If you enter a promotion code on this page, the discounted price shown on this page is what is charged instead.'), JSON.stringify(v))
    }
    assert.equal('discounts' in plain, false)
    // Someone with no trial left still gets the discount, charged today.
    const paid = m.params.buildCheckoutParams({ ...base, withTrial: false, noCard: true, offer })
    assert.equal(paid.custom_text.submit.message, 'Your card will be charged $4.99 for your first paid month (50% off) today, then $9.99/month until you cancel. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.')
    // The add-a-card page states it too.
    const add = m.params.buildAddCardParams({ userId: 'u1', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', trialEnd: null, successUrl: 's', cancelUrl: 'c', percentOff: 50 })
    assert.match(add.custom_text.submit.message, /It will be charged \$4\.99 for your first paid month \(50% off\) when your free trial ends, then \$9\.99\/month until you cancel\. Cancel anytime/)
    const card = m.params.buildCheckoutParams({ ...base, withTrial: true, noCard: false, offer })
    assert.match(card.custom_text.submit.message, /your card will be charged \$4\.99 for your first paid month \(50% off\) on day 8, then \$9\.99\/month until you cancel\. Cancel anytime/)
  } finally { m.restore() }
})

async function loadResolveOffer(promo) {
  const dir = mkdtempSync(join(tmpdir(), 'ss-offer-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  globalThis.__promo = promo
  writeFileSync(join(dir, 'stripe.mjs'), `export const getStripeClient = () => ({ promotionCodes: { list: async (q) => { globalThis.__promoQuery = q; if (globalThis.__promo === 'THROW') throw new Error('stripe down'); return { data: globalThis.__promo ? [globalThis.__promo] : [] } } } })`)
  put('offers-server', read('src/lib/offers-server.ts').replace("from '@/lib/stripe'", "from './stripe.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  return (await import(pathToFileURL(join(dir, 'offers-server.mjs')).href)).resolveOffer
}
const coupon = (over = {}) => ({ valid: true, percent_off: 50, duration: 'repeating', duration_in_months: 1, ...over })
const creator = { creator_offer: '1' }

test('offer codes (executed): Stripe is the only source of truth for whether a code is real and still open', async () => {
  let r = await loadResolveOffer({ id: 'promo_1', active: true, metadata: creator, coupon: coupon() })
  assert.deepEqual(await r('bailey'), { state: 'active', code: 'BAILEY', promotionCodeId: 'promo_1', percentOff: 50 })
  assert.deepEqual(globalThis.__promoQuery, { code: 'BAILEY', limit: 1 })
  // The cap was reached (Stripe marks the code inactive): the offer has ended.
  r = await loadResolveOffer({ id: 'promo_1', active: false, metadata: creator, coupon: coupon() })
  assert.deepEqual(await r('BAILEY'), { state: 'ended', code: 'BAILEY' })
  // Full or expired, even if Stripe still reports it active.
  r = await loadResolveOffer({ id: 'promo_1', active: true, metadata: creator, max_redemptions: 50, times_redeemed: 50, coupon: coupon() })
  assert.deepEqual(await r('BAILEY'), { state: 'ended', code: 'BAILEY' })
  r = await loadResolveOffer({ id: 'promo_1', active: true, metadata: creator, max_redemptions: 50, times_redeemed: 49, expires_at: null, coupon: coupon() })
  assert.equal((await r('BAILEY')).state, 'active')
  r = await loadResolveOffer({ id: 'promo_1', active: true, metadata: creator, expires_at: 1, coupon: coupon() })
  assert.deepEqual(await r('BAILEY'), { state: 'ended', code: 'BAILEY' })
  // A real, active code that is NOT marked as a creator offer (a private one-off)
  // is never confirmed by the public endpoint, whether open or closed.
  for (const meta of [undefined, {}, { creator_offer: '0' }, { creator_offer: 'true' }]) {
    for (const active of [true, false]) {
      r = await loadResolveOffer({ id: 'promo_2', active, metadata: meta, coupon: coupon() })
      assert.deepEqual(await r('ANNKOREA'), { state: 'unknown', code: 'ANNKOREA' }, JSON.stringify({ meta, active }))
    }
  }
  // No such code, or not a code at all.
  r = await loadResolveOffer(null)
  assert.deepEqual(await r('NOPE'), { state: 'unknown', code: 'NOPE' })
  assert.deepEqual(await r('!!'), { state: 'unknown', code: null })
})

test('offer codes (executed): a coupon that is not "a percentage off for exactly one month" is refused, never misdescribed', async () => {
  // Every sentence the app writes says "the first month". A forever discount, a
  // `once` coupon (used up by the free trial's $0 invoice), a fixed amount, or
  // 100% off would each make those sentences false.
  for (const bad of [
    coupon({ duration: 'forever', duration_in_months: null }),
    coupon({ duration: 'once', duration_in_months: null }),
    coupon({ duration_in_months: 3 }),
    coupon({ percent_off: null, amount_off: 500 }),
    coupon({ percent_off: 100 }),
    coupon({ percent_off: 0.4 }),
    coupon({ percent_off: 99.5 }),
    coupon({ valid: false }),
  ]) {
    const r = await loadResolveOffer({ id: 'promo_1', active: true, metadata: creator, coupon: bad })
    assert.deepEqual(await r('BAILEY'), { state: 'ended', code: 'BAILEY' }, JSON.stringify(bad))
  }
  // Stripe unreachable must be an error the caller sees, not "no discount".
  const r = await loadResolveOffer('THROW')
  await assert.rejects(() => r('BAILEY'), /stripe down/)
})

test('offer codes: the checkout stops if Stripe cannot confirm the code, and the page claims it only when Stripe did', () => {
  assert.match(checkout, /offer_code: z\.string\(\)\.max\(40\)\.optional\(\)/)
  const subscribe = read('src/app/(auth)/subscribe/page.tsx')
  const block = checkout.slice(checkout.indexOf('let offer:'), checkout.indexOf('// Stamp the first checkout start'))
  assert.match(block, /const resolved = await resolveOffer\(parsed\.data\.offer_code\)/, 'the server asks Stripe itself; the browser is never trusted')
  assert.match(block, /catch \(err\) \{[\s\S]{0,500}offer_failed: true \}, \{ status: 503 \}\)/, 'going on silently without the discount would charge full price to someone told the code was applied')
  assert.match(checkout, /\} catch \(err\) \{\s*if \(!offer\) throw err[\s\S]{0,500}return NextResponse\.json\(\{ error: offerFailedLine\(offer\.code\), offer_failed: true \}, \{ status: 409 \}\)/, 'a session Stripe refuses because of the code must not trap the person')
  assert.match(subscribe, /if \(result\.offer_failed\) \{[\s\S]{0,260}setOfferCode\(null\)\s*setOfferActive\(false\)\s*setOfferPercent\(null\)\s*setOfferLine\(result\.error\)\s*return/)
  assert.match(subscribe, /setOfferActive\(o\.state === 'active'\)/)
  assert.match(subscribe, /const priceLong = priceWithOffer\(offerActive \? offerPercent : null\)/)
  assert.doesNotMatch(subscribe, /PRICING\.monthly_display_long/, 'every price sentence on the paywall goes through priceLong, so none contradicts the code line')
  // What the saved line says is decided in resolveSavedOffer (executed below).
  assert.match(read('src/components/widget/OfferSavedLine.tsx'), /const \{ line \} = useSavedOffer\(\)\s*if \(!line\) return null/)
  const hook = read('src/lib/use-saved-offer.ts')
  // The hook only wires real readers into resolveSavedOffer. Its whole effect is pinned.
  const effect = hook.slice(hook.indexOf('  useEffect(() => {'), hook.indexOf('  return offer'))
  assert.equal(effect.replace(/\n\s*\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim(),
    "useEffect(() => { let live = true captureOfferCode() setOffer(NO_SAVED_OFFER) if (loading) return resolveSavedOffer({ code: getOfferCode(), signedIn: userId !== null, readPlan: () => readMemberPlan(supabase, userId as string), askOffer: (code) => askOfferOnce(code, (url) => fetch(url)), forget: clearOfferCode, onUpdate: (o) => { if (live) setOffer(o) }, }).catch((err) => console.error('[offer] could not check the saved code:', err)) return () => { live = false } }, [userId, loading])")
  assert.match(hook, /const \{ user, loading \} = useAuth\(\)\n  const userId = user\?\.id \?\? null\n/)
  // The whole hook, comments aside, by fingerprint: a wrong return statement
  // or initial state outside the effect passed every other assertion here
  // (second-model review). Any edit needs a review and a new fingerprint.
  const hookBody = hook.slice(hook.indexOf('export function useSavedOffer')).replace(/\n\s*\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim()
  assert.equal(sha('sha256').update(hookBody).digest('hex'), '58da4587a782f5cd4e2e1fa2f575243dc0eaa335d93a9bff02ac907ee0bbf879')
  assert.equal(sha('sha256').update(hook.split('\n').filter((l) => l.startsWith('import ')).join('\n')).digest('hex'), 'bef8127d6c2ae957642a0258fde4e1a625c1c4f31a659a3fe050be93c4fbd98f')
  assert.match(read('src/components/home/HomeClient.tsx'), /<TryYuriSection variant="hero" \/>\s*<OfferSavedLine \/>/)
  assert.match(block, /else if \(resolved\.state === 'ended'\) \{[\s\S]{0,260}return NextResponse\.json\(\{ error: offerEndedLine\(resolved\.code\), offer_ended: true \}, \{ status: 409 \}\)/, 'a code that closed stops the checkout and says so')
  assert.doesNotMatch(checkout, /error: message \}/, 'raw Stripe errors are not shown to customers')
  assert.match(subscribe, /\.\.\.\(offerCode \? \{ offer_code: offerCode \} : \{\}\)/, 'the remembered code is sent even if the page could not ask about it')
  assert.match(subscribe, /if \(response\.status === 409 && result\.offer_ended\) \{\s*[\s\S]{0,200}clearOfferCode\(\)\s*setOfferCode\(null\)/)
  assert.match(subscribe, /if \(o\.state !== 'active'\) \{\s*clearOfferCode\(\)\s*setOfferCode\(null\)/)
  assert.match(subscribe, /if \(o\.state === 'active' \|\| o\.state === 'ended'\) setOfferLine\(o\.line \?\? null\)/)
  assert.match(subscribe, /console\.error\('\[subscribe\] offer lookup unavailable; saying nothing about the code'\)/)
  // Bailey's own link applies her code; a code is remembered on every page load.
  assert.match(read('next.config.js'), /destination: '\/\?utm_source=tiktok&utm_medium=bio&from=tt_ss&code=BAILEY'/)
  assert.match(read('src/contexts/AuthContext.tsx'), /captureAttribution\(\)\s*captureOfferCode\(\)/)
  // The endpoint never reports how many are left.
  assert.doesNotMatch(read('src/app/api/offer/route.ts') + read('src/components/widget/OfferSavedLine.tsx'), /times_redeemed|max_redemptions|remaining/)
  assert.match(read('src/app/api/offer/route.ts'), /return NextResponse\.json\(offerResponse\(offer\)\)/)
  assert.match(read('src/lib/offers-server.ts'), /if \(promo\.metadata\?\.creator_offer !== '1'\) return \{ state: 'unknown', code \}\n  if \(!promo\.active\)/, 'the creator check comes before anything is said about the code')
})

test('offer codes: the discount follows the member into every later notice about what their card will be charged', () => {
  assert.match(webhook, /stripe\.subscriptions\.retrieve\(subscriptionId, \{ expand: \['discount\.promotion_code'\] \}\)/)
  assert.match(webhook, /const \{ code: offerCode, percentOff: offerPercentOff \} = offerFromSubscription\(subscription, session\.metadata\)/)
  assert.match(webhook, /offer_code: offerCode,\s*offer_percent_off: offerPercentOff,/)
  assert.match(webhook, /offerCode,\s*offerPercentOff,\s*\}\)/, 'recorded on the trial row')
  assert.match(read('src/lib/email/trial-emails.ts'), /Your card will be charged \$\{chargePhrase\(percentOff, 'on that day,'\)\}\./)
  assert.match(read('src/lib/trial-notices.ts'), /trialEndingLine\(t\.trial_end, state, await deps\.timezoneForUser\(t\.user_id\), pct && pct > 0 \? pct : null\)/)
  assert.match(read('src/components/layout/TrialNotice.tsx'), /Your card will be charged \{chargePhrase\(pct, 'on that day,'\)\}\./)
  assert.match(read('src/components/layout/TrialNotice.tsx'), /const pct = facts\.percent_off \?\? null\n/)
  assert.match(read('src/lib/trial-notices.ts'), /const pct = t\.offer_percent_off == null \? null : Number\(t\.offer_percent_off\)\n/)
  assert.match(webhook, /\{ cardOnFile: true, percentOff: trialRow\?\.offer_percent_off == null \? null : Number\(trialRow\.offer_percent_off\), timezone: await timezoneForUser\(supabase, userId\) \}/)
  const confirmRoute = read('src/app/api/stripe/confirm/route.ts')
  assert.match(confirmRoute, /const offer = offerFromSubscription\(subscription, session\.metadata\)/)
  assert.match(confirmRoute, /offer_code: offer\.code,\s*offer_percent_off: offer\.percentOff,/)
  assert.equal((read('src/components/layout/TrialNotice.tsx').match(/addCardPhrase\(pct\)/g) ?? []).length, 2)
  assert.doesNotMatch(read('src/components/layout/TrialNotice.tsx'), /PRICING\.monthly_display_long/, 'a member with a code must not be shown the full price for the first month')
  assert.match(read('src/app/api/stripe/add-card/route.ts'), /percentOff: sub\.offer_percent_off == null \? null : Number\(sub\.offer_percent_off\)/)
  const m = read('supabase/migrations/20261110000007_offer_codes.sql')
  for (const col of ['ss_trial_starts ADD COLUMN IF NOT EXISTS offer_code', 'ss_trial_starts ADD COLUMN IF NOT EXISTS offer_percent_off', 'ss_subscriptions ADD COLUMN IF NOT EXISTS offer_code']) assert.ok(m.includes(col), col)
})

test('offer codes (executed): what a subscription is recorded as carrying comes from Stripe\'s own discount, so a hand-typed code is seen', async () => {
  const m = await loadModules()
  try {
    const f = m.offers.offerFromSubscription
    const d = (over = {}, promo = { code: 'bailey' }) => ({ discount: { coupon: { percent_off: 50, duration: 'repeating', duration_in_months: 1, ...over }, promotion_code: promo } })
    // Typed into Stripe's own box: no metadata at all.
    assert.deepEqual(f(d(), {}), { code: 'BAILEY', percentOff: 50 })
    // Stripe's record wins over what the checkout wrote down.
    assert.deepEqual(f(d({ percent_off: 25 }, { code: 'OTHER' }), { offer_code: 'BAILEY', offer_percent_off: '50' }), { code: 'OTHER', percentOff: 25 })
    // Promotion code not expanded: the code name falls back to the metadata.
    assert.deepEqual(f(d({}, 'promo_123'), { offer_code: 'BAILEY', offer_percent_off: '50' }), { code: 'BAILEY', percentOff: 50 })
    assert.deepEqual(f(d({}, 'promo_123'), {}), { code: null, percentOff: 50 })
    // A discount the app's sentences cannot describe is not recorded as one.
    for (const bad of [{ duration: 'forever', duration_in_months: null }, { duration: 'once', duration_in_months: null }, { duration_in_months: 3 }, { percent_off: null }, { percent_off: 100 }]) {
      assert.deepEqual(f(d(bad), { offer_code: 'BAILEY', offer_percent_off: '50' }), { code: null, percentOff: null }, JSON.stringify(bad))
    }
    // No discount field on the object: the checkout's own record is used.
    assert.deepEqual(f({}, { offer_code: 'BAILEY', offer_percent_off: '50' }), { code: 'BAILEY', percentOff: 50 })
    assert.deepEqual(f({ discount: null }, {}), { code: null, percentOff: null })
    // `discount: null` is Stripe saying no discount applies. The checkout's note that one was meant to is not believed.
    assert.deepEqual(f({ discount: null }, { offer_code: 'BAILEY', offer_percent_off: '50' }), { code: null, percentOff: null })
    assert.deepEqual(f({}, { offer_code: 'BAILEY' }), { code: null, percentOff: null })
    assert.deepEqual(f({}, null), { code: null, percentOff: null })
  } finally { m.restore() }
})

test('offer codes (executed): the confirmation email states the discounted first charge and the price after it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ss-confirm-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  writeFileSync(join(dir, 'send.mjs'), 'export const sendEmail = async () => ({ sent: true }); export const wrapEmailHtml = (b, f) => b + f')
  writeFileSync(join(dir, 'html.mjs'), 'export const escapeHtml = (x) => String(x)')
  put('timezone', read('src/lib/email/timezone.ts'))
  put('confirm', read('src/lib/email/subscription-confirmation.ts').replace("from './send'", "from './send.mjs'").replace("from './html'", "from './html.mjs'").replace("from './timezone'", "from './timezone.mjs'").replace("from '@/lib/pricing'", "from './pricing.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  const { buildSubscriptionConfirmationEmail: build } = await import(pathToFileURL(join(dir, 'confirm.mjs')).href)
  const end = new Date('2026-11-17T00:00:00Z')
  const noCard = build({ trialEnd: end, cardOnFile: false, percentOff: 50 }).html
  assert.ok(noCard.includes('A card you add is charged $4.99 for your first paid month (50% off) when the trial ends, then $9.99/month until you cancel.'), noCard)
  const card = build({ trialEnd: end, cardOnFile: true, percentOff: 50 }).html
  assert.ok(card.includes('your card will be charged $4.99 for your first paid month (50% off) when the trial ends, 7 days after you signed up (Tuesday, November 17, 2026 at 12:00 AM UTC)</strong>, then $9.99/month until you cancel.'), card)
  const today = build({ trialEnd: null, percentOff: 50 }).html
  assert.ok(today.includes('Your card is charged $4.99 for your first paid month (50% off) today, then $9.99/month until you cancel.'), today)
  // Without a code, the wording is what it was.
  const plain = build({ trialEnd: end, cardOnFile: true }).html
  assert.ok(plain.includes('your card will be charged $9.99/month when the trial ends, 7 days after you signed up (Tuesday, November 17, 2026 at 12:00 AM UTC)</strong>, and again every month after that until you cancel.'), plain)
  assert.ok(build({ trialEnd: null }).html.includes('Your card is charged $9.99/month today and every month after that until you cancel.'))
  // Dates are in the member's own time zone, so the email and the app name the same day.
  // The real case: a trial ending Nov 18 06:11 UTC is Tuesday Nov 17, 10:11 PM in California.
  const real = new Date('2026-11-18T06:11:47Z')
  const la = build({ trialEnd: real, cardOnFile: false, timezone: 'America/Los_Angeles' })
  assert.equal(la.subject, 'Your Seoul Sister free trial has started (ends November 17, 2026 PST)', 'the zone is named in the subject too')
  assert.ok(la.html.includes('The trial ends Tuesday, November 17, 2026 at 10:11 PM PST.'), la.html)
  for (const unknown of [undefined, null, '', 'Not/AZone']) {
    const utc = build({ trialEnd: real, cardOnFile: false, timezone: unknown })
    assert.equal(utc.subject, 'Your Seoul Sister free trial has started (ends November 18, 2026 UTC)', `timezone=${unknown}`)
  // A zone typed as a city can differ from the device: the zone is always printed, so the date is never bare.
  const chi = build({ trialEnd: new Date('2026-11-18T06:30:00Z'), cardOnFile: false, timezone: 'America/Chicago' })
  assert.equal(chi.subject, 'Your Seoul Sister free trial has started (ends November 18, 2026 CST)')
  assert.ok(chi.html.includes('The trial ends Wednesday, November 18, 2026 at 12:30 AM CST.'))
    assert.ok(utc.html.includes('The trial ends Wednesday, November 18, 2026 at 6:11 AM UTC.'), utc.html)
  }
  for (const h of [noCard, card, today]) assert.doesNotMatch(h, /every month after that/, 'a discounted member is never told the first price repeats')
  assert.doesNotMatch(today, /free trial/, 'someone charged today has no free trial to cancel during')
  assert.match(card, /If you cancel during the free trial, you won\'t be charged\./)
})

test('offer codes (executed): the trial-ending notice states the discounted price to a member who has the code', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ss-ending-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  writeFileSync(join(dir, 'send.mjs'), 'export const sendEmail = async () => ({ sent: true }); export const wrapEmailHtml = (b, f) => b + f')
  writeFileSync(join(dir, 'html.mjs'), 'export const escapeHtml = (x) => String(x)')
  put('timezone', read('src/lib/email/timezone.ts'))
  put('trial-emails', read('src/lib/email/trial-emails.ts').replace("from './send'", "from './send.mjs'").replace("from './html'", "from './html.mjs'").replace("from './timezone'", "from './timezone.mjs'").replace("from '@/lib/pricing'", "from './pricing.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  put('trial-notices', read('src/lib/trial-notices.ts').replace(/from '@\/lib\/email\/trial-emails'/, "from './trial-emails.mjs'"))
  const { trialEndingLine } = await import(pathToFileURL(join(dir, 'trial-emails.mjs')).href)
  const end = '2026-11-27T04:00:00Z'
  assert.equal(
    trialEndingLine(end, { hasPaymentMethod: true, cancelAtPeriodEnd: false }, 'America/Chicago', 50),
    'Your free trial ends on Thursday, November 26 (CST). Your card will be charged $4.99 for your first paid month (50% off) on that day, then $9.99/month until you cancel.'
  )
  assert.equal(
    trialEndingLine(end, { hasPaymentMethod: false, cancelAtPeriodEnd: false }, 'America/Chicago', 50),
    'Your free trial ends on Thursday, November 26 (CST). No card is on file, so nothing will be charged and your membership will stop on that day. To keep going, sign in and use the "Add a card" button at the top of any page: $4.99 for your first paid month (50% off) when the trial ends, then $9.99/month.'
  )
  // The trial-ended email: unchanged without a code; with one, it says the code can be used again and where.
  const { buildTrialEndedEmail } = await import(pathToFileURL(join(dir, 'trial-emails.mjs')).href)
  const KEEP = 'If you would like to keep going, membership is $9.99/month. You can start it any time at <a href="https://www.seoulsister.com/subscribe">seoulsister.com/subscribe</a>, and Yuri picks up from where you left off.'
  for (const none of [undefined, {}, { offerCode: null }, { offerCode: '' }, { offerCode: '<b>x</b>' }]) {
    assert.ok(buildTrialEndedEmail(none).html.includes(`${KEEP} If not, there is nothing you need to do.</p>`), JSON.stringify(none))
  }
  assert.ok(buildTrialEndedEmail({ offerCode: 'bailey' }).html.includes(`${KEEP} You started your trial with code BAILEY. It can be used again there while it is still accepted: it is applied by itself in the browser you signed up in, and on another device you can type it on the payment page. If not, there is nothing you need to do.</p>`))
  // A stored zone the runtime does not know is treated as unknown, never a thrown error inside a notice.
  assert.equal(trialEndingLine(end, null, 'Mars/Olympus'), 'Your free trial ends on Friday, November 27 (UTC).')
  // The sender reads the percentage off the trial row and passes it through.
  const src = read('src/lib/trial-notices.ts')
  assert.match(src, /trialEndingLine\(t\.trial_end, state, await deps\.timezoneForUser\(t\.user_id\), pct && pct > 0 \? pct : null\)/)
})

// ---------------------------------------------------------------------------
// Yuri is told about a visitor's code as a FACT (both chat surfaces).
// ---------------------------------------------------------------------------
const YURI_ACTIVE = 'Creator code: this visitor has the code BAILEY saved in this browser. For someone who is not yet a member, it takes 50% off the first paid month: $4.99 instead of $9.99. Every month after that is $9.99/month, so where anything else here says $9.99/month, for this person that begins with the second paid month. If they start membership in this same browser the code is applied for them; on another device or browser they can type it on the payment page. The free trial is the same with or without it. The discount covers the first paid month only. When the code itself stops being accepted is not shown to you. It matters only if price or the code comes up.'
const YURI_ENDED = 'Creator code: this visitor arrived with the code BAILEY, and it is no longer accepted, so membership for them is $9.99/month.'
const YURI_UNCHECKED = "Creator code: this visitor's browser holds a creator code that could not be checked just now, so whether it applies is not visible to you."

test('offer codes (executed): what Yuri is told about a code is these exact sentences and nothing else', async () => {
  const m = await loadModules()
  try {
    // Pinned whole: any added sentence (a deadline, a count, a nudge to sell) fails here.
    assert.equal(m.offers.offerFactForYuri({ state: 'active', code: 'BAILEY', percentOff: 50 }), YURI_ACTIVE)
    assert.equal(m.offers.offerFactForYuri({ state: 'ended', code: 'BAILEY' }), YURI_ENDED)
    assert.equal(m.offers.offerFactForYuri({ state: 'unchecked' }), YURI_UNCHECKED)
  } finally { m.restore() }
})

test('offer codes (executed): Yuri is told only what Stripe confirmed; when it cannot be asked she is told exactly that, and the turn does not wait', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ss-fact-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  writeFileSync(join(dir, 'stripe.mjs'), `export const getStripeClient = () => ({ promotionCodes: { list: async () => { globalThis.__factCalls = (globalThis.__factCalls ?? 0) + 1; if (globalThis.__factPromo === 'THROW') throw new Error('stripe down'); if (globalThis.__factPromo === 'HANG') await new Promise((r) => setTimeout(r, 4000)); return { data: globalThis.__factPromo ? [globalThis.__factPromo] : [] } } } })`)
  put('offers-server', read('src/lib/offers-server.ts').replace("from '@/lib/stripe'", "from './stripe.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  const { offerFactLine } = await import(pathToFileURL(join(dir, 'offers-server.mjs')).href)
  const promo = (over = {}) => ({ id: 'promo_1', active: true, metadata: creator, coupon: coupon(), ...over })
  const t0 = 1_000_000

  globalThis.__factCalls = 0
  assert.equal(await offerFactLine(null), null)
  assert.equal(await offerFactLine('<script>'), null)
  assert.equal(globalThis.__factCalls, 0, 'no code, no Stripe call')

  // Stripe down: she is told only that the code could not be checked. That is
  // remembered for one minute, then Stripe is asked again.
  globalThis.__factPromo = 'THROW'
  assert.equal(await offerFactLine('BAILEY', t0 - 10 * 60 * 1000), YURI_UNCHECKED)
  globalThis.__factPromo = promo()
  assert.equal(await offerFactLine('BAILEY', t0 - 10 * 60 * 1000 + 30 * 1000), YURI_UNCHECKED)
  assert.equal(await offerFactLine('bailey', t0), YURI_ACTIVE)
  // Stripe slow: the chat turn gets an answer in about 1.5 seconds, not Stripe's 80.
  globalThis.__factPromo = 'HANG'
  const started = Date.now()
  assert.equal(await offerFactLine('SLOWCODE', t0), YURI_UNCHECKED)
  assert.ok(Date.now() - started < 2500, 'must not wait on Stripe')
  globalThis.__factPromo = promo()
  // Kept for five minutes, then asked again.
  const before = globalThis.__factCalls
  globalThis.__factPromo = promo({ active: false })
  assert.equal(await offerFactLine('BAILEY', t0 + 4 * 60 * 1000), YURI_ACTIVE)
  assert.equal(globalThis.__factCalls, before)
  assert.equal(await offerFactLine('BAILEY', t0 + 6 * 60 * 1000), YURI_ENDED)
  // A private code, or no such code: nothing at all.
  globalThis.__factPromo = promo({ metadata: {} })
  assert.equal(await offerFactLine('ANNKOREA', t0), null)
  globalThis.__factPromo = null
  assert.equal(await offerFactLine('NOPE', t0), null)
})

test('offer codes: the fact reaches both chats in the per-turn block, never the cached prompt', () => {
  const route = read('src/app/api/widget/chat/route.ts')
  assert.match(route, /const offerFact = await offerFactLine\(parsed\.offer_code\)/)
  assert.match(route, /\$\{visitorCountryFact\([^\n]*\)\}\$\{offerFact \? `\\n- \$\{offerFact\}` : ''\}\n- Continuity in this browser/)
  const widgetSrc = read('src/components/widget/TryYuriSection.tsx')
  assert.match(widgetSrc, /\.\.\.\(offerCodeRef\.current \? \{ offer_code: offerCodeRef\.current \} : \{\}\),/)
  assert.match(widgetSrc, /const savedOffer = useSavedOffer\(\)\n  const offerCodeRef = useRef<string \| null>\(null\)\n  offerCodeRef\.current = savedOffer\.codeForChat\n/)
  // The code reaches the request from that one assignment and nowhere else.
  assert.equal((widgetSrc.match(/offerCodeRef/g) ?? []).length, 4, 'declared, assigned once, read twice in one expression')
  assert.equal((widgetSrc.match(/offer_code/g) ?? []).length, 1)
  assert.doesNotMatch(widgetSrc, /getOfferCode|ss_offer_code|OFFER_STORAGE_KEY|localStorage\.getItem\('ss_offer/, 'the widget sends only the code useSavedOffer cleared for this person')
  assert.match(read('src/app/(app)/onboarding/page.tsx'), /\.\.\.\(getOfferCode\(\) \? \{ offer_code: getOfferCode\(\) \} : \{\}\),/)
  const lib = read('src/lib/yuri/onboarding.ts')
  assert.match(lib, /Nothing has been paid\.`\n    \)\n    if \(facts\.offerFact\) statusLines\.push\(facts\.offerFact\)\n  \}/, 'only for someone who is not a member yet')
  assert.match(lib, /cumulativeGive,\n    offerFact,\n    previewAgeFact: /)
  // Injected exactly once in the widget, with nothing added around it, and the
  // browser's value reaches the lookup unchanged on both routes.
  assert.equal((route.match(/offerFact/g) ?? []).length, 5, 'the import, one lookup, and one template expression (two mentions); nothing else')
  assert.doesNotMatch(route, /Creator code/, 'the wording lives in offers.ts only, never in the cached widget prompt')
  for (const r of [route, read('src/app/api/yuri/onboarding/route.ts')]) assert.match(r, /\n  offer_code: z\.string\(\)\.max\(40\)\.optional\(\)\.nullable\(\),\n/)
  assert.match(read('src/lib/offers.ts'), /export function getOfferCode\(\): string \| null \{\n  if \(typeof window === 'undefined'\) return null\n  try \{\n    return normalizeOfferCode\(window\.localStorage\.getItem\(OFFER_STORAGE_KEY\)\)\n  \} catch \{\n    return null\n  \}\n\}/)
  const cached = lib.slice(lib.indexOf('function buildOnboardingSystemPrompt'), lib.indexOf('export interface OnboardingTurnFacts'))
  assert.ok(cached.length > 2000)
  assert.doesNotMatch(cached, /offerFact|Creator code/)
})

test('saved code: who it is spoken of to, and what is said at each step (executed)', async () => {
  const m = await loadModules()
  try {
    const o = m.offers
    // Every combination, closed world.
    assert.deepEqual(
      [[false, null, true], [false, 'pro_monthly', true], [false, null, false], [true, null, true], [true, 'free', true], [true, '', true],
        [true, 'pro_monthly', true], [true, 'pro', true], [true, 'monthly', true], [true, 'anything_else', true],
        [true, 'free', false], [true, 'pro_monthly', false], [true, 'monthly', false], [true, null, false]]
        .map(([s, p, k]) => o.offerAudience(s, p, k)),
      // 'monthly' is the plan every $9.99 member and every trial gets (planFromStripePriceId).
      ['applies', 'applies', 'applies', 'applies', 'applies', 'applies', 'member', 'member', 'member', 'member', 'unknown', 'unknown', 'unknown', 'unknown']
    )
    const ACTIVE = { state: 'active', code: 'BAILEY', percent_off: 50, line: 'applied', saved_line: 'Code BAILEY saved: 50% off your first paid month.' }
    const run = async ({ code = 'BAILEY', signedIn = false, plan = null, known = true, answer = ACTIVE, askThrows = false }) => {
      const updates = []; const calls = { plan: 0, ask: 0, forget: 0 }
      let thrown = null
      await o.resolveSavedOffer({
        code, signedIn,
        readPlan: async () => { calls.plan++; return { plan, known } },
        askOffer: async () => { calls.ask++; if (askThrows) throw new Error('net'); return answer },
        forget: () => { calls.forget++ },
        onUpdate: (u) => updates.push(u),
      }).catch((e) => { thrown = e })
      return { updates, calls, last: updates[updates.length - 1], thrown }
    }
    const NOTHING = { line: null, percentOff: null, codeForChat: null }
    const SAVED = { line: 'Code BAILEY saved: 50% off your first paid month.', percentOff: 50, codeForChat: 'BAILEY' }
    const PENDING = { line: null, percentOff: null, codeForChat: 'BAILEY' }

    // No code: nothing, and nobody is asked anything.
    let r = await run({ code: null })
    assert.deepEqual([r.updates, r.calls], [[NOTHING], { plan: 0, ask: 0, forget: 0 }])
    // A visitor who is not signed in: membership is not read.
    r = await run({})
    assert.deepEqual([r.updates, r.calls], [[PENDING, SAVED], { plan: 0, ask: 1, forget: 0 }])
    // Signed in, not yet a member: the code is theirs to use.
    for (const plan of [null, 'free']) {
      r = await run({ signedIn: true, plan })
      assert.deepEqual([r.updates, r.calls], [[PENDING, SAVED], { plan: 1, ask: 1, forget: 0 }])
    }
    // A member: nothing is shown, no code goes to Yuri, Stripe is not asked, the code is kept.
    r = await run({ signedIn: true, plan: 'pro_monthly' })
    assert.deepEqual([r.updates, r.calls], [[NOTHING], { plan: 1, ask: 0, forget: 0 }])
    // Membership unreadable: the same silence.
    r = await run({ signedIn: true, plan: null, known: false })
    assert.deepEqual([r.updates, r.calls], [[NOTHING], { plan: 1, ask: 0, forget: 0 }])
    // Stripe says the code ended: said once, forgotten, never sent to Yuri.
    r = await run({ answer: { state: 'ended', code: 'BAILEY', line: 'Code BAILEY is no longer available, so membership is $9.99/month.' } })
    assert.deepEqual(r.last, { line: 'Code BAILEY is no longer available, so membership is $9.99/month.', percentOff: null, codeForChat: null })
    assert.equal(r.calls.forget, 1)
    // A code Stripe does not know: forgotten and nothing said.
    r = await run({ answer: { state: 'unknown' } })
    assert.deepEqual([r.last, r.calls.forget], [NOTHING, 1])
    // Stripe could not be asked: no claim, the code is kept and still goes with a chat message.
    r = await run({ answer: null })
    assert.deepEqual([r.updates, r.calls.forget], [[PENDING], 0])
    r = await run({ askThrows: true })
    assert.deepEqual([r.updates, r.calls.forget, r.thrown?.message], [[PENDING], 0, 'net'])
    // A percentage that is not usable is never shown as a price.
    r = await run({ answer: { ...ACTIVE, percent_off: 150 } })
    assert.equal(r.last.percentOff, null)
  } finally { m.restore() }
})

test('saved code: the plan is read by user_id, and /api/offer is asked once per page (executed)', async () => {
  const m = await loadModules()
  const realError = console.error
  const errors = []
  console.error = (...a) => errors.push(a.join(' '))
  try {
    const o = m.offers
    // readMemberPlan: the exact table, column and key, and a failed read is "not known".
    const calls = []
    const db = (result) => ({
      from(table) {
        const q = {
          select(c) { calls.push(['select', c]); return q },
          eq(c, v) { calls.push(['eq', c, v]); return q },
          maybeSingle: async () => result,
        }
        calls.push(['from', table])
        return q
      },
    })
    assert.deepEqual(await o.readMemberPlan(db({ data: { plan: 'monthly' }, error: null }), 'user-1'), { plan: 'monthly', known: true })
    assert.deepEqual(calls, [['from', 'ss_user_profiles'], ['select', 'plan'], ['eq', 'user_id', 'user-1']])
    assert.deepEqual(await o.readMemberPlan(db({ data: null, error: null }), 'user-1'), { plan: null, known: true }, 'no profile row yet: not a member')
    assert.deepEqual(await o.readMemberPlan(db({ data: { plan: null }, error: null }), 'user-1'), { plan: null, known: true })
    assert.deepEqual(await o.readMemberPlan(db({ data: null, error: { message: 'rls' } }), 'user-1'), { plan: null, known: false })
    assert.equal(errors.filter((e) => e.includes('could not read membership') && e.includes('rls')).length, 1)

    // askOfferOnce: two components, one request; the URL is encoded; a failure is not kept.
    const urls = []
    const ok = (body) => async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => body } }
    const [a, b] = await Promise.all([o.askOfferOnce('BAILEY', ok({ state: 'active', percent_off: 50 })), o.askOfferOnce('BAILEY', ok({ state: 'never' }))])
    assert.deepEqual([a, b], [{ state: 'active', percent_off: 50 }, { state: 'active', percent_off: 50 }])
    assert.deepEqual(urls, ['/api/offer?code=BAILEY'])
    await o.askOfferOnce('BAILEY', ok({ state: 'never' }))
    assert.equal(urls.length, 1, 'an answer is reused')
    // ...for five minutes, then Stripe is asked again (a code may have ended).
    assert.equal(o.OFFER_LOOKUP_TTL_MS, 5 * 60 * 1000)
    const realNow = Date.now
    try {
      const t0 = realNow()
      Date.now = () => t0 + 5 * 60 * 1000 - 1000
      await o.askOfferOnce('BAILEY', ok({ state: 'never' }))
      assert.equal(urls.length, 1)
      Date.now = () => t0 + 5 * 60 * 1000 + 1000
      assert.deepEqual(await o.askOfferOnce('BAILEY', ok({ state: 'ended', line: 'gone' })), { state: 'ended', line: 'gone' })
      assert.equal(urls.length, 2)
    } finally { Date.now = realNow }
    urls.length = 1
    await o.askOfferOnce('A B', ok({ state: 'unknown' }))
    assert.equal(urls[1], '/api/offer?code=A%20B')
    // 429 / 5xx: null, logged, and asked again next time.
    const limited = async (url) => { urls.push(url); return { ok: false, status: 429, json: async () => ({}) } }
    assert.equal(await o.askOfferOnce('LATER', limited), null)
    await new Promise((r) => setTimeout(r, 0))
    assert.deepEqual(await o.askOfferOnce('LATER', ok({ state: 'active', percent_off: 50 })), { state: 'active', percent_off: 50 })
    assert.equal(errors.filter((e) => e.includes('/api/offer answered 429')).length, 1)
    // A thrown fetch rejects (the hook logs it) and is asked again next time.
    await assert.rejects(o.askOfferOnce('THROWS', async () => { throw new Error('offline') }), /offline/)
    await new Promise((r) => setTimeout(r, 0))
    assert.deepEqual(await o.askOfferOnce('THROWS', ok({ state: 'ended' })), { state: 'ended' })
  } finally { console.error = realError; m.restore() }
})

test('pricing card: the free week leads and the price is stated; the allowance lives in the Terms and the member chat (Nov 11 2026)', async () => {
  const m = await loadModules()
  try {
    // Exact wording, executed.
    assert.deepEqual(m.offers.pricingCardLines(), {
      headline: 'Free for 7 days',
      noCard: 'No card needed to start.',
      after: 'Then $9.99/month, only if you add a card. Cancel anytime.',
      who: 'The free week is for new members.',
      cta: 'Start my 7 free days',
    })
  } finally { m.restore() }
  // The allowance has ONE source. Executed: the number Yuri, the emails and the
  // small print state is the number the server enforces.
  const P = await import('data:text/javascript;base64,' + Buffer.from(transpile(read('src/lib/pricing.ts'))).toString('base64'))
  assert.deepEqual({ ...P.USAGE_CAPS }, { yuri_messages_per_month: 80, scans_per_month: 30 })
  assert.equal(P.PRICING.yuri_allowance_display, '80 messages with Yuri a month')
  assert.equal(P.allowanceNote(), 'Includes 80 Yuri messages and 30 label scans each calendar month.')
  assert.match(read('src/lib/pricing.ts'), /yuri_allowance_display: `\$\{USAGE_CAPS\.yuri_messages_per_month\} messages with Yuri a month`,/)

  const card = read('src/components/pricing/PricingCards.tsx')
  // The four lines, their order and their sizes, exactly. The headline is the
  // only text-4xl on the card and nothing is larger.
  assert.ok(card.includes(`        <p className="text-4xl font-bold text-white leading-tight">{lines.headline}</p>
        <p className="text-base font-semibold text-gold-light mb-3">{lines.noCard}</p>
        <p className="text-sm text-white/80 mb-1">{lines.after}</p>
        <p className="text-sm text-white/60 mb-6">{lines.who} Less than a single skin consult, and she never closes.</p>`))
  assert.equal((card.match(/text-4xl/g) ?? []).length, 1)
  assert.doesNotMatch(card, /text-(5|6|7|8|9)xl/)
  assert.doesNotMatch(card, /PRICING\.|tier\.price|\$\{?9|9\.99/, 'every price on the card comes from pricingCardLines')
  assert.match(card, /\) : \(\s*lines\.cta\s*\)\}/)
  // And the whole card file by fingerprint: an added line ("No card is ever
  // needed.") or a changed button label passed every assertion above in review.
  assert.equal(sha('sha256').update(card).digest('hex'), '71455f161bf30a499b0c68ecc0ab627307f55248aeebdf28bd1e40a481e9e978')

  // The allowance is NOT on the pricing card or the membership page (owner
  // decision, Nov 11 2026: the "79 messages" month was the co-owner testing;
  // real member-months have a median of 8 messages). It must still be stated
  // in the Terms and shown in the member chat before it bites, and nothing
  // may call membership unlimited.
  const paywall = read('src/app/(auth)/subscribe/page.tsx')
  for (const [name, src] of [['card', card], ['paywall', paywall]]) {
    assert.doesNotMatch(src, /allowanceNote|USAGE_CAPS|label scans each/, `${name}: the allowance note is back`)
    // The SHAPE, not one wording: no count of messages, chats or scans, and no promise of endless use.
    assert.doesNotMatch(src, /\b\d{2,4}\b[^.<>{}\n]{0,30}\b(messages?|chats?|scans?|conversations?|questions?)\b/i, `${name}: a usage count is stated`)
    assert.doesNotMatch(src, /unlimited|no (limit|cap)|as (much|many|often) as|all you (want|like)|endless|without limit/i, name)
  }
  assert.match(read('src/app/(legal)/terms/page.tsx'), /Membership includes a monthly allowance of \{USAGE_CAPS\.yuri_messages_per_month\} messages with Yuri and \{USAGE_CAPS\.scans_per_month\} label scans, counted per calendar month \(UTC\)/)
  const chat = read('src/app/(app)/yuri/page.tsx')
  // What a member is shown from 80% used: how many are left, of how many, and when it resets. The whole element, exactly.
  assert.ok(chat.includes(`          {usage && usage.yuri_usage_pct >= 80 && (
            <div className="flex items-center gap-1.5 text-xs" role="status">
              <MessageCircle className="w-3 h-3 text-white/40" />
              <span className={usage.yuri_usage_pct >= 100 ? 'text-red-400' : 'text-gold-light'}>
                {usage.yuri_messages_remaining} of {usage.yuri_messages_limit} messages left this month, resets {nextMonthStart()}
              </span>
            </div>
          )}`), 'the 80% notice is missing, hidden or reworded')
  // The Terms sentence is rendered, not commented out.
  const terms = read('src/app/(legal)/terms/page.tsx')
  const sentenceAt = terms.indexOf('Membership includes a monthly allowance of')
  assert.ok(terms.lastIndexOf('{/*', sentenceAt) <= terms.lastIndexOf('*/}', sentenceAt), 'the allowance sentence sits inside a comment')
  assert.match(terms.slice(terms.lastIndexOf('\n', sentenceAt), sentenceAt), /^\n\s*<li>$/)
  assert.match(chat, /You&apos;ve used this month&apos;s \{usage\.yuri_messages_limit\} messages with Yuri\./)

  // The feature bullets, closed world: exactly these nine, no number, no "unlimited".
  const stripe = read('src/lib/stripe.ts')
  const monthly = stripe.slice(stripe.indexOf('  monthly: {'), stripe.indexOf('  // Legacy/comped plan'))
  const bullets = [...monthly.slice(monthly.indexOf('features: [')).matchAll(/^\s+['`](.*)['`],$/gm)].map((x) => x[1])
  assert.deepEqual(bullets, [
    'Yuri, your K-beauty advisor, available 24/7',
    'All 6 built-in AI specialists (ingredients, routines, authenticity & more)',
    'Reads your Korean labels & builds conflict-aware routines',
    'Remembers your skin across every session',
    'Glass Skin Score photo tracking',
    'Counterfeit warning signs & price checks',
    'Finds dupes & the right sunscreen for your skin',
    'Weather- & cycle-aware guidance',
    'Trending in Korea before it hits the US',
  ])

  // "Unlimited" and its near phrases are said about the current plan nowhere a
  // customer or Yuri can read them. Closed world over src/, counted PER
  // OCCURRENCE: a file that is allowed one use (a code comment, an internal
  // key, the retired plan's bullet, a "never claim unlimited" rule) fails the
  // moment it gains another. A file list alone let "unlimited" be added to the
  // widget's limit card and the LGAAS pricing feed in review.
  const NO_LIMIT_WORDS = /unlimited|open-ended|no (?:message |usage )?(?:limit|cap)s?\b|without (?:a )?limits?|as much as you (?:like|want)/gi
  const found = {}
  const walk = (dir) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const n = (read(p).match(NO_LIMIT_WORDS) ?? []).length
        if (n) found[p] = n
      }
    }
  }
  walk('src')
  assert.deepEqual(found, {
    'src/app/(auth)/register/page.tsx': 1,
    'src/app/(legal)/terms/page.tsx': 1,
    'src/app/api/lgaas/pricing/route.ts': 1,
    'src/app/api/widget/chat/route.ts': 1,
    'src/app/api/yuri/onboarding/route.ts': 1,
    'src/components/auth/AuthCaptcha.tsx': 1,
    'src/lib/pricing.ts': 2,
    'src/lib/stripe.ts': 2,
    'src/lib/subscription.ts': 4,
    'src/lib/utils/email-normalize.ts': 1,
    'src/lib/widget/subscriber-surface.ts': 2,
    'src/lib/yuri/advisor.ts': 2,
  })
  assert.match(read('src/lib/widget/subscriber-surface.ts'), /never describe membership as unlimited or as having no cap\./)
  assert.deepEqual(read('src/lib/yuri/advisor.ts').match(/[^.;]*unlimited[^.;]*/gi), [' use those numbers, never assume unlimited'])
  // The month the Terms describe is the month the code counts (executed).
  const usageSrc = read('src/lib/usage.ts')
  const fnSrc = usageSrc.slice(usageSrc.indexOf('export function currentUsagePeriod'), usageSrc.indexOf('\n}\n', usageSrc.indexOf('export function currentUsagePeriod')) + 3)
  const U = await import('data:text/javascript;base64,' + Buffer.from(transpile(fnSrc)).toString('base64'))
  assert.deepEqual(U.currentUsagePeriod(new Date('2026-11-30T23:59:59Z')), { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' })
  assert.deepEqual(U.currentUsagePeriod(new Date('2026-12-01T00:00:00Z')), { start: '2026-12-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' })
  assert.deepEqual(U.currentUsagePeriod(new Date('2026-12-31T23:30:00-08:00')), { start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' }, 'UTC, not local time')

  // The Terms state the allowance from the same numbers, what the month is, and what happens at the limit.
  assert.ok(read('src/app/(legal)/terms/page.tsx').includes('<li>Membership includes a monthly allowance of {USAGE_CAPS.yuri_messages_per_month} messages with Yuri and {USAGE_CAPS.scans_per_month} label scans, counted per calendar month (UTC). A free trial counts toward the same month. When an allowance is used up, that feature pauses until the next month begins. Your routine, shelf and history stay available, weekly check-in notes may still arrive, and nothing extra is charged</li>'))
  assert.match(read('src/lib/usage.ts'), /The current usage period: this calendar month in UTC/)
  // Members are still told their allowance, and so is Yuri on the member side.
  assert.match(read('src/lib/email/subscription-confirmation.ts'), /PRICING\.yuri_allowance_display/)
  assert.match(read('src/lib/yuri/advisor.ts'), /\$\{PRICING\.yuri_allowance_display\} plus \$\{USAGE_CAPS\.scans_per_month\} label scans/)
})
