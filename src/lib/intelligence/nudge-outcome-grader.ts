/**
 * v10.11.0 — Nudge Outcome Teacher (measured skin-result grading).
 *
 * Upgrades the nudge learning loop from a soft teacher (engagement: acted/
 * dismissed) to a MEASURED one: did the user's Glass Skin Score move in the weeks
 * after she ACTED on a nudge. Pure deterministic measurement — NO AI. AI here
 * would only add gameable subjectivity; abstention must be honest, not an opinion.
 *
 * Read NUDGE-OUTCOME-TEACHER-BLUEPRINT.md for the full reasoning. The three traps
 * this guards against:
 *   - Sparsity: most nudges won't have bracketing scores → abstain, never fabricate.
 *   - Correlation≠causation: only ACTED nudges, phase-consistent, noise-banded.
 *   - Confounded measurement: low-confidence photos (photo_quality) aren't gradeable.
 *
 * The outcome grade LAYERS ON TOP of engagement (status); it does not replace it.
 */

import { getServiceClient } from '@/lib/supabase'

export type OutcomeGrade = 'helped' | 'no_change' | 'hurt' | 'insufficient_data'

export interface GraderResult {
  scanned: number
  graded: number
  helped: number
  noChange: number
  hurt: number
  insufficientData: number
  stillPending: number
  errors: number
  tableMissing: boolean
}

// Days after acting before we attempt a grade (give the routine time to work).
const MATURITY_DAYS = 14
// Days after acting beyond which, with still no follow-up score, we stop waiting
// and mark insufficient_data (the follow-up is never coming).
const ABANDON_CEILING_DAYS = 60
// Photo-quality confidence floor: below this, score movement is measurement noise.
const CONFIDENCE_FLOOR = 0.85
// Delta band: within ±this is biological/photo noise, not a real change.
const NOISE_BAND = 4
// Photos taken this close together are one SITTING: retakes, angles, light.
// 15 minutes: the longest sitting on record spans 11 (656 s). Wider than that
// would average a bare-face photo with one taken after a product went on.
//
// Measured Nov 22 2026 on all 7 sittings that had more than one photo (16
// photos, 4 members): the overall score differed between photos of the same
// sitting by 2.7 points on average and by up to 6. In 3 of the 7 the gap was 4
// or more, which is the whole noise band, so a grade made from one photo on
// each side could be decided by which photo was taken last. A sitting is graded
// by the MEAN of its usable photos.
//
// What this does NOT settle: the sample is small and uneven (6 of the 7 were
// the earlier scorer, 3 from one member, several under the confidence floor),
// and it measures minutes apart, not days. NOISE_BAND = 4 was chosen for single
// photos and has not been re-derived for means or for the current scorer; with
// one usable current-scorer sitting on record there is nothing to derive it
// from yet. (No helped/hurt grade had been written when this changed: all 6
// graded rows were insufficient_data.)
export const SITTING_WINDOW_MS = 15 * 60 * 1000

export interface SittingMean {
  mean: number
  photos: number
}

/**
 * The mean overall score of the sitting an anchor photo belongs to: the photos
 * within SITTING_WINDOW_MS of it, on the allowed side of the nudge, scored by
 * the same scorer, and not flagged low-confidence. null when no photo in the
 * sitting can be used (the anchor itself was low-confidence and it had no
 * usable companion).
 *
 * `side` keeps the two sittings apart: a baseline sitting never includes a
 * photo taken after the member acted, and a follow-up sitting never includes
 * one taken before the routine had time to work.
 *
 * A low-confidence photo is left out of the mean, where the grader used to
 * abstain if either single photo was low-confidence. So a blurry first shot
 * with a clear retake beside it is now graded on the retake. A sitting with
 * nothing usable still abstains, even when an earlier good sitting exists: the
 * anchor is the photo nearest the nudge, and reaching past it for a better one
 * would be choosing the evidence.
 */
export function sittingMean(
  rows: Array<{ overall_score: number; created_at: string; photo_quality: { confidence_modifier?: number; scorer_version?: number } | null }>,
  anchor: { created_at: string; photo_quality: { confidence_modifier?: number; scorer_version?: number } | null },
  side: { notAfterMs?: number; notBeforeMs?: number },
  confidenceFloor: number = CONFIDENCE_FLOOR
): SittingMean | null {
  const at = new Date(anchor.created_at).getTime()
  const version = scorerVersionOf(anchor)
  const used = rows.filter((r) => {
    const t = new Date(r.created_at).getTime()
    if (Math.abs(t - at) > SITTING_WINDOW_MS) return false
    if (side.notAfterMs !== undefined && t > side.notAfterMs) return false
    if (side.notBeforeMs !== undefined && t < side.notBeforeMs) return false
    if (scorerVersionOf(r) !== version) return false
    const c = r.photo_quality?.confidence_modifier
    return (typeof c === 'number' ? c : 1.0) >= confidenceFloor
  })
  if (used.length === 0) return null
  return { mean: used.reduce((sum, r) => sum + r.overall_score, 0) / used.length, photos: used.length }
}

