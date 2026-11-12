/**
 * Guard tests — a member is never sent the lead follow-up emails (Nov 12 2026).
 *
 * Owner's walkthrough: chatted on the landing page, gave an email, created an
 * account and started the free week that night. At 8:05 the next morning the
 * first follow-up arrived: "we talked a while back... you can talk to me free".
 * The member check compared account ids only, and a chat lead is enrolled from
 * the address they typed, with no account id.
 *
 * Every test here EXECUTES the real enrolment and send code against a fake
 * database.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

async function loadNurture() {
  let js = ts.transpileModule(read('src', 'lib', 'email', 'nurture.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  const impls = {
    sendEmail: '(async (to, subject) => { globalThis.__nurtureSent.push([to, subject]); return { sent: true } })',
    wrapEmailHtml: '((b) => b)',
    postalAddress: '(() => "1 Main St")',
    buildNurtureEmail: '((step, cohort) => ({ subject: `step${step}:${cohort}`, bodyHtml: "", footerHtml: "", unsubscribeUrl: "u" }))',
    STEP_DELAYS_DAYS: '[0, 3, 5]',
    createResumeToken: '(() => null)',
    widgetEmailLink: '(() => "https://www.seoulsister.com/")',
    normalizeOfferCode: '((c) => c ?? null)',
    PAID_PLAN_KEYS: "['monthly', 'pro_monthly']",
    MAX_FREE_MESSAGES: '12',
  }
  js = js.replace(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g, (m, names) =>
    names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => {
      const local = n.split(/\s+as\s+/).pop().trim()
      const orig = n.split(/\s+as\s+/)[0].trim()
      assert.ok(orig in impls, `no test implementation for import ${orig}`)
      return `const ${local} = ${impls[orig]};`
    }).join('\n'))
  const file = join(mkdtempSync(join(tmpdir(), 'ss-nurture-members-')), 'm.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}
// PAID_PLAN_KEYS above is the real list.
test('the paid plan keys this test uses are the real ones', () => {
  assert.match(read('src', 'lib', 'pricing.ts'), /export const PAID_PLAN_KEYS = \['monthly', 'pro_monthly'\] as const/)
})

const nurture = await loadNurture()

/** A database with the five tables the follow-up job touches. `fail` names reads that error. */
function fakeDb({ users = [], subs = [], profiles = [], visitors = [], leads = [], fail = {}, pageSize = 1000 } = {}) {
  const state = { leads: leads.map((l) => ({ suppressed: false, sequence_step: 0, last_sent_at: null, enrolled_at: '2026-11-01T00:00:00Z', unsubscribe_token: 't', ...l })), listCalls: [] }
  const table = (name) => {
    const f = { in: null, eq: [], lt: [], notNull: null }
    let op = 'select', values, cols = null
    // The columns each table really has. A filter or a select on any other
    // column is an error, as it is in PostgREST, never a silent match.
    const COLUMNS = {
      ss_subscriptions: ['user_id', 'status'],
      ss_user_profiles: ['user_id', 'plan'],
      ss_widget_visitors: ['id', 'visitor_id', 'captured_email', 'registered_user_id', 'converted_user_id', 'offer_code', 'total_messages'],
      ss_widget_sessions: ['id', 'visitor_id', 'message_count', 'ended_naturally', 'last_message_at'],
      ss_nurture_leads: ['id', 'email', 'user_id', 'cohort', 'visitor_id', 'sequence_step', 'last_sent_at', 'enrolled_at', 'unsubscribe_token', 'suppressed', 'suppressed_reason', 'updated_at'],
    }
    const known = (c) => { if (!(COLUMNS[name] ?? []).includes(c)) throw new Error(`fake db: ${name} has no column "${c}"`) }
    const pick = (rows) => rows.map((r) => (cols ? Object.fromEntries(cols.map((c) => [c, r[c] ?? null])) : r))
    const rowsFor = () => {
      if (fail[name]) return { data: null, error: { message: `${name} read failed` } }
      const source = { ss_subscriptions: subs, ss_user_profiles: profiles, ss_widget_visitors: visitors, ss_nurture_leads: state.leads }[name] ?? []
      const rows = source
        .filter((r) => !f.in || f.in[1].includes(r[f.in[0]]))
        .filter((r) => !f.notNull || r[f.notNull] != null)
        .filter((r) => f.eq.every(([c, x]) => r[c] === x) && f.lt.every(([c, x]) => r[c] < x))
      return { data: pick(rows), error: null }
    }
    const q = {
      select(c) { if (typeof c === 'string' && op === 'select') { cols = c.split(',').map((x) => x.trim()); cols.forEach(known) } return q },
      in(c, v) { known(c); f.in = [c, v]; return q },
      eq(c, v) { known(c); f.eq.push([c, v]); return q },
      lt(c, v) { known(c); f.lt.push([c, v]); return q },
      gt: () => q,
      not(c, operator, v) { known(c); assert.deepEqual([operator, v], ['is', null], 'only "is not null" is emulated'); f.notNull = c; return q },
      order: () => q,
      limit: () => q,
      update(v) { op = 'update'; values = v; return q },
      upsert(rows, o) {
        assert.equal(o?.onConflict, 'email')
        if (fail[`${name}:upsert`]) { op = 'upsert-failed'; return q }
        op = 'upsert'
        const added = []
        for (const r of rows) if (!state.leads.some((l) => l.email === r.email)) { const row = { id: `lead-${state.leads.length + 1}`, suppressed: false, sequence_step: 0, last_sent_at: null, enrolled_at: '2026-11-01T00:00:00Z', unsubscribe_token: 't', ...r }; state.leads.push(row); added.push(row) }
        values = added
        return q
      },
      maybeSingle: async () => { const r = rowsFor(); return { data: r.data?.[0] ?? null, error: r.error } },
      then(res, rej) {
        let out
        if (op === 'upsert-failed') out = { data: null, error: { message: 'upsert failed' } }
        else if (op === 'upsert') out = { data: values.map((r) => ({ id: r.id })), error: null }
        else if (op === 'update') { Object.keys(values).forEach(known); for (const l of state.leads) if (f.eq.every(([c, x]) => l[c] === x)) Object.assign(l, values); out = { data: null, error: null } }
        else out = rowsFor()
        return Promise.resolve(out).then(res, rej)
      },
    }
    return q
  }
  return {
    state,
    from: table,
    auth: { admin: { listUsers: async ({ page, perPage }) => {
      state.listCalls.push([page, perPage])
      if (fail.listUsers) return { data: { users: [] }, error: { message: 'listUsers failed' } }
      const size = Math.min(perPage, pageSize)
      return { data: { users: users.slice((page - 1) * size, page * size) }, error: null }
    } } },
  }
}

