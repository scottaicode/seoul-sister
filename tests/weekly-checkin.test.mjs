/**
 * Weekly "week ahead" check-ins (Nov 7 2026).
 *
 * Runtime tests of the real functions (transpiled, imports stubbed or replaced
 * with the real implementations they call), not source greps:
 *   1. Cadence: judged on the member's LOCAL Sunday in daytime, across timezones.
 *   2. Weekly rejudge counts local calendar days (6), not hours.
 *   3. Trial members get one extra judgment on trial day 3, any weekday.
 *   4. The 7-day forecast keeps local dates and never turns missing data into 0.
 *   5. The judge's trimmed memory keeps the decision's sections and drops the rest.
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
const tmp = mkdtempSync(join(tmpdir(), 'ss-weekly-'))
let n = 0

const transpile = (src) =>
  ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText

/** Write a module with no imports as-is; returns its file URL. */
function emitStandalone(relPath) {
  const file = join(tmp, `s${n++}.mjs`)
  writeFileSync(file, transpile(read(...relPath)))
  return pathToFileURL(file).href
}

// Real implementations the tested modules import (both files have no imports).
const CLOCK = emitStandalone(['src', 'lib', 'yuri', 'clock.ts'])
const LIMITS = emitStandalone(['src', 'lib', 'intelligence', 'nudge-limits.ts'])
const real = (url, name) => `(await import(${JSON.stringify(url)})).${name}`

/** Transpile a module, replacing each named import with `impls[name]` (or a throwing stub). */
async function load(relPath, impls = {}) {
  let js = transpile(read(...relPath))
  js = js.replace(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];?/g, (_m, names) =>
    names
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [orig, alias] = x.split(/\s+as\s+/)
        const local = (alias || orig).trim()
        return `const ${local} = ${impls[orig.trim()] ?? `(() => { throw new Error("stub: ${orig.trim()}") })`};`
      })
      .join('\n')
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
    capOrSpacingBlocks: real(LIMITS, 'capOrSpacingBlocks'),
    DAYTIME_START_HOUR: real(LIMITS, 'DAYTIME_START_HOUR'),
    DAYTIME_END_HOUR: real(LIMITS, 'DAYTIME_END_HOUR'),
    PRICING: `({ trial_days: 7, monthly_display_long: '$9.99/month' })`,
  })

const sub = (timezone) => ({
  user_id: 'u',
  timezone,
  latitude: null,
  longitude: null,
  is_demo: false,
  nudge_email_opt_out: false,
  nudge_unsubscribe_token: null,
})
const opts = (now, over = {}) => ({ internal: false, nudgeCreatedAts: [], lastJudgedAt: null, now, ...over })
const at = (iso) => Date.parse(iso)

// 2026-11-08 is a Sunday.
test('cadence: judged only on the LOCAL Sunday, inside local daytime, in every timezone', async () => {
  const { checkinGate } = await loadCheckin()
  // 15:00Z Sun = 9am Sunday in Chicago (CST), but 00:00 Monday in Tokyo.
  assert.equal(checkinGate(sub('America/Chicago'), opts(at('2026-11-08T15:00:00Z'))), null)
  assert.equal(checkinGate(sub('Asia/Tokyo'), opts(at('2026-11-08T15:00:00Z'))), 'night')
  // 01:00Z Sun = 10am Sunday in Tokyo, 7pm SATURDAY in Chicago.
  assert.equal(checkinGate(sub('Asia/Tokyo'), opts(at('2026-11-08T01:00:00Z'))), null)
  assert.equal(checkinGate(sub('America/Chicago'), opts(at('2026-11-08T01:00:00Z'))), 'not_checkin_day')
  // 03:00Z Mon = 7pm Sunday in Los Angeles (still in), 9pm Sunday in Chicago (night).
  assert.equal(checkinGate(sub('America/Los_Angeles'), opts(at('2026-11-09T03:00:00Z'))), null)
  assert.equal(checkinGate(sub('America/Chicago'), opts(at('2026-11-09T03:00:00Z'))), 'night')
  // A weekday in daytime is not a check-in day; the dry-run bypass renders it anyway.
  const fri = at('2026-11-06T17:00:00Z')
  assert.equal(checkinGate(sub('America/Chicago'), opts(fri)), 'not_checkin_day')
  assert.equal(checkinGate(sub('America/Chicago'), opts(fri, { bypassCheckinDay: true })), null)
  // Demo / internal / cap still win on a Sunday.
  const sun = at('2026-11-08T17:00:00Z')
  assert.equal(checkinGate({ ...sub('America/Chicago'), is_demo: true }, opts(sun)), 'demo')
  assert.equal(checkinGate(sub('America/Chicago'), opts(sun, { internal: true })), 'internal')
  assert.equal(checkinGate(sub('America/Chicago'), opts(sun, { nudgeCreatedAts: [new Date(sun - 86400000).toISOString()] })), 'cap_or_spacing')
})

