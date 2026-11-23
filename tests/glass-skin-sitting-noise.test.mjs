/**
 * One photo is not a reading (Nov 22 2026).
 *
 * A member took two photos 26 seconds apart. Clarity read 48 on one and 60 on
 * the other. Yuri, shown the five scores of only the LAST photo of each day,
 * told her clarity was "60, up from 52 in October"; October's three photos read
 * 68, 58 and 52. Measured on every sitting with more than one photo (7 sittings,
 * 20 photos, 4 members): the overall score differs between photos of one sitting
 * by 2.7 on average and up to 6; clarity by 6.1 and up to 16.
 *
 * Two things follow, and both are tested by RUNNING the real code:
 *   1. Yuri is shown each score as the range across a day's photos, and the
 *      measured spread as a fact. Nothing tells her what to say.
 *   2. The grader that decides whether a nudge "helped" compares the MEAN of
 *      each sitting. On one photo each, the 4-point band was crossed by noise in
 *      3 of the 7 sittings.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const out = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const load = (js) => import('data:text/javascript;base64,' + Buffer.from(js + `\n// ${Math.random()}`).toString('base64'))

// ---- 1. What Yuri is shown -------------------------------------------------

const MEMORY = read('src/lib/yuri/memory.ts')
/** A top-level declaration cut out of memory.ts, from its `export` to the line that closes it. */
function cut(start, end) {
  const i = MEMORY.indexOf(start)
  assert.ok(i >= 0, start)
  const j = MEMORY.indexOf(end, i)
  assert.ok(j > i, `end of ${start}`)
  return MEMORY.slice(i, j + end.length)
}
const view = await load(out([
  cut('export const GLASS_SKIN_DIMENSIONS', 'as const\n'),
  cut('export function scoreRange(', '\n}\n'),
  cut('export const GLASS_SKIN_SITTING_SPREAD_FACT', "'\n"),
  cut('export function glassSkinScorerOf(', '\n}\n'),
  cut('export const GLASS_SKIN_TWO_SCORERS_FACT', "'\n"),
  cut('export function glassSkinDayLine(', '\n}\n'),
].join('\n')))

// The member's real photos, newest first within each day, as the context holds them.
const NOV = [
  { overall: 61, luminosity: 66, smoothness: 58, clarity: 60, hydration: 64, evenness: 58 },
  { overall: 57, luminosity: 60, smoothness: 58, clarity: 48, hydration: 62, evenness: 55 },
]
const OCT = [
  { overall: 58, luminosity: 66, smoothness: 54, clarity: 52, hydration: 60, evenness: 55 },
  { overall: 61, luminosity: 70, smoothness: 54, clarity: 58, hydration: 63, evenness: 60 },
  { overall: 64, luminosity: 70, smoothness: 66, clarity: 68, hydration: 60, evenness: 58 },
]

test('EXECUTED: a day with several photos shows each score as a range, never one photo standing for the day', () => {
  assert.equal(view.scoreRange([58, 58]), '58')
  assert.equal(view.scoreRange([60, 48]), '48 to 60')
  assert.equal(view.scoreRange([52, 58, 68]), '52 to 68')
  const nov = view.glassSkinDayLine('2026-11-22', ' (most recent)', NOV)
  assert.equal(nov, '- **2026-11-22** (most recent): 2 photos, overall 57, 61/100 in the order taken (across the 2 photos: luminosity 60 to 66, smoothness 58, clarity 48 to 60, hydration 62 to 64, evenness 55 to 58)')
  const oct = view.glassSkinDayLine('2026-10-05', '', OCT)
  assert.equal(oct, '- **2026-10-05**: 3 photos, overall 64, 61, 58/100 in the order taken (across the 3 photos: luminosity 66 to 70, smoothness 54 to 66, clarity 52 to 68, hydration 60 to 63, evenness 55 to 60)')
  // What produced "clarity 60, up from 52" is no longer on the page: the two ranges overlap, and both show.
  assert.ok(nov.includes('clarity 48 to 60') && oct.includes('clarity 52 to 68'))
  assert.equal(nov.includes('latest of the day'), false)
  // One photo: its own five scores, in the same order, with no range.
  assert.equal(view.glassSkinDayLine('2026-07-28', ' (first)', [NOV[0]]), '- **2026-07-28** (first): 1 photo, overall 61/100 in the order taken (luminosity 66, smoothness 58, clarity 60, hydration 64, evenness 58)')
  assert.deepEqual([...view.GLASS_SKIN_DIMENSIONS], ['luminosity', 'smoothness', 'clarity', 'hydration', 'evenness'])
})

