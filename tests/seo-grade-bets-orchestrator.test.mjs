/**
 * Guard tests — grader ORCHESTRATOR behaviour, executed against a fake DB.
 *
 * These run the real `runBetGrader` against an in-memory Supabase stub. An
 * earlier version of these tests asserted on SOURCE TEXT and passed against
 * both bugs when they were reintroduced — the repo's documented
 * "source tests miss runtime bugs" failure, reproduced by the author who had
 * just read the rule. Both tests below were confirmed to FAIL on revert.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Transpile the orchestrator with its imports stubbed so it runs standalone.
function loadOrchestrator() {
  let src = readFileSync(join(root, 'src', 'lib', 'seo', 'grade-bets.ts'), 'utf8')
  const graderSrc = readFileSync(join(root, 'src', 'lib', 'seo', 'bet-grader.ts'), 'utf8')
  src = src
    .replace(/^import type .*$/gm, '')
    .replace(/^import \{[^}]*\} from '\.\/bet-grader'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/execution-verifier'$/m, '')
    .replace(/^import \{[^}]*\} from '\.\/gsc-client'$/m, '')
  // Inline the real grader; stub only the network-touching pieces.
  const inlined =
    graderSrc.replace(/^import type .*$/gm, '') +
    '\nconst verifyExecution = async () => ({ status: "executed", evidence: "stub" })\n' +
    'const getGscConfig = () => null\n' +
    'const fetchSearchAnalytics = async () => []\n' +
    src
  const js = ts.transpileModule(inlined, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

/** Minimal Supabase stub: one table, chainable select/update. */
function makeDb(reports, { failWrites = false } = {}) {
  const writes = []
  return {
    writes,
    from() {
      const q = {
        select() { return q },
        eq() { return q },
        not() { return q },
        order() { return Promise.resolve({ data: reports, error: null }) },
        update(payload) {
          return {
            eq(_col, id) {
              if (failWrites) return Promise.resolve({ error: { message: 'simulated write failure' } })
              writes.push({ id, payload })
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

const bet = (id) => ({
  id,
  action: 'Do the thing',
  action_type: 'metadata',
  target_queries: ['q1'],
  target_page: '/blog/x',
  reasoning: 'r',
  expected_outcome: 'clicks rise to >=12',
  confidence: 'medium',
  review_after: '2026-01-01',
})

const reportRow = (over = {}) => ({
  id: 'r1',
  created_at: '2026-07-24T00:00:00Z',
  window_start: '2026-06-24',
  window_end: '2026-07-21',
  bets: [bet('b1')],
  grades: null,
  gsc_snapshot: { rows: [] },
  ...over,
})

test('an abstention is RE-GRADED on the next run, never frozen', async () => {
  // If any stored grade short-circuits re-grading, one early run stamps the
  // whole backlog `too_soon` permanently and the loop produces zero signal
  // forever — "abstain rather than fabricate" becoming "abstain once, never
  // grade".
  const { runBetGrader } = await loadOrchestrator()
  const reports = [
    reportRow({ grades: { b1: { verdict: 'ungradeable_too_soon', scorer: 'x' } } }),
  ]
  const db = makeDb(reports)
  const result = await runBetGrader(db, '2026-08-20')
  assert.equal(result.gradedNow, 1, 'a stored ABSTENTION must be re-graded, not skipped')
})

test('a settled verdict is NOT re-graded', async () => {
  // The mirror: hits and misses are final, or every run rewrites history.
  const { runBetGrader } = await loadOrchestrator()
  const reports = [reportRow({ grades: { b1: { verdict: 'miss', scorer: 'x' } } })]
  const db = makeDb(reports)
  const result = await runBetGrader(db, '2026-08-20')
  assert.equal(result.gradedNow, 0, 'a settled miss must not be re-graded')
})

test('a run whose writes all fail reports FAILED, not completed', async () => {
  // The price refresher wrote `status: completed` over ~130 nights of total
  // failure because its only tripwire was console.warn.
  const { runBetGrader } = await loadOrchestrator()
  const db = makeDb([reportRow()], { failWrites: true })
  const result = await runBetGrader(db, '2026-08-20')
  assert.equal(result.status, 'failed', 'failed grade writes must surface as a failed run')
  assert.match(result.error ?? '', /FAILED|fail/i)
})

test('a failed report fetch is not reported as "no bets due"', async () => {
  const { runBetGrader } = await loadOrchestrator()
  const db = {
    from: () => ({
      select: function () { return this },
      eq: function () { return this },
      order: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    }),
  }
  const result = await runBetGrader(db, '2026-08-20')
  assert.equal(result.status, 'failed')
})