const quiet = async (fn) => {
  const orig = [console.error, console.warn]
  const errs = []
  console.error = (...a) => errs.push(a.join(' '))
  console.warn = () => {}
  try { return [await fn(), errs] } finally { [console.error, console.warn] = orig }
}

test('the walkthrough case: a chat lead who is now on a free week is not enrolled and not emailed', async () => {
  globalThis.__nurtureSent = []
  const db = fakeDb({
    users: [{ id: 'u-member', email: 'Member@Example.com' }, { id: 'u-free', email: 'free@example.com' }],
    subs: [{ user_id: 'u-member', status: 'trialing' }],
    // The lead row has the address and NO account id: that is how every chat lead is stored.
    visitors: [{ id: 'v1', captured_email: 'member@example.com' }, { id: 'v2', captured_email: 'stranger@example.com' }],
  })
  const [summary] = await quiet(() => nurture.processDueSends(db))
  assert.deepEqual(db.state.leads.map((l) => [l.email, l.cohort]).sort(), [['free@example.com', 'registered'], ['stranger@example.com', 'widget']])
  assert.deepEqual(globalThis.__nurtureSent.map(([to]) => to).sort(), ['free@example.com', 'stranger@example.com'])
  assert.equal(summary.errors, 0)
})

test('a lead already enrolled before they joined is stopped at send time, by address', async () => {
  for (const member of [
    { subs: [{ user_id: 'u1', status: 'trialing' }] },
    { subs: [{ user_id: 'u1', status: 'active' }] },
    { profiles: [{ user_id: 'u1', plan: 'pro_monthly' }] }, // comped: a plan and no subscription
    { profiles: [{ user_id: 'u1', plan: 'monthly' }] },
  ]) {
    globalThis.__nurtureSent = []
    const db = fakeDb({
      users: [{ id: 'u1', email: 'member@example.com' }],
      leads: [{ id: 'l1', email: 'MEMBER@example.com ', user_id: null, visitor_id: 'v1', cohort: 'widget', sequence_step: 1, last_sent_at: '2026-01-01T00:00:00Z' }],
      ...member,
    })
    const [summary] = await quiet(() => nurture.processDueSends(db))
    assert.deepEqual(globalThis.__nurtureSent, [], JSON.stringify(member))
    assert.equal(summary.converted, 1)
    assert.deepEqual([db.state.leads[0].suppressed, db.state.leads[0].suppressed_reason], [true, 'converted'])
  }
})