test('weekly rejudge: 6 local calendar days, so the same hour next Sunday is never "too soon"', async () => {
  const { checkinGate, REJUDGE_AFTER_LOCAL_DAYS } = await loadCheckin()
  assert.equal(REJUDGE_AFTER_LOCAL_DAYS, 6)
  const s = sub('America/Chicago')
  const sun9 = at('2026-11-08T15:00:00Z') // Sunday 9am CST
  // Judged last Sunday at 7pm (later in the day than now): 7 local days, passes.
  assert.equal(checkinGate(s, opts(sun9, { lastJudgedAt: '2026-11-02T01:00:00Z' })), null)
  // Judged earlier today: blocked for the rest of the day (hourly cron).
  assert.equal(checkinGate(s, opts(at('2026-11-08T20:00:00Z'), { lastJudgedAt: '2026-11-08T15:30:00Z' })), 'judged_recently')
  // A judgment earlier in the week (a trial day-3 or day-6 note) does NOT take
  // the Sunday away (Nov 10 2026). The six-day rule used to apply here, which
  // put the first Sunday after a trial 8 to 12 days after the day-6 note. On a
  // Sunday only "already judged this weekend" is ruled out.
  assert.equal(checkinGate(s, opts(sun9, { lastJudgedAt: '2026-11-02T18:00:00Z' })), null)
  assert.equal(checkinGate(s, opts(sun9, { lastJudgedAt: '2026-11-03T18:00:00Z' })), null, 'Tuesday note, then Sunday: allowed')
  assert.equal(checkinGate(s, opts(sun9, { lastJudgedAt: '2026-11-07T18:00:00Z' })), 'judged_recently', 'Saturday, then Sunday: too close')
  // Off Sunday (a dry run with the bypass) the six-day rule still applies.
  const wed = at('2026-11-11T17:00:00Z')
  assert.equal(checkinGate(s, opts(wed, { bypassCheckinDay: true, lastJudgedAt: '2026-11-08T17:00:00Z' })), 'judged_recently')
})

test('trial day 3: one extra judgment on any weekday, counted in the member\'s local calendar', async () => {
  const { checkinGate, trialDayNumber } = await loadCheckin()
  const s = sub('America/Chicago')
  // Started 03:00Z Nov 5 = 9pm Nov 4 in Chicago: local day 1 is Nov 4, day 3 is Friday Nov 6.
  const trial = { startedAt: '2026-11-05T03:00:00Z', endsAt: '2026-11-12T03:00:00Z' }
  const fri = at('2026-11-06T17:00:00Z')
  assert.equal(trialDayNumber(trial, 'America/Chicago', fri), 3)
  assert.equal(trialDayNumber(trial, 'UTC', fri), 2, 'the same instant is day 2 on a UTC calendar')
  assert.equal(checkinGate(s, opts(fri, { trial })), null)
  assert.equal(checkinGate(s, opts(fri, { trial, lastJudgedAt: '2026-11-06T15:00:00Z' })), 'judged_recently', 'once that day')
  // Judged on the Sunday before the trial reached day 3 does not take day 3 away.
  assert.equal(checkinGate(s, opts(fri, { trial, lastJudgedAt: '2026-11-05T16:00:00Z' })), null)
  // Day 2 (Thursday) is an ordinary weekday; no trial = ordinary weekday.
  assert.equal(checkinGate(s, opts(at('2026-11-05T17:00:00Z'), { trial })), 'not_checkin_day')
  assert.equal(checkinGate(s, opts(fri)), 'not_checkin_day')
  // Night still applies on trial day 3.
  assert.equal(checkinGate(s, opts(at('2026-11-06T05:00:00Z'), { trial: { ...trial, startedAt: '2026-11-04T05:00:00Z' } })), 'night')
})