test('the measured spread is given as a fact: the whole sentence is held, so no clause can be added to it', () => {
  // Held WHOLE. A review added four different instructions to this sentence ("...smaller than
  // these is noise, not a change", "Treating a gap below these as progress would be wrong", "Yuri
  // reports such days as unchanged", "Please refrain from...") and a list of banned words let all
  // four through. Any change to these words is a change to what Yuri is told and needs a review.
  assert.equal(view.GLASS_SKIN_SITTING_SPREAD_FACT,
    'In the 7 sittings measured so far (November 2026, 4 members, mostly the earlier scorer), photos taken minutes apart differed on the overall score by about 3 points on average (6 at most); clarity about 6 (16 at most), evenness about 4 (10), smoothness about 4 (12), luminosity about 3 (6), hydration about 3 (5). Differences between days, with different light, were not measured.')
  assert.equal(view.GLASS_SKIN_TWO_SCORERS_FACT,
    "Each day says which scorer read it. Scorer 1 (photos before November 14 2026) was given the member's profile along with the photo; scorer 2 reads the photo alone. They are two different rulers.")
  // The note every score history carries, whole, from "Several photos" to its end: the spread
  // fact once, the two-scorers fact only when both are listed, and nothing after them but the
  // sentence that was already there.
  assert.ok(MEMORY.includes(" Several photos on one day are usually one sitting (retakes, angles, light). ${GLASS_SKIN_SITTING_SPREAD_FACT}${twoScorers ? ` ${GLASS_SKIN_TWO_SCORERS_FACT}` : ''} You see the scores, not the images.`\n"))
  assert.equal(MEMORY.split('GLASS_SKIN_SITTING_SPREAD_FACT').length - 1, 2, 'defined, used once')
  assert.equal(MEMORY.split('GLASS_SKIN_TWO_SCORERS_FACT').length - 1, 2, 'defined, used once')
  assert.ok(MEMORY.includes('      return glassSkinDayLine(d, tag, shots, twoScorers)\n'))
  assert.equal(MEMORY.split('glassSkinDayLine(').length - 1, 2, 'defined once, used once')
  assert.ok(MEMORY.includes('    const twoScorers = new Set(sorted.map((x) => x.scorer)).size > 1\n'))
  // Nothing else renders a single photo's scores as the day's.
  assert.equal(MEMORY.includes('latest of the day'), false)
  // A day cut by the loading window says so (only the nine most recent photos and the first are loaded).
  assert.ok(MEMORY.includes("` ${total} photos in total; ${total - listed} taken between the first day and the most recent ones are not listed, so the first day and the earliest of the recent days may each have had more photos than are shown here.` : ''"))
  // The scorer comes from the stored photo_quality, which the query now selects.
  assert.ok(MEMORY.includes("const GS_COLS = 'created_at, overall_score, luminosity_score, smoothness_score, clarity_score, hydration_score, evenness_score, photo_quality'"))
  assert.ok(MEMORY.includes('      scorer: glassSkinScorerOf(row.photo_quality),\n'))
})

test('EXECUTED: each day names its scorer when the list holds both, and a range uses every photo', () => {
  assert.equal(view.glassSkinScorerOf({ scorer_version: 2 }), 2)
  for (const none of [null, undefined, {}, { scorer_version: 'x' }, { scorer_version: 0 }, { confidence_modifier: 0.9 }]) assert.equal(view.glassSkinScorerOf(none), 1)
  const v2 = NOV.map((x) => ({ ...x, scorer: 2 }))
  const v1 = OCT.map((x) => ({ ...x, scorer: 1 }))
  assert.equal(view.glassSkinDayLine('2026-11-22', ' (most recent)', v2, true), '- **2026-11-22** (most recent): 2 photos, scorer 2, overall 57, 61/100 in the order taken (across the 2 photos: luminosity 60 to 66, smoothness 58, clarity 48 to 60, hydration 62 to 64, evenness 55 to 58)')
  assert.ok(view.glassSkinDayLine('2026-10-05', '', v1, true).startsWith('- **2026-10-05**: 3 photos, scorer 1, overall 64, 61, 58/100'))
  // Not shown when every listed photo was read by the same scorer: nothing to tell apart.
  assert.equal(view.glassSkinDayLine('2026-11-22', '', v2).includes('scorer'), false)
  // The range is over ALL the day's photos: the extreme can be the middle one.
  const mid = [{ ...NOV[0], clarity: 55 }, { ...NOV[0], clarity: 90 }, { ...NOV[0], clarity: 50 }]
  assert.ok(view.glassSkinDayLine('d', '', mid).includes('clarity 50 to 90'))
  const low = [{ ...NOV[0], clarity: 55 }, { ...NOV[0], clarity: 10 }, { ...NOV[0], clarity: 50 }]
  assert.ok(view.glassSkinDayLine('d', '', low).includes('clarity 10 to 55'))
})

