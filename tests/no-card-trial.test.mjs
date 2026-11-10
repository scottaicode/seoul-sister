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
  put('stripe-params', read('src/lib/stripe-params.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  put('funnel', read('src/lib/proactive/campaign-funnel.ts'))
  const saved = { ...process.env }
  Object.assign(process.env, env)
  const load = (name) => import(pathToFileURL(join(dir, `${name}.mjs`)).href)
  return {
    trial: await load('trial'),
    events: await load('trial-events'),
    params: await load('stripe-params'),
    funnel: await load('funnel'),
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
    assert.deepEqual(db.tables.ss_trial_starts[0], { email_canonical: 'jdoe@gmail.com', user_id: 'u1', stripe_subscription_id: 'sub_1', card_required: false, trial_end: '2026-11-17T00:00:00Z', ip_hash: 'net1' })
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
          'Your 7-day free trial starts today. No card is needed and nothing is charged. The trial ends after 7 days and your membership stops then, unless you have added a card with the "Add a card" button inside Seoul Sister. If you add one, it is charged $9.99/month when the trial ends and every month after that until you cancel.',
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
      'Your card will be charged $9.99/month today and every month after that until you cancel. Cancel anytime from your Profile page (Manage subscription) or by replying to any Seoul Sister email.'
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
    assert.deepEqual(f.trial, { ends_at: '2026-11-17T00:00:00Z', card_on_file: null, cancelled: null })
    const ok = await m.trial.trialFacts(fakeDb(trialing('2026-11-17T00:00:00Z')), me, { liveState: async () => ({ status: 'trialing', hasPaymentMethod: true, cancelAtPeriodEnd: true }), now: NOW })
    assert.deepEqual(ok.trial, { ends_at: '2026-11-17T00:00:00Z', card_on_file: true, cancelled: true })
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
  assert.match(setup, /sendSubscriptionConfirmation\(\s*cardEmail,[\s\S]{0,120}\{ cardOnFile: true \}/, 'saving the card starts auto-renewal: the terms go to the member in writing')
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
  assert.match(webhook, /sendSubscriptionConfirmation\(buyerEmail, trialEnd, \{ cardOnFile: !noCardTrial \}\)/)
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
  assert.match(webhook, /await sendTrialEndedEmail\(lapsedEmail\)/)
})

test('deleting an account cancels its Stripe subscription first', () => {
  const del = read('src/app/api/account/delete/route.ts')
  const cancel = del.indexOf('await cancelSubscriptionNow(')
  const wipe = del.indexOf("for (const table of tables)")
  assert.ok(cancel > 0 && cancel < wipe, 'cancel in Stripe BEFORE our row is deleted, or a member with a card is billed with no account')
  const photos = del.indexOf('await purgeUserPhotos(')
  assert.ok(photos > cancel, 'if Stripe fails the deletion stops: nothing (photos included) may have been removed yet')
})

test('migrations: the ledger has RLS on, no account foreign key, and the network column', () => {
  const m1 = read('supabase/migrations/20261110000002_trial_starts.sql')
  assert.match(m1, /email_canonical text NOT NULL UNIQUE/)
  assert.match(m1, /ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(m1, /REFERENCES/i)
  assert.doesNotMatch(m1, /CREATE POLICY/i)
  assert.match(read('supabase/migrations/20261110000003_trial_starts_network.sql'), /ADD COLUMN IF NOT EXISTS ip_hash text/)
})