test('trial info: only a trialing row; Stripe period start is the trial start, created_at the fallback', async () => {
  const { trialInfoFromSubscription } = await load(['src', 'lib', 'proactive', 'checkin-context.ts'])
  assert.equal(trialInfoFromSubscription({ status: 'active', current_period_start: '2026-11-01T00:00:00Z' }), null)
  assert.equal(trialInfoFromSubscription(undefined), null)
  assert.deepEqual(
    trialInfoFromSubscription({ status: 'trialing', current_period_start: '2026-11-04T10:00:00Z', created_at: '2026-11-04T09:59:00Z', trial_end: '2026-11-11T10:00:00Z' }),
    { startedAt: '2026-11-04T10:00:00Z', endsAt: '2026-11-11T10:00:00Z' }
  )
  assert.deepEqual(trialInfoFromSubscription({ status: 'trialing', current_period_start: null, created_at: '2026-11-04T09:59:00Z' }), {
    startedAt: '2026-11-04T09:59:00Z',
    endsAt: null,
  })
})

test('forecast: local dates and weekdays, missing values stay null, today/tomorrow from the member\'s date', async () => {
  const { shapeDailyForecast, formatForecastFacts } = await load(['src', 'lib', 'intelligence', 'weather-forecast.ts'], {
    WMO_CODES: '({ 3: { description: "Overcast" }, 65: { description: "Heavy rain" } })',
  })
  const f = shapeDailyForecast(
    {
      timezone: 'America/Chicago',
      daily: {
        time: ['2026-11-08', '2026-11-09', '2026-11-10', 'garbage'],
        weather_code: [3, 65, 99],
        temperature_2m_max: [21.3, 18.4, null],
        temperature_2m_min: [14.1, 14.7, 15.4],
        relative_humidity_2m_max: [87, 95, 98],
        relative_humidity_2m_min: [40, 60, null],
        relative_humidity_2m_mean: [73, 89, 91],
        uv_index_max: [4.33, 0, null],
        precipitation_sum: [0, 23.1, null],
        precipitation_probability_max: [34, 70, 12],
      },
    },
    'America/Chicago'
  )
  assert.equal(f.days.length, 3, 'a malformed date row is dropped')
  assert.deepEqual(f.days.map((d) => d.weekday), ['Sunday', 'Monday', 'Tuesday'])
  assert.equal(f.days[0].uvMax, 4.3)
  assert.equal(f.days[1].uvMax, 0, 'a real zero stays zero')
  assert.equal(f.days[2].uvMax, null, 'missing UV is null, never 0')
  assert.equal(f.days[2].precipMm, null)
  assert.equal(f.days[2].maxC, null)
  assert.equal(f.days[2].condition, null, 'unknown weather code is not invented')
  const text = formatForecastFacts(f, '2026-11-08', 'Austin, Texas')
  assert.match(text, /- Sunday 2026-11-08 \(today\): Overcast, high 21°C \/ low 14°C, humidity 40-87% \(mean 73%\), peak UV 4\.3/)
  assert.match(text, /- Monday 2026-11-09 \(tomorrow\): Heavy rain/)
  assert.match(text, /- Tuesday 2026-11-10: high \?°C \/ low 15°C/)
  assert.doesNotMatch(text, /Tuesday[^\n]*peak UV/, 'no UV line when UV is missing')
  assert.doesNotMatch(text, /—/, 'no em dashes')
  assert.match(formatForecastFacts({ timezone: 'UTC', days: [] }, '2026-11-08'), /Do not guess it/)
  // US members: Fahrenheit beside Celsius, so Yuri and the guard read the same numbers.
  const fText = formatForecastFacts(f, '2026-11-08', null, 'F')
  assert.match(fText, /high 21°C \(70°F\) \/ low 14°C \(57°F\)/)
  assert.doesNotMatch(text, /°F/, 'Celsius-only by default')
})

