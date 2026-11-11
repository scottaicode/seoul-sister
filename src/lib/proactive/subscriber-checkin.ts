/**
 * Subscriber check-ins — Yuri decides, from her own memory of the person,
 * whether there is something worth saying first about THE COMING WEEK (Yuri
 * Wakes Up First, Oct 9 2026; weekly "week ahead" cadence Nov 7 2026).
 *
 * How this differs from the rule-based proactive-nudge cron, which it sits
 * beside rather than replaces: that cron's eligibility engine picks a reason
 * (open loop, phase mismatch, cycle window, glass-skin cadence) and Yuri only
 * WRITES it, from a one-line context. Here Yuri gets the parts of her
 * chat memory a check-in needs (checkin-context.ts: profile, routine, photo
 * dates, latest summary, dated decisions and open loops) plus the check-in
 * facts (dates on the shelf, the 7-day forecast where they live, trial status,
 * what she already sent and what came of it) and makes the call herself,
 * including the call to stay quiet.
 *
 * Deterministic rails only: non-demo subscriber, local daytime, the shared
 * nudge cap/spacing (nudge-limits.ts), and the weekly cadence: judged on their
 * LOCAL Sunday, at most once per 6 local days, plus one extra judgment on day 3
 * of a free trial (checkinGate). A "speak" becomes an ss_user_nudges row, so the dashboard card, the
 * existing email adapter, the opt-out and the acted tracking all apply unchanged.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadUserContext, formatContextForPrompt, type UserContext } from '@/lib/yuri/memory'
import { getLocalClock, clockFactBlock, daysBetweenIso } from '@/lib/yuri/clock'
import { fetchWeeklyForecast, formatForecastFacts } from '@/lib/intelligence/weather-forecast'
import { resolveTemperatureUnit } from '@/lib/intelligence/temperature-units'
import { buildNudgeSubject } from '@/lib/email/nudge-email'
import type { DecisionMemory } from '@/lib/yuri/memory'
import { guardSourceFacts, type GuardEvidence } from './content-guard'
import { PRICING } from '@/lib/pricing'
import {
  localHour,
  DAYTIME_START_HOUR,
  DAYTIME_END_HOUR,
} from '@/lib/intelligence/nudge-limits'
import { runProactiveJudgment, type ProactiveDecision } from './judge'
import { calibrationFacts, CHECKIN_CAMPAIGN } from './ledger'
import { buildCheckinMemory, type TrialInfo } from './checkin-context'

/**
 * Weekly cadence (Nov 7 2026). The judge costs ~$0.05-0.08 a call; judged daily
 * that was ~$2.40/member/month on a $9.99 plan. Now: once a week, on the
 * member's LOCAL Sunday ("the week ahead"), and never again within
 * REJUDGE_AFTER_LOCAL_DAYS local calendar days of the last judgment.
 * Calendar days, not hours, so a Sunday judged at 9am and the next Sunday
 * reached at 9am are 7 apart however the hours fall.
 */
export const CHECKIN_WEEKDAY = 'Sunday'
export const REJUDGE_AFTER_LOCAL_DAYS = 6
/**
 * A trial member is judged on these days of the trial (day 1 = start date) and
 * on no other: day 3, and day 6 as the first-week review, which arrives before
 * a 7-day trial ends (Nov 10 2026). The ordinary Sunday is skipped during a
 * trial so they get these two notes, not three.
 */
export const TRIAL_CHECKIN_DAYS: readonly number[] = [3, 6]
export const TRIAL_REVIEW_DAY = 6
/**
 * Weekly rhythm (Nov 10 2026, owner decision): members are told when they join
 * that Yuri checks in every week and adjusts from what they tell her. The old
 * shared cap (3 proactive contacts per 30 days, 3 days apart) made a weekly
 * cadence impossible, so check-ins are no longer subject to it. What remains is
 * this: never a check-in within two days of ANY proactive contact. The older
 * rule-based nudge cron now SKIPS anyone the weekly check-in can reach (see
 * proactive-nudge/route.ts), so the two never alternate: when Yuri chooses to
 * stay quiet with someone, that cron does not email them in her place.
 */
export const CHECKIN_MIN_GAP_DAYS = 2
/** Members who joined on or after this date were told to expect the weekly check-in (membership page + welcome email). */
export const RHYTHM_EXPLAINED_FROM = '2026-11-11'

