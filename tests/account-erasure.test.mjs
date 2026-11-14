/**
 * "Delete my account" (Nov 11 2026).
 *
 * The route used to ignore every error, including the login's own deletion,
 * and answer `success: true`. Measured on throwaway accounts in production, the
 * login could not be deleted for anyone with an AI usage row, a custom shelf
 * product, a converted landing-chat visitor, or (found while testing the fix)
 * a skin score tied to a treatment phase.
 *
 * Every behaviour test here EXECUTES the real src/lib/account/erase.ts against
 * a recording fake of the database client. The source-text tests at the bottom
 * cover only wiring that cannot be executed without Next.js.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const SRC = read('src/lib/account/erase.ts')
assert.doesNotMatch(SRC, /^import /m, 'erase.ts must stay import-free so this file runs it as it is')
const js = ts.transpileModule(SRC, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { eraseAccount, EraseError, erasureFailedMessage } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const USER = '11111111-1111-4111-8111-111111111111'
const EMAIL = 'Person@Example.com'

/**
 * A recording fake. Every awaited query is logged as
 * { table, op, filters } and answered from `answer(call)`; `fail` names one
 * call (by index) that returns an error instead.
 */
function fakeDb({ selects = {}, failAt = -1, deleteUserError = null, getUserThrows = null, userAfter = { data: { user: null }, error: { message: 'User not found', status: 404 } } } = {}) {
  const calls = []
  const db = {
    calls,
    from(table) {
      const call = { table, op: 'select', filters: [] }
      const b = {
        select(cols) { if (call.op === 'select') call.cols = cols; return b },
        delete() { call.op = 'delete'; return b },
        update(v) { call.op = 'update'; call.values = v; return b },
        eq(c, v) { call.filters.push(['eq', c, v]); return b },
        in(c, v) { call.filters.push(['in', c, v]); return b },
        ilike(c, v) { call.filters.push(['ilike', c, v]); return b },
        is(c, v) { call.filters.push(['is', c, v]); return b },
        or(v) { call.filters.push(['or', v]); return b },
        then(resolve, reject) {
          const index = calls.push(call) - 1
          if (index === failAt) return Promise.resolve({ data: null, error: { message: `boom at ${index}` } }).then(resolve, reject)
          const data = call.op === 'select' ? (selects[`${table}:${call.filters.map((f) => f[0]).join('+')}`] ?? selects[table] ?? []) : null
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return b
    },
    auth: {
      admin: {
        async deleteUser(...args) { calls.push({ table: 'auth.users', op: 'deleteUser', args, filters: [['eq', 'id', args[0]]] }); return { error: deleteUserError } },
        async getUserById(id) { calls.push({ table: 'auth.users', op: 'getUserById', filters: [['eq', 'id', id]] }); if (getUserThrows) throw getUserThrows; return userAfter },
      },
    },
  }
  return db
}
const FULL = {
  ss_subscriptions: [
    { id: 'subrow-1', stripe_subscription_id: 'sub_live', stripe_customer_id: 'cus_1', status: 'trialing' },
    { id: 'subrow-2', stripe_subscription_id: 'sub_old', stripe_customer_id: 'cus_1', status: 'canceled' },
    { id: 'subrow-3', stripe_subscription_id: null, stripe_customer_id: null, status: 'active' },
    { id: 'subrow-4', stripe_subscription_id: 'sub_late', stripe_customer_id: 'cus_2', status: 'past_due' },
    // A customer that appears ONLY on a row we hold as canceled (paused or unpaid in Stripe).
    { id: 'subrow-5', stripe_subscription_id: 'sub_paused', stripe_customer_id: 'cus_3', status: 'canceled' },
  ],
  // An earlier customer of theirs, known only from the events we stored.
  ss_subscription_events: [{ customer: 'cus_old' }, { customer: null }, { customer: 'cus_1' }],
  'ss_widget_visitors:or': [{ id: 'row-1', visitor_id: 'vis-1' }, { id: 'row-2', visitor_id: 'vis-2' }],
  'ss_widget_visitors:ilike': [{ id: 'row-2', visitor_id: 'vis-2' }, { id: 'row-3', visitor_id: 'vis-3' }],
  ss_yuri_conversations: [{ id: 'conv-1' }, { id: 'conv-2' }],
  ss_reviews: [{ id: 'rev-1' }],
  ss_user_profiles: [],
}
function deps(over = {}) {
  const log = []
  return {
    log,
    cancelSubscription: async (id) => { log.push(`cancel:${id}`) },
    deleteStripeCustomer: async (id) => { log.push(`customer:${id}`) },
    // And one only Stripe knows about.
    findStripeCustomers: async (id) => { log.push(`search:${id}`); return ['cus_search', 'cus_2'] },
    purgePhotos: async (id) => { log.push(`photos:${id}`); return 4 },
    ...over,
  }
}
const sig = (c) => `${c.op} ${c.table}`
const mutates = (c) => c.op === 'delete' || c.op === 'update' || c.op === 'deleteUser'

test('the whole erasure, in order: these calls and no others', async () => {
  const db = fakeDb({ selects: FULL })
  const d = deps()
  const r = await eraseAccount(db, { id: USER, email: EMAIL }, d)
  assert.deepEqual(db.calls.map(sig), [
    'select ss_subscriptions',
    'select ss_subscription_events',
    'update ss_user_profiles',
    'update ss_nurture_leads',
    'update ss_nurture_leads',
    'select ss_widget_visitors',
    'select ss_widget_visitors',
    'delete ss_widget_intent_signals',
    'delete ss_widget_sessions',
    'delete ss_campaign_touches',
    'delete ss_proactive_judgments',
    'delete ss_widget_visitors',
    'delete ss_subscription_events',
    'delete ss_subscription_events',
    'delete ss_subscription_events',
    'update ss_ai_usage',
    'update ss_trial_starts',
    'update ss_trial_starts',
    'delete ss_catalog_requests',
    'delete ss_affiliate_clicks',
    'delete ss_review_helpfulness',
    'select ss_reviews',
    // The notes the learning job wrote from their reviews and conversations
    // (Nov 14 2026): personal data that used to be left behind. Each set goes
    // BEFORE its source, so a failed run that is tried again still finds the
    // source and cannot leave its notes orphaned.
    'delete ss_learning_patterns',
    'delete ss_reviews',
    'delete ss_glass_skin_scores',
    'delete ss_skin_breakdown_history',
    'delete ss_treatment_phases',
    'select ss_yuri_conversations',
    'delete ss_learning_patterns',
    'delete ss_yuri_messages',
    'delete ss_yuri_conversations',
    'delete ss_user_products',
    'delete ss_nurture_leads',
    'deleteUser auth.users',
    'getUserById auth.users',
    'select ss_user_profiles',
  ])
  // A hard delete: one argument. A second `true` is a soft delete that keeps the row.
  assert.deepEqual(db.calls.find((c) => c.op === 'deleteUser').args, [USER])
  assert.equal(r.photosRemoved, 4)
  assert.deepEqual(r.steps.slice(-2), ['login deleted', 'verified'])
  // Every subscription we do not hold as canceled is cancelled (past_due included),
  // then each Stripe customer once, and all of it before the photos.
  assert.deepEqual(d.log, [
    `search:${USER}`, 'cancel:sub_live', 'cancel:sub_late',
    'customer:cus_1', 'customer:cus_2', 'customer:cus_3', 'customer:cus_old', 'customer:cus_search',
    `photos:${USER}`,
  ])
})

test('every query is scoped to this person: no call can touch anyone else', async () => {
  const db = fakeDb({ selects: FULL })
  await eraseAccount(db, { id: USER, email: EMAIL }, deps())
  const expected = {
    'select ss_subscriptions': [['eq', 'user_id', USER]],
    'delete ss_widget_intent_signals': [['in', 'visitor_id', ['vis-1', 'vis-2', 'vis-3']]],
    'delete ss_widget_sessions': [['in', 'visitor_id', ['vis-1', 'vis-2', 'vis-3']]],
    'delete ss_campaign_touches': [['in', 'visitor_id', ['vis-1', 'vis-2', 'vis-3']]],
    'delete ss_proactive_judgments': [['in', 'widget_visitor_id', ['vis-1', 'vis-2', 'vis-3']]],
    'delete ss_widget_visitors': [['in', 'id', ['row-1', 'row-2', 'row-3']]],
    'update ss_user_profiles': [['eq', 'user_id', USER]],
    'delete ss_catalog_requests': [['eq', 'user_id', USER]],
    'delete ss_affiliate_clicks': [['eq', 'user_id', USER]],
    'update ss_ai_usage': [['eq', 'user_id', USER]],
    'delete ss_review_helpfulness': [['eq', 'user_id', USER]],
    'select ss_reviews': [['eq', 'user_id', USER]],
    'delete ss_reviews': [['eq', 'user_id', USER]],
    'delete ss_glass_skin_scores': [['eq', 'user_id', USER]],
    'delete ss_skin_breakdown_history': [['eq', 'user_id', USER]],
    'delete ss_treatment_phases': [['eq', 'user_id', USER]],
    'select ss_yuri_conversations': [['eq', 'user_id', USER]],
    'delete ss_yuri_messages': [['in', 'conversation_id', ['conv-1', 'conv-2']]],
    'delete ss_yuri_conversations': [['in', 'id', ['conv-1', 'conv-2']]],
    'delete ss_user_products': [['eq', 'user_id', USER]],
    'deleteUser auth.users': [['eq', 'id', USER]],
    'getUserById auth.users': [['eq', 'id', USER]],
    'select ss_user_profiles': [['eq', 'user_id', USER]],
  }
  for (const c of db.calls) {
    assert.ok(c.filters.length > 0, `${sig(c)} ran with no filter at all`)
    if (expected[sig(c)]) assert.deepEqual(c.filters, expected[sig(c)], sig(c))
  }
  const visitorLookups = db.calls.filter((c) => sig(c) === 'select ss_widget_visitors').map((c) => c.filters)
  assert.deepEqual(visitorLookups, [
    [['or', `registered_user_id.eq.${USER},converted_user_id.eq.${USER}`]],
    [['ilike', 'captured_email', 'person@example.com']],
  ])
  const by = (signature) => db.calls.filter((c) => sig(c) === signature)
  assert.deepEqual(by('delete ss_learning_patterns').map((c) => c.filters), [
    [['in', 'data->>source_id', ['rev-1']]],
    [['in', 'data->>source_id', ['conv-1', 'conv-2']]],
  ])
  assert.deepEqual(by('update ss_nurture_leads').map((c) => c.filters), [[['eq', 'user_id', USER]], [['ilike', 'email', 'person@example.com']]])
  assert.deepEqual(by('delete ss_nurture_leads').map((c) => c.filters), [[['ilike', 'email', 'person@example.com']]])
  assert.deepEqual(by('delete ss_subscription_events').map((c) => c.filters), [
    [['in', 'subscription_id', ['subrow-1', 'subrow-2', 'subrow-3', 'subrow-4', 'subrow-5']]],
    [['in', 'event_data->>customer', ['cus_1', 'cus_2', 'cus_3', 'cus_old', 'cus_search']]],
    [['eq', 'event_data->metadata->>user_id', USER]],
  ])
  assert.deepEqual(by('select ss_subscription_events').map((c) => [c.cols, c.filters]), [['customer:event_data->>customer', [['eq', 'event_data->metadata->>user_id', USER]]]])
  // The ledger: an open trial is closed (never one already lapsed or paid), then the links are cleared.
  assert.deepEqual(by('update ss_trial_starts').map((c) => c.filters), [
    [['eq', 'user_id', USER], ['is', 'lapsed_at', null], ['is', 'paid_at', null]],
    [['eq', 'user_id', USER]],
  ])
  // What each update writes, and nothing else.
  const updates = db.calls.filter((c) => c.op === 'update').map((c) => [c.table, c.values])
  assert.deepEqual(Object.keys(updates[4][1]), ['lapsed_at'])
  assert.ok(Math.abs(Date.parse(updates[4][1].lapsed_at) - Date.now()) < 60_000)
  updates.splice(4, 1)
  assert.deepEqual(updates, [
    ['ss_user_profiles', { nudge_email_opt_out: true }],
    ['ss_nurture_leads', { suppressed: true, suppressed_reason: 'account_deleted' }],
    ['ss_nurture_leads', { suppressed: true, suppressed_reason: 'account_deleted' }],
    ['ss_ai_usage', { user_id: null }],
    ['ss_trial_starts', { user_id: null, stripe_subscription_id: null }],
  ])
})

test('the lead-email row is only suppressed until the very end, so a failure cannot re-enrol the person', async () => {
  const db = fakeDb({ selects: FULL })
  await eraseAccount(db, { id: USER, email: EMAIL }, deps())
  const sigs = db.calls.map(sig)
  assert.equal(sigs.indexOf('delete ss_nurture_leads'), sigs.indexOf('deleteUser auth.users') - 1)
  assert.ok(sigs.indexOf('update ss_nurture_leads') < sigs.findIndex((x) => x.startsWith('delete ')))
  assert.ok(sigs.indexOf('update ss_user_profiles') < sigs.findIndex((x) => x.startsWith('delete ')))
})

test('an address containing * is matched exactly, never as a pattern', async () => {
  const db = fakeDb({ selects: { ss_user_profiles: [] } })
  await eraseAccount(db, { id: USER, email: 'A*@example.com' }, deps())
  const byAddress = db.calls.flatMap((c) => c.filters.map((f) => [sig(c), ...f])).filter((f) => f[2] === 'email' || f[2] === 'captured_email')
  assert.deepEqual(byAddress, [
    ['update ss_nurture_leads', 'eq', 'email', 'a*@example.com'],
    ['select ss_widget_visitors', 'eq', 'captured_email', 'a*@example.com'],
    ['delete ss_nurture_leads', 'eq', 'email', 'a*@example.com'],
  ])
  assert.equal(db.calls.flatMap((c) => c.filters).filter((f) => f[0] === 'ilike').length, 0)
})

test('an address with LIKE wildcards matches only itself', async () => {
  const db = fakeDb({ selects: { ss_user_profiles: [] } })
  await eraseAccount(db, { id: USER, email: 'a_b%c\\d@example.com' }, deps())
  const patterns = db.calls.flatMap((c) => c.filters).filter((f) => f[0] === 'ilike').map((f) => f[2])
  assert.deepEqual(patterns, Array(3).fill('a\\_b\\%c\\\\d@example.com'))
})

test('no address on the account: nothing is ever matched by address', async () => {
  for (const email of [undefined, null, '', '   ']) {
    const db = fakeDb({ selects: { ss_user_profiles: [] } })
    await eraseAccount(db, { id: USER, email }, deps())
    assert.equal(db.calls.flatMap((c) => c.filters).filter((f) => f[0] === 'ilike' || f[1] === 'email' || f[1] === 'captured_email').length, 0, `email=${JSON.stringify(email)}`)
    assert.ok(db.calls.some((c) => c.op === 'deleteUser'))
  }
})

test('no preview chat and no conversations: those deletes are not sent with an empty list', async () => {
  const db = fakeDb({ selects: { ss_user_profiles: [] } })
  await eraseAccount(db, { id: USER, email: EMAIL }, deps())
  for (const c of db.calls) for (const f of c.filters) if (f[0] === 'in') assert.ok(f[2].length > 0, `${sig(c)} sent an empty list`)
  assert.ok(!db.calls.some((c) => c.table === 'ss_widget_sessions' || c.table === 'ss_yuri_messages'))
  // No subscription row and no customer anywhere: only the by-account sweep of billing events runs.
  const d = deps({ findStripeCustomers: async () => [] })
  const bare = fakeDb({ selects: { ss_user_profiles: [] } })
  await eraseAccount(bare, { id: USER, email: EMAIL }, d)
  assert.deepEqual(bare.calls.filter((c) => c.table === 'ss_subscription_events' && c.op === 'delete').map((c) => c.filters), [[['eq', 'event_data->metadata->>user_id', USER]]])
  assert.ok(!d.log.some((l) => l.startsWith('customer') || l.startsWith('cancel')))
})

test('ANY failed query stops the erasure before the login is touched, and names the step', async () => {
  const clean = fakeDb({ selects: FULL })
  await eraseAccount(clean, { id: USER, email: EMAIL }, deps())
  const loginAt = clean.calls.findIndex((c) => c.op === 'deleteUser')
  assert.ok(loginAt > 15)
  for (let i = 0; i < loginAt; i++) {
    const db = fakeDb({ selects: FULL, failAt: i })
    await assert.rejects(
      eraseAccount(db, { id: USER, email: EMAIL }, deps()),
      (e) => e instanceof EraseError && typeof e.step === 'string' && e.step.length > 0 && e.message.includes(`boom at ${i}`),
      `call ${i} (${sig(clean.calls[i])}) failed and the erasure carried on`
    )
    assert.equal(db.calls.length, i + 1, `call ${i} (${sig(clean.calls[i])}) failed and later calls still ran`)
    assert.ok(!db.calls.some((c) => c.op === 'deleteUser'))
  }
})

test('Stripe unreachable at ANY Stripe call: it stops with nothing removed or changed, photos included', async () => {
  const down = async () => { throw new Error('stripe is down') }
  // The first cancel, the SECOND cancel, the first customer, the second customer.
  const cases = [
    ['cancel subscription', { cancelSubscription: down }],
    ['cancel subscription', { cancelSubscription: async (id) => { if (id === 'sub_late') await down() } }],
    ['close billing', { deleteStripeCustomer: down }],
    ['close billing', { deleteStripeCustomer: async (id) => { if (id === 'cus_search') await down() } }],
    ['find billing', { findStripeCustomers: down }],
  ]
  for (const [step, over] of cases) {
    const db = fakeDb({ selects: FULL })
    const d = deps(over)
    await assert.rejects(eraseAccount(db, { id: USER, email: EMAIL }, d), (e) => e instanceof EraseError && e.step === step && /stripe is down/.test(e.message), step)
    assert.equal(db.calls.filter(mutates).length, 0, step)
    assert.ok(!d.log.some((l) => l.startsWith('photos')), step)
  }
})

test('subscriptions cannot be read: it stops with nothing removed', async () => {
  const db = fakeDb({ selects: FULL, failAt: 0 })
  const d = deps()
  await assert.rejects(eraseAccount(db, { id: USER, email: EMAIL }, d), (e) => e instanceof EraseError && e.step === 'read subscriptions')
  assert.deepEqual(d.log, [])
  assert.equal(db.calls.filter(mutates).length, 0)
})

test('the login refuses to delete: that is a failure, not a success', async () => {
  const db = fakeDb({ selects: FULL, deleteUserError: { message: 'Database error deleting user' } })
  await assert.rejects(eraseAccount(db, { id: USER, email: EMAIL }, deps()), (e) => e instanceof EraseError && e.step === 'delete login' && /Database error deleting user/.test(e.message))
})

test('verification: only "the login is not found" passes', async () => {
  const bad = [
    ['the lookup failed for another reason', { data: { user: null }, error: { message: 'fetch failed', status: 500 } }],
    ['the lookup said nothing either way', { data: { user: null }, error: null }],
    ['the lookup returned no data and no error', { data: null, error: null }],
  ]
  for (const [name, userAfter] of bad) {
    const db = fakeDb({ selects: FULL, userAfter })
    await assert.rejects(eraseAccount(db, { id: USER, email: EMAIL }, deps()), (e) => e instanceof EraseError && e.step === 'verify', name)
  }
  // The lookup itself blowing up is "could not confirm", never "gone".
  await assert.rejects(eraseAccount(fakeDb({ selects: FULL, getUserThrows: new Error('socket hang up') }), { id: USER, email: EMAIL }, deps()), (e) => e instanceof EraseError && e.step === 'verify' && /socket hang up/.test(e.message))
  // The login still being there is its own outcome: the person CAN try again, and must not be told it was deleted.
  await assert.rejects(eraseAccount(fakeDb({ selects: FULL, userAfter: { data: { user: { id: USER } }, error: null } }), { id: USER, email: EMAIL }, deps()), (e) => e instanceof EraseError && e.step === 'login still exists')
  assert.match(erasureFailedMessage('login still exists', 'a@b.c'), /Please try again/)
  assert.doesNotMatch(erasureFailedMessage('login still exists', 'a@b.c'), /login was deleted/)
  for (const userAfter of [{ data: { user: null }, error: { message: 'User not found', status: 404 } }, { data: { user: null }, error: { message: 'user not found', status: 404 } }]) {
    const r = await eraseAccount(fakeDb({ selects: FULL, userAfter }), { id: USER, email: EMAIL }, deps())
    assert.equal(r.steps.at(-1), 'verified')
  }
  // Half the shape is not the answer either: a 404 from elsewhere, or some other "not found".
  for (const error of [{ message: 'Not Found', status: 404 }, { message: 'route not found', status: 404 }, { message: 'User not found' }, { message: 'User not found', status: 500 }, { message: 'could not connect', status: 500 }, { message: 'relation not found', status: 400 }, { message: 'not allowed', status: 404 }]) {
    const db = fakeDb({ selects: FULL, userAfter: { data: { user: null }, error } })
    await assert.rejects(eraseAccount(db, { id: USER, email: EMAIL }, deps()), (e) => e instanceof EraseError && e.step === 'verify', JSON.stringify(error))
  }
  // Being refused the answer is not the answer.
  for (const status of [401, 403, 429, 500, 503]) {
    const db = fakeDb({ selects: FULL, userAfter: { data: { user: null }, error: { message: 'no', status } } })
    await assert.rejects(eraseAccount(db, { id: USER, email: EMAIL }, deps()), (e) => e instanceof EraseError && e.step === 'verify', String(status))
  }
})

test('verification: a profile row left behind is a failure', async () => {
  const db = fakeDb({ selects: { ...FULL, ss_user_profiles: [{ user_id: USER }] } })
  await assert.rejects(eraseAccount(db, { id: USER, email: EMAIL }, deps()), (e) => e instanceof EraseError && e.step === 'verify profile' && /profile/.test(e.message))
})

test('what the person is told at each step is true of what has happened by then', async () => {
  // Run the real erasure failing at every call in turn, and check the message
  // for the step it names against what the fake recorded up to that point.
  const clean = fakeDb({ selects: FULL })
  await eraseAccount(clean, { id: USER, email: EMAIL }, deps())
  const seen = new Set()
  for (let i = 0; i < clean.calls.length; i++) {
    if (clean.calls[i].op === 'deleteUser' || clean.calls[i].op === 'getUserById') continue
    const db = fakeDb({ selects: FULL, failAt: i })
    const d = deps()
    const err = await eraseAccount(db, { id: USER, email: EMAIL }, d).then(() => null, (e) => e)
    assert.ok(err instanceof EraseError, `call ${i}`)
    const m = erasureFailedMessage(err.step, 'team@example.com')
    seen.add(err.step)
    const removedOrChanged = db.calls.slice(0, i).some(mutates) || d.log.some((l) => l.startsWith('photos'))
    const stripeTouched = d.log.some((l) => l.startsWith('cancel') || l.startsWith('customer'))
    const loginGone = db.calls.some((c) => c.op === 'deleteUser')
    if (/None of your data has been removed|Nothing in your Seoul Sister account has been removed/.test(m)) assert.equal(removedOrChanged, false, `${err.step}: says nothing removed after a removal`)
    if (/membership has not changed/.test(m)) assert.equal(stripeTouched, false, `${err.step}: says membership unchanged after Stripe was called`)
    if (/Please try again/.test(m)) assert.equal(loginGone, false, `${err.step}: asks for a retry the person cannot make`)
    if (loginGone) assert.match(m, /Your login was deleted, but/, err.step)
    else assert.doesNotMatch(m, /login was deleted/, err.step)
    assert.match(m, /team@example\.com/)
    assert.doesNotMatch(m, /account (has been|was) deleted|successfully/i)
  }
  assert.ok(seen.size > 20, 'every step should have been exercised')
})

test('messages for the steps the loop above cannot reach, and for a step nobody has written yet', () => {
  for (const step of ['cancel subscription', 'close billing']) {
    const m = erasureFailedMessage(step, 'a@b.c')
    // Not "none of your data": a Stripe customer record may already be gone.
    assert.match(m, /Nothing in your Seoul Sister account has been removed, but your membership may already have been cancelled/)
    assert.doesNotMatch(m, /None of your data|has not changed/)
    assert.match(m, /Please try again/)
  }
  assert.match(erasureFailedMessage('find billing', 'a@b.c'), /None of your data has been removed and your membership has not changed/)
  for (const step of ['delete login', 'login still exists', 'unexpected', 'a step added next year', 'photos']) {
    const m = erasureFailedMessage(step, 'a@b.c')
    assert.match(m, /Some of your data has been removed and some has not/)
    assert.match(m, /may already have been cancelled/)
    assert.doesNotMatch(m, /None of your data|Nothing in your|has not changed|will not be charged|login was deleted/)
  }
  // Confirmed gone (the lookup said so, then a profile row was found or could not be checked).
  const gone = erasureFailedMessage('verify profile', 'a@b.c')
  assert.match(gone, /Your login was deleted, but we could not confirm that everything else was removed\. Trying again will not work because the login is gone\./)
  assert.doesNotMatch(gone, /try again\b(?! will not)|recorded/i)
  // Not confirmed either way: say neither "deleted" nor "not deleted", and cover both.
  const unsure = erasureFailedMessage('verify', 'a@b.c')
  assert.match(unsure, /We asked for your login to be deleted but could not confirm that it was\. If you can still sign in, please try again\. If you cannot, your login is gone/)
  assert.doesNotMatch(unsure, /Your login was deleted|will not work|recorded/)
  for (const m of [gone, unsure]) assert.match(m, /a@b\.c/)
})

// ---- the route, EXECUTED: its imports are swapped for stubs, the real erasure runs inside it ----

const ROUTE = read('src/app/api/account/delete/route.ts')

function loadRoute() {
  const body = ROUTE.replace(/^import [^\n]*\n/gm, '').replace('export async function DELETE', 'async function DELETE').replace('export const maxDuration = 60', 'const maxDuration = 60')
  assert.match(ROUTE, /^export const maxDuration = 60$/m)
  assert.doesNotMatch(body, /^\s*(import|export) /m, 'an import or export the harness does not handle')
  const out = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const names = ['NextResponse', 'requireAuth', 'getServiceClient', 'handleApiError', 'eraseAccount', 'EraseError', 'erasureFailedMessage',
    'logPipelineRun', 'CONTACT_EMAIL', 'sendEmail', 'wrapEmailHtml', 'escapeHtml', 'cancelSubscriptionForDeletedAccount', 'deleteStripeCustomer', 'findStripeCustomersForUser', 'process', 'console']
  // Every import in the file must be one the harness supplies.
  const imported = [...ROUTE.matchAll(/^import (?:type )?\{([^}]*)\}/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/^type /, ''))).filter(Boolean)
  for (const name of imported) if (name !== 'NextRequest') assert.ok(names.includes(name), `route imports ${name}, which the harness does not stub`)
  return new Function(...names, `${out}\nreturn DELETE`)
}