test('trimmed judge memory: keeps profile, routine, photos, latest summary, dated plan; drops chat-only bulk', async () => {
  const { buildCheckinMemory, keepCheckinSections, renderRecentConversations } = await load(['src', 'lib', 'proactive', 'checkin-context.ts'], {
    isOpenLoop: '((l) => !l.resolved_at)',
  })
  const ctx = {
    skinProfile: { skin_type: 'combination' },
    recentConversations: [
      { conversationId: 'a', title: 'Older', timestamp: '2026-10-01T00:00:00Z', aiSummary: 'OLD SUMMARY', conversationType: 'general' },
      { conversationId: 'c', title: 'Middle', timestamp: '2026-10-25T00:00:00Z', aiSummary: 'MIDDLE SUMMARY', conversationType: 'general' },
      { conversationId: 'b', title: 'Newest', timestamp: '2026-11-02T00:00:00Z', aiSummary: 'NEW SUMMARY', conversationType: 'general' },
    ],
    recentExcerpts: [{ conversationId: 'b', title: 'x', messages: [] }],
    userProducts: [{ custom_name: 'x' }],
    learningInsights: [{ type: 'trend', summary: 'x' }],
    specialistInsights: [{ specialistType: 'x', data: {}, createdAt: 'x' }],
    ingredientOverlap: { entries: [1] },
    decisionMemory: {
      decisions: [{ topic: 'retinal', decision: 'twice a week', date: '2026-10-20' }],
      preferences: [{ topic: 'texture', preference: 'light', date: '2026-10-01' }],
      commitments: [{ item: 'buy SPF', date: '2026-10-21' }],
      corrections: [
        { topic: 'new', truth: 'she stopped the BHA', date: '2026-10-15', category: 'factual', yuri_said: '' },
        { topic: 'old', truth: 'ancient fact', date: '2026-01-01', category: 'factual', yuri_said: '' },
      ],
      open_loops: [
        { topic: 'retinal check', summary: 'how is the stinging', opened_date: '2026-10-20', check_back_date: '2026-11-09' },
        { topic: 'closed one', summary: 'done', opened_date: '2026-10-01', resolved_at: '2026-10-05' },
      ],
      extracted_at: '2026-11-02',
    },
  }
  let seen
  const format = (c) => {
    seen = c
    return [
      "## User's Skin Profile\nskin",
      '## Medical History (not on file)\nnone',
      '## Current Routine Products\nroutine',
      '## Active Ingredient Stacking in Their Routine\nstack',
      '## Your Product Inventory\ninv',
      '## Glass Skin Score History\nphotos 2026-10-05',
      '## Suggested Opener (If This Is a Fresh Conversation)\nopener',
      '## Cycle Tracking Available (Not Enabled)\nupsell',
      '## Learning Engine Insights (From Community Data)\nlearn',
      '## Some Section Added Later\nnew',
    ].join('\n\n')
  }
  const out = buildCheckinMemory(ctx, format) // never contacted: newest summary only
  // The formatter is handed nothing large to render and throw away.
  assert.deepEqual([seen.recentConversations, seen.recentExcerpts, seen.userProducts, seen.learningInsights, seen.specialistInsights], [[], [], [], [], []])
  assert.equal(seen.ingredientOverlap, null)
  assert.equal(seen.decisionMemory, null)
  assert.equal(seen.skinProfile, ctx.skinProfile)
  for (const kept of ["## User's Skin Profile", '## Medical History', '## Current Routine Products', '## Glass Skin Score History', 'NEW SUMMARY', '2026-11-02', 'retinal: twice a week (decided 2026-10-20)', 'you said you\'d check back 2026-11-09', 'she stopped the BHA', 'ancient fact', 'texture: light']) {
    assert.ok(out.includes(kept), `keeps: ${kept}`)
  }
  for (const dropped of ['Ingredient Stacking', 'Product Inventory', 'Suggested Opener', 'Cycle Tracking Available', 'Learning Engine', 'Some Section Added Later', 'OLD SUMMARY', 'MIDDLE SUMMARY', 'closed one', 'buy SPF']) {
    assert.ok(!out.includes(dropped), `drops: ${dropped}`)
  }
  assert.match(out, /2 earlier conversation summary\(ies\) exist and are not included here/)
  // Labelled as Yuri's own account, so her advice is not read back as their agreement.
  assert.match(out, /your summary of what you said; their agreement only counts from their own messages/)
  assert.doesNotMatch(out, /made together/)
  // Since the last proactive contact (Oct 20): every summary after it, newest first.
  const since = renderRecentConversations(ctx.recentConversations, '2026-10-20T00:00:00Z')
  assert.ok(since.includes('NEW SUMMARY') && since.includes('MIDDLE SUMMARY') && !since.includes('OLD SUMMARY'))
  assert.ok(since.indexOf('NEW SUMMARY') < since.indexOf('MIDDLE SUMMARY'))
  // Contact after the newest conversation: the newest is still shown.
  const after = renderRecentConversations(ctx.recentConversations, '2026-11-05T00:00:00Z')
  assert.ok(after.includes('NEW SUMMARY') && !after.includes('MIDDLE SUMMARY'))
  // Closed world: the allowlist filter on its own drops anything unlisted.
  assert.equal(keepCheckinSections('## Brand New\nx\n\n## Current Routine Products\ny'), '## Current Routine Products\ny')
  // No memory at all renders nothing rather than empty headings.
  assert.equal(buildCheckinMemory({ ...ctx, recentConversations: [], decisionMemory: null }, () => ''), '')
})

