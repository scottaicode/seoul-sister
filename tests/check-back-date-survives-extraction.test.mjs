/**
 * Guard test — a check-in date Yuri NAMED must survive extraction into storage.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Bailey, August 6 2026, chin peeling on alternating adapalene/BHA. Yuri pulled
 * both actives, prescribed a barrier reset, and said — three times, across two
 * replies — "I'll check in with you Sunday to see if the chin's settled enough
 * to reintroduce the actives."
 *
 * The whole promised-follow-up feature was built and correct:
 *   - the extraction prompt (memory.ts) tells Sonnet to resolve "Sunday" to a
 *     concrete ISO date, and carefully distinguishes a check-in she offered from
 *     an outcome horizon ("four to six weeks before you judge results");
 *   - mergeDecisionMemory preserves an existing date when a later extraction is
 *     silent, so a follow-up can't be silently erased;
 *   - the nudge engine (nudge-eligibility.ts) fires on check_back_date in BOTH
 *     directions — early if she said Friday, held back if she said two weeks —
 *     and ranks a kept promise above a merely stale loop, with its own copy:
 *     "she's following up because she said she would".
 *
 * And it had NEVER ONCE RUN. The parser that turns Sonnet's JSON into the stored
 * object declared its inline type as { topic, summary, opened_date } and rebuilt
 * every loop from exactly those three fields. check_back_date was dropped on the
 * floor before it ever reached the merge.
 *
 * Measured in production before the fix, across the whole database:
 *   37 conversations had open_loops. ZERO had ever held a non-null
 *   check_back_date.
 *
 * This is the "nothing happened vs. nothing ran" class. null is a legitimate
 * value for a loop with no promised date, so every downstream stage behaved
 * exactly as designed — for a date that was always null. Bailey's loop fell back
 * to the generic STALE_OPEN_LOOP_DAYS = 5 default (due Tuesday, not Sunday), and
 * nothing anywhere knew that Sunday had been promised to her.
 *
 * These tests EXECUTE the real parser mapping rather than grepping for the
 * field name. A source-regex test ("does memory.ts mention check_back_date?")
 * passes against the broken code — the string appears in the prompt, in the
 * merge, and in the type, all while the parser drops it.
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

const memorySrc = read('src', 'lib', 'yuri', 'memory.ts')

/**
 * Rebuild the REAL open_loops mapping out of memory.ts and run it.
 *
 * The mapping lives inside an async function with Supabase/Anthropic imports at
 * module scope, so we lift the exact `open_loops:` expression verbatim and
 * evaluate it against a fixture. Lifting the real source (rather than
 * reimplementing it) is what makes this test fail when the field is dropped.
 */
