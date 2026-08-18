/**
 * Guard test — a cron that has gone quiet must be able to REACH the alarm.
 *
 * THE DEFECT (Aug 4 2026, the second silence on the same job)
 *
 * `findStaleRuns()` worked perfectly. On Aug 3-4 it recorded
 * `capture_reddit_intel` as quiet on five consecutive guardian-watch runs —
 * 112h, 118h, 130h, 136h, 142h — every one of them stored in
 * ss_pipeline_runs.metadata.cron_quiet. Scott was never told, and the only live
 * acquisition channel stayed dead for six days.
 *
 * The findings went to console.error and to metadata, but never into
 * `report.signals`. Alerting reads `report.signals` and fires on `critical`, so
 * a quiet cron could not reach the alarm NO MATTER HOW LONG IT STAYED DEAD.
 * The detection was complete; the wire to the bell was missing.
 *
 * The subtle half: appending signals is not enough. `runHealthCheck` computes
 * `overall` and `counts` from its OWN signals before these exist, so a report
 * carrying a new critical signal would still be labelled 'ok' — and since the
 * alert reads severity, it would have stayed just as silent while LOOKING
 * fixed. The route must recompute both.
 *
 * These tests EXECUTE the real functions (transpiled), rather than asserting on
 * source text, because a regex test passes against broken code.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

/**
 * Load `staleRunSignals` for real. run-log.ts imports the Supabase client at
 * module scope, so stub the import rather than hand-rolling a copy of the
 * function — a copy would drift from the code it claims to protect.
 */
function loadStaleRunSignals() {
  const src = read('src', 'lib', 'pipeline', 'run-log.ts')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  const require_ = (spec) => {
    if (spec === '@/lib/supabase') return { getServiceClient: () => ({}) }
    throw new Error(`unexpected import: ${spec}`)
  }
  new Function('module', 'exports', 'require', js)(module, module.exports, require_)
  return module.exports
}

const { staleRunSignals, CRON_CRITICAL_MULTIPLE, WATCHED_RUN_TYPES } = loadStaleRunSignals()

test('a cron that has NEVER logged a run is critical', () => {
  // The exact Reddit case, twice over. There is no benign reading of a watched
  // job with zero rows: it means the route is unreachable or was never wired.
  const signals = staleRunSignals({
    quiet: [{ runType: 'capture_reddit_intel', lastRunAt: null, hoursSince: null }],
    unhealthy: [],
  })
  assert.equal(signals.length, 1)
  assert.equal(signals[0].severity, 'critical', 'A never-run cron must be critical, or it cannot alert.')
  assert.equal(signals[0].detail.never_ran, true)
  assert.match(signals[0].summary, /NEVER logged/)
})

test('a cron far past its threshold escalates to critical', () => {
  // 142h against a 48h threshold — the real Aug 4 reading. This is the value
  // that sat in metadata for days without alerting.
  const signals = staleRunSignals({
    quiet: [{ runType: 'capture_reddit_intel', lastRunAt: '2026-07-29T21:56:44Z', hoursSince: 142 }],
    unhealthy: [],
  })
  assert.equal(signals[0].severity, 'critical', '142h quiet on a 48h threshold must be critical.')
  assert.equal(signals[0].detail.threshold_hours, 48)
})

test('a cron only just past its threshold stays warn (log-only)', () => {
  // The charter's warn=log-only rule exists to prevent alert fatigue. One slow
  // day is not an incident, so it must NOT alert.
  const signals = staleRunSignals({
    quiet: [{ runType: 'capture_reddit_intel', lastRunAt: '2026-08-01T00:00:00Z', hoursSince: 50 }],
    unhealthy: [],
  })
  assert.equal(signals[0].severity, 'warn', 'A barely-stale cron must stay warn, not alert.')
})

test('the critical boundary is exactly the documented multiple', () => {
  const threshold = 48
  const at = staleRunSignals({
    quiet: [{ runType: 'capture_reddit_intel', lastRunAt: 'x', hoursSince: threshold * CRON_CRITICAL_MULTIPLE }],
    unhealthy: [],
  })
  const below = staleRunSignals({
    quiet: [{ runType: 'capture_reddit_intel', lastRunAt: 'x', hoursSince: threshold * CRON_CRITICAL_MULTIPLE - 1 }],
    unhealthy: [],
  })
  assert.equal(at[0].severity, 'critical')
  assert.equal(below[0].severity, 'warn')
})

test('signal keys are per-cron and stable, so de-dupe works per job', () => {
  // The alert de-dupes on sorted signal KEYS. A shared key would collapse two
  // dead crons into one condition and hide the second; an unstable key (one
  // containing the hour count) would re-alert on every run and become spam.
  const signals = staleRunSignals({
    quiet: [
      { runType: 'capture_reddit_intel', lastRunAt: null, hoursSince: null },
      { runType: 'nurture_sequence', lastRunAt: 'x', hoursSince: 100 },
    ],
    unhealthy: [],
  })
  const keys = signals.map((s) => s.key)
  assert.equal(new Set(keys).size, 2, 'Each cron needs its own key.')
  for (const k of keys) {
    assert.doesNotMatch(k, /\d{2,}/, `Key '${k}' embeds a number — it would change every run and spam.`)
  }
})

