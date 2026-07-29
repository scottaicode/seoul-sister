/**
 * Guard test — cron observability must live in the DATABASE, not an inbox.
 *
 * THE DEFECT
 * `capture-reddit-intel` stopped executing after July 14 2026 and nobody could
 * tell for 15 days. It was the only cron that never wrote to ss_pipeline_runs,
 * so "ran and found nothing" and "never ran at all" produced the IDENTICAL
 * database state. The route's own console.error guard was correct and had
 * nothing to fire into that anyone reads. Diagnosis required invoking the
 * endpoint by hand, which immediately captured 82 comments that had been
 * accumulating the whole time.
 *
 * THE STANDING RULE (owner instruction, July 29 2026)
 * Nothing may DEPEND on an email reaching the owner. An inbox is not a
 * monitoring system — mail bounces, filters, gets marked spam, or goes unread.
 * Every health signal must be answerable with a SQL query; notification is a
 * redundant layer on top.
 *
 * Source-structural assertions. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const runLogSrc = read('src', 'lib', 'pipeline', 'run-log.ts')
const redditSrc = read('src', 'app', 'api', 'cron', 'capture-reddit-intel', 'route.ts')
const guardianSrc = read('src', 'app', 'api', 'cron', 'guardian-watch', 'route.ts')

test('the run logger only writes to the DB — it never sends anything', () => {
  // The whole point: durable state, not a notification.
  assert.ok(
    !/resend|sendMail|sendGuardianAlert|fetch\(/i.test(runLogSrc),
    'run-log.ts must not send email or call out anywhere — the DB row IS the signal.'
  )
  assert.match(runLogSrc, /from\('ss_pipeline_runs'\)/, 'Lost the run-row insert.')
})

test('observability never takes down the job it observes', () => {
  assert.match(
    runLogSrc,
    /catch \(err\) \{[\s\S]{0,120}failed to write run log/,
    'logPipelineRun must swallow its own errors.'
  )
})

test('status values match the DB CHECK constraint', () => {
  // An earlier draft used 'stale', which violates
  // ss_pipeline_runs_status_check. Because the helper swallows errors, that
  // INSERT would have failed SILENTLY — recreating the exact invisibility this
  // module exists to remove.
  assert.match(
    runLogSrc,
    /export type RunStatus = 'completed' \| 'completed_with_errors' \| 'failed' \| 'running'/,
    'RunStatus must mirror the CHECK constraint exactly.'
  )
  assert.ok(
    !/'stale'(?!\))/.test(runLogSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
    "Executable code must not use the invalid 'stale' status."
  )
})

test('an anomalous empty run is distinguishable in data', () => {
  assert.match(
    runLogSrc,
    /anomalous_empty: true/,
    'A zero-result run that should have found something must be flagged in metadata.'
  )
  assert.match(
    runLogSrc,
    /anomalousEmpty \? 'completed_with_errors' : input\.status/,
    'Lost the status escalation for an anomalous empty run.'
  )
})

test('the reddit cron logs every exit path', () => {
  const paths = redditSrc.match(/await logRun\(/g) || []
  assert.ok(
    paths.length >= 3,
    `Expected logging on success, zero-result and failure paths; found ${paths.length}.`
  )
  // The failure path is the one that historically vanished.
  assert.match(
    redditSrc,
    /await logRun\(startedAt, 'failed'/,
    'A failed run must still leave a trace.'
  )
})

test('the reddit cron marks an unexpected empty result as anomalous', () => {
  assert.match(
    redditSrc,
    /\(count \?\? 0\) > 0/,
    'Zero comments against a non-empty corpus is anomalous and must be flagged.'
  )
})

test('startedAt is captured before any work', () => {
  // Otherwise duration is meaningless and a hung run looks instantaneous.
  const handlerIdx = redditSrc.indexOf('export async function POST')
  const startedIdx = redditSrc.indexOf('const startedAt = new Date().toISOString()')
  assert.ok(
    startedIdx > handlerIdx && startedIdx - handlerIdx < 120,
    'startedAt must be the first thing the handler does.'
  )
})

test('the Guardian detects crons that have gone quiet', () => {
  assert.match(guardianSrc, /findStaleRuns\(\)/, 'Guardian no longer checks cron liveness.')
  assert.match(
    guardianSrc,
    /cron_quiet: cronFindings\.quiet/,
    'Findings must be persisted to the verdict, not just logged.'
  )
  assert.match(
    guardianSrc,
    /has NEVER logged a run/,
    'A cron that never logged is the exact Reddit case — it must be reported distinctly.'
  )
})

test('the liveness check cannot break the Guardian', () => {
  assert.match(
    guardianSrc,
    /cron liveness check failed/,
    'The liveness check must be wrapped so it never fails the health pass.'
  )
})

test('the watch list is readable and non-empty', () => {
  assert.match(runLogSrc, /WATCHED_RUN_TYPES/, 'Lost the watch list.')
  assert.match(
    runLogSrc,
    /runType: 'capture_reddit_intel'/,
    'The job that caused this must itself be watched.'
  )
})

test('the watch list keys on the run_type actually WRITTEN, not the cron name', () => {
  // guardian-watch stores run_type 'reprocess' (a CHECK-allowed value reused to
  // avoid a migration). Keying on the folder name produced a false "has NEVER
  // logged a run" on the first live run — a monitor crying wolf is worse than
  // no monitor, because it trains you to ignore it.
  assert.match(
    runLogSrc,
    /runType: 'reprocess'/,
    "guardian-watch must be watched under the run_type it writes ('reprocess')."
  )
  assert.ok(
    !/runType: 'guardian-watch'/.test(runLogSrc),
    "'guardian-watch' is never written as a run_type — watching it guarantees a false positive."
  )
})

test('no cron makes email delivery a precondition for anything', () => {
  // Owner instruction: nothing may depend on mail arriving. Email paths must
  // no-op gracefully when unconfigured, never gate logic or throw.
  const cronDir = join(root, 'src', 'app', 'api', 'cron')
  const offenders = []
  for (const entry of readdirSync(cronDir)) {
    const file = join(cronDir, entry, 'route.ts')
    if (!existsSync(file)) continue
    const src = readFileSync(file, 'utf8')
    // Throwing or early-returning an error BECAUSE a recipient is missing would
    // make the notification load-bearing.
    if (/throw new Error\([^)]*(GUARDIAN_ALERT_EMAIL|ALERT_EMAIL|recipient)/i.test(src)) {
      offenders.push(entry)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These crons treat a missing alert recipient as fatal: ${offenders.join(', ')}`
  )
})
