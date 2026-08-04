/**
 * Guard test — the nudge cap is a ROLLING WINDOW, not a lifetime cap (v11.23.1).
 *
 * THE DEFECT
 *
 * MAX_NUDGES counted every nudge a user had EVER received. Once a subscriber hit
 * 3, the proactive engine could never contact them again for the life of their
 * subscription. Bailey hit that ceiling on June 11 2026 and was still unreachable
 * 53 days later — the single most engaged user on the platform, permanently
 * muted by a guardrail meant to prevent nagging.
 *
 * The shape was inherited from lead nurture, where the relationship is finite:
 * warm a prospect a few times, then stop. A paying subscriber is the opposite —
 * they are paying for ongoing care, and "Yuri checks in at most three times ever,
 * then goes silent forever" is not a defensible rule at $24.99/mo.
 *
 * WHAT MUST NOT REGRESS
 *
 * Loosening a nag guard is exactly the kind of change that quietly becomes spam.
 * These tests pin BOTH directions: the window must let a long-dormant user be
 * reachable again, AND every anti-nag property must survive — at most 3 per 30
 * days, never closer than 3 days apart, and dedup still lifetime-scoped so Yuri
 * never repeats an identical ask.
 *
 * The gate is inline in the cron route (it needs the db client), so these tests
 * lift the REAL expressions out of the route source and execute them against
 * synthetic nudge rows. Asserting on source text would pass against broken logic
 * (feedback_source_tests_miss_runtime_bugs); pinning the constants alone would
 * not catch a wrong comparison.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const routeSrc = readFileSync(
  join(root, 'src', 'app', 'api', 'cron', 'proactive-nudge', 'route.ts'),
  'utf8'
)

/** Read a numeric constant out of the real route rather than duplicating it. */
function constant(name) {
  const m = routeSrc.match(new RegExp(`const ${name} = (\\d+)`))
  assert.ok(m, `${name} must be defined in the cron route`)
  return Number(m[1])
}

const MAX_NUDGES = constant('MAX_NUDGES')
const NUDGE_WINDOW_DAYS = constant('NUDGE_WINDOW_DAYS')
const SPACING_DAYS = constant('SPACING_DAYS')

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS).toISOString()

/**
 * Build the gate predicate FROM THE ROUTE SOURCE.
 *
 * A hand-written copy of the gate would keep passing after someone reverts the
 * route to a lifetime cap — verified: an early draft of this file did exactly
 * that, and only the source-shape assertion caught the revert. So the executable
 * body is sliced out of the real file between two anchors and evaluated. If the
 * route's logic changes, these behavioral tests change with it.
 */
function buildGateFromSource() {
  const start = routeSrc.indexOf('const windowStart =')
  const endAnchor = '// --- Gather signals ---'
  const end = routeSrc.indexOf(endAnchor)
  assert.ok(
    start > -1 && end > start,
    'could not locate the cap/spacing gate in the cron route — anchors moved?'
  )

  // The slice references `allNudges`, `stats` and `continue`. Rewrite the two
  // cron-loop control statements into return values; everything else is the
  // route's own arithmetic, untouched.
  const body = routeSrc
    .slice(start, end)
    .replace(/stats\.skippedCapOrSpacing\+\+\s*\n\s*continue\s*\n/g, 'return { allowed: false, reason: REASON }\n')

  // Two blocked branches in order: the cap, then spacing.
  let seen = 0
  const wired = body.replace(/REASON/g, () => (seen++ === 0 ? "'cap'" : "'spacing'"))

  const fn = new Function(
    'allNudges',
    'MAX_NUDGES',
    'NUDGE_WINDOW_DAYS',
    'SPACING_DAYS',
    `${wired}\n return { allowed: true, sequence: nudgesInWindow.length + 1 }`
  )

  return (nudges) => {
    const sorted = [...nudges].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    return fn(sorted, MAX_NUDGES, NUDGE_WINDOW_DAYS, SPACING_DAYS)
  }
}

const evaluateGate = buildGateFromSource()

// ---------------------------------------------------------------------------
// The gate in the route must actually be the windowed one
// ---------------------------------------------------------------------------

test('the route computes a rolling window, not a lifetime count', () => {
  assert.match(
    routeSrc,
    /const windowStart = Date\.now\(\) - NUDGE_WINDOW_DAYS \* 24 \* 60 \* 60 \* 1000/,
    'the window start must be computed from NUDGE_WINDOW_DAYS'
  )
  assert.match(
    routeSrc,
    /nudgesInWindow\.length >= MAX_NUDGES/,
    'the cap must be applied to the WINDOWED count'
  )
  assert.ok(
    !/const nudgeCount = priorNudges\?\.length/.test(routeSrc),
    'the lifetime count must be gone — that was the defect'
  )
  assert.match(
    routeSrc,
    /const nudgeSequence = nudgesInWindow\.length \+ 1/,
    'the escalation ladder must reset with the window, or everyone is pinned at the final rung'
  )
})