test('someone who is NOT a member still gets the emails: a lapsed or cancelled account, a free plan', async () => {
  globalThis.__nurtureSent = []
  const db = fakeDb({
    users: [{ id: 'u1', email: 'lapsed@example.com' }, { id: 'u2', email: 'free@example.com' }],
    subs: [{ user_id: 'u1', status: 'canceled' }, { user_id: 'u2', status: 'incomplete_expired' }],
    profiles: [{ user_id: 'u1', plan: 'free' }, { user_id: 'u2', plan: null }],
    visitors: [{ id: 'v1', captured_email: 'lapsed@example.com' }],
  })
  await quiet(() => nurture.processDueSends(db))
  assert.deepEqual(globalThis.__nurtureSent.map(([to]) => to).sort(), ['free@example.com', 'lapsed@example.com'])
})

test('a failed read is not "nobody is a member": nothing is enrolled, nothing is sent, and the run says so', async () => {
  for (const fail of [{ ss_subscriptions: true }, { ss_user_profiles: true }, { listUsers: true }]) {
    globalThis.__nurtureSent = []
    const db = fakeDb({
      users: [{ id: 'u1', email: 'member@example.com' }],
      subs: [{ user_id: 'u1', status: 'active' }],
      visitors: [{ id: 'v1', captured_email: 'member@example.com' }],
      leads: [{ id: 'l1', email: 'member@example.com', user_id: null, visitor_id: 'v1', cohort: 'widget' }],
      fail,
    })
    const [summary, errs] = await quiet(() => nurture.processDueSends(db))
    assert.deepEqual(globalThis.__nurtureSent, [], JSON.stringify(fail))
    assert.deepEqual(summary, { enrolled: 0, sent: 0, converted: 0, errors: 1, skipped_reason: 'members_unreadable' })
    assert.equal(db.state.leads.length, 1, 'nobody new was enrolled')
    assert.equal(errs.length, 1)
  }
  // And the scheduled job records that as a failed run, not a clean one.
  assert.match(read('src', 'app', 'api', 'cron', 'nurture-sequence', 'route.ts'), /status: summary\.skipped_reason === 'members_unreadable' \? 'failed' : summary\.errors > 0 \? 'completed_with_errors' : 'completed',/)
})