test('an unhealthy last run is reported but stays warn', () => {
  const signals = staleRunSignals({
    quiet: [],
    unhealthy: [{ runType: 'image_health', status: 'failed', startedAt: '2026-08-04T00:00:00Z' }],
  })
  assert.equal(signals.length, 1)
  assert.equal(signals[0].severity, 'warn')
})

test('no findings produces no signals', () => {
  assert.deepEqual(staleRunSignals({ quiet: [], unhealthy: [] }), [])
})

test('a Tue-Thu cron stays SILENT through every real Guardian run in its designed gap', () => {
  // nurture_sequence runs "0 16 * * 2-4". Thursday 16:00 -> the following
  // Tuesday 16:00 is 120h of silence BY DESIGN — five days, not the four an
  // earlier version of this comment claimed.
  //
  // WHAT DECIDES A WARN: detectStaleRuns gates entry into `quiet` with
  // `hoursSince > maxAgeHours` (run-log.ts:186). staleRunSignals then only
  // chooses warn vs critical for rows ALREADY in quiet — so calling it directly
  // with a hand-built quiet array always yields a signal and proves nothing
  // about the threshold. This test asserts the real gate.
  //
  // The threshold must clear the last guardian-watch run before Tuesday's job,
  // not the gap between the jobs. guardian-watch runs 08:23/14:23/20:23 UTC, so
  // these are the only readings that can occur inside the designed gap.
  const threshold = WATCHED_RUN_TYPES.find((w) => w.runType === 'nurture_sequence')?.maxAgeHours
  assert.ok(threshold, 'nurture_sequence must stay on the watch list')

  const THU_16 = Date.parse('2026-08-13T16:00:00Z')
  const gate = (at) => (Date.parse(at) - THU_16) / 3_600_000 > threshold

  for (const at of ['2026-08-18T08:23:00Z', '2026-08-18T14:23:00Z', '2026-08-18T20:23:00Z']) {
    const hours = ((Date.parse(at) - THU_16) / 3_600_000).toFixed(1)
    assert.equal(
      gate(at),
      false,
      `A healthy Tue-Thu cron must NOT be flagged quiet at ${at} (${hours}h, threshold ${threshold}h) — ` +
      'a warn every Tuesday forever is the weekly noise this threshold exists to remove.'
    )
  }

  // ...but a genuinely dead one must still escalate promptly. By Wed 08:23 it
  // has missed its Tuesday slot entirely, and that IS an incident.
  assert.equal(
    gate('2026-08-19T08:23:00Z'),
    true,
    'A nurture cron still silent at Wed 08:23 (136.4h) has missed a scheduled day and must be flagged — ' +
    'one working day is the detection budget.'
  )

  // And once flagged, a long silence must reach CRITICAL so it actually emails.
  const dead = staleRunSignals({
    quiet: [{ runType: 'nurture_sequence', lastRunAt: '2026-08-13T16:00:00Z', hoursSince: threshold * CRON_CRITICAL_MULTIPLE }],
    unhealthy: [],
  })
  assert.equal(dead[0].severity, 'critical', 'A nurture cron past the critical multiple must alert, not just warn.')
})

test('the job that caused this is still watched', () => {
  const watched = WATCHED_RUN_TYPES.map((w) => w.runType)
  assert.ok(
    watched.includes('capture_reddit_intel'),
    'capture_reddit_intel must stay on the watch list — it went silent twice.'
  )
})

/**
 * The wiring half. These assert on the route source because the route is a
 * Next.js handler with cron auth and a live DB — executing it here would test
 * the harness, not the behaviour. Each asserts a property whose absence
 * reproduces the exact silence.
 */
test('the watcher folds cron signals into the report before alerting', () => {
  const src = read('src', 'app', 'api', 'cron', 'guardian-watch', 'route.ts')
  assert.match(src, /staleRunSignals\(/, 'Cron findings are no longer converted to signals.')
  assert.match(
    src,
    /report\.signals\s*=\s*\[\s*\.\.\.report\.signals/,
    'Cron signals must be merged into report.signals or they can never alert.'
  )
  // Match the CALL sites, not the import lines at the top of the file.
  const mergeIdx = src.indexOf('staleRunSignals(cronFindings)')
  const alertIdx = src.indexOf('await maybeSendGuardianAlert(')
  assert.ok(
    mergeIdx > -1 && alertIdx > -1 && mergeIdx < alertIdx,
    'The merge must happen BEFORE the alert step, or the alert sees the old report.'
  )
})

test('the watcher recomputes overall and counts after merging', () => {
  // Without this, a critical cron signal lands inside a report still labelled
  // 'ok'. The alert reads severity, so it would stay silent while looking fixed.
  const src = read('src', 'app', 'api', 'cron', 'guardian-watch', 'route.ts')
  const mergeIdx = src.indexOf('report.signals = [...report.signals')
  const overallIdx = src.indexOf('report.overall =', mergeIdx)
  const countsIdx = src.indexOf('report.counts =', mergeIdx)
  assert.ok(overallIdx > mergeIdx, 'report.overall must be recomputed after the merge.')
  assert.ok(countsIdx > mergeIdx, 'report.counts must be recomputed after the merge.')
})
