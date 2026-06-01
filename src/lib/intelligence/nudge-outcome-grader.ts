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

interface ScoreRow {
  id: string
  overall_score: number
  created_at: string
  photo_quality: { confidence_modifier?: number } | null
  treatment_phase_id: string | null
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

function confidenceOf(score: ScoreRow): number {
  const c = score.photo_quality?.confidence_modifier
  // No photo_quality recorded (older scores) → treat as acceptable (1.0). We only
  // penalize scores explicitly flagged low-confidence; we don't punish absence.
  return typeof c === 'number' ? c : 1.0
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

  // 4. Confidence gate — either score low-confidence → not gradeable.
  if (confidenceOf(baseline) < CONFIDENCE_FLOOR || confidenceOf(followup) < CONFIDENCE_FLOOR) {
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

  // 6. Grade the delta against the noise band.
  const delta = followup.overall_score - baseline.overall_score
  const grade: OutcomeGrade = delta >= NOISE_BAND ? 'helped' : delta <= -NOISE_BAND ? 'hurt' : 'no_change'
  const note = `Δ${delta >= 0 ? '+' : ''}${delta} (${baseline.overall_score}→${followup.overall_score}) over ${Math.round((new Date(followup.created_at).getTime() - actedMs) / (1000 * 60 * 60 * 24))}d.`
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