test('login continuity: a signed-out click on the check-in button returns to /yuri with the ask after sign-in', async () => {
  const { safeReturnTo, loginUrlFor, afterSignIn } = await load(['src', 'lib', 'auth', 'return-to.ts'])
  const link = '/yuri?ask=How%20is%20the%20retinal%20going%3F&from=nudge_email'
  const login = loginUrlFor('/yuri', '?ask=How%20is%20the%20retinal%20going%3F&from=nudge_email')
  assert.equal(login, `/login?next=${encodeURIComponent(link)}`)
  // What the login page reads back out of its own URL.
  const next = new URL(`https://x.test${login}`).searchParams.get('next')
  assert.equal(next, link)
  assert.equal(afterSignIn('/dashboard', next), link)
  // Onboarding and the paywall still win over the return path.
  assert.equal(afterSignIn('/onboarding', next), '/onboarding')
  assert.equal(afterSignIn('/subscribe', next), '/subscribe')
  assert.equal(afterSignIn('/dashboard', null), '/dashboard')
  // Never an open redirect, never a loop into the auth pages.
  for (const bad of ['//evil.com/x', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '/login?next=/yuri', '/auth/callback', '/x\nSet-Cookie:a']) {
    assert.equal(safeReturnTo(bad), null, bad)
    assert.equal(afterSignIn('/dashboard', bad), '/dashboard', bad)
  }
  assert.equal(loginUrlFor('/login', ''), '/login')
  // Wiring: the shell sends signed-out members to loginUrlFor, and both sign-in paths use afterSignIn.
  assert.match(read('src', 'components', 'layout', 'AppShell.tsx'), /router\.replace\(loginUrlFor\(pathname,/)
  assert.match(read('src', 'app', '(auth)', 'login', 'page.tsx'), /router\.push\(afterSignIn\('\/dashboard', readNext\(\)\)\)/)
  assert.match(read('src', 'app', 'auth', 'callback', 'page.tsx'), /router\.replace\(afterSignIn\(postSignInDestination\(profile\), next\)\)/)
})

test('no timezone: profile tz wins, else the coordinates\' tz, else the gate skips with no_timezone', async () => {
  const { checkinGate, resolveCheckinTimezone } = await loadCheckin()
  const calls = []
  const lookup = async (lat, lng) => (calls.push([lat, lng]), 'Asia/Tokyo')
  assert.equal(await resolveCheckinTimezone({ timezone: 'America/Chicago', latitude: 1, longitude: 2 }, lookup), 'America/Chicago')
  assert.equal(calls.length, 0, 'no lookup when the profile has one')
  assert.equal(await resolveCheckinTimezone({ timezone: null, latitude: 35.7, longitude: 139.7 }, lookup), 'Asia/Tokyo')
  assert.deepEqual(calls, [[35.7, 139.7]])
  assert.equal(await resolveCheckinTimezone({ timezone: '  ', latitude: null, longitude: null }, lookup), null)
  // 01:00Z Sunday: Sunday 10am in the resolved Tokyo zone; with no zone at all, skip visibly (not "noon").
  const sun = at('2026-11-08T01:00:00Z')
  assert.equal(checkinGate(sub('Asia/Tokyo'), opts(sun)), null)
  assert.equal(checkinGate(sub(null), opts(sun)), 'no_timezone')
  assert.equal(checkinGate(sub(null), opts(sun, { bypassDaytime: true, bypassCheckinDay: true })), 'no_timezone')
  // run.ts resolves before the gate and counts a failed lookup as an error.
  const run = read('src', 'lib', 'proactive', 'run.ts')
  assert.match(run, /tz = await resolveCheckinTimezone\(row, fetchTimezoneForCoords\)/)
  assert.match(run, /errors\.push\(`timezone lookup/)
})

test('only decided judgments consume the week (a failed row is retried)', () => {
  const run = read('src', 'lib', 'proactive', 'run.ts')
  const q = run.slice(run.indexOf(".from('ss_proactive_judgments')\n        .select('user_id, created_at')"), run.indexOf('8 * 24 * 3600 * 1000'))
  assert.match(q, /\.in\('decision', \['speak', 'silent', 'blocked'\]\)/)
})

test('cost logging cannot be switched off by an env var; only the review script\'s module flag', async () => {
  const src = read('src', 'lib', 'ai-usage-logger.ts')
  assert.doesNotMatch(src, /AI_USAGE_DRY_RUN/)
  assert.match(src, /if \(aiUsageDryRun\) \{/)
  assert.match(read('scripts', 'dry-run-yuri-wakes-up.ts'), /setAiUsageDryRun\(true\)/)
})

test('guard product matching: common words do not name a product; distinctive names still do', async () => {
  const { knownProductsInMessage } = await load(['src', 'lib', 'proactive', 'content-guard.ts'])
  const shelf = [
    'Hero Cosmetics Hero Mighty Patches',
    'Medicube Zero Pore SA Clear Capsule Cleansing Foam',
    'Illiyoon Ceramide Ato Concentrate Cream',
    'Aestura AtoBarrier365 Cream',
  ]
  assert.deepEqual(knownProductsInMessage('That cold front might be showing up Friday', shelf), [])
  assert.deepEqual(knownProductsInMessage('Friday looks clear and dry with a low near 8°C.', shelf), [])
  assert.deepEqual(knownProductsInMessage('keep the Illiyoon for the cold', shelf), ['Illiyoon Ceramide Ato Concentrate Cream'])
  assert.deepEqual(knownProductsInMessage('the AtoBarrier365 is fine', shelf), ['Aestura AtoBarrier365 Cream'])
  assert.deepEqual(knownProductsInMessage('the AtoBarrier is fine', shelf), ['Aestura AtoBarrier365 Cream'], 'prefix of >= 6 chars')
  assert.deepEqual(knownProductsInMessage('your Medicube cleanser', shelf), ['Medicube Zero Pore SA Clear Capsule Cleansing Foam'])
  assert.deepEqual(knownProductsInMessage('the mighty patches on your chin', shelf), ['Hero Cosmetics Hero Mighty Patches'], 'two distinctive words')
  assert.deepEqual(knownProductsInMessage('Differin at night', ['Differin']), ['Differin'], 'single-word product')
  assert.deepEqual(knownProductsInMessage('it might help', ['Mighty']), [], 'a 5-char prefix is not a match')
})

test('allowlist is bound to the real chat formatter; forecast params are pinned', async () => {
  const { CHECKIN_MEMORY_SECTIONS } = await load(['src', 'lib', 'proactive', 'checkin-context.ts'], { isOpenLoop: '((l) => !l.resolved_at)' })
  const memory = read('src', 'lib', 'yuri', 'memory.ts')
  assert.equal(CHECKIN_MEMORY_SECTIONS.length, 8)
  for (const h of CHECKIN_MEMORY_SECTIONS) assert.ok(memory.includes(h), `formatContextForPrompt still renders "${h}"`)
  const wf = read('src', 'lib', 'intelligence', 'weather-forecast.ts')
  assert.match(
    wf,
    /'daily=weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,relative_humidity_2m_min,relative_humidity_2m_mean,uv_index_max,precipitation_sum,precipitation_probability_max'/
  )
})
