/**
 * Cumulative give — what Yuri has ALREADY handed this visitor.
 *
 * See WIDGET-CUMULATIVE-GIVE-BLUEPRINT.md for the full rationale.
 *
 * The problem this solves: the preview's gate ("the complete build is subscriber
 * work") is a CUMULATIVE boundary, but Yuri only ever sees one turn at a time.
 * In a real 14-message test she delivered a full AM/PM routine, a weekly
 * rotation, a shelf audit, three priced picks, and a conflict-check — no single
 * reply crossed the line, but the sum was the entire subscriber deliverable. She
 * was asked to hold a boundary she had no instrument to measure.
 *
 * This module is that instrument. It reads Yuri's OWN ALREADY-SENT replies and
 * reports which artifacts of the complete build have appeared. The result is
 * injected as a FACT into her next turn's context.
 *
 * What this is NOT, and must never become:
 *   - a content filter (nothing here blocks, truncates, or rewrites output)
 *   - a hard cap (no "after N artifacts, refuse")
 *   - a check on drafts before sending (it only ever looks backwards)
 * It observes and reports. What to do about it is Yuri's judgment, every time.
 * A false positive costs at most a slightly conservative note she is free to
 * disregard — it can never suppress an answer.
 */

/** The artifacts the system prompt's gate names as "the complete build". */
export type GiveArtifact =
  | 'am_pm_routine'
  | 'weekly_schedule'
  | 'slot_picks'
  | 'lineup_conflict_check'
  | 'shelf_audit'

export const GIVE_ARTIFACT_COUNT = 5

/** Human-readable phrasing, used verbatim in the injected fact. */
const ARTIFACT_LABEL: Record<GiveArtifact, string> = {
  am_pm_routine: 'a full AM/PM routine',
  weekly_schedule: 'a weekly rotation or multi-week introduction schedule',
  slot_picks: 'specific product picks for multiple routine slots',
  lineup_conflict_check: 'a conflict-check of their existing lineup',
  shelf_audit: 'a keep/cut/add audit of their shelf',
}

/**
 * Detection notes: these patterns are deliberately conservative — they look for
 * the STRUCTURAL shape of a delivered artifact (an AM block AND a PM block; a
 * per-night rotation; explicit keep-vs-cut framing), not for topic keywords.
 * Merely discussing sunscreen must not count as delivering a routine.
 */

// A routine is delivered when BOTH halves of the day are laid out as steps.
const AM_BLOCK = /\b(?:AM|morning)\b[^\n]{0,80}(?::|—|-|→)/i
const PM_BLOCK = /\b(?:PM|night|evening|nightly)\b[^\n]{0,80}(?::|—|-|→)/i
// Step sequencing: "cleanse → toner → sunscreen"
const STEP_ARROWS = /(?:→|->)[^\n]*(?:→|->)/

// A schedule: named nights, or explicit weekly frequency, or a staged rollout.
const NIGHT_ROTATION = /\bnight\s*(?:a|b|c|1|2|3)\b/i
const WEEKLY_FREQUENCY = /\b\d\s*(?:x|times)\s*(?:\/|\s*per\s*|a\s*)?(?:wk|week)\b/i
const STAGED_ROLLOUT = /\b(?:two\s+weeks?|2\s*weeks?)\s+apart\b|\bone\s+(?:new\s+)?active\s+at\s+a\s+time\b/i

// Picks for slots: multiple distinct priced/named recommendations.
const PRICE_TOKEN = /\$\d/g

// Conflict checking across their lineup.
const CONFLICT_LANGUAGE =
  /\b(?:same job|do(?:ing)? the same|redundant|duplicat|don'?t (?:need|use) both|collide|stack(?:ing)? (?:two|both)|overlap)\b/i

// Keep / cut / add scorecard.
const KEEP_CUT_ADD =
  /\b(?:keep(?:ers?)?\s*(?:as-is)?\b[^\n]{0,40}\b(?:cut|drop|add)|cut back|keep\/cut\/add|scorecard)\b/i

/** Count distinct `$nn` price mentions in one reply. */
function pricedPickCount(text: string): number {
  const matches = text.match(PRICE_TOKEN)
  return matches ? matches.length : 0
}

/**
 * Which artifacts appear in a SINGLE assistant reply.
 * Exported for testing; callers should use detectCumulativeGive().
 */
export function detectArtifactsInReply(text: string): Set<GiveArtifact> {
  const found = new Set<GiveArtifact>()
  if (!text) return found

  // Full routine: both halves of the day laid out, or explicit step sequencing
  // present alongside at least one labelled half.
  const hasAm = AM_BLOCK.test(text)
  const hasPm = PM_BLOCK.test(text)
  if ((hasAm && hasPm) || ((hasAm || hasPm) && STEP_ARROWS.test(text))) {
    found.add('am_pm_routine')
  }

  if (NIGHT_ROTATION.test(text) || WEEKLY_FREQUENCY.test(text) || STAGED_ROLLOUT.test(text)) {
    found.add('weekly_schedule')
  }

  // Two or more priced recommendations in one reply = picks for multiple slots.
  if (pricedPickCount(text) >= 2) {
    found.add('slot_picks')
  }

  if (CONFLICT_LANGUAGE.test(text)) {
    found.add('lineup_conflict_check')
  }

  if (KEEP_CUT_ADD.test(text)) {
    found.add('shelf_audit')
  }

  return found
}

export interface CumulativeGive {
  artifacts: GiveArtifact[]
  count: number
  /** Human phrasing of what's been delivered, for prompt injection. */
  labels: string[]
}

/**
 * Aggregate across every assistant reply so far in this conversation.
 * Only assistant turns are read — the visitor describing their own routine
 * must never count as Yuri having delivered one.
 */
export function detectCumulativeGive(
  history: Array<{ role: string; content: string }>
): CumulativeGive {
  const all = new Set<GiveArtifact>()
  for (const turn of history) {
    if (turn.role !== 'assistant') continue
    for (const a of detectArtifactsInReply(turn.content || '')) all.add(a)
  }
  const artifacts = Array.from(all)
  return {
    artifacts,
    count: artifacts.length,
    labels: artifacts.map((a) => ARTIFACT_LABEL[a]),
  }
}

/**
 * The fact block injected into Yuri's per-turn context.
 *
 * Returns null when nothing substantial has been given yet — an empty state is
 * noise, and every string added to the per-turn context costs tokens.
 *
 * Deliberately ends by handing the decision back. No instruction to refuse,
 * deflect, or upsell appears anywhere in it: the intervention is visibility,
 * and the response is hers.
 */
export function buildCumulativeGiveBlock(give: CumulativeGive): string | null {
  if (give.count < 2) return null

  const list = give.labels.join(', ')
  const mostOfIt = give.count >= 4

  return `\n\n## What You've Already Given This Visitor (facts, not instructions)
Across your earlier replies in this conversation you have already delivered ${give.count} of the ${GIVE_ARTIFACT_COUNT} things the complete build is made of: ${list}.${
    mostOfIt
      ? ' That is most of the subscriber deliverable, already handed over.'
      : ''
  }
This is a cumulative count you cannot see by reading any single reply — that is why it is here. It is context for your judgment, not a rule and not a cap: sometimes the honest answer to their question genuinely needs another piece of the build, and you are the one who decides that. Nothing here asks you to withhold help, change your voice, or start selling.`
}