// ---- 2. The grader -----------------------------------------------------------

const GRADER = read('src/lib/intelligence/nudge-outcome-grader.ts')
assert.deepEqual([...GRADER.matchAll(/^import [^\n]*$/gm)].map((m) => m[0]), ["import { getServiceClient } from '@/lib/supabase'"], 'the grader gained an import this file does not supply')

/** The real grader module, run against a recording stand-in for the database. */
async function runGrader({ nudges, scores, phases = [] }) {
  const writes = []
  const db = {
    from(table) {
      const q = { table, filters: {}, update: null }
      const api = {
        select: () => api, order: () => api,
        eq: (k, v) => { q.filters[k] = v; return api },
        is: (k, v) => { q.filters[k] = v; return api },
        in: (k, v) => { q.filters[k] = v; return api },
        update: (row) => { q.update = row; return api },
        then: (resolve) => {
          if (q.update) { writes.push({ id: q.filters.id, ...q.update }); return resolve({ error: null }) }
          if (table === 'ss_user_nudges') return resolve({ data: nudges, error: null })
          if (table === 'ss_glass_skin_scores') return resolve({ data: scores.filter((s) => s.user_id === q.filters.user_id).sort((a, b) => a.created_at.localeCompare(b.created_at)), error: null })
          if (table === 'ss_treatment_phases') return resolve({ data: phases, error: null })
          throw new Error('unexpected table ' + table)
        },
      }
      return api
    },
  }
  globalThis.__graderDb = db
  const mod = await load(out(GRADER.replace("import { getServiceClient } from '@/lib/supabase'", 'const getServiceClient = () => globalThis.__graderDb')))
  const result = await mod.gradeNudgeOutcomes()
  return { result, writes, mod }
}

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const iso = (ms) => new Date(ms).toISOString()
const photo = (id, ms, overall, extra = {}) => ({ id, user_id: 'u1', overall_score: overall, created_at: iso(ms), photo_quality: { confidence_modifier: 0.9, scorer_version: 2 }, treatment_phase_id: null, ...extra })
const ACTED = NOW - 40 * DAY
const nudge = { id: 'n1', user_id: 'u1', nudge_type: 'routine_check', acted_at: iso(ACTED) }
const B = ACTED - 2 * DAY      // the sitting before she acted
const F = ACTED + 20 * DAY     // the sitting after the routine had time to work

test('EXECUTED: a grade is made from the mean of each sitting, so photo order cannot decide it', async () => {
  // Before: 64, 61, 58 (mean 61). After: 64, 58, 60 (mean 60.7). The skin did not change.
  // On one photo each (the last before, the first after) this read 58 -> 64: "+6, helped".
  const scores = [photo('b1', B, 64), photo('b2', B + 30_000, 61), photo('b3', B + 80_000, 58), photo('f1', F, 64), photo('f2', F + 30_000, 58), photo('f3', F + 60_000, 60)]
  const { result, writes } = await runGrader({ nudges: [nudge], scores })
  assert.equal(writes.length, 1)
  assert.equal(writes[0].outcome_grade, 'no_change')
  assert.equal(writes[0].outcome_score_delta, 0)
  assert.match(writes[0].outcome_notes, /^Δ-0\.3 \(61→60\.7; mean of 3 photos before, 3 after\) over 20d\.$/)
  assert.deepEqual([writes[0].outcome_baseline_score_id, writes[0].outcome_followup_score_id], ['b3', 'f1'], 'the anchor photos are still recorded')
  assert.deepEqual([result.graded, result.helped, result.noChange, result.hurt], [1, 0, 1, 0])

  // The same sittings in a different order give the same grade.
  const shuffled = [photo('b1', B, 58), photo('b2', B + 30_000, 64), photo('b3', B + 80_000, 61), photo('f1', F, 58), photo('f2', F + 30_000, 60), photo('f3', F + 60_000, 64)]
  const again = await runGrader({ nudges: [nudge], scores: shuffled })
  assert.equal(again.writes[0].outcome_grade, 'no_change')
  assert.equal(again.writes[0].outcome_score_delta, 0)
})

