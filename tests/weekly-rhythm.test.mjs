/**
 * Weekly rhythm (Nov 10 2026, owner decision).
 *
 * "There has to be a reason for subs to engage with Yuri on a more regular
 * schedule... Subs need to be taught that to get the best results, they need
 * to provide regular feedback to Yuri."
 *
 * Before this: the check-in judge was told "Silence is the normal answer"; a
 * shared cap of 3 proactive contacts per 30 days made a weekly note impossible
 * by the fourth week; a 7-day trial got one note (day 3); most new profiles had
 * no timezone, so their Sunday could not be found; and chat-Yuri had no record
 * of the check-in she had sent when the member came to answer it.
 *
 * The gate, the facts and the email line are executed. The judge paragraph is
 * pinned exactly: a ban list cannot see an added sentence.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'
import { createHash } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const tmp = mkdtempSync(join(tmpdir(), 'ss-rhythm-'))
let n = 0
const transpile = (src) =>
  ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
function emitStandalone(relPath) {
  const file = join(tmp, `s${n++}.mjs`)
  writeFileSync(file, transpile(read(...relPath)))
  return pathToFileURL(file).href
}
const CLOCK = emitStandalone(['src', 'lib', 'yuri', 'clock.ts'])
const LIMITS = emitStandalone(['src', 'lib', 'intelligence', 'nudge-limits.ts'])
const real = (url, name) => `(await import(${JSON.stringify(url)})).${name}`
async function load(relPath, impls = {}) {
  let js = transpile(read(...relPath))
  js = js.replace(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];?/g, (_m, names) =>
    names.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      const [orig, alias] = x.split(/\s+as\s+/)
      return `const ${(alias || orig).trim()} = ${impls[orig.trim()] ?? `(() => { throw new Error("stub: ${orig.trim()}") })`};`
    }).join('\n')
  )
  js = js.replace(/^export\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?$/gm, '')
  const file = join(tmp, `m${n++}.mjs`)
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}
const loadCheckin = () =>
  load(['src', 'lib', 'proactive', 'subscriber-checkin.ts'], {
    getLocalClock: real(CLOCK, 'getLocalClock'),
    daysBetweenIso: real(CLOCK, 'daysBetweenIso'),
    localHour: real(LIMITS, 'localHour'),
    DAYTIME_START_HOUR: real(LIMITS, 'DAYTIME_START_HOUR'),
    DAYTIME_END_HOUR: real(LIMITS, 'DAYTIME_END_HOUR'),
    PRICING: `({ trial_days: 7, monthly_display_long: '$9.99/month' })`,
  })

const sub = (timezone = 'America/Chicago') => ({ user_id: 'u', timezone, latitude: null, longitude: null, is_demo: false, nudge_email_opt_out: false, nudge_unsubscribe_token: null })
const at = (iso) => Date.parse(iso)
const DAY = 86400000
const src = read('src', 'lib', 'proactive', 'subscriber-checkin.ts')

// ---------------------------------------------------------------------------
// The gate (executed)
// ---------------------------------------------------------------------------
const gate = (m, now, over = {}) => m.checkinGate(sub(), { internal: false, nudgeCreatedAts: [], lastJudgedAt: null, now, ...over })

test('a member can be judged every Sunday, week after week (the old 3-per-30-days cap blocked week four)', async () => {
  const m = await loadCheckin()
  const sundays = ['2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06'].map((d) => at(`${d}T17:00:00Z`))
  const sent = []
  for (const s of sundays) {
    assert.equal(gate(m, s, { nudgeCreatedAts: sent, lastJudgedAt: sent.at(-1) ?? null }), null, `Sunday ${new Date(s).toISOString().slice(0, 10)} (${sent.length} already sent)`)
    sent.push(new Date(s).toISOString())
  }
  assert.equal(sent.length, 5)
  assert.doesNotMatch(src, /capOrSpacingBlocks/, 'the 3-per-30-days cap must not gate a weekly check-in')
})

test('never within two days of ANY proactive contact, and not twice on one Sunday', async () => {
  const m = await loadCheckin()
  assert.equal(m.CHECKIN_MIN_GAP_DAYS, 2)
  const sun = at('2026-11-08T17:00:00Z')
  assert.equal(m.contactedTooRecently([], sun), false)
  assert.equal(m.contactedTooRecently([new Date(sun - 1 * DAY).toISOString()], sun), true)
  assert.equal(m.contactedTooRecently([new Date(sun - 2 * DAY).toISOString()], sun), false)
  assert.equal(gate(m, sun, { nudgeCreatedAts: [new Date(sun - 1 * DAY).toISOString()] }), 'cap_or_spacing')
  assert.equal(gate(m, sun + 3 * 3600000, { lastJudgedAt: new Date(sun).toISOString() }), 'judged_recently')
})

test('a trial is judged on EXACTLY day 3 and day 6: every day is tested by itself, so nothing else masks a wrong day', async () => {
  const m = await loadCheckin()
  assert.deepEqual([...m.TRIAL_CHECKIN_DAYS], [3, 6])
  // Every start weekday: each trial day is asked with no prior judgment and no
  // prior contact. (A first version of this test walked the days in order, and
  // the two-day gap after day 3 hid a gate that also judged day 4.)
  for (let startOffset = 0; startOffset < 7; startOffset++) {
    const start = at('2026-11-02T18:00:00Z') + startOffset * DAY
    const trial = { startedAt: new Date(start).toISOString(), endsAt: new Date(start + 7 * DAY).toISOString() }
    const judged = []
    for (let d = 0; d < 7; d++) {
      const now = start + d * DAY
      if (gate(m, now, { trial }) === null) judged.push(m.trialDayNumber(trial, 'America/Chicago', now))
    }
    assert.deepEqual(judged, [3, 6], `trial starting ${trial.startedAt.slice(0, 10)}`)
  }
})

test('a row that still says "trialing" after its last day does not silence the member', async () => {
  const m = await loadCheckin()
  // Started Oct 20; today is Sunday Nov 8 (day 20). The row never left 'trialing'.
  const stale = { startedAt: '2026-10-20T18:00:00Z', endsAt: '2026-10-27T18:00:00Z' }
  assert.equal(gate(m, at('2026-11-08T17:00:00Z'), { trial: stale }), null, 'falls through to the Sunday rule')
  assert.equal(gate(m, at('2026-11-10T17:00:00Z'), { trial: stale }), 'not_checkin_day')
  // A trial that was ended EARLY (its end date has passed while the day count
  // is still inside seven): today is Sunday Nov 8, day 4 of a trial that
  // started Thursday and was ended an hour ago. The day count alone would call
  // this "a trial day that is not 3 or 6" and skip the Sunday.
  assert.equal(gate(m, at('2026-11-08T17:00:00Z'), { trial: { startedAt: '2026-11-05T18:00:00Z', endsAt: '2026-11-08T16:00:00Z' } }), null)
  // No end date on the row, but past the trial's length: same.
  assert.equal(gate(m, at('2026-11-08T17:00:00Z'), { trial: { startedAt: '2026-10-20T18:00:00Z', endsAt: null } }), null)
})

test('the first Sunday after a trial is not pushed out a week by the day-6 note', async () => {
  const m = await loadCheckin()
  // Day-6 note on Wednesday Nov 4; trial over; Sunday Nov 8 is four days later.
  assert.equal(gate(m, at('2026-11-08T17:00:00Z'), { lastJudgedAt: '2026-11-04T18:00:00Z', nudgeCreatedAts: ['2026-11-04T18:00:00Z'] }), null)
})

// ---------------------------------------------------------------------------
// What the judge is told (the WHOLE prompt is pinned; fact builders executed)
// ---------------------------------------------------------------------------
test('CLOSED WORLD: the entire check-in judge prompt is pinned by fingerprint', () => {
  // A paragraph-level pin let "End every note with: reply today or your routine
  // will be reset." be added as a new bullet with every test green. Any change
  // to this prompt now fails here, and the person changing it has to read the
  // whole thing, run the second-model review, and update the fingerprint.
  const a = src.indexOf('const CHECKIN_SYSTEM = `') + 'const CHECKIN_SYSTEM = `'.length
  const b = src.indexOf('`\n\nfunction daysSince')
  assert.ok(a > 100 && b > a)
  assert.equal(createHash('sha256').update(src.slice(a, b)).digest('hex'), '4846dd4c9841774aa8dba4d1fbcdd31a93595510a80c10e60f6e8f71f07f61e4')
})

test('what the judge prompt says about speaking and silence, in words', () => {
  const system = src.slice(src.indexOf('const CHECKIN_SYSTEM = `'), src.indexOf('function daysSince'))
  assert.match(system, /Seoul Sister's policy is that most weeks a note goes out\. One question is enough, two at most/)
  assert.match(system, /Ask WHETHER before HOW/, 'a "how is X going" question claims use and is blocked by the content guard')
  assert.match(system, /Silence is yours to choose, and it fits when they have left your recent check-ins unanswered/)
  assert.match(system, /During a free trial, an unanswered day-3 note is not a reason to skip the first-week review\./)
  assert.doesNotMatch(system, /Silence is the normal answer/)
  assert.doesNotMatch(system, /two or three specific questions/, 'that produced a questionnaire and contradicted the "one specific thing" bullet')
  // No number of unanswered notes forces her either way.
  assert.doesNotMatch(system, /\b(after|once)\s+(two|three|2|3|\d+)\s+(unanswered|ignored|check-ins)/i)
  for (const line of [
    /is their prescriber's call to start, stop, or change/,
    /The person comes before the skin\./,
    /Never guilt about how long it's been\. No urgency or sales pressure\./,
    /don't prescribe a new product or a change to their actives here/,
  ]) assert.match(system, line)
})

test('facts (executed): why today, in the member\'s own calendar, and nothing the guard would block', async () => {
  const m = await loadCheckin()
  // Trial ends Thursday 10pm Chicago = Friday 04:00 UTC. The date must be THEIR Thursday.
  const trial = { startedAt: '2026-11-20T04:00:00Z', endsAt: '2026-11-27T04:00:00Z' }
  assert.equal(
    m.checkinReasonFact(6, trial, 'America/Chicago'),
    'Why you are being asked today: it is day 6 of their 7-day free trial, which ends Thursday, November 26 in their time. This is their first-week review: ask how the first days went. Any adjustment is worked out in chat once they answer, not in this note. Seoul Sister sends them a separate plain notice about when the trial ends and how to keep going, so do not write about the trial ending, the price, or a card yourself.'
  )
  assert.equal(m.checkinReasonFact(3, trial, 'America/Chicago'), 'Why you are being asked today: it is day 3 of their free trial (the mid-trial check-in). You write again on day 6; after the trial you are asked once a week, on Sunday.')
  assert.equal(m.checkinReasonFact(null, null), 'Why you are being asked today: it is their weekly check-in (once a week, on Sunday, about the week just gone and the week ahead).')
  assert.doesNotMatch(m.checkinReasonFact(6, trial, 'America/Chicago'), /what you would adjust next/, 'asking her to propose a change makes the guard block the note')
})

test('facts (executed): whether they were told, and what became of the notes already sent', async () => {
  const m = await loadCheckin()
  assert.equal(m.rhythmFact('2026-11-11T09:00:00Z'), 'They were told when they joined (on the membership page and in their welcome email) that you check in every week and adjust their routine from what they tell you. A weekly note is expected.')
  assert.equal(m.rhythmFact('2026-07-21T00:00:00Z'), 'They joined before members were told to expect a weekly check-in, and nothing has told them one is coming. If you write, one short line saying you will check in each week from now on is fair.')
  assert.equal(m.rhythmFact(null), m.rhythmFact('2026-07-21T00:00:00Z'), 'unknown must not be reported as "they were told"')

  const nudges = [
    { nudge_type: 'yuri_checkin', created_at: '2026-11-22T17:00:00Z', acted_at: null },
    { nudge_type: 'yuri_checkin', created_at: '2026-11-15T17:00:00Z', acted_at: '2026-11-15T19:00:00Z' },
    { nudge_type: 'open_loop', created_at: '2026-11-12T17:00:00Z', acted_at: null },
    { nudge_type: 'yuri_checkin', created_at: '2026-11-08T17:00:00Z', acted_at: null },
  ]
  assert.equal(
    m.unansweredFact(nudges, '2026-11-10T00:00:00Z'),
    'Check-ins sent since they last wrote to you: 2, the latest on 2026-11-22 (looking at your 4 most recent proactive notes). They opened 1 of those into a chat and have not written since.'
  )
  assert.equal(m.unansweredFact(nudges, '2026-11-23T00:00:00Z'), 'Check-ins sent since they last wrote to you: none (looking at your 4 most recent proactive notes).')
  assert.match(m.unansweredFact(nudges, null), /: 3, the latest on 2026-11-22/)
})

test('the guard is told what is true for THIS member: during a trial the next note is day 6, not Sunday', async () => {
  const m = await loadCheckin()
  assert.equal(m.weeklyCheckinStatement(3), 'Yuri writes to this member again on day 6 of their free trial, and after the trial most weeks on Sunday, adjusting their routine from what they tell her.')
  assert.equal(m.weeklyCheckinStatement(6), 'Yuri checks in with this member most weeks, on Sunday, and adjusts their routine from what they tell her.')
  assert.equal(m.weeklyCheckinStatement(null), m.weeklyCheckinStatement(6))
  assert.match(src, /evidence\.verifiedStatements = \[\.\.\.\(evidence\.verifiedStatements \?\? \[\]\), weeklyCheckinStatement\(trialDayNumber\(trial, s\.timezone, now\)\)\]/)
})

test('"were they told" is read from the subscription they are on now, never defaulted', () => {
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.match(run, /const memberSinceAt = rows\.map\(\(r\) => \(r\.stripe_created_at as string \| null\) \?\? \(r\.created_at as string\)\)\.sort\(\)\.pop\(\) \?\? null/)
  assert.doesNotMatch(run, /memberSinceAt\s*\?\?\s*new Date|memberSinceAt \|\|/, 'a default here would label everyone as told')
  assert.doesNotMatch(run, /factLine|trialReviewLine/, 'the billing line is no longer part of Yuri\'s email')
})

// ---------------------------------------------------------------------------
// The trial-ending notice: its own email, sent whatever Yuri decides (executed)
// ---------------------------------------------------------------------------
async function loadNotices() {
  const emails = await load(['src', 'lib', 'email', 'trial-emails.ts'], {
    PRICING: `({ trial_days: 7, monthly_display_long: '$9.99/month' })`,
    chargePhrase: `((pct, when) => (pct ? '$4.99 for your first paid month (' + pct + '% off) ' + when.replace(',', '') + ', then $9.99/month until you cancel' : '$9.99/month ' + when + ' and every month after that until you cancel'))`,
    addCardPhrase: `((pct) => (pct ? '$4.99 for your first paid month (' + pct + '% off) when the trial ends, then $9.99/month' : '$9.99/month, starting when the trial ends'))`,
    escapeHtml: `((x) => x)`,
    validTimeZone: `((tz) => { if (!tz) return null; try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz } catch { return null } })`,
    wrapEmailHtml: `((body, footer) => body + footer)`,
    sendEmail: `(async () => ({ sent: true }))`,
  })
  globalThis.__trialEndingLine = emails.trialEndingLine
  const notices = await load(['src', 'lib', 'trial-notices.ts'], { trialEndingLine: 'globalThis.__trialEndingLine' })
  return { emails, notices }
}

test('the trial-ending line names the member\'s own day and claims a card only when Stripe says so', async () => {
  const { emails } = await loadNotices()
  const end = '2026-11-27T04:00:00Z' // Thursday 10pm in Chicago
  assert.equal(emails.trialEndingLine(end, null, 'America/Chicago'), 'Your free trial ends on Thursday, November 26.')
  assert.equal(emails.trialEndingLine(end, null, null), 'Your free trial ends on Friday, November 27 (UTC).', 'with no timezone the date says which calendar it is')
  assert.equal(emails.trialEndingLine(end, { hasPaymentMethod: true, cancelAtPeriodEnd: false }, 'America/Chicago'), 'Your free trial ends on Thursday, November 26. Your card will be charged $9.99/month on that day, and every month after that until you cancel.')
  assert.equal(emails.trialEndingLine(end, { hasPaymentMethod: true, cancelAtPeriodEnd: true }, 'America/Chicago'), 'Your free trial ends on Thursday, November 26. You cancelled, so nothing will be charged.')
  assert.equal(
    emails.trialEndingLine(end, { hasPaymentMethod: false, cancelAtPeriodEnd: false }, 'America/Chicago'),
    'Your free trial ends on Thursday, November 26. No card is on file, so nothing will be charged and your membership will stop on that day. To keep going, sign in and use the "Add a card" button at the top of any page: $9.99/month, starting when the trial ends.'
  )
  const body = emails.buildTrialEndingEmail('LINE').html
  assert.match(body, /A note from Seoul Sister about your free trial\./)
  assert.match(body, /This is an account notice, not a message from Yuri\./)
})

function noticeDb(rows, { failStamp = false } = {}) {
  const stamps = []
  return {
    stamps,
    from() {
      const q = {
        select: () => q, is: () => q, gt: () => q, lte: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }),
        update(values) {
          const u = { eq: () => u, is: () => { stamps.push(values); return Promise.resolve({ error: failStamp ? { message: 'x' } : null }) } }
          return u
        },
      }
      return q
    },
  }
}

test('trial notices (executed): sent once, stamped only AFTER a successful send, and never claims a card when Stripe fails', async () => {
  const { notices } = await loadNotices()
  const row = { id: 'trial-0001', user_id: 'u1', stripe_subscription_id: 'sub_1', trial_end: '2026-11-27T04:00:00Z' }
  const sent = []
  const deps = (over = {}) => ({
    liveState: async () => ({ hasPaymentMethod: false, cancelAtPeriodEnd: false }),
    emailForUser: async () => 'kim@example.com',
    timezoneForUser: async () => 'America/Chicago',
    send: async (to, line) => { sent.push([to, line]); return { sent: true } },
    ...over,
  })
  const db = noticeDb([row])
  const ok = await notices.sendTrialEndingNotices(db, deps(), Date.parse('2026-11-25T12:00:00Z'))
  assert.deepEqual([ok.due, ok.sent, ok.errors.length], [1, 1, 0])
  assert.equal(db.stamps.length, 1)
  assert.match(sent[0][1], /^Your free trial ends on Thursday, November 26\. No card is on file/)

  // The send fails: NOT stamped, so the next hour tries again.
  const db2 = noticeDb([row])
  const failed = await notices.sendTrialEndingNotices(db2, deps({ send: async () => ({ sent: false, reason: 'bounce' }) }), Date.parse('2026-11-25T12:00:00Z'))
  assert.deepEqual([failed.sent, db2.stamps.length], [0, 0])
  assert.equal(failed.errors.length, 1)

  // Stripe cannot be asked: the notice still goes, with the date only.
  sent.length = 0
  const unknown = await notices.sendTrialEndingNotices(noticeDb([row]), deps({ liveState: async () => { throw new Error('stripe down') } }), Date.parse('2026-11-25T12:00:00Z'))
  assert.equal(unknown.sent, 1)
  assert.equal(sent[0][1], 'Your free trial ends on Thursday, November 26.')
  assert.equal(notices.TRIAL_NOTICE_HOURS_BEFORE, 48)
})

test('the notice does not depend on the check-in feature flag, and a failed one is a visible row', () => {
  const route = read('src', 'app', 'api', 'cron', 'yuri-wakes-up', 'route.ts')
  assert.ok(route.indexOf('await sendTrialEndingNotices(') < route.indexOf("const mode = process.env.YURI_WAKES_UP_MODE === 'live'"), 'must run before the mode check returns early')
  assert.match(route, /run_type: 'trial_ending_notices',\s*status: trialNotices\.errors\.length > 0 \? 'failed' : 'completed'/)
  assert.match(read('supabase', 'migrations', '20261110000006_trial_ending_notice.sql'), /ADD COLUMN IF NOT EXISTS ending_notice_sent_at timestamptz/)
})

// ---------------------------------------------------------------------------
// One proactive channel: the older nudge cron yields (executed)
// ---------------------------------------------------------------------------
test('the rule-based nudge cron skips anyone the weekly check-in can reach, and only then', async () => {
  const saved = process.env.YURI_WAKES_UP_MODE
  try {
    const limits = await import(LIMITS)
    process.env.YURI_WAKES_UP_MODE = 'live'
    assert.equal(limits.weeklyCheckinCovers('America/Chicago'), true)
    assert.equal(limits.weeklyCheckinCovers(null), false, 'no timezone: the check-in cannot find their Sunday, so the older cron still serves them')
    assert.equal(limits.weeklyCheckinCovers('  '), false)
    process.env.YURI_WAKES_UP_MODE = 'off'
    assert.equal(limits.weeklyCheckinCovers('America/Chicago'), false, 'check-ins switched off: the older cron is the channel again')
  } finally {
    if (saved === undefined) delete process.env.YURI_WAKES_UP_MODE
    else process.env.YURI_WAKES_UP_MODE = saved
  }
  const cron = read('src', 'app', 'api', 'cron', 'proactive-nudge', 'route.ts')
  assert.match(cron, /if \(weeklyCheckinCovers\(p\.timezone\)\) \{\s*stats\.skippedWeeklyCheckinMember\+\+\s*continue\s*\}/)
  assert.ok(cron.indexOf('weeklyCheckinCovers(p.timezone)') < cron.indexOf("from('ss_user_nudges')", cron.indexOf('stats.subscribersScanned++')), 'before any nudge is considered')
})

// ---------------------------------------------------------------------------
// Members are told to expect it, in words that stay true
// ---------------------------------------------------------------------------
test('new members are told about the check-in as "most weeks", never as a guarantee', () => {
  const paywall = read('src', 'app', '(auth)', 'subscribe', 'page.tsx')
  const email = read('src', 'lib', 'email', 'subscription-confirmation.ts')
  const setup = read('src', 'lib', 'yuri', 'onboarding.ts')
  assert.match(paywall, /Then, most weeks, I check in and adjust it from how your skin is doing\./)
  assert.match(email, /After that, most weeks she checks in with a question or two about how your skin did, and adjusts the routine from what you tell her\./)
  assert.match(setup, /once they are a member, most weeks you check in with a question or two about how their skin did/)
  // Silence is allowed, the guard can block, and a member with no timezone is
  // skipped: "every week" would be a promise the system cannot keep.
  for (const [name, text] of [['paywall', paywall], ['welcome email', email]]) {
    assert.doesNotMatch(text, /check(s)? in (once a|every) week/, `${name} promises a weekly note`)
  }
  assert.match(src, /export const RHYTHM_EXPLAINED_FROM = '2026-11-11'/)
})

test('a device timezone goes only into an EMPTY field, and a geocoded one records its source', () => {
  const route = read('src', 'app', 'api', 'me', 'timezone', 'route.ts')
  assert.match(route, /\.update\(\{ timezone: parsed\.data\.timezone, timezone_source: 'browser' \}\)\s*\.eq\('user_id', user\.id\)\s*\.is\('timezone', null\)/)
  assert.equal((route.match(/\.update\(/g) || []).length, 1, 'exactly one write: a second one could overwrite an existing timezone')
  assert.match(route, /if \(!parsed\.success \|\| !isIanaTimezone\(parsed\.data\.timezone\)\)/)
  assert.match(read('src', 'components', 'layout', 'AppShell.tsx'), /void reportTimezoneOnce\(\)/)
  assert.match(read('src', 'lib', 'yuri', 'onboarding.ts'), /profileData\.timezone = geo\.timezone[\s\S]{0,200}profileData\.timezone_source = 'geocoded'/)
})

// ---------------------------------------------------------------------------
// Chat-Yuri sees the check-in she sent (executed)
// ---------------------------------------------------------------------------
test('member turn facts: stated as facts, with no date she could get wrong and nothing to sell', async () => {
  const { formatMemberTurnFacts, CHECKIN_ANSWER_WINDOW_DAYS } = await load(['src', 'lib', 'yuri', 'turn-facts.ts'])
  assert.equal(formatMemberTurnFacts({ checkin: null, trial: null }), '')
  assert.equal(CHECKIN_ANSWER_WINDOW_DAYS, 7)
  assert.equal(
    formatMemberTurnFacts({ checkin: { created_at: '2026-11-08T17:30:00Z', message: 'Did you start the oil cleanse?\n\nIf so, how does it feel?' }, trial: { trial_end: '2026-11-12T15:00:00Z' } }),
    '\n\n## Member facts this turn (facts, not instructions)\n- Your last weekly check-in to them, sent 2026-11-08 by email and on their dashboard: "Did you start the oil cleanse? If so, how does it feel?". They may be answering it, or writing about something else.\n- They are on the free trial. The date it ends and whether a card is on file are shown to them at the top of the app and sent to them by email; you cannot see either, so if they ask, point them there.'
  )
  const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
  assert.match(advisor, /usageFact \? `\\n\\n\$\{usageFact\}` : '', memberFacts, clockBlock\]\.join\(''\)/, 'per turn, after the conversation, before the clock')
  assert.match(advisor, /if \(!isScenario\) \{\s*try \{\s*memberFacts = await loadMemberTurnFacts\(/)
})

test('the advisor prompt: the check-in is "most weeks", mentioned once, and a named day is not promised to the day', () => {
  const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
  assert.match(advisor, /\*\*The weekly check-in\.\*\* Most weeks you send each member a short note on their Sunday \(day 3 and day 6 during a free trial\) asking how their skin did, and their answers are how the routine gets adjusted\. It is not guaranteed every week\./)
  assert.match(advisor, /from November 11 2026 on were told to expect it; you cannot see who was\. Mention it once when you first build someone's routine, not in ordinary answers\./)
  assert.doesNotMatch(advisor, /Every member hears from you once a week/)
  assert.doesNotMatch(advisor, /the proactive check-in fires on that day/)
  assert.match(advisor, /it is raised in your next weekly note, which may be up to six days after the day you named/)
  assert.doesNotMatch(advisor, /ask them to message you when it happens/, 'that puts the burden back on the member')
})