async function loadOpenLoopMapper() {
  const start = memorySrc.indexOf('    open_loops: Array.isArray(extracted.open_loops)')
  assert.ok(start > -1, 'open_loops mapping must exist in memory.ts')
  const endMarker = '    extracted_at: new Date().toISOString(),'
  const end = memorySrc.indexOf(endMarker, start)
  assert.ok(end > start, 'open_loops mapping must be followed by extracted_at')

  // The normalizer the mapping calls, lifted from module scope.
  const nStart = memorySrc.indexOf('export function normalizeCheckBackDate')
  assert.ok(nStart > -1, 'normalizeCheckBackDate must exist in memory.ts')
  const nEnd = memorySrc.indexOf('\n}', nStart) + 2
  const normalizer = memorySrc.slice(nStart, nEnd)

  const mapping = memorySrc.slice(start, end)
  const module_ = `${normalizer}
export function mapOpenLoops(extracted) {
  const out = {
${mapping}  }
  return out.open_loops
}
`
  const js = ts.transpileModule(module_, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText

  const dir = mkdtempSync(join(tmpdir(), 'ss-checkback-'))
  const file = join(dir, 'mapper.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

// ---------------------------------------------------------------------------
// The defect itself: the promised date must reach storage.
// ---------------------------------------------------------------------------

test('a named check-in date survives extraction (Baileys Sunday)', async () => {
  const { mapOpenLoops } = await loadOpenLoopMapper()

  // Exactly the shape Sonnet returns for the Aug 6 conversation.
  const loops = mapOpenLoops({
    open_loops: [
      {
        topic: 'chin_peeling_resolution',
        summary:
          "Yuri is checking whether the chin peeling has fully resolved and is smooth to determine if user is ready to start TXA",
        opened_date: '2026-08-06',
        check_back_date: '2026-08-09',
      },
    ],
  })

  assert.equal(loops.length, 1)
  assert.equal(
    loops[0].check_back_date,
    '2026-08-09',
    'the date Yuri promised must survive into the stored loop — dropping it silently reverts the follow-up to the 5-day generic default'
  )
})

test('a loop with no promised date stores null, not undefined', async () => {
  const { mapOpenLoops } = await loadOpenLoopMapper()

  const loops = mapOpenLoops({
    open_loops: [
      { topic: 'active_reintroduction_cadence', summary: 'cadence not finalized', opened_date: '2026-08-06' },
    ],
  })

  assert.equal(loops.length, 1)
  // Must be an explicit null: mergeDecisionMemory treats `undefined` as "the
  // extraction said nothing, keep the prior date" and only an explicit null
  // clears it. Storing undefined here would make a no-date loop indistinguishable
  // from a silent one and could resurrect a stale promised date.
  assert.equal(loops[0].check_back_date, null)
  assert.ok('check_back_date' in loops[0], 'the key must be present, not absent')
})

// ---------------------------------------------------------------------------
// Malformed values must never schedule a nudge on a wrong day.
// ---------------------------------------------------------------------------

test('malformed check-in dates degrade to null rather than a wrong day', async () => {
  const { normalizeCheckBackDate } = await loadOpenLoopMapper()

  // Late is recoverable (falls back to generic staleness). Wrong-day is not.
  assert.equal(normalizeCheckBackDate('Sunday'), null, 'an unresolved weekday name is not a date')
  assert.equal(normalizeCheckBackDate('next week'), null)
  assert.equal(normalizeCheckBackDate(''), null)
  assert.equal(normalizeCheckBackDate('   '), null)
  assert.equal(normalizeCheckBackDate(null), null)
  assert.equal(normalizeCheckBackDate(undefined), null)
  assert.equal(normalizeCheckBackDate(20260809), null, 'a number is not a date string')
  assert.equal(normalizeCheckBackDate('2026-02-30'), null, 'calendar-invalid dates must be rejected')
  assert.equal(normalizeCheckBackDate('2026-13-01'), null)
})

test('valid date forms normalize to a bare ISO date', async () => {
  const { normalizeCheckBackDate } = await loadOpenLoopMapper()

  assert.equal(normalizeCheckBackDate('2026-08-09'), '2026-08-09')
  assert.equal(normalizeCheckBackDate('  2026-08-09  '), '2026-08-09')
  // Sonnet occasionally returns a full timestamp; the engine does bare-date math.
  assert.equal(normalizeCheckBackDate('2026-08-09T00:00:00.000Z'), '2026-08-09')
  assert.equal(normalizeCheckBackDate('2026-08-09 00:00:00'), '2026-08-09')
  assert.equal(normalizeCheckBackDate('2028-02-29'), '2028-02-29', 'a real leap day is a valid date')
  assert.equal(normalizeCheckBackDate('2026-02-29'), null, '2026 is not a leap year — Feb 29 must be rejected')
})

test('an already-arrived date is preserved, not clamped away', async () => {
  const { normalizeCheckBackDate } = await loadOpenLoopMapper()

  // Re-extraction on an older conversation legitimately yields a past date, and
  // the engine treats "date <= today" as DUE. Rejecting it here would suppress
  // exactly the follow-up that is most overdue.
  assert.equal(normalizeCheckBackDate('2020-01-01'), '2020-01-01')
})

// ---------------------------------------------------------------------------
// The consumer must still honor the date once it arrives.
// ---------------------------------------------------------------------------

test('the nudge engine still reads check_back_date as the due signal', () => {
  const src = read('src', 'lib', 'intelligence', 'nudge-eligibility.ts')
  assert.ok(
    /if\s*\(\s*l\.check_back_date\s*\)/.test(src),
    'nudge-eligibility must branch on check_back_date — without a consumer the stored date is inert'
  )
  assert.ok(
    src.includes('check_back_date ? 0 : 1'),
    'a promised check-in must outrank a merely stale loop when choosing which to surface'
  )
})

test('the merge still lets a silent extraction preserve an earlier promised date', () => {
  assert.ok(
    memorySrc.includes(
      'l.check_back_date !== undefined ? l.check_back_date : (prev?.check_back_date ?? null)'
    ),
    'an extraction that simply did not mention a follow-up must not erase a date Yuri named earlier'
  )
})