test('EXECUTED: a real change between sittings is still graded, on the unrounded difference', async () => {
  // 58, 60 (mean 59) -> 66, 68 (mean 67): +8, helped.
  let r = await runGrader({ nudges: [nudge], scores: [photo('b1', B, 58), photo('b2', B + 20_000, 60), photo('f1', F, 66), photo('f2', F + 20_000, 68)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['helped', 8])
  // 66, 68 -> 58, 60: -8, hurt.
  r = await runGrader({ nudges: [nudge], scores: [photo('b1', B, 66), photo('b2', B + 20_000, 68), photo('f1', F, 58), photo('f2', F + 20_000, 60)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['hurt', -8])
  // 60 -> 63, 64 (mean 63.5): +3.5 is inside the band of 4, and is not rounded up into "helped".
  r = await runGrader({ nudges: [nudge], scores: [photo('b1', B, 60), photo('f1', F, 63), photo('f2', F + 20_000, 64)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['no_change', 4])
  assert.match(r.writes[0].outcome_notes, /^Δ\+3\.5 \(60→63\.5; mean of 1 photo before, 2 after\)/)
  // One photo on each side still grades as it always did.
  r = await runGrader({ nudges: [nudge], scores: [photo('b1', B, 60), photo('f1', F, 64)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['helped', 4])
})

test('EXECUTED: a sitting takes only its own usable photos', async () => {
  const { mod } = await runGrader({ nudges: [], scores: [] })
  const at = Date.parse('2026-11-22T20:36:00Z')
  const p = (offsetMs, overall, q = { confidence_modifier: 0.9, scorer_version: 2 }) => ({ overall_score: overall, created_at: iso(at + offsetMs), photo_quality: q })
  const anchor = p(0, 60)
  // 15 minutes: the longest sitting on record spans 11.
  assert.equal(mod.SITTING_WINDOW_MS, 15 * 60 * 1000)
  // Within the window either side: in. Beyond: another reading, out.
  assert.deepEqual(mod.sittingMean([anchor, p(-26_000, 48), p(14 * 60_000, 54), p(16 * 60_000, 99), p(-16 * 60_000, 1)], anchor, {}), { mean: 54, photos: 3 })
  // The edges, exactly: at the window it is in, one millisecond past it is out.
  assert.deepEqual(mod.sittingMean([anchor, p(15 * 60_000, 80)], anchor, {}), { mean: 70, photos: 2 })
  assert.deepEqual(mod.sittingMean([anchor, p(15 * 60_000 + 1, 80)], anchor, {}), { mean: 60, photos: 1 })
  assert.deepEqual(mod.sittingMean([anchor, p(-15 * 60_000, 80)], anchor, {}), { mean: 70, photos: 2 })
  // Confidence exactly at the floor is usable; just under it is not.
  assert.deepEqual(mod.sittingMean([anchor, p(5_000, 80, { confidence_modifier: 0.85, scorer_version: 2 })], anchor, {}), { mean: 70, photos: 2 })
  assert.deepEqual(mod.sittingMean([anchor, p(5_000, 80, { confidence_modifier: 0.849, scorer_version: 2 })], anchor, {}), { mean: 60, photos: 1 })
  // The side bounds, exactly: a photo AT the bound is in, one millisecond over is out.
  assert.deepEqual(mod.sittingMean([anchor, p(60_000, 80)], anchor, { notAfterMs: at + 60_000 }), { mean: 70, photos: 2 })
  assert.deepEqual(mod.sittingMean([anchor, p(60_000, 80)], anchor, { notAfterMs: at + 59_999 }), { mean: 60, photos: 1 })
  assert.deepEqual(mod.sittingMean([anchor, p(-60_000, 80)], anchor, { notBeforeMs: at - 60_000 }), { mean: 70, photos: 2 })
  assert.deepEqual(mod.sittingMean([anchor, p(-60_000, 80)], anchor, { notBeforeMs: at - 59_999 }), { mean: 60, photos: 1 })
  // A low-confidence photo is left out of the mean; a photo from another scorer is a different ruler.
  assert.deepEqual(mod.sittingMean([anchor, p(10_000, 20, { confidence_modifier: 0.5, scorer_version: 2 }), p(20_000, 90, { confidence_modifier: 0.9, scorer_version: 1 })], anchor, {}), { mean: 60, photos: 1 })
  // A photo with no quality record counts as usable, as it did before, and as scorer 1.
  const old = p(0, 50, null)
  assert.deepEqual(mod.sittingMean([old, p(5_000, 60, null)], old, {}), { mean: 55, photos: 2 })
  // The sides do not leak: nothing after she acted in the baseline, nothing too early in the follow-up.
  assert.deepEqual(mod.sittingMean([anchor, p(60_000, 90)], anchor, { notAfterMs: at + 30_000 }), { mean: 60, photos: 1 })
  assert.deepEqual(mod.sittingMean([anchor, p(-60_000, 10)], anchor, { notBeforeMs: at - 30_000 }), { mean: 60, photos: 1 })
  // Nothing usable: no number at all, never a zero.
  assert.equal(mod.sittingMean([p(0, 60, { confidence_modifier: 0.5 })], p(0, 60, { confidence_modifier: 0.5 }), {}), null)
})

test('EXECUTED: the grader itself keeps each sitting on its own side of the nudge', async () => {
  // She photographs, acts on the nudge a minute later, then photographs again four minutes after
  // that: one sitting by the clock, but the second photo is AFTER she acted and is not baseline.
  const acted = NOW - 40 * DAY
  const n = { ...nudge, acted_at: iso(acted) }
  let r = await runGrader({ nudges: [n], scores: [photo('b1', acted - 60_000, 60), photo('x1', acted + 4 * 60_000, 90), photo('f1', acted + 20 * DAY, 60)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['no_change', 0], 'a photo taken after she acted must not raise the baseline')
  assert.match(r.writes[0].outcome_notes, /mean of 1 photo before, 1 after/)
  // The follow-up sitting straddles the 14-day line: the photo just before it is not follow-up.
  const line = acted + 14 * DAY
  r = await runGrader({ nudges: [n], scores: [photo('b1', acted - 60_000, 60), photo('early', line - 2 * 60_000, 20), photo('f1', line + 60_000, 60)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['no_change', 0], 'a photo from before the routine had time to work must not lower the follow-up')
  assert.match(r.writes[0].outcome_notes, /mean of 1 photo before, 1 after/)
  // Two separate uploads 25 minutes apart are not one sitting.
  r = await runGrader({ nudges: [n], scores: [photo('old', acted - 2 * DAY - 25 * 60_000, 20), photo('b1', acted - 2 * DAY, 60), photo('f1', acted + 20 * DAY, 60), photo('later', acted + 20 * DAY + 25 * 60_000, 99)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['no_change', 0])
})

test('EXECUTED: the gates that abstain still abstain', async () => {
  // Both photos of the follow-up sitting are low-confidence: not gradeable.
  let r = await runGrader({ nudges: [nudge], scores: [photo('b1', B, 60), photo('f1', F, 70, { photo_quality: { confidence_modifier: 0.5, scorer_version: 2 } }), photo('f2', F + 20_000, 72, { photo_quality: { confidence_modifier: 0.6, scorer_version: 2 } })] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['insufficient_data', null])
  // The anchor is low-confidence but its retake is good: the retake is what is graded.
  r = await runGrader({ nudges: [nudge], scores: [photo('b1', B, 60), photo('f1', F, 40, { photo_quality: { confidence_modifier: 0.5, scorer_version: 2 } }), photo('f2', F + 20_000, 68)] })
  assert.deepEqual([r.writes[0].outcome_grade, r.writes[0].outcome_score_delta], ['helped', 8])
  // Different scorers before and after: a change of ruler.
  r = await runGrader({ nudges: [nudge], scores: [photo('b1', B, 60, { photo_quality: { confidence_modifier: 0.9, scorer_version: 1 } }), photo('f1', F, 70)] })
  assert.equal(r.writes[0].outcome_grade, 'insufficient_data')
  // No baseline at all.
  r = await runGrader({ nudges: [nudge], scores: [photo('f1', F, 70)] })
  assert.equal(r.writes[0].outcome_grade, 'insufficient_data')
  // Not yet two weeks since she acted: left pending, nothing written.
  r = await runGrader({ nudges: [{ ...nudge, acted_at: iso(NOW - 5 * DAY) }], scores: [photo('b1', NOW - 6 * DAY, 60), photo('f1', NOW - DAY, 70)] })
  assert.equal(r.writes.length, 0)
  assert.equal(r.result.stillPending, 1)
})