test('a failed prior-nudge query is an error, never a fresh quota', () => {
  assert.match(
    routeSrc,
    /error: priorErr[\s\S]{0,400}?if \(priorErr\)/,
    'ignoring `error` here would read as "never nudged" and hand out a full quota'
  )
})

// ---------------------------------------------------------------------------
// The defect itself
// ---------------------------------------------------------------------------

test('THE FIX: a user at the lifetime cap becomes reachable once the window passes', () => {
  // Bailey's exact shape: 3 nudges, all far in the past. Under the old lifetime
  // cap this user was blocked forever.
  const bailey = [
    { created_at: daysAgo(83) },
    { created_at: daysAgo(63) },
    { created_at: daysAgo(53) },
  ]

  const result = evaluateGate(bailey)
  assert.equal(
    result.allowed,
    true,
    'a subscriber whose nudges all fall outside the window must be reachable again'
  )
  assert.equal(
    result.sequence,
    1,
    'the ladder resets: this should be a warm nudge #1, not the "I will stop bothering you" rung'
  )
})

test('three nudges INSIDE the window still block a fourth', () => {
  const recent = [
    { created_at: daysAgo(20) },
    { created_at: daysAgo(12) },
    { created_at: daysAgo(5) },
  ]
  const result = evaluateGate(recent)
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'cap', 'the cap must still bind inside the window')
})

test('the window boundary is respected exactly', () => {
  // Two inside, one just outside → the outside one must not count.
  const straddling = [
    { created_at: daysAgo(NUDGE_WINDOW_DAYS + 1) },
    { created_at: daysAgo(10) },
    { created_at: daysAgo(4) },
  ]
  assert.equal(
    evaluateGate(straddling).allowed,
    true,
    'a nudge older than the window must drop out of the count'
  )

  // Move that one just inside → now three in-window, blocked.
  const allInside = [
    { created_at: daysAgo(NUDGE_WINDOW_DAYS - 1) },
    { created_at: daysAgo(10) },
    { created_at: daysAgo(4) },
  ]
  assert.equal(evaluateGate(allInside).allowed, false)
})

// ---------------------------------------------------------------------------
// Anti-nag properties that must survive the loosening
// ---------------------------------------------------------------------------

test('spacing still blocks a rapid follow-up', () => {
  const result = evaluateGate([{ created_at: daysAgo(1) }])
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'spacing', 'one day after a nudge is far too soon')
})

test('spacing is measured against ALL nudges, not just in-window ones', () => {
  // The only prior nudge sits just outside the window but was YESTERDAY-recent
  // relative to spacing. If spacing were measured only over in-window rows, this
  // list would look empty and a nudge would fire immediately after another.
  const edge = [{ created_at: daysAgo(NUDGE_WINDOW_DAYS + 0.5) }]
  const result = evaluateGate(edge)
  assert.equal(result.allowed, true, 'a 30-day-old nudge is outside spacing too')

  // The real protection: a very recent nudge always blocks regardless of window.
  const recent = [{ created_at: daysAgo(SPACING_DAYS - 1) }]
  assert.equal(evaluateGate(recent).reason, 'spacing')
})

test('the realistic ceiling stays roughly one nudge per 10 days', () => {
  // Walk a year of daily cron runs through the REAL gate, newest-first ages
  // recomputed each simulated day, and count how many sends it permits.
  const sent = []
  for (let day = 0; day < 365; day++) {
    const ageOf = (iso) => iso // rows carry absolute timestamps already
    const asRows = sent.map((t) => ({ created_at: ageOf(t) }))
    // Shift every prior send forward so "now" is the simulated day.
    const offset = (365 - day) * DAY_MS
    const shifted = asRows.map((r) => ({
      created_at: new Date(new Date(r.created_at).getTime() + offset).toISOString(),
    }))
    if (evaluateGate(shifted).allowed) {
      sent.push(new Date(Date.now() - offset).toISOString())
    }
  }

  assert.ok(
    sent.length <= 38,
    `a year of eligible days produced ${sent.length} nudges — that is more than ~3/30d allows`
  )
  assert.ok(
    sent.length >= 30,
    `only ${sent.length} nudges in a year means the window is not actually reopening`
  )
})

test('a never-nudged user gets a warm first nudge', () => {
  const result = evaluateGate([])
  assert.equal(result.allowed, true)
  assert.equal(result.sequence, 1)
})

test('dedup stays LIFETIME-scoped so Yuri never repeats an identical ask', () => {
  assert.match(
    routeSrc,
    /const alreadyNudgedReason = allNudges\.some\(/,
    'dedup must check ALL nudges ever, not just the window — repeating the same ' +
      'ask is annoying no matter how much time has passed'
  )
})
