/**
 * The weekly check-in's memory context (Nov 7 2026).
 *
 * The judge used to receive Yuri's FULL chat memory (formatContextForPrompt:
 * every conversation summary, recent excerpts, product inventory, ingredient
 * stacking, community insights, specialist notes). Measured ~16.4K input tokens
 * per judgment. A check-in decides one thing ("is there something timely about
 * their skin this week?"), so it gets only what that decision needs:
 *   - skin profile + medical history, current routine, Glass Skin photo dates,
 *     reactions/allergies, cycle phase when tracked (rendered by the SAME
 *     formatter as chat, closed-world allowlist of sections, so the ownership
 *     and provenance hedges are identical to chat)
 *   - their most recent conversation summary (what the plan is right now)
 *   - decision memory: open loops, decisions, preferences, recent corrections,
 *     all with dates (commitments are rendered beside the shelf instead)
 * The shelf with dates, last-contact, prior check-ins and outcomes, the
 * forecast and trial status are added by loadCheckinFacts.
 *
 * Nothing here judges. It selects and renders facts; Yuri decides.
 * The content guard is NOT fed from this: it still reads their own messages
 * and the full decision memory (loadGuardEvidence), so trimming the judge's
 * context cannot starve the second reader.
 */

import type { DecisionMemory, UserContext } from '@/lib/yuri/memory'
import { isOpenLoop } from '@/lib/yuri/memory'

/**
 * Sections of formatContextForPrompt the check-in keeps. Closed world: a
 * section added to the chat formatter later is NOT picked up here until it is
 * listed, so the judge's context cannot silently grow back.
 */
export const CHECKIN_MEMORY_SECTIONS = [
  "## User's Skin Profile",
  '## Medical History',
  '## Current Routine Products',
  '## Glass Skin Score History',
  '## Holy Grail Products',
  '## Products That Caused Reactions',
  '## IMPORTANT: Things their skin reacted badly to',
  '## Menstrual Cycle Phase',
] as const

/** Corrections older than this are left out (they are product facts, mostly for chat). */
export const CHECKIN_CORRECTION_DAYS = 120

/** Keep only allowlisted top-level sections of a rendered chat context. Pure. */
export function keepCheckinSections(rendered: string): string {
  return rendered
    .split(/\n\n(?=## )/)
    .filter((sec) => CHECKIN_MEMORY_SECTIONS.some((h) => sec.startsWith(h)))
    .join('\n\n')
}

const day = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : null)

/** Decision memory as dated facts, no chat tool instructions. Pure. */
export function renderCheckinDecisionMemory(dm: DecisionMemory | null, todayIso: string): string {
  if (!dm) return ''
  const parts: string[] = []

  const loops = (dm.open_loops ?? []).filter(isOpenLoop)
  if (loops.length) {
    parts.push(
      `### Open loops (things you left unresolved)\n` +
        loops
          .map((l) => `- ${l.topic}: ${l.summary} (opened ${day(l.opened_date) ?? 'date unknown'}${l.check_back_date ? `; you said you'd check back ${day(l.check_back_date)}` : ''})`)
          .join('\n')
    )
  }
  // Commitments are NOT rendered here: loadCheckinFacts lists them beside the
  // shelf on purpose ("I'll pick up X" is a pending purchase the shelf may
  // already list as owned), and rendering them twice only costs tokens.
  if (dm.decisions?.length) {
    parts.push(
      `### Decisions you made together (a correction below about the same product or fact outranks a decision)\n` +
        dm.decisions.map((d) => `- ${d.topic}: ${d.decision} (decided ${day(d.date) ?? 'date unknown'})`).join('\n')
    )
  }
  if (dm.preferences?.length) {
    parts.push(`### Their stated preferences\n` + dm.preferences.map((p) => `- ${p.topic}: ${p.preference}${p.date ? ` (stated ${day(p.date)})` : ''}`).join('\n'))
  }
  const cutoff = new Date(new Date(`${todayIso}T00:00:00Z`).getTime() - CHECKIN_CORRECTION_DAYS * 86400000).toISOString().slice(0, 10)
  const corrections = dm.corrections ?? []
  const recent = corrections.filter((c) => (day(c.date) ?? '') >= cutoff)
  if (recent.length) {
    const older = corrections.length - recent.length
    parts.push(
      `### Things they corrected you on (last ${CHECKIN_CORRECTION_DAYS} days; their word is ground truth)${older > 0 ? `\n${older} older correction(s) exist and are not listed here.` : ''}\n` +
        recent.map((c) => `- ${c.topic} (${day(c.date) ?? 'date unknown'}): ${c.truth}`).join('\n')
    )
  }
  return parts.length ? `## Your structured memory of them\n${parts.join('\n\n')}` : ''
}

/** The newest conversation summary (any type), with its date. Pure. */
export function renderLatestConversation(convs: UserContext['recentConversations']): string {
  const withSummary = convs.filter((c) => c.aiSummary)
  if (!withSummary.length) return ''
  const latest = [...withSummary].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0]
  const older = withSummary.length - 1
  return (
    `## Your most recent conversation with them (${day(latest.timestamp) ?? 'date unknown'}${latest.title ? `, "${latest.title}"` : ''}): your summary\n${latest.aiSummary}` +
    (older > 0 ? `\n\n(${older} earlier conversation summary(ies) exist and are not included here.)` : '')
  )
}

/**
 * The check-in's memory block. `format` is formatContextForPrompt (injected so
 * the selection logic is testable without the database layer).
 */
export function buildCheckinMemory(ctx: UserContext, todayIso: string, format: (c: UserContext) => string): string {
  // Feed the formatter only the fields the allowlisted sections read; the rest
  // are emptied so nothing large is rendered and thrown away.
  const reduced: UserContext = {
    ...ctx,
    recentConversations: [],
    recentExcerpts: [],
    userProducts: [],
    learningInsights: [],
    specialistInsights: [],
    ingredientOverlap: null,
    decisionMemory: null,
  }
  return [keepCheckinSections(format(reduced)), renderLatestConversation(ctx.recentConversations), renderCheckinDecisionMemory(ctx.decisionMemory, todayIso)]
    .filter(Boolean)
    .join('\n\n')
}

export interface TrialInfo {
  /** When the free trial started (ISO). */
  startedAt: string
  /** When it ends (ISO), if Stripe told us. */
  endsAt: string | null
}

/**
 * Trial start for a 'trialing' subscription row. Stripe's current_period_start
 * IS the trial start while trialing; created_at is the fallback for rows written
 * without it. Null when the row is not trialing. Pure.
 */
export function trialInfoFromSubscription(
  row: { status: string | null; current_period_start?: string | null; created_at?: string | null; trial_end?: string | null } | null | undefined
): TrialInfo | null {
  if (!row || row.status !== 'trialing') return null
  const startedAt = row.current_period_start || row.created_at || null
  if (!startedAt) return null
  return { startedAt, endsAt: row.trial_end ?? null }
}
