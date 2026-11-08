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
import { buildNudgeSubject } from '@/lib/email/nudge-email'
import type { DecisionMemory } from '@/lib/yuri/memory'
import type { GuardEvidence } from './content-guard'
import {
  capOrSpacingBlocks,
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
/** Trial members get one extra judgment on this day of the trial (day 1 = start date). */
export const TRIAL_CHECKIN_DAY = 3

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
  if (capOrSpacingBlocks(opts.nudgeCreatedAts, opts.now)) return 'cap_or_spacing'

  const today = getLocalClock(s.timezone, new Date(opts.now))
  const lastJudgedLocal = opts.lastJudgedAt ? getLocalClock(s.timezone, new Date(opts.lastJudgedAt)).isoDate : null
  const daysSinceJudged = lastJudgedLocal ? daysBetweenIso(lastJudgedLocal, today.isoDate) : null

  // Trial day 3: one judgment that day, whatever the weekday, so a member on a
  // 7-day trial can hear from Yuri before it ends. Never twice on the same day.
  if (trialDayNumber(opts.trial ?? null, s.timezone, opts.now) === TRIAL_CHECKIN_DAY) {
    return daysSinceJudged === 0 ? 'judged_recently' : null
  }

  if (!opts.bypassCheckinDay && today.weekday !== CHECKIN_WEEKDAY) return 'not_checkin_day'
  if (daysSinceJudged != null && daysSinceJudged < REJUDGE_AFTER_LOCAL_DAYS) return 'judged_recently'
  return null
}

const CHECKIN_SYSTEM = `You are Yuri (유리), Seoul Sister's K-beauty advisor: twenty-plus years in Korean formulation labs and cosmetic chemistry, warm, direct, the older sister who tells the truth about skin and money. Affiliate relationships never influence what you recommend, so "don't buy that yet" and "keep what you have" are things you can say when they're true.

Below is what you know about one of your subscribers that bears on a check-in: a selection from the memory you use when you talk to them (older conversation summaries and past message excerpts are left out, so something missing here may still have happened), plus this week's facts. This check-in looks at the coming seven days; the facts below say why you are being asked today. You are deciding whether to reach out to them FIRST about the coming week, before they come to you.

Silence is the normal answer. Most weeks there is nothing worth interrupting someone for, and a check-in with nothing in it teaches them to ignore you. Speak only if, from what you actually know, there is something timely and specific to THEIR skin in the coming week that they would be glad you said. The kinds of moments that can earn it: where they are in a plan you made together (an active they started, a phase, a promise you made to check back), something in this week's forecast where they live that matters for what they're using, or something they told you they were about to buy or replace, where "hold off until we've talked" is the honest advice. These are examples, not a checklist; anything else that genuinely matters to them counts, and none of these is a reason to speak on its own.

The forecast is day by day, so you can point to a specific day ("Tuesday looks humid"). Anything after today is a forecast, not a fact, and reads that way when you say it.

Data you do NOT have, so never present as measured: when a bottle was opened, how much they use per application, or whether they actually bought something you recommended. Shelf dates are when an item was added to their shelf in Seoul Sister. Items marked "on a plan you saved, not confirmed owned" were written to the shelf when you saved a routine; treat them as planned, not as something they use, unless their own words say otherwise. If timing matters, reason from what you know and ask.

Before it is sent, your message is checked by a second reader against their own words: anything you say or assume about them (what they have or use, including inside a question, what happened in their life, how their skin has changed) must be something they told you, and it must not change their routine, promise anything about the plan or service, or reassure them that a symptom is harmless.

If you speak:
- It reads as you continuing their care: one specific thing, said the way you'd say it in chat, plus the question you'd pick up with.
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

export async function loadCheckinFacts(
  db: SupabaseClient,
  s: SubscriberRow,
  now: number,
  dm: DecisionMemory | null = null,
  trial: TrialInfo | null = null
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
  const lines: string[] = [clockFactBlock(clock)]
  const trialDay = trialDayNumber(trial, s.timezone, now)
  if (trial) {
    lines.push(
      `They are on a free trial: started ${trial.startedAt.slice(0, 10)}${trial.endsAt ? `, ends ${trial.endsAt.slice(0, 10)}` : ''}; today is day ${trialDay ?? 'unknown'} of it.`
    )
  }
  lines.push(
    trialDay === TRIAL_CHECKIN_DAY && clock.weekday !== CHECKIN_WEEKDAY
      ? `Why you are being asked today: it is day ${TRIAL_CHECKIN_DAY} of their trial (the one mid-trial check-in). Otherwise you are asked once a week, on Sunday.`
      : `Why you are being asked today: it is their weekly check-in (once a week, on Sunday, about the week ahead).`
  )

  const last = (lastMsg.data ?? [])[0] as { created_at: string } | undefined
  lines.push(
    last
      ? `They last wrote to you ${daysSince(last.created_at, now)} days ago (${last.created_at.slice(0, 10)}).`
      : `No messages from them are on record.`
  )

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
      lines.push(formatForecastFacts(f, clock.isoDate))
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
  lastContactAt: string | null = null
): Promise<{ decision: ProactiveDecision; factsText: string; evidence: GuardEvidence }> {
  const userContext = await loadUserContext(s.user_id)
  if (patchContext) await patchContext(userContext)
  const [checkinFacts, calibration] = await Promise.all([
    loadCheckinFacts(db, s, now, userContext.decisionMemory, trial),
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
  return { decision, factsText, evidence: await loadGuardEvidence(db, s.user_id, userContext.decisionMemory) }
}

/**
 * The content guard's evidence: their OWN words (never Yuri's), recorded
 * decisions/commitments, and the active plan. Throws on a failed read so a
 * guard never runs against an empty record by accident.
 */
export async function loadGuardEvidence(
  db: SupabaseClient,
  userId: string,
  dm: DecisionMemory | null
): Promise<GuardEvidence> {
  const [msgs, phase, shelf] = await Promise.all([
    db
      .from('ss_yuri_messages')
      .select('content, created_at, ss_yuri_conversations!inner(user_id)')
      .eq('ss_yuri_conversations.user_id', userId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('ss_treatment_phases').select('name, protocol').eq('user_id', userId).eq('status', 'active').maybeSingle(),
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
  const ph = phase.data as { name: string; protocol: unknown } | null
  type Row = { custom_name: string | null; custom_brand: string | null; ss_products: { name_en: string | null; brand_en: string | null } | null }
  const knownProducts = ((shelf.data ?? []) as unknown as Row[])
    .map((r) => [r.ss_products?.brand_en ?? r.custom_brand, r.ss_products?.name_en ?? r.custom_name].filter(Boolean).join(' '))
    .filter(Boolean)
  return { userMessages, recordedDecisions, plan: ph ? `${ph.name}: ${JSON.stringify(ph.protocol)}` : null, knownProducts }
}

export { CHECKIN_CAMPAIGN }
