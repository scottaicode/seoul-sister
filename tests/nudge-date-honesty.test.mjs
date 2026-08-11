/**
 * Guard tests — Yuri must never assert a weekday she wasn't given, and the One
 * Metric must count PEOPLE, not table rows.
 *
 * THE DEFECTS THESE PREVENT FROM RETURNING (both caught by Bailey, Aug 11 2026)
 *
 * 1. A dashboard nudge opened with "Sunday's here, so I'm keeping my word and
 *    checking in like I said I would." It shipped on a TUESDAY.
 *
 *    The first diagnosis — that Yuri had fabricated the promise — was WRONG, and
 *    it matters that this test file records why. She promised a Sunday check-in
 *    five separate times, unprompted, across Aug 6-8 ("I'll check in Sunday to
 *    see which way it went"). Her memory worked perfectly. THREE date bugs
 *    stacked underneath it:
 *
 *      a. The decision-memory extractor resolved her promised "Sunday" against
 *         `new Date().toISOString()` — raw server UTC, no weekday name, no user
 *         timezone. Bailey messaged 9:26 PM CT Aug 8 = 02:26 UTC Aug 9, so the
 *         server's "today" was already Sunday while hers was Saturday, and
 *         "Sunday" resolved forward to MONDAY Aug 10. Verified in production:
 *         check_back_date = "2026-08-10". She said Sunday. Sunday was Aug 9.
 *      b. The nudge cron passed NO date, weekday, or timezone to the message
 *         writer. Given a real memory of a Sunday promise and no clock, Yuri
 *         stated the promised day as though it were today.
 *      c. The eligibility engine used one shared server-UTC `todayIso` for every
 *         user regardless of their timezone.
 *
 *    The fix is a CLOCK, not a muzzle. An early draft proposed banning temporal
 *    language in nudges outright; that would have destroyed the best thing the
 *    feature does (Yuri remembering she gave her word on a specific day). A
 *    missing fact looks exactly like bad judgment. Fix the fact.
 *
 * 2. The admin One Metric read "Paid (from widget): 2" when it was ONE human —
 *    the first paying subscriber, who used the widget from two devices and so
 *    owns two ss_widget_visitors rows. attributeConversion() correctly stamps
 *    both; the dashboard counted rows. The number this project's entire build
 *    freeze is keyed to was reading 2x high.
 *
 * These tests EXECUTE real code (transpiling the modules where needed) rather
 * than grepping for strings. A source-regex test passes against the broken code:
 * the word "timezone" appears throughout memory.ts while the prompt still
 * interpolates raw UTC.
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
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

async function loadTs(relPath, name) {
  const src = read(...relPath)
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), `ss-${name}-`))
  const file = join(dir, `${name}.mjs`)
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

// ---------------------------------------------------------------------------
// 1. The clock itself — the arithmetic that was silently wrong.
// ---------------------------------------------------------------------------

test('local clock resolves the USERs calendar date, not the servers UTC one', async () => {
  const { getLocalClock } = await loadTs(['src', 'lib', 'yuri', 'clock.ts'], 'clock')

  // Bailey's exact message moment: 9:26 PM CT on Saturday Aug 8 2026,
  // which is 02:26 UTC on Sunday Aug 9. This is the instant that broke it.
  const moment = new Date('2026-08-09T02:26:00Z')

  const utc = getLocalClock('UTC', moment)
  assert.equal(utc.isoDate, '2026-08-09', 'sanity: the server really was on Aug 9')
  assert.equal(utc.weekday, 'Sunday')

  const austin = getLocalClock('America/Chicago', moment)
  assert.equal(austin.isoDate, '2026-08-08', 'for Bailey it was still Aug 8')
  assert.equal(
    austin.weekday,
    'Saturday',
    'REGRESSION: her local weekday must be Saturday. If this reads Sunday, the ' +
      'extractor is back on server time and every promised weekday drifts a day.'
  )
})

test('a named weekday resolves to the NEXT occurrence on or after today', async () => {
  const { nextWeekdayOnOrAfter } = await loadTs(['src', 'lib', 'yuri', 'clock.ts'], 'clock2')

  // The real case: she said "Sunday" on Saturday Aug 8. That means TOMORROW,
  // Aug 9 — not Monday Aug 10 (what production wrote), and not Aug 16.
  assert.equal(nextWeekdayOnOrAfter('Sunday', '2026-08-08'), '2026-08-09')

  // Said ON the named day = later today, not a week out.
  assert.equal(nextWeekdayOnOrAfter('Sunday', '2026-08-09'), '2026-08-09')

  // Wrapping across the week boundary.
  assert.equal(nextWeekdayOnOrAfter('Tuesday', '2026-08-09'), '2026-08-11')
  assert.equal(nextWeekdayOnOrAfter('Saturday', '2026-08-09'), '2026-08-15')

  // Case-insensitive, and junk is null rather than a wrong guess.
  assert.equal(nextWeekdayOnOrAfter('friday', '2026-08-09'), '2026-08-14')
  assert.equal(nextWeekdayOnOrAfter('someday', '2026-08-09'), null)
})

test('an unknown or malformed timezone falls back to UTC honestly, never throws', async () => {
  const { getLocalClock } = await loadTs(['src', 'lib', 'yuri', 'clock.ts'], 'clock3')
  const moment = new Date('2026-08-11T15:01:00Z')

  for (const tz of [null, undefined, '', '   ', 'Not/AZone']) {
    const c = getLocalClock(tz, moment)
    assert.equal(c.timezone, 'UTC', `"${tz}" must report UTC, not a guessed zone`)
    assert.equal(c.isoDate, '2026-08-11')
    assert.equal(c.weekday, 'Tuesday')
  }
})

// ---------------------------------------------------------------------------
// 2. The extraction prompt must carry a real local clock.
// ---------------------------------------------------------------------------

test('extraction prompt anchors dates to the users calendar, not raw server UTC', async () => {
  const src = read('src', 'lib', 'yuri', 'memory.ts')

  // The prompt-building region: from the extractor entrypoint to the end of the
  // JSON template it asks Sonnet to fill in.
  const start = src.indexOf('export async function extractAndSaveDecisionMemory')
  assert.ok(start > -1, 'extractAndSaveDecisionMemory must exist')
  const end = src.indexOf('"open_loops": [{', start)
  assert.ok(end > start, 'the JSON output template must exist in the prompt')
  const promptRegion = src.slice(start, end)

  assert.ok(
    !promptRegion.includes("${new Date().toISOString().split('T')[0]}"),
    'REGRESSION: the extraction prompt interpolates raw server UTC again. This is ' +
      'the exact bug that turned Baileys promised Sunday (Aug 9) into Monday Aug 10 ' +
      '— a late-evening US message lands on the servers tomorrow. Use the local clock.'
  )

  assert.ok(
    /getLocalClock\(/.test(promptRegion),
    'the extractor must resolve the users local clock via the shared getLocalClock'
  )

  // The weekday NAME has to reach the model. Without it, "Sunday" is unresolvable
  // arithmetic — the model can see an ISO date and still not know what day it is.
  assert.ok(
    /clock\.weekday/.test(promptRegion),
    'REGRESSION: the prompt no longer tells the model what weekday today is. An ' +
      'ISO date alone does not let it resolve "I will check in Sunday".'
  )

  assert.ok(
    /timezone/.test(promptRegion),
    'the prompt should state which timezone the date is expressed in'
  )
})

test('extractAndSaveDecisionMemory accepts a timezone and the advisor passes one', async () => {
  const memorySrc = read('src', 'lib', 'yuri', 'memory.ts')
  const sig = memorySrc.slice(
    memorySrc.indexOf('export async function extractAndSaveDecisionMemory'),
    memorySrc.indexOf('): Promise<void> {', memorySrc.indexOf('export async function extractAndSaveDecisionMemory'))
  )
  assert.ok(
    /timezone\??:\s*string/.test(sig),
    'extractAndSaveDecisionMemory must accept the users timezone'
  )

  // A parameter nothing passes is the check-back-date bug all over again: the
  // feature exists, reads correct, and never runs.
  const advisorSrc = read('src', 'lib', 'yuri', 'advisor.ts')
  const call = advisorSrc.slice(
    advisorSrc.indexOf('extractAndSaveDecisionMemory(userId'),
    advisorSrc.indexOf('extractAndSaveDecisionMemory(userId') + 220
  )
  assert.ok(
    /transcriptForDecisions,\s*userTz/.test(call.replace(/\s+/g, ' ')),
    'REGRESSION: the advisor stopped passing the users timezone into extraction, ' +
      'so every promised weekday silently resolves against server UTC again.'
  )
})

// ---------------------------------------------------------------------------
// 3. The nudge prompt must carry the clock — and must stay a FACT, not a command.
// ---------------------------------------------------------------------------

test('nudge prompt receives the real date, weekday and promised-date lateness', async () => {
  const src = read('src', 'app', 'api', 'cron', 'proactive-nudge', 'route.ts')

  assert.ok(
    /clockFactBlock\(clock\)/.test(src),
    'REGRESSION: the nudge message-writer lost its clock. With no date in the ' +
      'prompt, Yuri restates a promised day as though it were today — which is ' +
      'exactly how "Sundays here" shipped on a Tuesday.'
  )

  assert.ok(
    /daysLate/.test(src),
    'the writer must be told how late the check-in is running, so she can be ' +
      'straightforward about it instead of pretending the promised day is now'
  )

  // Per-user clock, not one shared server date for the whole run.
  assert.ok(
    /const clock = getLocalClock\(p\.timezone\)/.test(src),
    'each user needs their OWN local date; a shared server-UTC today makes a ' +
      'promised check-back land a day early or late for anyone west of Greenwich'
  )
  assert.ok(
    !/const todayIso = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(src),
    'REGRESSION: a single shared server-UTC todayIso is back in the nudge cron'
  )
})

test('the clock block states facts and never dictates what Yuri may say', async () => {
  const { getLocalClock, clockFactBlock } = await loadTs(['src', 'lib', 'yuri', 'clock.ts'], 'clock4')
  const block = clockFactBlock(getLocalClock('America/Chicago', new Date('2026-08-11T15:01:00Z')))

  // It must actually carry the facts.
  assert.ok(/Tuesday/.test(block), 'must name the weekday')
  assert.ok(/2026-08-11/.test(block), 'must carry the ISO date')

  // And it must NOT become a muzzle. The widget give/gate failed twice by
  // rewording a rule; v11.10.0 fixed it with a fact. Same discipline here: this
  // block informs Yuri's judgment about timing, it does not legislate her voice.
  // Yuri may name the day, own being late, or say nothing about timing at all.
  const forbidden = [
    /never mention (?:the |a )?(?:day|date|weekday)/i,
    /do not (?:mention|reference|name) (?:the |a )?(?:day|date|weekday)/i,
    /avoid (?:temporal|time) (?:language|references)/i,
    /you must apologi[sz]e/i,
  ]
  for (const pattern of forbidden) {
    assert.ok(
      !pattern.test(block),
      `REGRESSION: the clock block became a COMMAND (matched ${pattern}). It is an ` +
        'instrument, not a cage — it supplies the date and hands the decision back. ' +
        'Banning temporal language would destroy the best thing the nudge does: ' +
        'Yuri remembering she gave her word on a specific day.'
    )
  }
})

test('the promised check-back date is carried to the message writer', async () => {
  const { pickNudgeOpportunity } = await loadTs(
    ['src', 'lib', 'intelligence', 'nudge-eligibility.ts'],
    'elig'
  )

  // Bailey's real loop, verbatim from production.
  const opp = pickNudgeOpportunity({
    activePhase: null,
    activeRoutinePhaseNumbers: [],
    openLoops: [
      {
        topic: 'barrier_recovery_check',
        summary:
          "Yuri will check back on chin and nose dryness Sunday - if smooth by then, that's the green light to bring TXA in solo",
        opened_date: '2026-08-08',
        check_back_date: '2026-08-09',
      },
    ],
    daysSinceLastGlassScore: null,
    cycle: null,
    todayIso: '2026-08-11',
  })

  assert.ok(opp, 'a promised loop whose date has arrived must produce an opportunity')
  assert.equal(
    opp.promisedCheckBackDate,
    '2026-08-09',
    'REGRESSION: the promised date is no longer carried out of the eligibility ' +
      'engine, so the message writer cannot know it is running late.'
  )

  // The context must not assert the promised date is TODAY — it was two days ago.
  assert.ok(
    !/that date has arrived/.test(opp.context),
    'REGRESSION: the context tells the writer the promised date "has arrived", ' +
      'which reads as "today" and reproduces the Tuesday/Sunday defect. The ' +
      'relationship between the promise and today belongs in the date facts.'
  )
})

// ---------------------------------------------------------------------------
// 4. The One Metric counts humans, not rows.
// ---------------------------------------------------------------------------

test('One Metric counts distinct PEOPLE across devices, not visitor rows', async () => {
  const src = read('src', 'app', 'api', 'admin', 'widget', 'analytics', 'route.ts')

  // Lift the real identity/dedup block and execute it against the exact
  // production rows that produced the wrong number.
  const start = src.indexOf('const identityOf =')
  assert.ok(start > -1, 'the distinct-identity helper must exist')
  const end = src.indexOf('const pct =', start)
  assert.ok(end > start, 'the dedup block must precede the pct helper')

  const body = src.slice(start, end)
  const module_ = `
export function measure(visitorRows, capturedEmailRows, convertedRows) {
  const capturedEmailResult = { data: capturedEmailRows }
  const convertedResult = { data: convertedRows }
${body}
  return { distinctPeople, capturedEmails, convertedVisitors }
}
`
  const js = ts.transpileModule(module_, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-onemetric-'))
  const file = join(dir, 'm.mjs')
  writeFileSync(file, js)
  const { measure } = await import(pathToFileURL(file).href)

  // The real rows: ONE person (first paying subscriber), two devices, two rows.
  const converted = [
    {
      visitor_id: '1b6e969b-e98d-477e-ae14-d5690bb2c255',
      captured_email: 'lrwells2013@gmail.com',
      converted_user_id: 'fe464145-bd26-4972-aa0f-56396e84f6f5',
    },
    {
      visitor_id: '4848fbee-a2cc-407c-93dd-74d1a911485a',
      captured_email: 'lrwells2013@gmail.com',
      converted_user_id: 'fe464145-bd26-4972-aa0f-56396e84f6f5',
    },
  ]
  const visitors = [
    ...converted.map((r) => ({ visitor_id: r.visitor_id, captured_email: r.captured_email })),
    { visitor_id: 'anon-1', captured_email: null },
    { visitor_id: 'anon-2', captured_email: null },
  ]

  const out = measure(visitors, converted.map((r) => ({ ...r })), converted)

  assert.equal(
    out.convertedVisitors,
    1,
    'REGRESSION: the One Metric is counting ROWS again. Two visitor rows for one ' +
      'human across two devices reported "2 paid" when exactly one subscription ' +
      'exists. This is the number the entire build freeze is keyed to.'
  )
  assert.equal(out.capturedEmails, 1, 'the same email on two devices is one lead')
  assert.equal(out.distinctPeople, 3, 'one identified person + two anonymous visitors')
})

test('identity dedup is case-insensitive and keeps anonymous visitors distinct', async () => {
  const src = read('src', 'app', 'api', 'admin', 'widget', 'analytics', 'route.ts')
  const start = src.indexOf('const identityOf =')
  const end = src.indexOf('const pct =', start)
  const js = ts.transpileModule(
    `export function measure(visitorRows, capturedEmailRows, convertedRows) {
  const capturedEmailResult = { data: capturedEmailRows }
  const convertedResult = { data: convertedRows }
${src.slice(start, end)}
  return { distinctPeople, capturedEmails, convertedVisitors }
}`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }
  ).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-onemetric2-'))
  const file = join(dir, 'm.mjs')
  writeFileSync(file, js)
  const { measure } = await import(pathToFileURL(file).href)

  const out = measure(
    [
      { visitor_id: 'a', captured_email: 'Kim@Example.com' },
      { visitor_id: 'b', captured_email: 'kim@example.com  ' },
      { visitor_id: 'c', captured_email: null },
      { visitor_id: 'd', captured_email: null },
    ],
    [
      { visitor_id: 'a', captured_email: 'Kim@Example.com' },
      { visitor_id: 'b', captured_email: 'kim@example.com  ' },
    ],
    []
  )

  assert.equal(out.capturedEmails, 1, 'casing/whitespace must not mint a second lead')
  assert.equal(out.distinctPeople, 3, 'two anonymous visitors stay two people')
})
