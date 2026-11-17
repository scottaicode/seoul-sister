/**
 * The free week started on our own membership page, with no Stripe-hosted
 * page (Nov 15 2026, behind DIRECT_FREE_WEEK=on, off by default).
 *
 * Why: a tester met Stripe's page (a price, a code box, the word "trial") on
 * a step that takes no card and thought she was about to be charged.
 *
 * What is pinned here: the switch, exactly what Stripe is sent, that two
 * presses cannot make two subscriptions, the words the page adds, and that
 * none of those words describes a page that is no longer there.
 */
import { createHash } from 'node:crypto'
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

async function loadModules(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ss-direct-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('email-normalize', read('src/lib/utils/email-normalize.ts'))
  put('trial', read('src/lib/trial.ts').replace("from '@/lib/utils/email-normalize'", "from './email-normalize.mjs'").replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  put('stripe-params', read('src/lib/stripe-params.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  writeFileSync(join(dir, 'send.mjs'), 'export const sendEmail = async () => ({ sent: true }); export const wrapEmailHtml = (b, f) => b + f')
  writeFileSync(join(dir, 'html.mjs'), 'export const escapeHtml = (x) => String(x)')
  put('timezone', read('src/lib/email/timezone.ts'))
  put('confirm', read('src/lib/email/subscription-confirmation.ts').replace("from './send'", "from './send.mjs'").replace("from './html'", "from './html.mjs'").replace("from './timezone'", "from './timezone.mjs'").replace("from '@/lib/pricing'", "from './pricing.mjs'").replace("from '@/lib/offers'", "from './offers.mjs'"))
  const saved = { ...process.env }
  for (const k of ['DIRECT_FREE_WEEK', 'NO_CARD_TRIAL_ENABLED', 'VERCEL_ENV', 'NODE_ENV']) delete process.env[k]
  Object.assign(process.env, env)
  const load = (name) => import(pathToFileURL(join(dir, `${name}.mjs`)).href)
  return { trial: await load('trial'), offers: await load('offers'), params: await load('stripe-params'), confirm: await load('confirm'), restore: () => { process.env = saved } }
}

test('the switch: on in production unless stopped, off elsewhere unless turned on, and off whenever the no-card week is stopped', async () => {
  // Since Nov 16 2026 creating an account starts the free week, so this is how
  // the week starts for everyone. It was off-by-default while it was new.
  for (const [env, want] of [
    // Not set: on in the production deployment only. A laptop or a preview
    // build with the live Stripe key must not make real subscriptions.
    [{}, false],
    [{ VERCEL_ENV: 'preview' }, false],
    [{ VERCEL_ENV: 'development' }, false],
    [{ NODE_ENV: 'production' }, false],
    [{ VERCEL_ENV: 'production' }, true],
    // Set: it decides, wherever it runs.
    [{ DIRECT_FREE_WEEK: 'on' }, true],
    [{ DIRECT_FREE_WEEK: 'ON', VERCEL_ENV: 'preview' }, true],
    [{ DIRECT_FREE_WEEK: 'true' }, true],
    // The emergency stop works however it is typed in a hurry.
    [{ DIRECT_FREE_WEEK: 'off', VERCEL_ENV: 'production' }, false],
    [{ DIRECT_FREE_WEEK: 'OFF', VERCEL_ENV: 'production' }, false],
    [{ DIRECT_FREE_WEEK: 'false', VERCEL_ENV: 'production' }, false],
    [{ DIRECT_FREE_WEEK: ' False ', VERCEL_ENV: 'production' }, false],
    [{ DIRECT_FREE_WEEK: '0', VERCEL_ENV: 'production' }, false],
    // Anything unrecognised is "not set".
    [{ DIRECT_FREE_WEEK: 'maybe' }, false],
    [{ DIRECT_FREE_WEEK: 'maybe', VERCEL_ENV: 'production' }, true],
    // And never when the no-card week itself is stopped.
    [{ DIRECT_FREE_WEEK: 'on', NO_CARD_TRIAL_ENABLED: 'false' }, false],
    [{ VERCEL_ENV: 'production', NO_CARD_TRIAL_ENABLED: 'false' }, false],
  ]) {
    const m = await loadModules(env)
    try { assert.equal(m.trial.directFreeWeekEnabled(), want, JSON.stringify(env)) } finally { m.restore() }
  }
  // The page learns it from the same function the checkout uses.
  assert.ok(read('src/lib/trial.ts').includes('    direct: directFreeWeekEnabled(),\n'))
})

test('exactly what Stripe is sent for the subscription: no card, ends by itself, the terms version, and nothing with a timestamp', async () => {
  const m = await loadModules()
  try {
    assert.deepEqual(m.params.buildDirectFreeWeekParams({ userId: 'u1', plan: 'monthly', priceId: 'price_1', customerId: 'cus_1', ipHash: 'net1' }), {
      customer: 'cus_1',
      items: [{ price: 'price_1', quantity: 1 }],
      trial_period_days: 7,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      metadata: { user_id: 'u1', plan: 'monthly', no_card: '1', direct: '1', terms_version: '2026-11-15', terms_agreed: '1', terms_shown: 'membership_page', ip_hash: 'net1' },
    })
    assert.deepEqual(m.params.buildDirectFreeWeekParams({ userId: 'u1', plan: 'monthly', priceId: 'price_1', customerId: 'cus_1', offer: { code: 'BAILEY', promotionCodeId: 'promo_1', percentOff: 50 } }), {
      customer: 'cus_1',
      items: [{ price: 'price_1', quantity: 1 }],
      trial_period_days: 7,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      promotion_code: 'promo_1',
      metadata: { user_id: 'u1', plan: 'monthly', no_card: '1', direct: '1', terms_version: '2026-11-15', terms_agreed: '1', terms_shown: 'membership_page', offer_code: 'BAILEY', offer_percent_off: '50' },
    })
    // Started by creating an account: the record names the sign-up page's sentence, not the membership page's paragraph.
    assert.deepEqual(m.params.buildDirectFreeWeekParams({ userId: 'u1', plan: 'monthly', priceId: 'price_1', customerId: 'cus_1', termsShown: 'signup' }).metadata, { user_id: 'u1', plan: 'monthly', no_card: '1', direct: '1', terms_version: 'signup-2026-11-16', terms_agreed: '1', terms_shown: 'signup' })
    assert.notEqual(m.params.SIGNUP_TERMS_VERSION, m.params.DIRECT_TERMS_VERSION)
  } finally { m.restore() }
})

test('the terms shown above the box are this exact text, and the stored version names it', async () => {
  const m = await loadModules()
  try {
    const plain = m.params.directFreeWeekTerms(7)
    assert.equal(plain, 'Nothing is charged today and no card is asked for. Your free week is the first 7 days of membership and starts when you press the button. With no card, membership stops when the free week ends and nothing is ever charged. To keep going you add a card with the "Add a card" button inside Seoul Sister; a card you add is charged $9.99/month when the free week ends and every month after that until you cancel. The free week can be started once.')
    assert.match(m.params.directFreeWeekTerms(7, 50), /a card you add is charged \$4\.99 for your first paid month \(50% off\) when the free week ends, then \$9\.99\/month until you cancel\. The free week can be started once\.$/)
    // Version and text move together: change a word and this fails until the version changes too.
    assert.equal(
      createHash('sha256').update(`${m.params.DIRECT_TERMS_VERSION}\n${plain}`).digest('hex'),
      '67b73e554eec3f4aacfeb5ed6b434267949a61e1d58870ece7f5a3a86e7add5d'
    )
  } finally { m.restore() }
})

test('closed world: nothing the page adds for a start on our own page describes a page that is not there', async () => {
  const m = await loadModules()
  try {
    const started = m.offers.directStartedLines('Sunday, November 22 at 10:11 PM')
    const email = m.confirm.buildSubscriptionConfirmationEmail({ trialEnd: new Date('2026-11-23T06:11:00Z'), cardOnFile: false, timezone: 'America/Los_Angeles', startedOnOurPage: true })
    const said = [
      m.offers.paywallStartLineDirect(),
      m.offers.directAgreeLabel(),
      started.heading, started.body, started.cta,
      m.offers.directStartedLines(null).body,
      m.offers.directStartedNotRecordedLine(), m.offers.couldNotStartLine(), m.offers.tickToStartLine(), m.offers.startWithoutCodeLabel(),
      m.params.directFreeWeekTerms(7),
      m.params.directFreeWeekTerms(7, 50),
      email.subject, email.html,
    ]
    // Not a list of phrases: any mention of Stripe, of another page, of a
    // checkout or payment step, or of a "trial" is out.
    for (const s of said) assert.doesNotMatch(s, /stripe|next page|payment page|checkout|\btrials?\b|confirm(ed)? (there|on)/i, s.slice(0, 120))
    assert.equal(m.offers.paywallStartLineDirect(), 'Starts when you press the button below. No card needed.')
    assert.equal(started.body, 'It ends Sunday, November 22 at 10:11 PM. No card is on file, so nothing will be charged, and membership stops when the free week ends unless you add a card with the "Add a card" button at the top of the app.')
    // Stripe has it but our records do not: the same button finishes it, and Stripe's page is not named.
    assert.equal(m.offers.directStartedNotRecordedLine(), 'Your free week has started, but we could not finish setting up your membership just now. Nothing was charged. Press the button again in a minute to finish.')
    assert.equal(m.offers.couldNotStartLine(), 'This could not be started just now. Nothing was charged. Please try again in a minute.')
    assert.equal(m.offers.tickToStartLine(), 'Tick the box above to start.')
    assert.equal(m.offers.startWithoutCodeLabel(), 'Start without a code')
    assert.ok(email.html.includes('Your free week has started. You started it on the Seoul Sister membership page. <strong>No card is on file and you will not be charged.</strong>'))
    // The same email for a start on Stripe's page keeps its bridge.
    assert.ok(m.confirm.buildSubscriptionConfirmationEmail({ trialEnd: new Date('2026-11-23T06:11:00Z'), cardOnFile: false }).html.includes("This is the 7-day trial you confirmed on Stripe's page; we call it your free week."))
    // The three sentences that DO name Stripe's page are these and say nothing else about it.
    assert.equal(m.offers.directStartFailedLine(), "Your free week could not be started here just now. Nothing was charged. Try again in a minute, or start it on Stripe's page instead.")
    assert.equal(m.offers.codeNotAppliedHereLine('ANNKOREA'), "We cannot apply ANNKOREA on this page. If it is a Seoul Sister promotion code, start on Stripe's page instead, where it can be entered.")
    assert.equal(m.offers.useStripePageLabel(), "Start on Stripe's page instead")
    assert.equal(m.offers.startPageChangedLine(), 'This page was out of date, so nothing was started and nothing was charged. It now shows the current way to start.')
  } finally { m.restore() }
  // Which email a member gets follows how THEIR subscription started, not the switch today.
  assert.equal(read('src/lib/subscription-fulfilment.ts').split("startedOnOurPage: subscription.metadata?.direct === '1', startedAtSignup: subscription.metadata?.terms_shown === 'signup' })").length - 1, 2)
  // Started by creating the account: the email says that, and not that a membership page was used.
  const m2 = await loadModules()
  try {
    const atSignup = m2.confirm.buildSubscriptionConfirmationEmail({ trialEnd: new Date('2026-11-23T06:11:00Z'), cardOnFile: false, startedOnOurPage: true, startedAtSignup: true }).html
    assert.ok(atSignup.includes('Your free week has started. It started when you created your account. <strong>No card is on file and you will not be charged.</strong>'))
    assert.doesNotMatch(atSignup, /membership page|Stripe/)
  } finally { m2.restore() }
})

/** The direct-start helpers, executed against a fake Stripe client. */
function loadStart(client) {
  const src = read('src/lib/stripe.ts')
  const from = src.indexOf('/** Thrown when this account already has a live subscription')
  const to = src.indexOf('/**\n * A Stripe-hosted page where a member')
  assert.ok(from > -1 && to > from)
  const out = transpile(src.slice(from, to).replace(/^export /gm, ''))
  const build = (p) => ({ built: p })
  const h = new Function('getStripeClient', 'buildDirectFreeWeekParams', 'getPriceId', `${out}\nreturn { startDirectFreeWeek, findDirectFreeWeek, HasLiveSubscriptionError }`)(() => client, build, () => 'price_1')
  return Object.assign(h.startDirectFreeWeek, h)
}
const USER = '11111111-2222-3333-4444-555555555555'

test('two presses cannot make two: an existing customer is reused, an open subscription is returned, and the keys hold no time', async () => {
  const calls = []
  const fresh = {
    customers: {
      list: async (q) => { calls.push(['customers.list', q]); return { data: [{ id: 'cus_other', metadata: { user_id: 'someone-else' } }] } },
      create: async (body, opts) => { calls.push(['customers.create', body, opts]); return { id: 'cus_new' } },
    },
    subscriptions: {
      list: async (q) => { calls.push(['subscriptions.list', q]); return { data: [{ id: 'sub_old', status: 'canceled' }] } },
      create: async (body, opts) => { calls.push(['subscriptions.create', body, opts]); return { id: 'sub_new', status: 'trialing' } },
    },
  }
  const out = await loadStart(fresh)({ userId: USER, email: 'a@b.co', plan: 'monthly', ipHash: 'net1', offer: { code: 'BAILEY', promotionCodeId: 'promo_1', percentOff: 50 } })
  assert.deepEqual(out, { subscription: { id: 'sub_new', status: 'trialing' }, customerId: 'cus_new' })
  assert.deepEqual(calls, [
    ['customers.list', { email: 'a@b.co', limit: 100 }],
    // Another account's customer on the same address is never reused.
    ['customers.create', { email: 'a@b.co', metadata: { user_id: USER } }, { idempotencyKey: `fw-cus-${USER}` }],
    ['subscriptions.list', { customer: 'cus_new', status: 'all', limit: 20, expand: ['data.discount.promotion_code'] }],
    ['subscriptions.create', { built: { userId: USER, plan: 'monthly', priceId: 'price_1', customerId: 'cus_new', ipHash: 'net1', offer: { code: 'BAILEY', promotionCodeId: 'promo_1', percentOff: 50 }, termsShown: undefined, timezone: null }, expand: ['discount.promotion_code'] }, { idempotencyKey: 'fw-sub-cus_new-BAILEY-membership_page' }],
  ])

  // Second press: the customer exists and its free week is running. Nothing is created.
  const made = []
  const again = {
    customers: { list: async () => ({ data: [{ id: 'cus_new', metadata: { user_id: USER } }] }), create: async () => { made.push('customer') } },
    subscriptions: { list: async () => ({ data: [{ id: 'sub_old', status: 'canceled' }, { id: 'sub_live', status: 'trialing' }] }), create: async () => { made.push('subscription') } },
  }
  assert.deepEqual(await loadStart(again)({ userId: USER, email: 'a@b.co', plan: 'monthly' }), { subscription: { id: 'sub_live', status: 'trialing' }, customerId: 'cus_new' })
  assert.deepEqual(made, [])
  // A live subscription that is NOT a free week (paid, past due, half made) is
  // never reported as one, and nothing is created beside it.
  for (const status of ['active', 'past_due', 'incomplete']) {
    const none = []
    const paid = {
      customers: { list: async () => ({ data: [{ id: 'cus_new', metadata: { user_id: USER } }] }), create: async () => { none.push('customer') } },
      subscriptions: { list: async () => ({ data: [{ id: 'sub_paid', status }] }), create: async () => { none.push('subscription') } },
    }
    const start = loadStart(paid)
    await assert.rejects(start({ userId: USER, email: 'a@b.co', plan: 'monthly' }), (e) => e instanceof start.HasLiveSubscriptionError && e.status === status)
    assert.deepEqual(none, [], status)
  }
  // And if Stripe itself answers the create with anything but a running free week, it is not called one.
  const odd = {
    customers: { list: async () => ({ data: [{ id: 'cus_new', metadata: { user_id: USER } }] }) },
    subscriptions: { list: async () => ({ data: [] }), create: async () => ({ id: 's', status: 'incomplete' }) },
  }
  await assert.rejects(loadStart(odd)({ userId: USER, email: 'a@b.co', plan: 'monthly' }), /already has a incomplete subscription/)
  // After a failed call the route asks what exists: nothing, a customer only, or the running week.
  assert.deepEqual(await loadStart({ customers: { list: async () => ({ data: [] }) } }).findDirectFreeWeek(USER, 'a@b.co'), { customerId: null, subscription: null })
  assert.deepEqual(await loadStart(odd).findDirectFreeWeek(USER, 'a@b.co'), { customerId: 'cus_new', subscription: null })
  assert.deepEqual(await loadStart(again).findDirectFreeWeek(USER, 'a@b.co'), { customerId: 'cus_new', subscription: { id: 'sub_live', status: 'trialing' } })
  // No code: the key says so, and still holds no time.
  const keys = []
  const noCode = {
    customers: { list: async () => ({ data: [{ id: 'cus_new', metadata: { user_id: USER } }] }) },
    subscriptions: { list: async () => ({ data: [] }), create: async (_b, opts) => { keys.push(opts.idempotencyKey); return { id: 's', status: 'trialing' } } },
  }
  await loadStart(noCode)({ userId: USER, email: 'a@b.co', plan: 'monthly' })
  assert.deepEqual(keys, ['fw-sub-cus_new-none-membership_page'])
  keys.length = 0
  await loadStart(noCode)({ userId: USER, email: 'a@b.co', plan: 'monthly', termsShown: 'signup' })
  assert.deepEqual(keys, ['fw-sub-cus_new-none-signup'])
  // Nothing but an account id reaches Stripe.
  await assert.rejects(loadStart(fresh)({ userId: "x' OR 1", email: 'a@b.co', plan: 'monthly' }), /not an account id/)
  // A Stripe failure is thrown to the caller, which says so and offers Stripe's page.
  const boom = { customers: { list: async () => { throw new Error('stripe down') } } }
  await assert.rejects(loadStart(boom)({ userId: USER, email: 'a@b.co', plan: 'monthly' }), /stripe down/)
})

test('the checkout starts it here only for the no-card free week, with the switch on and the box ticked, and Stripe\'s page stays the other way', () => {
  const route = read('src/app/api/stripe/checkout/route.ts')
  assert.ok(route.includes("    const direct = parsed.data.via === 'direct'\n    if (direct && !(withTrial && noCard && directFreeWeekEnabled())) {\n      return NextResponse.json({ error: withTrial && noCard ? startPageChangedLine() : freeWeekChangedLine(), free_week_changed: true }, { status: 409 })\n    }\n    if (direct && parsed.data.agreed_terms !== true) {\n      return NextResponse.json({ error: 'Please tick the box to agree to the terms first.' }, { status: 400 })\n    }\n"))
  // One call, inside the direct branch, after both refusals and after the code is resolved.
  assert.equal(route.split('startDirectFreeWeek(').length - 1, 1)
  const branch = route.indexOf('    if (direct) {\n')
  const call = route.indexOf('await startDirectFreeWeek(')
  const hosted = route.indexOf('url = await createCheckoutSession(')
  assert.ok(route.indexOf('agreed_terms !== true') < branch && branch < call && call < hosted)
  assert.ok(route.indexOf('const resolved = await resolveOffer(') < branch, 'a code is checked with Stripe before anything is started')
  // A code we cannot apply stops the start here and points to Stripe's page.
  assert.match(route, /else if \(direct\) \{\s*return NextResponse\.json\(\{ error: codeNotAppliedHereLine\(normalizeOfferCode\(parsed\.data\.offer_code\) \?\? 'that code'\), code_not_applied: true \}, \{ status: 409 \}\)/)
  // A failed call: Stripe is asked what exists before anything is said. Unknown
  // offers nothing; known-absent offers Stripe's page; a running week is finished here.
  assert.ok(route.includes(`        if (!after) return NextResponse.json({ error: couldNotStartLine() }, { status: 502 })
        // Known to be absent: nothing started, and Stripe's page is a safe way on.
        if (!after.subscription || !after.customerId) return NextResponse.json({ error: directStartFailedLine(), direct_failed: true }, { status: 502 })
        started = { subscription: after.subscription, customerId: after.customerId }
`))
  assert.equal(route.split('direct_failed: true').length - 1, 1, 'Stripe\'s page is offered from exactly one place')
  // Stripe has it but our write failed: said as that, never as "started" (the
  // next page would treat them as a stranger) and never with Stripe's page.
  assert.ok(route.includes(`        return NextResponse.json({ error: directStartedNotRecordedLine(), started_not_recorded: true }, { status: 503 })
      }
      return NextResponse.json({ started: true, ends_at: endsAt })`))
  assert.equal(route.split('started: true').length - 1, 1)

  // The page sends which way it showed, and the box decides the button.
  const page = read('src/app/(auth)/subscribe/page.tsx')
  assert.ok(page.includes("            ? directMode && !useStripePage\n              ? { via: 'direct', agreed_terms: agreed, ...browserTimeZone() }\n              : { via: 'stripe' }\n"))
  assert.ok(page.includes('          disabled={loading || (freeWeekLeads && directMode && (!agreed || foreignCode !== null))}'))
  // A code this page cannot apply is never dropped silently: the start is held until the person chooses.
  assert.equal(page.split('setForeignCode(code)').length - 1, 2, 'typed, and remembered from a link')
  assert.ok(page.includes("      if (result.started_not_recorded) {") && page.includes("        setStripeOption(false)\n        setCheckoutError(result.error)"))
  // The block this page adds states no figure of its own: prices come from offers.ts.
  const added = page.slice(page.indexOf('{freeWeekLeads && directMode && ('), page.indexOf('onClick={() => handleCheckout()}'))
  assert.doesNotMatch(added, /\$\d|charged|free weeks? (left|remain)/i)
  assert.ok(page.includes('<p className="text-xs text-white/70 leading-relaxed mb-3">{directFreeWeekTerms(PRICING.trial_days, offerActive ? offerPercent : null)}</p>'))
  assert.ok(page.includes("    setDirectMode(t.eligible === true && t.no_card === true && t.direct === true)\n"))
  // Nothing on the page counts spots or hurries anyone.
  assert.doesNotMatch(page, /spots? left|almost gone|running out|hurry|last chance|times_redeemed|max_redemptions/i)
})

test('the webhook is the second chance for a start on our page: after the stale check, trialing only, and it throws', () => {
  const hook = read('src/app/api/stripe/webhook/route.ts')
  const stale = hook.indexOf('if (isStaleSubscriptionEvent(')
  const second = hook.indexOf("if (event.type === 'customer.subscription.created' && subscription.metadata?.direct === '1' && subscription.status === 'trialing') {")
  assert.ok(stale > 0 && second > stale)
  const block = hook.slice(second, hook.indexOf('        break', second))
  assert.match(block, /await fulfilNewSubscription\(supabase, \{\s*userId,\s*customerId,\s*subscription,\s*buyerEmail: await emailForUser\(supabase, userId\),\s*metadata: subscription\.metadata,\s*mailOnlyIfNewLedgerRow: true,\s*\}\)/)
  assert.doesNotMatch(block, /try \{|catch/, 'a swallowed failure here would leave no ledger row, and so a second free week after deletion')
  // A subscription started on Stripe's page is fulfilled where it always was, and always mails.
  assert.match(hook, /buyerEmail: session\.customer_details\?\.email \|\| session\.customer_email \|\| null,\s*metadata: session\.metadata,\s*mailOnlyIfNewLedgerRow: false,/)
  assert.equal(hook.split('fulfilNewSubscription(').length - 1, 2)
})

test('arriving with ?started=1 grants nothing: the plan read decides, and the address is cleaned', () => {
  const page = read('src/app/(app)/onboarding/page.tsx')
  assert.ok(page.includes("    const startedHere = !sessionId && search.get('started') === '1'\n    if (!sessionId && !startedHere) return\n    startedHereRef.current = startedHere\n"))
  assert.ok(page.includes("        if (sessionId) await fetch('/api/stripe/confirm', {"))
  assert.ok(page.includes('        if (startedHere) setIsMember(false)\n        return false'))
  assert.ok(page.includes('              justPaidRef.current && (member || !startedHereRef.current)\n'))
  // Deleting an account also finds a customer the start left with no subscription.
  assert.ok(read('src/lib/stripe.ts').includes("const result = await stripe.customers.search({ query: `metadata['user_id']:'${userId}'`, limit: 100, page: customerPage })"))
})

/** fulfilNewSubscription, executed: real ledger code, stubbed mail and attribution. */
async function loadFulfilment() {
  const dir = mkdtempSync(join(tmpdir(), 'ss-fulfil-'))
  const put = (name, src) => writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  put('pricing', read('src/lib/pricing.ts'))
  put('email-normalize', read('src/lib/utils/email-normalize.ts'))
  put('trial', read('src/lib/trial.ts').replace("from '@/lib/utils/email-normalize'", "from './email-normalize.mjs'").replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  put('offers', read('src/lib/offers.ts').replace("from '@/lib/pricing'", "from './pricing.mjs'"))
  writeFileSync(join(dir, 'stubs.mjs'), `
export const sent = []
export const fail = { confirm: 0 }
export const planFromStripePriceId = () => 'monthly'
export const attributeConversion = async (email, userId) => { sent.push(['attributeConversion', email, userId]); return 'widget' }
export const leadSourceForEmail = async () => null
export const notifyNewSubscriber = async (o) => { sent.push(['owner', o.kind, o.cardOnFile]); return { sent: true } }
export const sendSubscriptionConfirmation = async (to, end, opts) => {
  if (fail.confirm > 0) { fail.confirm--; sent.push(['confirm-failed', to]); return { sent: false, reason: 'bounce' } }
  sent.push(['confirm', to, opts.cardOnFile, opts.startedOnOurPage]); return { sent: true }
}
export const subscriptionPeriod = () => ({ start: '2026-11-15T00:00:00.000Z', end: '2026-11-22T00:00:00.000Z' })
`)
  put('fulfil', read('src/lib/subscription-fulfilment.ts')
    .replace("from '@/lib/stripe'", "from './stubs.mjs'")
    .replace("from '@/lib/widget/visitor'", "from './stubs.mjs'")
    .replace("from '@/lib/trial'", "from './trial.mjs'")
    .replace("from '@/lib/offers'", "from './offers.mjs'")
    .replace("from '@/lib/email/new-subscriber-alert'", "from './stubs.mjs'")
    .replace("from '@/lib/email/subscription-confirmation'", "from './stubs.mjs'")
    .replace("from '@/lib/stripe-payload'", "from './stubs.mjs'"))
  const stubs = await import(pathToFileURL(join(dir, 'stubs.mjs')).href)
  const { fulfilNewSubscription } = await import(pathToFileURL(join(dir, 'fulfil.mjs')).href)
  return { fulfilNewSubscription, stubs }
}
function fulfilDb(failTable = null) {
  const tables = { ss_subscriptions: [], ss_trial_starts: [], ss_user_profiles: [{ user_id: 'u1', plan: 'free', timezone: null }] }
  return {
    tables,
    from(table) {
      const boom = table === failTable ? { message: `${table} boom` } : null
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: () => Promise.resolve({ data: tables[table]?.[0] ?? null, error: boom }),
        upsert(values, opts) {
          const rows = tables[table]
          const key = opts?.onConflict
          const duplicate = !boom && !!(key && rows.some((r) => r[key] === values[key]))
          if (!boom && !(duplicate && opts.ignoreDuplicates)) { if (duplicate) Object.assign(rows.find((r) => r[key] === values[key]), values); else rows.push({ ...values }) }
          return Object.assign(Promise.resolve({ error: boom }), { select: () => Promise.resolve({ data: boom ? null : duplicate ? [] : [{ id: 'row' }], error: boom }) })
        },
        update(values) {
          return { eq: () => { if (!boom) Object.assign(tables[table][0], values); return Promise.resolve({ error: boom }) } }
        },
      }
      return q
    },
  }
}
const directSub = { id: 'sub_d', status: 'trialing', created: 1794700000, trial_end: 1795304800, items: { data: [{ price: { id: 'price_1' } }] }, metadata: { user_id: 'u1', no_card: '1', direct: '1', ip_hash: 'net1' } }

test('executed: a start two callers can reach is fulfilled twice and mailed once, and a failed ledger write throws', async () => {
  const { fulfilNewSubscription, stubs } = await loadFulfilment()
  const db = fulfilDb()
  const args = { userId: 'u1', customerId: 'cus_1', subscription: directSub, buyerEmail: 'A.B@gmail.com', metadata: directSub.metadata, mailOnlyIfNewLedgerRow: true }
  // The route, then the webhook's second chance (or the other way round: same result).
  assert.deepEqual(await fulfilNewSubscription(db, args), { plan: 'monthly', isTrial: true, mailed: true })
  assert.deepEqual(await fulfilNewSubscription(db, args), { plan: 'monthly', isTrial: true, mailed: false })
  assert.deepEqual(stubs.sent, [['confirm', 'A.B@gmail.com', false, true], ['owner', 'trial_started', false]], 'one confirmation, one owner alert, no paid conversion')
  assert.equal(db.tables.ss_user_profiles[0].plan, 'monthly')
  assert.equal(db.tables.ss_subscriptions.length, 1)
  assert.deepEqual([db.tables.ss_subscriptions[0].status, db.tables.ss_subscriptions[0].stripe_subscription_id], ['trialing', 'sub_d'])
  assert.equal(db.tables.ss_trial_starts.length, 1)
  assert.deepEqual([db.tables.ss_trial_starts[0].email_canonical, db.tables.ss_trial_starts[0].card_required, db.tables.ss_trial_starts[0].ip_hash], ['ab@gmail.com', false, 'net1'])

  // The only caller that will ever send it tries the confirmation a second time.
  stubs.sent.length = 0
  stubs.fail.confirm = 1
  await fulfilNewSubscription(fulfilDb(), args)
  assert.deepEqual(stubs.sent.map((x) => x[0]), ['confirm-failed', 'confirm', 'owner'])

  // No ledger row means a second free week after deletion: that failure is thrown, never swallowed.
  stubs.sent.length = 0
  await assert.rejects(fulfilNewSubscription(fulfilDb('ss_trial_starts'), args), /could not record trial start for sub_d/)
  assert.deepEqual(stubs.sent, [], 'nothing is mailed for a start that was not recorded')
  await assert.rejects(fulfilNewSubscription(fulfilDb('ss_subscriptions'), args), /ss_subscriptions upsert failed/)

  // A subscription started on Stripe's page mails every time it is fulfilled, as before, and
  // a paid one (no free week) writes no ledger row and is the one case that stamps a conversion.
  stubs.sent.length = 0
  const hosted = fulfilDb()
  const paidSub = { ...directSub, id: 'sub_p', status: 'active', trial_end: null, metadata: { user_id: 'u1' } }
  assert.deepEqual(await fulfilNewSubscription(hosted, { ...args, subscription: paidSub, metadata: { user_id: 'u1' }, mailOnlyIfNewLedgerRow: false }), { plan: 'monthly', isTrial: false, mailed: true })
  assert.deepEqual(stubs.sent, [['attributeConversion', 'A.B@gmail.com', 'u1'], ['confirm', 'A.B@gmail.com', true, false], ['owner', 'paid', true]])
  assert.equal(hosted.tables.ss_trial_starts.length, 0)
})