/** Storage fake: `objects` maps bucket -> list of full paths. Lists a page at a time like the real one. */
function fakeStorage(objects, { failList = null, failRemove = null } = {}) {
  const removed = []
  return {
    removed,
    from(bucket) {
      return {
        async list(path, opts = {}) {
          if (failList && failList(bucket, path)) return { data: null, error: { message: 'list 500' } }
          const limit = opts.limit ?? 100, offset = opts.offset ?? 0
          const children = new Map()
          for (const full of objects[bucket] ?? []) {
            if (!full.startsWith(path + '/')) continue
            const [head, ...rest] = full.slice(path.length + 1).split('/')
            if (!children.has(head)) children.set(head, { name: head, id: rest.length ? null : `id-${head}` })
          }
          return { data: [...children.values()].slice(offset, offset + limit), error: null }
        },
        async remove(paths) {
          if (failRemove && failRemove(bucket)) return { data: null, error: { message: 'remove 500' } }
          removed.push(...paths.map((p) => `${bucket}:${p}`))
          return { data: [], error: null }
        },
      }
    },
  }
}

async function callRoute({ dbOpts = { selects: FULL }, auth = async () => ({ id: USER, email: EMAIL }), storage = fakeStorage({}), stripe = {}, alertTo = 'owner@example.com', sendEmail } = {}) {
  const db = fakeDb(dbOpts)
  db.storage = storage
  const seen = { runs: [], emails: [], stripe: [], errors: [], db }
  const handler = loadRoute()(
    { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
    auth,
    () => db,
    (e) => ({ body: { error: e.message }, status: e.statusCode ?? 500, viaHandleApiError: true }),
    eraseAccount, EraseError, erasureFailedMessage,
    async (_db, entry) => { seen.runs.push(entry) },
    'team@example.com',
    sendEmail ?? (async (to, subject, html) => { seen.emails.push({ to, subject, html }); return { sent: true } }),
    (html, footer) => html + (footer ?? ''),
    (v) => String(v).replace(/</g, '&lt;'),
    stripe.cancel ?? (async (id) => { seen.stripe.push(`cancel:${id}`) }),
    stripe.customer ?? (async (id) => { seen.stripe.push(`customer:${id}`) }),
    stripe.find ?? (async () => ['cus_search']),
    { env: { GUARDIAN_ALERT_EMAIL: alertTo } },
    { error: (...a) => seen.errors.push(a), warn() {}, log() {} },
  )
  const res = await handler({ headers: new Map() })
  return { res, ...seen }
}

test('route: a clean erasure answers success, once the login is really gone', async () => {
  const { res, runs, emails, stripe, db } = await callRoute()
  assert.deepEqual(res, { body: { success: true, photos_removed: 0 }, status: 200 })
  assert.ok(db.calls.some((c) => c.op === 'deleteUser') && db.calls.some((c) => c.op === 'getUserById'))
  assert.deepEqual(stripe, ['cancel:sub_live', 'cancel:sub_late', 'customer:cus_1', 'customer:cus_2', 'customer:cus_3', 'customer:cus_old', 'customer:cus_search'])
  assert.deepEqual([runs, emails], [[], []])
})

test('route: nobody signed in means nothing happens', async () => {
  const { res, db, stripe } = await callRoute({ auth: async () => { throw Object.assign(new Error('Unauthorized'), { statusCode: 401 }) } })
  assert.equal(res.status, 401)
  assert.deepEqual([db.calls.length, stripe.length], [0, 0])
})

test('route: it acts on the signed-in account and no other', async () => {
  const OTHER = '22222222-2222-4222-8222-222222222222'
  const { db } = await callRoute({ auth: async () => ({ id: OTHER, email: 'other@example.com' }) })
  assert.deepEqual(db.calls.find((c) => c.op === 'deleteUser').args, [OTHER])
  assert.ok(!JSON.stringify(db.calls).includes(USER))
})

test('route: EVERY failing step answers 500 with that step\'s message, records a failed run and emails the owner', async () => {
  const clean = await callRoute()
  const total = clean.db.calls.length
  const variants = []
  for (let i = 0; i < total; i++) if (!['deleteUser', 'getUserById'].includes(clean.db.calls[i].op)) variants.push([`call ${i}`, { dbOpts: { selects: FULL, failAt: i } }])
  variants.push(['login refuses', { dbOpts: { selects: FULL, deleteUserError: { message: 'Database error deleting user' } } }])
  variants.push(['login still there', { dbOpts: { selects: FULL, userAfter: { data: { user: { id: USER } }, error: null } } }])
  variants.push(['stripe cancel down', { stripe: { cancel: async () => { throw new Error('stripe down') } } }])
  variants.push(['stripe customer down', { stripe: { customer: async () => { throw new Error('stripe down') } } }])
  variants.push(['stripe search down', { stripe: { find: async () => { throw new Error('stripe down') } } }])
  variants.push(['lookup after delete throws', { dbOpts: { selects: FULL, getUserThrows: new Error('socket hang up') } }])
  variants.push(['profile remains', { dbOpts: { selects: { ...FULL, ss_user_profiles: [{ user_id: USER }] } } }])
  for (const [name, opts] of variants) {
    const { res, runs, emails } = await callRoute(opts)
    assert.equal(res.status, 500, name)
    assert.deepEqual(Object.keys(res.body), ['error'], name)
    assert.equal(runs.length, 1, name)
    const run = runs[0]
    assert.deepEqual([run.run_type, run.status], ['account_deletion', 'failed'], name)
    assert.equal(res.body.error, erasureFailedMessage(run.metadata.stopped_at, 'team@example.com'), name)
    assert.equal(run.metadata.user_id, USER)
    // The run row outlives the account: the id, never the address.
    assert.ok(!JSON.stringify(run).toLowerCase().includes('person@example.com'), name)
    assert.equal(emails.length, 1, name)
    assert.equal(emails[0].to, 'owner@example.com')
    assert.ok(emails[0].html.includes(run.metadata.stopped_at) && emails[0].html.includes(USER), name)
    // The owner is told exactly what the person was told, not a fixed sentence.
    assert.ok(emails[0].html.includes(res.body.error.replace(/</g, '&lt;')), name)
  }
  assert.ok(variants.length > 35)
})

test('route: something that is not a step failure is "unexpected", and is never reported as a deleted login', async () => {
  const user = { id: USER, get email() { throw new TypeError('not a step') } }
  const { res, runs } = await callRoute({ auth: async () => user })
  assert.equal(res.status, 500)
  assert.equal(runs[0].metadata.stopped_at, 'unexpected')
  assert.match(res.body.error, /We could not finish deleting your account/)
  assert.doesNotMatch(res.body.error, /login was deleted/)
})

test('route: a failed owner email, or no owner address, still gives the person the honest answer', async () => {
  for (const opts of [
    { sendEmail: async () => { throw new Error('resend down') } },
    { sendEmail: async () => ({ sent: false, reason: 'no key' }) },
    { alertTo: '' },
  ]) {
    const { res, runs, errors } = await callRoute({ ...opts, dbOpts: { selects: FULL, failAt: 12 } })
    assert.equal(res.status, 500)
    assert.match(res.body.error, /could not finish deleting/)
    assert.equal(runs.length, 1)
    assert.ok(errors.length >= 2, `the missed owner email must at least be logged: ${JSON.stringify(errors)}`)
  }
})

test('route: photos in both buckets, at both depths, past the first page, are all removed', async () => {
  const many = Array.from({ length: 1205 }, (_, i) => `${USER}/scan-a/f${i}.jpg`)
  const storage = fakeStorage({
    'glass-skin-photos': [`${USER}/one.jpg`, `${USER}/two.jpg`, 'someone-else/keep.jpg'],
    'user-uploads': [...many, `${USER}/scan-b/x.jpg`, `${USER}/loose.jpg`, 'someone-else/scan/keep.jpg'],
  })
  const { res } = await callRoute({ storage })
  assert.deepEqual(res.body, { success: true, photos_removed: 1209 })
  assert.equal(storage.removed.length, 1209)
  assert.ok(storage.removed.every((p) => p.includes(`:${USER}/`)), 'only this person\'s objects')
  assert.ok(storage.removed.includes(`user-uploads:${USER}/scan-a/f1204.jpg`) && storage.removed.includes(`glass-skin-photos:${USER}/two.jpg`))
})

test('route: a photo that could not be removed does not stop the deletion, and does not go unreported', async () => {
  const objects = { 'glass-skin-photos': [`${USER}/one.jpg`], 'user-uploads': [`${USER}/scan/x.jpg`] }
  const cases = [
    ['top list fails', { failList: (b, p) => b === 'user-uploads' && p === USER }, 1],
    ['nested list fails', { failList: (b, p) => p.endsWith('/scan') }, 1],
    ['remove fails', { failRemove: (b) => b === 'glass-skin-photos' }, 1],
  ]
  for (const [name, fail, removedCount] of cases) {
    const storage = fakeStorage(objects, fail)
    const { res, runs, emails, db } = await callRoute({ storage })
    assert.deepEqual(res, { body: { success: true, photos_removed: removedCount }, status: 200 }, name)
    assert.ok(db.calls.some((c) => c.op === 'deleteUser'), name)
    assert.equal(runs.length, 1, name)
    assert.deepEqual([runs[0].status, runs[0].run_type], ['failed', 'account_deletion'], name)
    assert.equal(emails.length, 1, name)
    assert.match(emails[0].html, /photos/)
    assert.match(emails[0].html, /They were told their account was deleted, which it was/)
    // The account is gone: the address must not travel on in this email or the run row.
    assert.ok(!(emails[0].html + JSON.stringify(runs)).toLowerCase().includes('person@example.com'), name)
  }
})

test('settings page shows the route\'s message instead of signing the person out', () => {
  const page = read('src/app/(app)/settings/page.tsx')
  const fn = page.slice(page.indexOf('async function handleDeleteAccount'), page.indexOf('await signOut()', page.indexOf('async function handleDeleteAccount')))
  assert.match(fn, /if \(!res\.ok\) \{[\s\S]*throw new Error\(body\?\.error \|\| 'Failed to delete account'\)/)
})

test('migration: the keys that blocked deletion now have an action, and the count trigger is insert-only', () => {
  const m = read('supabase/migrations/20261111000003_account_deletion_unblocked.sql')
  for (const [table, action] of [
    ['ss_ai_usage', 'SET NULL'], ['ss_user_products', 'CASCADE'], ['ss_widget_visitors', 'SET NULL'],
    ['ss_treatment_phases', 'SET NULL'], ['ss_glass_skin_scores', 'SET NULL'], ['ss_skin_breakdown_history', 'SET NULL'],
  ]) {
    const block = m.slice(m.indexOf(`ALTER TABLE public.${table}\n`), m.indexOf(';', m.indexOf(`ALTER TABLE public.${table}\n`)))
    assert.ok(block.endsWith(`ON DELETE ${action}`), `${table}: ${block.slice(-40)}`)
  }
  assert.match(m, /CREATE TRIGGER ss_yuri_message_count\n  AFTER INSERT ON public\.ss_yuri_messages/)
})

// ---- what we keep of a Stripe event, EXECUTED ----

const PAYLOAD = ts.transpileModule(read('src/lib/stripe-payload.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { eventObjectForLog } = await import('data:text/javascript;base64,' + Buffer.from(PAYLOAD).toString('base64'))

test('the event log keeps ids, status, amounts and our metadata, and nothing that names a person', () => {
  const invoice = {
    id: 'in_1', object: 'invoice', status: 'paid', customer: 'cus_1', subscription: 'sub_1', amount_paid: 999, currency: 'usd', created: 1,
    customer_email: 'person@example.com', customer_name: 'Pat Person', customer_phone: '+1 555 0100',
    customer_address: { line1: '1 Main St', city: 'Austin' }, customer_shipping: { name: 'Pat Person' },
    receipt_email: 'person@example.com', hosted_invoice_url: 'https://invoice.stripe.com/i/secret', invoice_pdf: 'https://x/pdf',
    account_name: 'Seoul Sister', lines: { data: [{ description: 'Pat Person plan' }] },
    billing_details: { email: 'person@example.com' }, customer_details: { email: 'person@example.com', name: 'Pat Person' },
    a_field_stripe_adds_next_year: { email: 'person@example.com' }, description: 'for Pat Person',
    metadata: { user_id: USER, offer_code: 'BAILEY', ip_hash: 'n1a2b3c', nested: { email: 'person@example.com' } },
    cancellation_details: { comment: 'account_deleted', feedback: 'Pat Person said so' },
  }
  const kept = eventObjectForLog(invoice)
  assert.deepEqual(kept, {
    id: 'in_1', object: 'invoice', status: 'paid', currency: 'usd', amount_paid: 999, created: 1,
    customer: 'cus_1', subscription: 'sub_1',
    metadata: { user_id: USER, offer_code: 'BAILEY' },
    cancellation_details: { comment: 'account_deleted' },
  })
  assert.doesNotMatch(JSON.stringify(kept), /person@example|Pat Person|555|Main St|invoice\.stripe/)
})

test('an expanded customer or subscription object is not kept, and junk in does not throw', () => {
  const kept = eventObjectForLog({ id: 'x', customer: { id: 'cus_1', email: 'person@example.com' }, subscription: { id: 'sub_1' }, status: { odd: true } })
  assert.deepEqual(kept, { id: 'x' })
  for (const junk of [null, undefined, 'str', 5, []]) assert.deepEqual(eventObjectForLog(junk), {})
  // A customer object: its own top-level fields are the person.
  assert.deepEqual(
    eventObjectForLog({ id: 'cus_1', object: 'customer', email: 'person@example.com', name: 'Pat Person', phone: '555', address: { city: 'Austin' }, description: 'Pat', created: 5 }),
    { id: 'cus_1', object: 'customer', created: 5 }
  )
})

test('webhook: stores only the reduced event, and sends no "everything is saved" email on an account deletion', () => {
  const hook = read('src/app/api/stripe/webhook/route.ts')
  // The whole insert, exactly: nothing spread in after the reduced object.
  assert.match(hook, /\.from\('ss_subscription_events'\)\.insert\(\{\n    event_type: event\.type,\n    stripe_event_id: event\.id,\n(?:    \/\/[^\n]*\n)*    event_data: eventObjectForLog\(event\.data\.object\),\n  \}\)/)
  assert.equal((hook.match(/event_data/g) ?? []).length, 1)
  assert.equal((hook.match(/\.insert\(/g) ?? []).length, 1, 'a second insert into the event log would need its own check')
  const del = hook.slice(hook.indexOf("case 'customer.subscription.deleted'"), hook.indexOf("case 'invoice.paid'"))
  assert.match(del, /^case 'customer\.subscription\.deleted': \{\n\s+const subscription = event\.data\.object as Stripe\.Subscription\n/)
  assert.equal((del.match(/\bsubscription\s*=[^=]/g) ?? []).length, 1, 'subscription is assigned once, from the event')
  assert.equal((del.match(/cancellation_details/g) ?? []).length, 1)
  assert.doesNotMatch(del, /delete subscription|Object\.assign\(subscription/)
  assert.match(del, /const accountDeleted = subscription\.cancellation_details\?\.comment === ACCOUNT_DELETED_CANCEL_COMMENT\n\s+if \(!accountDeleted && \(lapsed \?\? \[\]\)\.length > 0\) \{/)
  assert.equal((del.match(/sendTrialEndedEmail\(/g) ?? []).length, 1)
  assert.ok(del.indexOf('if (!accountDeleted') < del.indexOf('sendTrialEndedEmail('))
})

// ---- the Stripe helpers, EXECUTED against a stub client ----

function loadStripeHelpers(client) {
  const src = read('src/lib/stripe.ts')
  const from = src.indexOf('export const ACCOUNT_DELETED_CANCEL_COMMENT')
  const to = src.indexOf('export async function createBillingPortalSession')
  assert.ok(from > -1 && to > from)
  const block = src.slice(src.lastIndexOf('/**', from), to).replace(/^export /gm, '')
  const out = ts.transpileModule(block, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('getStripeClient', `${out}\nreturn { ACCOUNT_DELETED_CANCEL_COMMENT, cancelSubscriptionForDeletedAccount, deleteStripeCustomer, findStripeCustomersForUser }`)(() => client)
}
const missing = () => Object.assign(new Error('No such thing'), { code: 'resource_missing' })

test('stripe: the cancel carries the mark the webhook reads; gone already is fine; any other error is thrown', async () => {
  const calls = []
  const h = loadStripeHelpers({ subscriptions: { cancel: async (...a) => { calls.push(a) } } })
  await h.cancelSubscriptionForDeletedAccount('sub_1')
  assert.deepEqual(calls, [['sub_1', { cancellation_details: { comment: 'account_deleted' } }]])
  assert.equal(h.ACCOUNT_DELETED_CANCEL_COMMENT, 'account_deleted')
  await loadStripeHelpers({ subscriptions: { cancel: async () => { throw missing() } } }).cancelSubscriptionForDeletedAccount('sub_1')
  for (const err of [new Error('network'), Object.assign(new Error('rate'), { code: 'rate_limit' })]) {
    await assert.rejects(loadStripeHelpers({ subscriptions: { cancel: async () => { throw err } } }).cancelSubscriptionForDeletedAccount('sub_1'), (e) => e === err)
  }
})

test('stripe: the customer is really deleted; gone already is fine; any other error is thrown', async () => {
  const calls = []
  await loadStripeHelpers({ customers: { del: async (...a) => { calls.push(a) } } }).deleteStripeCustomer('cus_1')
  assert.deepEqual(calls, [['cus_1']])
  await loadStripeHelpers({ customers: { del: async () => { throw missing() } } }).deleteStripeCustomer('cus_1')
  const err = new Error('network')
  await assert.rejects(loadStripeHelpers({ customers: { del: async () => { throw err } } }).deleteStripeCustomer('cus_1'), (e) => e === err)
})

test('stripe: customers are found by OUR account id on their subscriptions, every page, never by address', async () => {
  const queries = []
  const pages = {
    first: { data: [{ customer: 'cus_a', status: 'active' }, { customer: { id: 'cus_b' }, status: 'incomplete_expired' }, { customer: 'cus_a', status: 'paused' }], has_more: true, next_page: 'p2' },
    // The usual case for an earlier customer: its subscription is long canceled.
    p2: { data: [{ customer: 'cus_c', status: 'canceled' }, { customer: null }], has_more: false, next_page: null },
  }
  const h = loadStripeHelpers({ subscriptions: { search: async (q) => { queries.push(q); return pages[q.page ?? 'first'] } } })
  assert.deepEqual(await h.findStripeCustomersForUser(USER), ['cus_a', 'cus_b', 'cus_c'])
  assert.deepEqual(queries, [
    { query: `metadata['user_id']:'${USER}'`, limit: 100, page: undefined },
    { query: `metadata['user_id']:'${USER}'`, limit: 100, page: 'p2' },
  ])
  // Nothing that is not an account id may reach the query (no quotes, no email, no wildcard).
  for (const bad of ['', "x' OR email:'a@b.c", 'person@example.com', '*']) {
    await assert.rejects(h.findStripeCustomersForUser(bad), /not an account id/)
  }
  assert.equal(queries.length, 2)
  const err = new Error('stripe down')
  await assert.rejects(loadStripeHelpers({ subscriptions: { search: async () => { throw err } } }).findStripeCustomersForUser(USER), (e) => e === err)
})

test('the route hands the erasure these three Stripe helpers', () => {
  const route = read('src/app/api/account/delete/route.ts')
  assert.match(route, /cancelSubscription: cancelSubscriptionForDeletedAccount,\n\s+deleteStripeCustomer,\n\s+findStripeCustomers: findStripeCustomersForUser,/)
  assert.match(route, /import \{ cancelSubscriptionForDeletedAccount, deleteStripeCustomer, findStripeCustomersForUser \} from '@\/lib\/stripe'/)
})