test('the account list is read to the end: a member on a later page is still a member', async () => {
  globalThis.__nurtureSent = []
  const users = Array.from({ length: 5 }, (_, i) => ({ id: `u${i}`, email: `p${i}@example.com` }))
  const db = fakeDb({
    users,
    pageSize: 2, // the server hands back short pages: 2, 2, 1
    subs: [{ user_id: 'u4', status: 'active' }],
    visitors: [{ id: 'v1', captured_email: 'p4@example.com' }],
  })
  const [members] = await quiet(() => nurture.loadMembers(db))
  // A short page is not the last page: reading stops only on an empty one.
  assert.deepEqual([...members.emails], ['p4@example.com'])
  assert.equal(members.accounts.length, 5)
  assert.deepEqual(db.state.listCalls.map(([p]) => p), [1, 2, 3, 4])
  await quiet(() => nurture.processDueSends(db))
  assert.deepEqual(globalThis.__nurtureSent.map(([to]) => to).sort(), ['p0@example.com', 'p1@example.com', 'p2@example.com', 'p3@example.com'])
})

test('every way of being a member counts, in any letter case, and a chat tied to a member account under another address', async () => {
  globalThis.__nurtureSent = []
  const db = fakeDb({
    users: [
      { id: 'u-due', email: 'pastdue@example.com' },
      { id: 'u-comp', email: 'comped@example.com' },
      { id: 'u-case', email: 'case@example.com' },
      { id: 'u-relay', email: 'relay-address@privaterelay.example' },
    ],
    subs: [{ user_id: 'u-due', status: 'past_due' }, { user_id: 'u-case', status: 'active' }, { user_id: 'u-relay', status: 'trialing' }],
    profiles: [{ user_id: 'u-comp', plan: 'pro_monthly' }],
    visitors: [
      { id: 'v1', captured_email: 'pastdue@example.com' },
      { id: 'v2', captured_email: 'comped@example.com' },
      { id: 'v3', captured_email: '  Case@Example.COM ' },
      // Typed one address to Yuri, signed up with another: the chat is tied to the account.
      { id: 'v4', captured_email: 'typed-in-chat@example.com', registered_user_id: 'u-relay' },
      { id: 'v5', captured_email: 'also-typed@example.com', converted_user_id: 'u-case' },
      { id: 'v6', captured_email: 'real-lead@example.com', registered_user_id: 'u-nobody' },
    ],
  })
  const [summary] = await quiet(() => nurture.processDueSends(db))
  assert.deepEqual(db.state.leads.map((l) => l.email), ['real-lead@example.com'])
  assert.deepEqual(globalThis.__nurtureSent.map(([to]) => to), ['real-lead@example.com'])
  assert.equal(summary.errors, 0)
})

test('a run that could not read the chat leads, or could not enrol them, is not recorded as clean', async () => {
  for (const fail of [{ ss_widget_visitors: true }, { 'ss_nurture_leads:upsert': true }]) {
    globalThis.__nurtureSent = []
    const db = fakeDb({ users: [{ id: 'u1', email: 'free@example.com' }], visitors: [{ id: 'v1', captured_email: 'lead@example.com' }], fail })
    const [summary, errs] = await quiet(() => nurture.processDueSends(db))
    assert.ok(summary.errors >= 1, JSON.stringify(fail))
    assert.ok(errs.length >= 1)
  }
})

test('an account list too long to read to the end is a failed read, never a short list', async () => {
  // The server keeps answering full pages past the cap.
  const endless = fakeDb({ users: [] })
  endless.auth.admin.listUsers = async ({ page }) => ({ data: { users: [{ id: `u${page}`, email: `p${page}@example.com` }] }, error: null })
  const [members, errs] = await quiet(() => nurture.loadMembers(endless))
  assert.equal(members, null)
  assert.match(errs[0], /was not read to the end/)
})