interface ScoreRow {
  id: string
  overall_score: number
  created_at: string
  photo_quality: { confidence_modifier?: number; scorer_version?: number } | null
  treatment_phase_id: string | null
}

/** 1 = scored with the profile in the prompt (before Nov 14 2026); 2 = from the photo alone. */
export function scorerVersionOf(score: { photo_quality: { scorer_version?: number } | null }): number {
  const v = score.photo_quality?.scorer_version
  return typeof v === 'number' && v >= 1 ? v : 1
}

interface NudgeRow {
  id: string
  user_id: string
  nudge_type: string
  acted_at: string | null
}

function isMissingColumn(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  return (
    err.code === '42703' || // undefined_column
    err.code === '42P01' || // undefined_table
    !!err.message?.toLowerCase().includes('does not exist') ||
    !!err.message?.toLowerCase().includes('could not find')
  )
}

async function gradeOne(
  db: ReturnType<typeof getServiceClient>,
  nudge: NudgeRow,
  nowMs: number
): Promise<OutcomeGrade | 'pending'> {
  if (!nudge.acted_at) return 'pending'
  const actedMs = new Date(nudge.acted_at).getTime()
  const ageDays = (nowMs - actedMs) / (1000 * 60 * 60 * 24)

  // 1. Maturity gate — too soon to judge.
  if (ageDays < MATURITY_DAYS) return 'pending'

  // Load this user's scores (sparse — fine to pull all).
  const { data: scores, error } = await db
    .from('ss_glass_skin_scores')
    .select('id, overall_score, created_at, photo_quality, treatment_phase_id')
    .eq('user_id', nudge.user_id)
    .order('created_at', { ascending: true })

  if (error) throw error
  const rows = (scores ?? []) as ScoreRow[]

  // 2. Baseline — latest score at or before acted_at.
  const baseline = [...rows]
    .filter((s) => new Date(s.created_at).getTime() <= actedMs)
    .pop()
  if (!baseline) {
    return await writeGrade(db, nudge.id, 'insufficient_data', null, null, null, 'No baseline Glass Skin Score at or before the nudge.')
  }

  // 3. Follow-up — earliest score >= MATURITY_DAYS after acted_at.
  const followupThresholdMs = actedMs + MATURITY_DAYS * 24 * 60 * 60 * 1000
  const followup = rows.find((s) => new Date(s.created_at).getTime() >= followupThresholdMs)
  if (!followup) {
    // No follow-up yet. Keep waiting unless we've passed the abandon ceiling.
    if (ageDays >= ABANDON_CEILING_DAYS) {
      return await writeGrade(db, nudge.id, 'insufficient_data', null, baseline.id, null, `No follow-up score within ${ABANDON_CEILING_DAYS} days of acting.`)
    }
    return 'pending'
  }

  // 3b. Same instrument. A baseline from one scorer and a follow-up from
  // another is a change of ruler, not a change of skin.
  if (scorerVersionOf(baseline) !== scorerVersionOf(followup)) {
    return await writeGrade(db, nudge.id, 'insufficient_data', null, baseline.id, followup.id, `Baseline and follow-up were scored by different scorer versions (${scorerVersionOf(baseline)} and ${scorerVersionOf(followup)}); not comparable.`)
  }

  // 4. Confidence gate — a sitting with no usable photo → not gradeable. Each
  //    side is the MEAN of its sitting's usable photos, not one photo (see
  //    SITTING_WINDOW_MS). A low-confidence photo is left out of the mean; if
  //    that leaves a side empty, there is nothing reliable to compare.
  const before = sittingMean(rows, baseline, { notAfterMs: actedMs })
  const after = sittingMean(rows, followup, { notBeforeMs: followupThresholdMs })
  if (!before || !after) {
    return await writeGrade(db, nudge.id, 'insufficient_data', null, baseline.id, followup.id, 'Low-confidence photo on baseline or follow-up; movement not reliable.')
  }

  // 5. Phase gate — follow-up must not be from an EARLIER phase than baseline
  //    (regression/abandonment isn't a fair grade of the nudge). We compare phase
  //    numbers via the phases table; if either lacks a phase link, skip the gate
  //    (can't prove regression, so don't penalize).
  if (baseline.treatment_phase_id && followup.treatment_phase_id && baseline.treatment_phase_id !== followup.treatment_phase_id) {
    const { data: phaseRows } = await db
      .from('ss_treatment_phases')
      .select('id, phase_number')
      .in('id', [baseline.treatment_phase_id, followup.treatment_phase_id])
    const phaseNum = new Map((phaseRows ?? []).map((p) => [p.id, p.phase_number as number]))
    const bNum = phaseNum.get(baseline.treatment_phase_id)
    const fNum = phaseNum.get(followup.treatment_phase_id)
    if (typeof bNum === 'number' && typeof fNum === 'number' && fNum < bNum) {
      return await writeGrade(db, nudge.id, 'insufficient_data', null, baseline.id, followup.id, `Phase regressed (Phase ${bNum} → ${fNum}); not a fair grade.`)
    }
  }

  // 6. Grade the change between the two sittings' means against the noise band.
  //    The grade is decided on the unrounded difference; the stored delta is a
  //    whole number (the column is an integer) and the note carries the means.
  const change = after.mean - before.mean
  const delta = Math.round(change) || 0 // never -0
  const grade: OutcomeGrade = change >= NOISE_BAND ? 'helped' : change <= -NOISE_BAND ? 'hurt' : 'no_change'
  const one = (n: number) => (Math.round(n * 10) / 10).toString()
  const note = `Δ${change >= 0 ? '+' : ''}${one(change)} (${one(before.mean)}→${one(after.mean)}; mean of ${before.photos} photo${before.photos === 1 ? '' : 's'} before, ${after.photos} after) over ${Math.round((new Date(followup.created_at).getTime() - actedMs) / (1000 * 60 * 60 * 24))}d.`
  return await writeGrade(db, nudge.id, grade, delta, baseline.id, followup.id, note)
}