/** True when any proactive contact was sent within CHECKIN_MIN_GAP_DAYS. Pure. */
export function contactedTooRecently(createdAts: string[], now: number): boolean {
  if (!createdAts.length) return false
  const last = Math.max(...createdAts.map((c) => new Date(c).getTime()))
  return (now - last) / (24 * 60 * 60 * 1000) < CHECKIN_MIN_GAP_DAYS
}

export interface SubscriberRow {
  user_id: string
  timezone: string | null
  latitude: number | null
  longitude: number | null
  is_demo: boolean | null
  nudge_email_opt_out: boolean | null
  nudge_unsubscribe_token: string | null
}

export type CheckinSkipReason =
  | 'demo'
  | 'internal'
  | 'no_timezone'
  | 'night'
  | 'cap_or_spacing'
  | 'not_checkin_day'
  | 'judged_recently'

/**
 * The timezone the weekly gate and clock use: the profile's, else the one
 * Open-Meteo resolves from their coordinates, else null (gate skips with
 * 'no_timezone' rather than guessing a day). `lookup` is injected for tests.
 */
export async function resolveCheckinTimezone(
  s: Pick<SubscriberRow, 'timezone' | 'latitude' | 'longitude'>,
  lookup: (lat: number, lng: number) => Promise<string | null>
): Promise<string | null> {
  if (s.timezone && s.timezone.trim()) return s.timezone.trim()
  if (s.latitude == null || s.longitude == null) return null
  return lookup(Number(s.latitude), Number(s.longitude))
}

/** Day N of a trial in the member's local calendar (start date = day 1). Pure. */
export function trialDayNumber(trial: TrialInfo | null, timezone: string | null, now: number): number | null {
  if (!trial) return null
  const start = getLocalClock(timezone, new Date(trial.startedAt)).isoDate
  const today = getLocalClock(timezone, new Date(now)).isoDate
  const diff = daysBetweenIso(start, today)
  return diff == null ? null : diff + 1
}

/**
 * Admin/founder accounts are excluded unless listed for dogfooding in
 * PROACTIVE_DOGFOOD_USER_IDS. Dogfood rows are tagged in context_facts and
 * kept OUT of Yuri's calibration record and the kill-test scoreboard, so the
 * owner's own reactions never teach her what strangers want.
 */
