/**
 * Guard tests — per-comment Reddit attribution.
 *
 * WHAT THIS IS FOR
 *
 * `ss_reddit_intel.attributed_sessions` was written once at insert and never
 * updated: all 621 rows sat at 0. The cron computed a single platform-wide
 * "did Reddit send anyone" number into the RUN metadata, so the question that
 * actually decides the channel — *which* comments, from *which* subreddits,
 * correlate with visits — was unanswerable in either direction.
 *
 * THE FAILURE MODE THIS GUARDS
 *
 * Attribution here is coarse by necessity (Reddit exposes no per-comment
 * referral), so the danger is not an imprecise number — it is a number that
 * LOOKS like measurement while being an artifact:
 *   - crediting a comment for a visit that happened BEFORE it was posted
 *   - weighting by score, which bakes in the hypothesis under test
 *   - an all-zero table that cannot distinguish "no traffic yet" from
 *     "the attributor never ran"
 *
 * The real transpiled module is executed against a stub client, because a
 * source-text assertion passes against broken code.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/**
 * Load intel.ts with a stubbed Supabase client.
 * `sessions` and `comments` are the two reads; `writes` records every update.
 */
function load({ sessions = [], comments = [], sessionErr = null, commentErr = null } = {}) {
  const src = readFileSync(join(root, 'src/lib/reddit/intel.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText

  const writes = []
  const db = {
    from(table) {
      if (table === 'ss_widget_sessions') {
        const q = {
          select: () => q,
          eq: () => Promise.resolve({ data: sessions, error: sessionErr }),
        }
        return q
      }
      // ss_reddit_intel
      const q = {
        select: () => q,
        order: () => Promise.resolve({ data: comments, error: commentErr }),
        update(values) {
          const u = {
            eq: (_col, id) => {
              writes.push({ id, ...values })
              return Promise.resolve({ error: null })
            },
          }
          return u
        },
      }
      return q
    },
  }

  const module = { exports: {} }
  const require_ = (spec) => {
    if (spec === '../supabase') return { getServiceClient: () => db }
    if (spec === './oauth') return { redditFetch: async () => ({}) }
    throw new Error(`unexpected import: ${spec}`)
  }
  new Function('module', 'exports', 'require', js)(module, module.exports, require_)
  return { mod: module.exports, writes }
}

const HOUR = 3_600_000
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString()

/** Module instance used only to read exported constants. */
const { mod: mod0 } = load()

test('reports no signal when there is no reddit traffic (the Aug 2026 state)', async () => {
  // All 621 rows legitimately 0. This must be DISTINGUISHABLE from a broken run.
  const { mod, writes } = load({ sessions: [], comments: [{ id: 'c1', posted_at: iso(HOUR) }] })
  const res = await mod.attributeSessionsToComments()
  assert.equal(res.hadSignal, false, 'no sessions means no signal, and it must say so')
  assert.equal(res.redditSessions, 0)
  assert.equal(writes.length, 0, 'must not write when there is nothing to attribute')
})

test('a failed session query THROWS rather than reading as no-traffic', async () => {
  // Conflating "query broke" with "channel is quiet" is how a broken instrument
  // looks like a dead channel for six days.
  const { mod } = load({ sessionErr: { message: 'boom' } })
  await assert.rejects(() => mod.attributeSessionsToComments())
})

test('credits a comment posted shortly before the visit', async () => {
  const { mod, writes } = load({
    sessions: [{ id: 's1', started_at: iso(0) }],
    comments: [{ id: 'c1', posted_at: iso(2 * HOUR) }],
  })
  const res = await mod.attributeSessionsToComments()
  assert.equal(res.hadSignal, true)
  assert.equal(res.commentsCredited, 1)
  assert.deepEqual(writes, [{ id: 'c1', attributed_sessions: 1 }])
})

test('NEVER credits a comment posted AFTER the visit', async () => {
  // Crediting forwards would invent causation backwards in time.
  const { mod, writes } = load({
    sessions: [{ id: 's1', started_at: iso(3 * HOUR) }],
    comments: [{ id: 'c1', posted_at: iso(0) }],
  })
  const res = await mod.attributeSessionsToComments()
  assert.equal(writes.length, 0, 'a later comment must never be credited')
  assert.equal(res.unattributedSessions, 1, 'and the session must be reported as unattributed')
})

test('ignores comments older than the attribution window', async () => {
  const { mod, writes } = load({
    sessions: [{ id: 's1', started_at: iso(0) }],
    comments: [{ id: 'old', posted_at: iso(200 * HOUR) }],
  })
  const res = await mod.attributeSessionsToComments()
  assert.equal(writes.length, 0)
  assert.equal(res.unattributedSessions, 1)
})

test('splits credit evenly across comments in the window', async () => {
  // Even split, NOT score-weighted: weighting by score would bake in the very
  // hypothesis under test ("good comments drive traffic") and read it back as
  // a finding. Two comments, two sessions -> one each after rounding.
  const { mod, writes } = load({
    sessions: [{ id: 's1', started_at: iso(0) }, { id: 's2', started_at: iso(HOUR) }],
    comments: [
      { id: 'c1', posted_at: iso(3 * HOUR) },
      { id: 'c2', posted_at: iso(4 * HOUR) },
    ],
  })
  await mod.attributeSessionsToComments()
  const byId = Object.fromEntries(writes.map((w) => [w.id, w.attributed_sessions]))
  assert.equal(byId.c1, 1)
  assert.equal(byId.c2, 1)
})

test('the window boundary is the documented constant, not a magic number', async () => {
  assert.equal(typeof mod0.ATTRIBUTION_WINDOW_HOURS, 'number')
  const justInside = mod0.ATTRIBUTION_WINDOW_HOURS - 1
  const justOutside = mod0.ATTRIBUTION_WINDOW_HOURS + 1

  const inside = load({
    sessions: [{ id: 's1', started_at: iso(0) }],
    comments: [{ id: 'c1', posted_at: iso(justInside * HOUR) }],
  })
  await inside.mod.attributeSessionsToComments()
  assert.equal(inside.writes.length, 1, 'inside the window must be credited')

  const outside = load({
    sessions: [{ id: 's1', started_at: iso(0) }],
    comments: [{ id: 'c1', posted_at: iso(justOutside * HOUR) }],
  })
  await outside.mod.attributeSessionsToComments()
  assert.equal(outside.writes.length, 0, 'outside the window must not be')
})

test('sessions with no eligible comment are counted, not silently dropped', async () => {
  const { mod } = load({
    sessions: [
      { id: 's1', started_at: iso(0) },
      { id: 's2', started_at: iso(500 * HOUR) },
    ],
    comments: [{ id: 'c1', posted_at: iso(HOUR) }],
  })
  const res = await mod.attributeSessionsToComments()
  assert.equal(res.redditSessions, 2)
  assert.equal(res.unattributedSessions, 1, 'the orphan session must be visible in the result')
})

test('an empty corpus with real traffic reports no signal, not a crash', async () => {
  const { mod } = load({ sessions: [{ id: 's1', started_at: iso(0) }], comments: [] })
  const res = await mod.attributeSessionsToComments()
  assert.equal(res.hadSignal, false)
  assert.equal(res.unattributedSessions, 1)
})

/**
 * ---------------------------------------------------------------- pushback
 *
 * Piece 2. `was_corrected` existed as a boolean since the table shipped and
 * nobody ever set it. The obvious way to populate it — flag score < 0 — was
 * tested against the real corpus on Aug 5 2026 and is WRONG.
 *
 * All three negative comments were fetched WITH their reply threads. They are
 * three different things, and the bodies below are verbatim:
 *
 *   on7e1qd (-4) an AI CALLOUT (+5). No factual error at all — the comment was
 *                a correct distinction between Real Barrier Extreme Cream and
 *                its Light/Special Set variants. Score-based flagging would
 *                have graded the account's best factual work as a mistake.
 *   oc2erhk (-3) a real FACTUAL CORRECTION (+3).
 *   p1j0ipt (-1) substantive DISAGREEMENT (+2).
 */

const REAL_REPLIES = {
  ai_callout:
    'Why bother replying using AI generated responses? If OP wanted one of those, they can get ir easily themselves.',
  factual_correction: '300 is higher! 50 is the lowest. ',
  disagreement:
    "This is very strange advice. I don't think it's true at all. I personally have been using tret on dry skin every other night for months and results have been great.",
}

test('classifies all three REAL pushback replies correctly', () => {
  for (const [expected, body] of Object.entries(REAL_REPLIES)) {
    assert.equal(
      mod0.classifyPushback(body),
      expected,
      `verbatim reply misclassified: ${body.slice(0, 60)}`
    )
  }
})

test('does not flag benign replies', () => {
  // Verbatim from the same threads. A classifier that fires on these would
  // bury the real signal in noise and get ignored.
  for (const body of [
    'Thank you!',
    'I applied it on the dry skin.',
    'I dont have that dr. Jart+ ceramidin cream. What I do have is laneige cica sleeping mask, bioderma lipid cream and skin 1004 centella ampoule and madeca cream. Are there any that can work?',
  ]) {
    assert.equal(mod0.classifyPushback(body), null, `false positive on: ${body.slice(0, 50)}`)
  }
})

test('an AI callout outranks a higher-scoring disagreement', () => {
  // Severity beats score. An ai_callout is not a skincare error — it is the one
  // signal that the account's cover is slipping, which is the only failure that
  // ends the channel rather than costing one comment.
  const picked = mod0.selectPushback([
    { author: 'a', body: 'I disagree with this entirely', score: 99 },
    { author: 'b', body: 'is this ai generated?', score: 1 },
  ])
  assert.equal(picked.kind, 'ai_callout')
})

test('score breaks ties within the same kind', () => {
  const picked = mod0.selectPushback([
    { author: 'a', body: "that's not correct", score: 2 },
    { author: 'b', body: "that's wrong", score: 8 },
  ])
  assert.equal(picked.reply.score, 8)
})

test('ignores the author replying to themselves', () => {
  // glass_skin_atx correcting their own comment is not community pushback.
  const picked = mod0.selectPushback([
    { author: 'glass_skin_atx', body: "actually, that's not correct — I misspoke", score: 5 },
  ])
  assert.equal(picked, null)
})

test('returns null when no reply pushes back', () => {
  assert.equal(
    mod0.selectPushback([{ author: 'x', body: 'This helped a lot, thanks!', score: 4 }]),
    null
  )
})
