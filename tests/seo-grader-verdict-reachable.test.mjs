/**
 * Guard test — a HIT must be reachable through the REAL orchestrator cadence.
 *
 * Earned Sep 1 2026, and this is the defect the existing unit tests could not
 * see. tests/seo-bet-grader.test.mjs proves `hit` reachable by calling gradeBet
 * directly with `firstSeen: '2026-06-25'` against `windowStart: '2026-07-01'` —
 * a first-sighting BEFORE the window opened. The orchestrator provably never
 * produced such an input:
 *
 *   - execution_first_seen is only ever stamped with `today` (bet-grader.ts:293)
 *   - verifyExecution was only called once a clean 28-day window existed, and
 *     grading did not begin until `review_after`
 *   => firstSeen >= windowStart + 28 ALWAYS, and the stamp is sticky
 *   => gate 2b (firstSeen > windowStart) fired on every executed bet, forever
 *
 * So hit/miss was UNREACHABLE for every bet at any traffic level. Production
 * agreed: the only two bets ever observed executed both carry first_seen
 * 2026-08-23 (the grader's first cron run) against window starts of 2026-06-24
 * and 2026-06-26 — the date the INSTRUMENT arrived, not the date work shipped.
 *
 * A unit test that hand-feeds an impossible input is not evidence. This test
 * drives the real orchestrator on the real weekly cadence instead.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadOrchestrator() {
  let src = readFileSync(join(root, 'src', 'lib', 'seo', 'grade-bets.ts'), 'utf8')
  const graderSrc = readFileSync(join(root, 'src', 'lib', 'seo', 'bet-grader.ts'), 'utf8')
  src = src
    .replace(/^import type .*$/gm, '')
    .replace(/^import \{[^}]*\} from '\.\/bet-grader'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/execution-verifier'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/gsc-client'$/m, '')
  const inlined =
    graderSrc.replace(/^import type .*$/gm, '') +
    // The work IS shipped and observable from day one — the honest case this
    // test exists to cover.
    '\nconst verifyExecution = async () => ({ status: "executed", evidence: "stub" })\n' +
    'const getGscConfig = () => null\n' +
    'const fetchSearchAnalytics = async () => []\n' +
    src
  const js = ts.transpileModule(inlined, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

function makeDb(reports) {
  return {
    from() {
      const q = {
        select() { return q },
        eq() { return q },
        not() { return q },
        order() { return Promise.resolve({ data: reports, error: null }) },
        update(payload) {
          return {
            eq(_col, id) {
              const row = reports.find((r) => r.id === id)
              if (row) Object.assign(row, payload)
              return Promise.resolve({ error: null })
            },
          }
        },
      }
      return q
    },
  }
}

const PAGE = '/blog/x'
const rows = (clicks) => [{ query: 'q1', page: PAGE, clicks, impressions: 400, position: 8 }]

// Report born Jul 24 measuring Jun 24 - Jul 21; bet due Aug 14. A later report
// supplies the clean after-window (baseline 4 -> 14 clicks, threshold >=12 — a
// real powered win under the grader's own conditional test).
//
// The after-window opens Aug 1, AFTER the first weekly grader run (Jul 26).
// That ordering is the point: gate 2b compares first-sighting against the
// AFTER-window start, so the witness must run before that window opens. It now
// does, because witnessing happens every week from the bet's birth rather than
// only once the bet is due.
function fixture() {
  return [
    {
      id: 'r1',
      created_at: '2026-07-24T00:00:00Z',
      window_start: '2026-06-24',
      window_end: '2026-07-21',
      bets: [{
        id: 'b1',
        action: 'Rewrite the title to "Exact Marker Phrase"',
        action_type: 'metadata',
        target_queries: ['q1'],
        target_page: PAGE,
        reasoning: 'r',
        expected_outcome: 'the page earns >=12 clicks within 4 weeks',
        confidence: 'medium',
        review_after: '2026-08-14',
      }],
      grades: null,
      gsc_snapshot: { rows: rows(4) },
    },
    {
      id: 'r2',
      created_at: '2026-08-30T00:00:00Z',
      window_start: '2026-08-01',
      window_end: '2026-08-28',
      bets: [],
      grades: null,
      gsc_snapshot: { rows: rows(14) },
    },
  ]
}

test('THE test: a shipped, powered bet reaches a real verdict on the weekly cadence', async () => {
  const { runBetGrader } = await loadOrchestrator()
  const reports = fixture()
  const db = makeDb(reports)

  // Weekly cron runs, exactly as vercel.json schedules them. The first runs
  // happen BEFORE the bet is due — which is precisely when execution must be
  // witnessed, because gate 2b compares first-sighting against window_start
  // (2026-06-24).
  for (const day of ['2026-07-26', '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30']) {
    await runBetGrader(db, day)
  }

  const grade = reports[0].grades?.b1
  assert.ok(grade, 'the bet must have been graded')
  assert.notEqual(
    grade.verdict,
    'ungradeable_execution_unknown',
    'a bet whose work was live from the first run must not be discarded as "first observed after the window opened" — that is the instrument blaming its own tardiness on the work'
  )
  assert.equal(grade.verdict, 'hit', `expected a hit; got ${grade.verdict} — ${grade.notes}`)
})

test('gate 2b still fires for work that genuinely shipped late', async () => {
  // The protection must survive. A bet whose page is NOT observable until after
  // the window opened is still correctly discarded — we fixed the witness
  // timing, not the gate's meaning.
  let src = readFileSync(join(root, 'src', 'lib', 'seo', 'grade-bets.ts'), 'utf8')
  const graderSrc = readFileSync(join(root, 'src', 'lib', 'seo', 'bet-grader.ts'), 'utf8')
  src = src
    .replace(/^import type .*$/gm, '')
    .replace(/^import \{[^}]*\} from '\.\/bet-grader'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/execution-verifier'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/gsc-client'$/m, '')
  const inlined =
    graderSrc.replace(/^import type .*$/gm, '') +
    // Not live until 2026-08-16 — genuinely late work.
    '\nlet NOW = ""\nconst verifyExecution = async () => ({ status: NOW >= "2026-08-16" ? "executed" : "unverified", evidence: "stub" })\n' +
    'const getGscConfig = () => null\n' +
    'const fetchSearchAnalytics = async () => []\n' +
    src +
    '\nexport const setNow = (d) => { NOW = d }\n'
  const js = ts.transpileModule(inlined, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

  const reports = fixture()
  const db = makeDb(reports)
  for (const day of ['2026-07-26', '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30']) {
    mod.setNow(day)
    await mod.runBetGrader(db, day)
  }
  assert.equal(
    reports[0].grades?.b1?.verdict,
    'ungradeable_execution_unknown',
    'late-shipped work must STILL be discarded — the gate protects against a mostly-pre-execution window'
  )
})

test('a window whose tail sits inside the GSC publishing lag is NOT fetched live', async () => {
  // GSC publishes with a ~3 day lag (gsc-client.ts:89). Fetching a window that
  // ends inside it returns partial data with NO error — the after-window is
  // silently short, clicks undercount, and the bet grades `miss` for a reason
  // that has nothing to do with the bet.
  //
  // This asserts the boundary directly: fetchCleanWindow must not be called for
  // a window whose end is within the lag, and must be called once it clears.
  let src = readFileSync(join(root, 'src', 'lib', 'seo', 'grade-bets.ts'), 'utf8')
  const graderSrc = readFileSync(join(root, 'src', 'lib', 'seo', 'bet-grader.ts'), 'utf8')
  src = src
    .replace(/^import type .*$/gm, '')
    .replace(/^import \{[^}]*\} from '\.\/bet-grader'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/execution-verifier'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/gsc-client'$/m, '')
  const inlined =
    graderSrc.replace(/^import type .*$/gm, '') +
    '\nconst verifyExecution = async () => ({ status: "executed", evidence: "stub" })\n' +
    // Record every window the grader tries to fetch LIVE.
    'export const fetched = []\n' +
    'const getGscConfig = () => ({ siteUrl: "s", clientEmail: "e", privateKey: "k" })\n' +
    'const fetchSearchAnalytics = async (_c, start, end) => { fetched.push(start + ".." + end); return [] }\n' +
    src
  const js = ts.transpileModule(inlined, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

  // r1's window ends 2026-07-21, so its clean after-window is 07-22..08-18.
  // A run on 08-19 or 08-20 is inside the ~3d lag and must not fetch it.
  await mod.runBetGrader(makeDb(fixture()), '2026-08-19')
  assert.deepEqual(mod.fetched, [], 'must NOT fetch a window whose tail is inside the GSC lag')

  await mod.runBetGrader(makeDb(fixture()), '2026-08-23')
  assert.ok(
    mod.fetched.includes('2026-07-22..2026-08-18'),
    `once the lag clears the window must be fetched; saw ${JSON.stringify(mod.fetched)}`
  )
})