export function dogfoodUserIds(): Set<string> {
  return new Set(
    (process.env.PROACTIVE_DOGFOOD_USER_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

/** Pure gate, exported for tests. */
export function checkinGate(
  s: SubscriberRow,
  opts: {
    /** is_admin / excluded_from_metrics, and not on the dogfood list. */
    internal: boolean
    nudgeCreatedAts: string[]
    lastJudgedAt: string | null
    now: number
    /** Set only for a 'trialing' subscription (trialInfoFromSubscription). */
    trial?: TrialInfo | null
    bypassDaytime?: boolean
    /** DRY RUN ONLY: judge on any weekday (review runs). */
    bypassCheckinDay?: boolean
  }
): CheckinSkipReason | null {
  if (s.is_demo) return 'demo'
  if (opts.internal) return 'internal'
  // No timezone means no honest "their Sunday" or "their daytime" (the old
  // localHour fallback treated unknown as noon). Run resolves one from their
  // coordinates first; reaching here without one skips, visibly.
  if (!s.timezone || !s.timezone.trim()) return 'no_timezone'
  if (!opts.bypassDaytime) {
    const h = localHour(s.timezone, opts.now)
    if (h < DAYTIME_START_HOUR || h >= DAYTIME_END_HOUR) return 'night'
  }
  if (contactedTooRecently(opts.nudgeCreatedAts, opts.now)) return 'cap_or_spacing'

  const today = getLocalClock(s.timezone, new Date(opts.now))
  const lastJudgedLocal = opts.lastJudgedAt ? getLocalClock(s.timezone, new Date(opts.lastJudgedAt)).isoDate : null
  const daysSinceJudged = lastJudgedLocal ? daysBetweenIso(lastJudgedLocal, today.isoDate) : null

  // During a trial only the trial's own days count, whatever the weekday: day 3
  // and the day-6 first-week review. Never twice on the same day, and the
  // ordinary Sunday is not added on top. A trial is only a trial WHILE IT RUNS:
  // a row that still says 'trialing' after its last day (a late or dropped
  // webhook) falls through to the Sunday rule, or the member would never be
  // checked in on again.
  const trialDay = trialDayNumber(opts.trial ?? null, s.timezone, opts.now)
  const trialEnded = opts.trial?.endsAt ? new Date(opts.trial.endsAt).getTime() <= opts.now : false
  if (trialDay != null && trialDay >= 1 && trialDay <= PRICING.trial_days && !trialEnded) {
    if (TRIAL_CHECKIN_DAYS.includes(trialDay)) return daysSinceJudged === 0 ? 'judged_recently' : null
    if (!opts.bypassCheckinDay) return 'not_checkin_day'
  }

  if (!opts.bypassCheckinDay && today.weekday !== CHECKIN_WEEKDAY) return 'not_checkin_day'
  // On a Sunday, "already judged this weekend" is all that needs ruling out: a
  // Sunday comes once a week by itself. Counting the full six days here made
  // the first Sunday after a trial 8 to 12 days after the day-6 note. The
  // six-day rule still applies to a dry run on other weekdays.
  const minDays = today.weekday === CHECKIN_WEEKDAY ? CHECKIN_MIN_GAP_DAYS : REJUDGE_AFTER_LOCAL_DAYS
  if (daysSinceJudged != null && daysSinceJudged < minDays) return 'judged_recently'
  return null
}

/**
 * What the guard is told is true of the service (see judgeSubscriber), so "I'll
 * ask again on Sunday" is not blocked as an invented promise. Stated per
 * member: during a trial the next note is day 6, not Sunday. Pure, exported.
 */
export function weeklyCheckinStatement(trialDay: number | null): string {
  if (trialDay != null && trialDay >= 1 && trialDay < TRIAL_REVIEW_DAY) {
    return `Yuri writes to this member again on day ${TRIAL_REVIEW_DAY} of their free trial, and after the trial most weeks on Sunday, adjusting their routine from what they tell her.`
  }
  return 'Yuri checks in with this member most weeks, on Sunday, and adjusts their routine from what they tell her.'
}

const CHECKIN_SYSTEM = `You are Yuri (유리), Seoul Sister's K-beauty advisor: twenty-plus years in Korean formulation labs and cosmetic chemistry, warm, direct, the older sister who tells the truth about skin and money. Affiliate relationships never influence what you recommend, so "don't buy that yet" and "keep what you have" are things you can say when they're true.

Below is what you know about one of your subscribers that bears on a check-in: a selection from the memory you use when you talk to them (older conversation summaries and past message excerpts are left out, so something missing here may still have happened), plus this week's facts. This check-in looks at the coming seven days; the facts below say why you are being asked today. You are deciding whether to reach out to them FIRST about the coming week, before they come to you.

A routine only gets better from what the person tells you about how their skin did, and this weekly note is where that happens; the facts below say whether they were told to expect it. Seoul Sister's policy is that most weeks a note goes out. When something in the coming week matters for what they are doing, open with it: a day in the forecast that bears on their routine, or something in your memory of them below that you told them to expect around now. Name it and say in a clause why it matters for them, and stop there. The working-out belongs in the chat, where you can check it properly, so the note gives them the reason to talk, not the advice. Then one question, two at most, about the thing that matters most in what they are doing. Ask WHETHER before HOW ("Did you start the oil cleanse? If so, how does your skin feel after rinsing?") unless their own words already say they started. When nothing in the coming week bears on them, the question alone is enough to write; you do not need news, and you never reach for a forecast day just to have one. Silence is yours to choose, and it fits when they have left your recent check-ins unanswered (their silence is an answer; if you write at all, keep it short and say they need not reply), when they asked for fewer messages or said they would be away, when you would only repeat last week's note, or when the subject belongs to their prescriber, a doctor, or the person-first rule below. During a free trial, an unanswered day-3 note is not a reason to skip the first-week review.

The forecast is day by day, so you can point to a specific day ("Tuesday looks humid"). Anything after today is a forecast, not a fact, and reads that way when you say it.

Data you do NOT have, so never present as measured: when a bottle was opened, how much they use per application, or whether they actually bought something you recommended. Shelf dates are when an item was added to their shelf in Seoul Sister. Items marked "on a plan you saved, not confirmed owned" were written to the shelf when you saved a routine; treat them as planned, not as something they use, unless their own words say otherwise. If timing matters, reason from what you know and ask.

Before it is sent, your message is checked by a second reader against their own words: anything you say or assume about them (what they have or use, including inside a question, what happened in their life, how their skin has changed) must be something they told you, and it must not change their routine, promise anything about the plan or service, or reassure them that a symptom is harmless.

If you speak:
- It reads as you continuing their care: what is coming, if anything is, and the one or two questions above, said the way you'd say it in chat. Not a list, not a form.
- You have no tools in this message: no ingredient-conflict check, no catalog lookup. So don't prescribe a new product or a change to their actives here. Say what you noticed and why it matters, and invite them to work out the change with you in chat, where you can check it properly. Telling them to hold off on buying or replacing something is fine.
- Lesions, moles, anything that might need a doctor: refer, plainly.
- Anything a doctor prescribed them (tretinoin, isotretinoin, spironolactone, a prescription-strength adapalene or hydroquinone, a topical antibiotic or steroid) is their prescriber's call to start, stop, or change. A recorded decision or open loop about a prescription's dose or schedule is a question for their prescriber, never a plan to follow up on here.
- The person comes before the skin. If your memory holds a plan that would harm their body for their skin's sake (going without food, purging, diet pills or laxatives, megadosing a supplement, cutting, scrubbing or burning themselves), never mention that plan in a check-in, follow up on it, check its progress, or treat it as a step in their care. That conversation belongs in chat, where you can answer what they tell you. A fast with a planned end, a religious fast, or cutting out dairy is ordinary and not this.
- No greeting and no sign-off (the email adds "Hi, it's Yuri."). No em dashes. Never guilt about how long it's been. No urgency or sales pressure.
- Any day or date you mention must come from TODAY'S DATE or the forecast dates below.
- The email you write ends with a button that opens a chat with you, with your suggested_ask already typed in for them. So your message can end by inviting them to pick it up with you there. It is an invitation they are free to ignore: no pressure, no "log in now".

Return STRICT JSON only:
{"decision": "speak" | "silent", "signal": "<2-5 word label for what made you decide, in your words>", "reasoning": "<one or two sentences for the operations log: what you saw and why it does or doesn't warrant reaching out this week>", "confidence": <0..1, how sure you are this helps rather than intrudes>, "subject": "<short, human subject line, or empty if silent>", "message": "<plain text, 1-3 short paragraphs separated by a blank line, or empty if silent>", "suggested_ask": "<the one-line message they could send you to pick it up, in THEIR voice, or empty if silent>"}`

function daysSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  return Math.floor((now - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * The check-in-specific facts that formatContextForPrompt does not carry:
 * dated shelf + sizes, routine recency, the 7-day forecast, trial status and
 * why today, recency of contact,
 * and what Yuri already sent proactively and what came of it.
 * Throws on a failed query: a silently empty shelf would read as "nothing to say".
 */
async function checkinSubjects(db: SupabaseClient, nudgeIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!nudgeIds.length) return out
  const { data, error } = await db.from('ss_proactive_judgments').select('nudge_id, subject').in('nudge_id', nudgeIds)
  // Before the ledger migration exists there are no Yuri check-ins to look up.
  if (error && error.code === 'PGRST205') return out
  if (error) throw new Error(`check-in subject lookup failed: ${error.message}`)
  for (const r of data ?? []) if (r.nudge_id && r.subject) out.set(r.nudge_id as string, r.subject as string)
  return out
}

/** A date in the member's own calendar, e.g. "Thursday, November 26". Pure. */
export function localDateText(iso: string, timezone: string | null): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone || 'UTC' })
}

/** Why the judge is being asked today. Pure, exported for tests. */
export function checkinReasonFact(trialDay: number | null, trial: TrialInfo | null, timezone: string | null = null): string {
  if (trial && trialDay === TRIAL_REVIEW_DAY) {
    return `Why you are being asked today: it is day ${TRIAL_REVIEW_DAY} of their ${PRICING.trial_days}-day free trial${trial.endsAt ? `, which ends ${localDateText(trial.endsAt, timezone)} in their time` : ''}. This is their first-week review: ask how the first days went. Any adjustment is worked out in chat once they answer, not in this note. Seoul Sister sends them a separate plain notice about when the trial ends and how to keep going, so do not write about the trial ending, the price, or a card yourself.`
  }
  if (trial && trialDay != null && TRIAL_CHECKIN_DAYS.includes(trialDay)) {
    return `Why you are being asked today: it is day ${trialDay} of their free trial (the mid-trial check-in). You write again on day ${TRIAL_REVIEW_DAY}; after the trial you are asked once a week, on Sunday.`
  }
  return `Why you are being asked today: it is their weekly check-in (once a week, on Sunday, about the week just gone and the week ahead).`
}

/** Whether this member was told to expect a weekly check-in. Pure, exported for tests. */
export function rhythmFact(joinedAt: string | null): string {
  if (joinedAt && joinedAt.slice(0, 10) >= RHYTHM_EXPLAINED_FROM) {
    return `They were told when they joined (on the membership page and in their welcome email) that you check in every week and adjust their routine from what they tell you. A weekly note is expected.`
  }
  return `They joined before members were told to expect a weekly check-in, and nothing has told them one is coming. If you write, one short line saying you will check in each week from now on is fair.`
}

/**
 * What became of the check-ins sent since the member last wrote. Counts and a
 * date, never a threshold: when silence means "ease off" is hers to judge.
 * Only the most recent proactive notes are looked at (the query's limit), and
 * the fact says so. Pure, exported for tests.
 */
export function unansweredFact(
  nudges: Array<{ nudge_type: string; created_at: string; acted_at?: string | null }>,
  lastWroteAt: string | null
): string {
  const checkins = nudges.filter((n) => n.nudge_type === 'yuri_checkin')
  const since = checkins.filter((n) => !lastWroteAt || n.created_at > lastWroteAt)
  if (since.length === 0) return `Check-ins sent since they last wrote to you: none (looking at your ${nudges.length} most recent proactive notes).`
  const opened = since.filter((n) => n.acted_at).length
  const newestAt = since.map((n) => n.created_at).sort().pop() as string
  return `Check-ins sent since they last wrote to you: ${since.length}, the latest on ${newestAt.slice(0, 10)} (looking at your ${nudges.length} most recent proactive notes). They opened ${opened} of those into a chat and have not written since.`
}

export async function loadCheckinFacts(
  db: SupabaseClient,
  s: SubscriberRow,
  now: number,
  dm: DecisionMemory | null = null,
  trial: TrialInfo | null = null,
  /** Filled with the exact forecast text shown to the judge, so the guard can check it. */
  sink: { forecast?: string; today?: string } = {},
  opts: { /** When they became a member (ISO), if known. */ memberSince?: string | null } = {}
): Promise<string> {
  const [shelf, routines, phase, lastMsg, nudges, routineProducts] = await Promise.all([
    db
      .from('ss_user_products')
      .select('product_id, custom_name, custom_brand, category, status, learned_from, created_at, updated_at, ss_products(name_en, brand_en, volume_ml, volume_display, pao_months)')
      .eq('user_id', s.user_id)
      .order('created_at', { ascending: false })
      .limit(40),
    db
      .from('ss_user_routines')
      .select('name, routine_type, created_at, updated_at')
      .eq('user_id', s.user_id)
      .eq('is_active', true),
    db
      .from('ss_treatment_phases')
      .select('phase_number, name, goal, started_at')
      .eq('user_id', s.user_id)
      .eq('status', 'active')
      .maybeSingle(),
    db
      .from('ss_yuri_messages')
      .select('created_at, ss_yuri_conversations!inner(user_id)')
      .eq('ss_yuri_conversations.user_id', s.user_id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1),
    db
      .from('ss_user_nudges')
      .select('id, nudge_type, nudge_sequence, message, status, created_at, acted_at, email_status')
      .eq('user_id', s.user_id)
      .order('created_at', { ascending: false })
      .limit(5),
    // Catalog products that sit on one of their saved routines: save_routine
    // writes those to the shelf as status 'active', so "on the shelf" alone
    // does not mean owned (tools.ts save_routine).
    db
      .from('ss_routine_products')
      .select('product_id, ss_user_routines!inner(user_id, is_active)')
      .eq('ss_user_routines.user_id', s.user_id)
      .not('product_id', 'is', null),
  ])
  for (const q of [shelf, routines, phase, lastMsg, nudges, routineProducts]) {
    if (q.error) throw new Error(`check-in facts query failed: ${q.error.message}`)
  }

  const clock = getLocalClock(s.timezone, new Date(now))
  sink.today = clock.isoDate
  const lines: string[] = [clockFactBlock(clock)]
  const trialDay = trialDayNumber(trial, s.timezone, now)
  if (trial) {
    lines.push(
      `They are on a free trial: started ${trial.startedAt.slice(0, 10)}${trial.endsAt ? `, ends ${trial.endsAt.slice(0, 10)}` : ''}; today is day ${trialDay ?? 'unknown'} of it.`
    )
  }
  lines.push(checkinReasonFact(trialDay, trial, s.timezone))
  lines.push(rhythmFact(opts.memberSince ?? trial?.startedAt ?? null))

  const last = (lastMsg.data ?? [])[0] as { created_at: string } | undefined
  lines.push(
    last
      ? `They last wrote to you ${daysSince(last.created_at, now)} days ago (${last.created_at.slice(0, 10)}).`
      : `No messages from them are on record.`
  )

  lines.push(unansweredFact(((nudges.data ?? []) as Array<{ nudge_type: string; created_at: string; acted_at: string | null }>), last?.created_at ?? null))

  const p = phase.data as { phase_number: number; name: string; goal: string | null; started_at: string | null } | null
  if (p) lines.push(`Active treatment phase: Phase ${p.phase_number} "${p.name}"${p.goal ? ` (goal: ${p.goal})` : ''}, started ${p.started_at?.slice(0, 10) ?? 'date unknown'}${p.started_at ? `, day ${daysSince(p.started_at, now)}` : ''}.`)

  const r = (routines.data ?? []) as Array<{ name: string; routine_type: string; created_at: string; updated_at: string }>
  if (r.length) {
    lines.push(`Active saved routines: ${r.map((x) => `"${x.name}" (${x.routine_type}, created ${x.created_at.slice(0, 10)}, last changed ${x.updated_at.slice(0, 10)})`).join('; ')}.`)
  } else {
    lines.push(`No saved routine on file. Anything you recommended in chat that they may be using is only in your conversation memory.`)
  }

  type ShelfRow = {
    product_id: string | null
    custom_name: string | null
    custom_brand: string | null
    category: string | null
    status: string
    learned_from: string | null
    created_at: string
    updated_at: string
    ss_products: { name_en: string | null; brand_en: string | null; volume_ml: number | null; volume_display: string | null; pao_months: number | null } | null
  }
  const onSavedRoutine = new Set(
    ((routineProducts.data ?? []) as Array<{ product_id: string | null }>).map((x) => x.product_id).filter(Boolean)
  )
  const shelfRows = (shelf.data ?? []) as unknown as ShelfRow[]

  // Commitments sit next to the shelf on purpose: "I'll pick up X" is a
  // pending purchase, and the shelf may already list X as if it were owned.
  const commitments = (dm?.commitments ?? []).filter((c) => c.item?.trim())
  if (commitments.length) {
    lines.push(`Things THEY said they would do or buy (pending until they say otherwise):`)
    for (const c of commitments) lines.push(`- ${c.item}${c.date ? ` (said ${c.date})` : ''}`)
  }

  if (shelfRows.length) {
    lines.push(`Shelf (date = added to their Seoul Sister shelf, NOT opened; "inferred" = you inferred it from conversation, not confirmed owned):`)
    for (const x of shelfRows) {
      const name = x.ss_products?.name_en || x.custom_name || 'unnamed'
      const brand = x.ss_products?.brand_en || x.custom_brand
      const size = x.ss_products?.volume_display || (x.ss_products?.volume_ml ? `${x.ss_products.volume_ml} ml` : null)
      const pao = x.ss_products?.pao_months ? `PAO ${x.ss_products.pao_months}M` : null
      const meta = [x.category, size, pao, x.status !== 'active' ? `status ${x.status} (updated ${x.updated_at.slice(0, 10)})` : null, x.learned_from?.includes('inferred') ? 'inferred' : null, x.product_id && onSavedRoutine.has(x.product_id) ? 'on a plan you saved, not confirmed owned' : null]
        .filter(Boolean)
        .join(', ')
      lines.push(`- ${brand ? `${brand} ` : ''}${name}${meta ? ` (${meta})` : ''}, added ${x.created_at.slice(0, 10)} (${daysSince(x.created_at, now)} days ago)`)
    }
  } else {
    lines.push(`Shelf: empty. You do not know what they own beyond what's in your conversation memory.`)
  }

  if (s.latitude != null && s.longitude != null) {
    try {
      const f = await fetchWeeklyForecast(Number(s.latitude), Number(s.longitude), s.timezone)
      const forecast = formatForecastFacts(f, clock.isoDate, null, resolveTemperatureUnit({ latitude: Number(s.latitude), longitude: Number(s.longitude) }))
      sink.forecast = forecast
      lines.push(forecast)
    } catch (err) {
      lines.push(`Forecast: unavailable this run (fetch failed). Do not guess it.`)
      console.warn(`[proactive] forecast fetch failed for ${s.user_id}:`, err)
    }
  } else {
    lines.push(`Forecast: no coordinates on file for them.`)
  }

  const n = (nudges.data ?? []) as Array<{ id: string; nudge_type: string; nudge_sequence: number; message: string; status: string; created_at: string; acted_at: string | null; email_status: string | null }>
  if (n.length) {
    // Full bodies and subjects: a promise made in the closing line of an
    // earlier note ("I won't keep bringing it up") is exactly what a cut-off
    // excerpt hides.
    const yuriSubjects = await checkinSubjects(db, n.filter((x) => x.nudge_type === 'yuri_checkin').map((x) => x.id))
    lines.push(`What you (or the older automated nudge) already sent them proactively, newest first (full text):`)
    for (const x of n) {
      const outcome = x.acted_at ? `they opened it into a chat on ${x.acted_at.slice(0, 10)}` : x.status === 'surfaced' ? 'seen on their dashboard, not acted on' : 'no response'
      const subject = yuriSubjects.get(x.id) ?? buildNudgeSubject(x.nudge_type, x.nudge_sequence)
      lines.push(`- ${x.created_at.slice(0, 10)} [${x.nudge_type}] subject "${subject}"; email ${x.email_status ?? 'not sent'}; ${outcome}:\n  "${x.message.replace(/\s+/g, ' ')}"`)
    }
  } else {
    lines.push(`You have never reached out to them first.`)
  }

  return lines.join('\n')
}

export async function judgeSubscriber(
  db: SupabaseClient,
  s: SubscriberRow,
  now: number = Date.now(),
  /**
   * DRY RUN ONLY: patch the loaded memory in-process (e.g. with a not-yet-
   * applied memory backfill) to render what Yuri would say once it lands.
   */
  patchContext?: (ctx: UserContext) => Promise<void> | void,
  trial: TrialInfo | null = null,
  /** Newest ss_user_nudges created_at (any proactive contact), or null. */
  lastContactAt: string | null = null,
  /** When they became a member (ISO), if known. */
  memberSince: string | null = null
): Promise<{ decision: ProactiveDecision; factsText: string; evidence: GuardEvidence; shown: { forecast: string | null } }> {
  const userContext = await loadUserContext(s.user_id)
  if (patchContext) await patchContext(userContext)
  const sink: { forecast?: string; today?: string } = {}
  const [checkinFacts, calibration] = await Promise.all([
    loadCheckinFacts(db, s, now, userContext.decisionMemory, trial, sink, { memberSince }),
    calibrationFacts(db, 'subscriber'),
  ])
  // The FULL context is still loaded: the guard's evidence below reads the
  // complete decision memory. Only what the judge is shown is trimmed.
  const memory = buildCheckinMemory(userContext, formatContextForPrompt, lastContactAt)
  const factsText = `# WHAT YOU KNOW ABOUT THEM (from your memory)\n${memory}\n\n# THIS WEEK\n${checkinFacts}\n\n${calibration}\n\nDecide, then return the JSON.`
  const decision = await runProactiveJudgment({
    system: CHECKIN_SYSTEM,
    facts: factsText,
    feature: 'proactive_checkin',
    userId: s.user_id,
  })
  // Facts the judge was given that are not the member's own words but are true
  // at the source: the forecast and where they live. Without these the guard
  // reads "Tuesday looks sunny in Austin" as a claim they never made.
  const sourceFacts = guardSourceFacts({
    today: sink.today,
    statedLocation: ((userContext.skinProfile as Record<string, unknown> | null)?.location_text as string | null) ?? null,
    gpsLocation: userContext.locationName,
    forecast: sink.forecast,
  })
  const evidence = await loadGuardEvidence(db, s.user_id, userContext.decisionMemory, sourceFacts)
  // True of the service itself, so the guard must not read it as a promise
  // Yuri invented ("I'll ask again next Sunday" used to be blocked as one).
  evidence.verifiedStatements = [...(evidence.verifiedStatements ?? []), weeklyCheckinStatement(trialDayNumber(trial, s.timezone, now))]
  // `shown` is recorded with the judgment, so the chat she opens from this note
  // can be given the forecast she was looking at when she wrote it.
  return { decision, factsText, evidence, shown: { forecast: sink.forecast ?? null } }
}

/**
 * Longest forecast text kept with a judgment. Measured on the repo's own
 * formatter: a clear week in °C is about 1,100 characters and a rainy week in
 * °F about 1,300, so 1,200 dropped exactly the weeks worth recording. The
 * judge's whole briefing is many times this size.
 */
export const FORECAST_RECORD_MAX_CHARS = 2500

/**
 * The forecast to keep with a judgment, or null. Kept only for a note that is
 * actually going out, and only when it is the size of a forecast: anything
 * larger is logged and not kept (the whole briefing must never be stored here and
 * replayed into the member chat). Pure, exported for tests.
 */
export function forecastToRecord(decision: ProactiveDecision['decision'], forecast: string | null | undefined): string | null {
  if (decision !== 'speak') return null
  const text = (forecast ?? '').trim()
  if (!text) return null
  if (text.length > FORECAST_RECORD_MAX_CHARS) {
    console.error(`[proactive] forecast not recorded with the check-in: ${text.length} characters is larger than a forecast (${FORECAST_RECORD_MAX_CHARS})`)
    return null
  }
  return text
}

/**
 * The content guard's evidence: their OWN words (never Yuri's), recorded
 * decisions/commitments, and the active plan. Throws on a failed read so a
 * guard never runs against an empty record by accident.
 */
export { guardSourceFacts } from './content-guard'

export async function loadGuardEvidence(
  db: SupabaseClient,
  userId: string,
  dm: DecisionMemory | null,
  sourceFacts: string[] = []
): Promise<GuardEvidence> {
  const [msgs, phase, shelf] = await Promise.all([
    db
      .from('ss_yuri_messages')
      .select('content, created_at, ss_yuri_conversations!inner(user_id)')
      .eq('ss_yuri_conversations.user_id', userId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('ss_treatment_phases').select('name, protocol, started_at').eq('user_id', userId).eq('status', 'active').maybeSingle(),
    db.from('ss_user_products').select('custom_name, custom_brand, ss_products(name_en, brand_en)').eq('user_id', userId),
  ])
  if (shelf.error) throw new Error(`guard evidence (shelf) failed: ${shelf.error.message}`)
  if (msgs.error) throw new Error(`guard evidence (messages) failed: ${msgs.error.message}`)
  if (phase.error) throw new Error(`guard evidence (phase) failed: ${phase.error.message}`)
  const userMessages = ((msgs.data ?? []) as Array<{ content: string }>).map((m) => m.content).reverse()
  const recordedDecisions = [
    ...(dm?.decisions ?? []).map((d) => `decision (${d.date}): ${d.topic}: ${d.decision}`),
    ...(dm?.commitments ?? []).map((c) => `they said they would (${c.date}): ${c.item}`),
    ...(dm?.preferences ?? []).map((p) => `preference: ${p.topic}: ${p.preference}`),
  ]
  const ph = phase.data as { name: string; protocol: unknown; started_at: string | null } | null
  type Row = { custom_name: string | null; custom_brand: string | null; ss_products: { name_en: string | null; brand_en: string | null } | null }
  const knownProducts = ((shelf.data ?? []) as unknown as Row[])
    .map((r) => [r.ss_products?.brand_en ?? r.custom_brand, r.ss_products?.name_en ?? r.custom_name].filter(Boolean).join(' '))
    .filter(Boolean)
  return { userMessages, recordedDecisions, plan: ph ? `${ph.name}${ph.started_at ? ` (started ${ph.started_at.slice(0, 10)})` : ''}: ${JSON.stringify(ph.protocol)}` : null, knownProducts, sourceFacts }
}

export { CHECKIN_CAMPAIGN }