test('the re-engagement campaign uses the same member list, by account and by address', () => {
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.match(run, /const members = loadErr \? null : await loadMembers\(db\)\n    if \(loadErr \|\| !members\) \{\n      lead\.phase = 'load_failed'/)
  assert.match(run, /hasEverPaid:\n\s+\(!!personId\(l\) && \(everPaid\.has\(personId\(l\)!\) \|\| members\.ids\.has\(personId\(l\)!\)\)\) \|\|\n\s+convertedEmails\.has\(l\.email\.toLowerCase\(\)\) \|\|\n\s+members\.emails\.has\(l\.email\.trim\(\)\.toLowerCase\(\)\),/)
  // And the gate that reads it turns a member away.
  assert.match(read('src', 'lib', 'proactive', 'lead-reengage.ts'), /if \(opts\.hasEverPaid\) return 'former_or_current_payer'/)
})

// ---------------------------------------------------------------------------
// The Skin Profile write-up is told what it is not shown (Nov 12 2026).
// It told a member whose one recorded sensitivity is fragrance that their
// "whole routine is fragrance-free by design" while a fragranced serum sat in
// the evening routine. It is given the profile and conversation records, never
// a routine or an ingredient list.
// ---------------------------------------------------------------------------
test('the Skin Profile write-up: its brief states what it cannot see, and that is true of what it is handed', () => {
  const src = read('src', 'lib', 'intelligence', 'skin-breakdown.ts')
  const brief = src.slice(src.indexOf('const SKIN_BREAKDOWN_BRIEF = `'), src.indexOf('`\n\nfunction buildUserMessage'))
  assert.ok(brief.includes("- You are given their phase plan and what was said in conversation, never their saved routine or any product's ingredient list. The phase protocol is what you planned, not a check of what they own or what is in it. Say what the plan calls for; do not state that their routine or a product is free of something unless a line below records that as checked.\n"))
  assert.ok(brief.includes('- Nothing below says whether they have a menstrual cycle; mention cycle timing only if the profile has cycle tracking enabled or a line below records it.\n'))
  // The sentence that went wrong is not quoted back to the model.
  assert.doesNotMatch(brief, /fragrance-free/i)
  // True of the code: what the write-up is handed is built in buildUserMessage
  // and gatherInputs, and neither reads a routine, a shelf or ingredients.
  const handed = src.slice(src.indexOf('function buildUserMessage'), src.indexOf('async function classifyCacheState')).replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, '$1')
  assert.ok(handed.length > 3000)
  assert.doesNotMatch(handed, /ss_user_routines|ss_routine_products|ss_user_products|ss_product_ingredients|ingredients_inci/, 'if the write-up is given routine or ingredient data, the "not shown" fact is false and must be rewritten')
  assert.match(handed, /if \(p\.cycle_tracking_enabled\) profileBits\.push\(`Cycle tracking: enabled`\)/)
  // A write-up made under an older brief is replaced on the next visit.
  assert.match(src, /const hashable = \{\n(?:\s+\/\/[^\n]*\n)+\s+brief: BRIEF_VERSION,\n/)
  assert.match(src, /const BRIEF_VERSION = '2026-11-12'/)
  // A write-up made before this brief is never served again: the loader
  // answers "none", which the page treats as a first visit and writes a new
  // one before replying (the old path showed the old text once more and
  // relied on work left running after the response).
  assert.match(src, /if \(!data\) return null\n(?:\s+\/\/[^\n]*\n)+\s+if \(new Date\(data\.generated_at\)\.getTime\(\) < Date\.parse\(BRIEF_SINCE\)\) return null\n/)
  const since = /const BRIEF_SINCE = '([^']+)'/.exec(src)?.[1]
  assert.ok(since && !Number.isNaN(Date.parse(since)))
  const route = read('src', 'app', 'api', 'skin-profile', 'route.ts')
  assert.match(route, /const cached = await loadCachedSkinBreakdown\(user\.id\)\n      if \(cached\) \{[\s\S]*?\} else \{\n\s+\/\/ First visit[^\n]*\n\s+const fresh = await getOrGenerateSkinBreakdown\(user\.id\)/)
})