async function writeGrade(
  db: ReturnType<typeof getServiceClient>,
  nudgeId: string,
  grade: OutcomeGrade,
  delta: number | null,
  baselineId: string | null,
  followupId: string | null,
  notes: string
): Promise<OutcomeGrade> {
  const { error } = await db
    .from('ss_user_nudges')
    .update({
      outcome_grade: grade,
      outcome_score_delta: delta,
      outcome_baseline_score_id: baselineId,
      outcome_followup_score_id: followupId,
      outcome_graded_at: new Date().toISOString(),
      outcome_notes: notes,
    })
    .eq('id', nudgeId)
  if (error) throw error
  return grade
}

export async function gradeNudgeOutcomes(): Promise<GraderResult> {
  const db = getServiceClient()
  const result: GraderResult = {
    scanned: 0, graded: 0, helped: 0, noChange: 0, hurt: 0,
    insufficientData: 0, stillPending: 0, errors: 0, tableMissing: false,
  }

  // Acted nudges not yet outcome-graded.
  const { data: nudges, error } = await db
    .from('ss_user_nudges')
    .select('id, user_id, nudge_type, acted_at')
    .eq('status', 'acted')
    .is('outcome_grade', null)

  if (error) {
    if (isMissingColumn(error)) {
      result.tableMissing = true
      console.warn('[nudge-outcome-grader] outcome columns not applied yet — no-op')
      return result
    }
    console.error('[nudge-outcome-grader] scan failed:', error.message)
    result.errors++
    return result
  }

  const nowMs = Date.now()
  for (const n of (nudges ?? []) as NudgeRow[]) {
    result.scanned++
    try {
      const outcome = await gradeOne(db, n, nowMs)
      if (outcome === 'pending') {
        result.stillPending++
      } else {
        result.graded++
        if (outcome === 'helped') result.helped++
        else if (outcome === 'no_change') result.noChange++
        else if (outcome === 'hurt') result.hurt++
        else result.insufficientData++
      }
    } catch (err) {
      const e = err as { message?: string; code?: string }
      if (isMissingColumn(e)) {
        result.tableMissing = true
        return result
      }
      result.errors++
      console.error(`[nudge-outcome-grader] failed for nudge ${n.id}:`, e.message ?? err)
    }
  }

  return result
}

/**
 * Calibration read (Pillar C) — per nudge_type, the historical helped-rate among
 * GRADED outcomes. Used by the eligibility/message layer to discount
 * underperforming nudge types. Conservative: a type with fewer than MIN_SAMPLE
 * graded outcomes returns null (don't learn from n=1). Abstentions
 * (insufficient_data) are excluded from the rate — they're not evidence either way.
 */
const MIN_SAMPLE = 5

export interface NudgeTypePerformance {
  nudgeType: string
  gradedCount: number
  helpedRate: number | null // null when below MIN_SAMPLE
}

export async function getNudgeTypePerformance(): Promise<Record<string, NudgeTypePerformance>> {
  const db = getServiceClient()
  const out: Record<string, NudgeTypePerformance> = {}
  try {
    const { data, error } = await db
      .from('ss_user_nudges')
      .select('nudge_type, outcome_grade')
      .in('outcome_grade', ['helped', 'no_change', 'hurt']) // exclude insufficient_data + pending
    if (error) return out

    const agg = new Map<string, { total: number; helped: number }>()
    for (const r of data ?? []) {
      const t = r.nudge_type as string
      const a = agg.get(t) ?? { total: 0, helped: 0 }
      a.total++
      if (r.outcome_grade === 'helped') a.helped++
      agg.set(t, a)
    }
    for (const [nudgeType, a] of agg) {
      out[nudgeType] = {
        nudgeType,
        gradedCount: a.total,
        helpedRate: a.total >= MIN_SAMPLE ? a.helped / a.total : null,
      }
    }
  } catch {
    // Non-critical — calibration absent just means no discounting.
  }
  return out
}
