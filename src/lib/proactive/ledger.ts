/**
 * ss_proactive_judgments — the dated ledger behind Yuri Wakes Up First.
 *
 * Step 1 (judgment): recordJudgment() — every decision, including SILENCE.
 * Step 2 (teacher):  gradeMatured()   — objective rows only: a chat restart or
 *                    reply, a subscription, an unsubscribe, a bounce. No
 *                    self-report, no model grading its own outcome.
 * Step 3 (feedback): calibrationFacts() — the graded record, read back into
 *                    Yuri's next judgment as FACTS she reasons over (never a
 *                    rule that suppresses a kind of message for her).
 *
 * Deterministic bookkeeping only. No judgment happens in this file.
 */

import { safeSlice } from '@/lib/utils/text-slice'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProactiveDecision } from './judge'

export type Audience = 'lead' | 'subscriber'
export type Grade = 'converted' | 'engaged' | 'unsubscribed' | 'no_response' | 'undelivered' | 'blocked'

export const LEAD_CAMPAIGN = 'lead_reengage_v1'
export const CHECKIN_CAMPAIGN = 'subscriber_checkin'

/** Days after a send before it is graded. */
export const GRADE_WINDOW_DAYS: Record<Audience, number> = { lead: 14, subscriber: 7 }
export const RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export interface JudgmentInsert {
  audience: Audience
  campaign: string
  user_id?: string | null
  nurture_lead_id?: string | null
  widget_visitor_id?: string | null
  decision: ProactiveDecision
  context_facts?: Record<string, unknown>
  attribution_tag?: string | null
  delivery_status?: string | null
}

/**
 * Insert a judgment. Returns the row id, `null` on the lead-once unique conflict
 * (already decided — the never-double-send guarantee), or throws on any other
 * error so the caller counts it rather than reading a failed write as success.
 */
export async function recordJudgment(db: SupabaseClient, row: JudgmentInsert): Promise<string | null> {
  const d = row.decision
  const { data, error } = await db
    .from('ss_proactive_judgments')
    .insert({
      audience: row.audience,
      campaign: row.campaign,
      user_id: row.user_id ?? null,
      nurture_lead_id: row.nurture_lead_id ?? null,
      widget_visitor_id: row.widget_visitor_id ?? null,
      decision: d.decision,
      signal: d.signal,
      reasoning: d.reasoning,
      confidence: d.confidence,
      subject: d.subject,
      message: d.message,
      suggested_ask: d.suggestedAsk,
      model: d.model,
      context_facts: row.context_facts ?? null,
      attribution_tag: row.attribution_tag ?? null,
      delivery_status: row.delivery_status ?? null,
      // A guard-blocked draft is graded at birth: it never reached anyone, and
      // the reason it was refused is the lesson.
      ...(d.decision === 'blocked' ? { grade: 'blocked', graded_at: new Date().toISOString() } : {}),
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return null
    throw new Error(`recordJudgment failed: ${error.message}`)
  }
  return data.id as string
}

export async function recordDelivery(
  db: SupabaseClient,
  id: string,
  patch: {
    delivery_status: string
    provider_id?: string | null
    sent_at?: string | null
    nudge_id?: string | null
    attribution_tag?: string | null
    decision?: 'failed'
  }
): Promise<void> {
  const { error } = await db.from('ss_proactive_judgments').update(patch).eq('id', id)
  if (error) console.error(`[proactive] recordDelivery failed for ${id}:`, error.message)
}

/** Resend webhook fan-out: delivery events for lead re-engagement emails. */
export async function updateJudgmentDeliveryByProviderId(
  db: SupabaseClient,
  providerId: string,
  status: string
): Promise<{ matched: boolean }> {
  let query = db
    .from('ss_proactive_judgments')
    .update({ delivery_status: status })
    .eq('provider_id', providerId)
  // A late 'delivered' never overwrites a bounce/complaint (events arrive out of order).
  if (status === 'delivered') query = query.not('delivery_status', 'in', '(bounced,complained)')
  const { data, error } = await query.select('id')
  if (error) {
    console.error('[proactive] webhook delivery update failed:', error.message)
    return { matched: false }
  }
  return { matched: (data?.length ?? 0) > 0 }
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------

export interface GradeEvidence {
  delivery_status: string | null
  converted: boolean
  unsubscribed: boolean
  /**
   * A chat restart (lead), or for a subscriber an ATTRIBUTABLE response inside
   * the window: the card acted on, the prefilled ask sent, or a message that
   * picks up the check-in's own topic. Chatting about something else is not
   * engagement with the check-in (see attributeSubscriberEngagement).
   */
  engaged: boolean
  /** Subscriber only: which signal attributed it, if any. */
  attribution?: 'acted' | 'ask_sent' | 'topic_reply' | null
  /** Subscriber only: they chatted in the window but nothing tied it to the check-in. */
  chatted_unattributed?: boolean
  /** Subscriber only: share of the 8 prior 7-day windows (56 days) in which they chatted at all. */
  baseline_week_chat_rate?: number
}

// Function words AND generic skincare vocabulary: "routine", "cream" or "using"
// shared with a check-in says nothing about whether they replied to IT.
const STOP = new Set([
  'about', 'there', 'their', 'which', 'would', 'could', 'should', 'these', 'those', 'where', 'while', 'really',
  'still', 'thing', 'things', 'think', 'right', 'yuri', 'today', 'tonight', 'night', 'nights', 'morning', 'evening',
  'week', 'weeks', 'using', 'feels', 'feeling', 'little', 'since', 'after', 'before', 'again', 'maybe',
  'skin', 'skincare', 'routine', 'product', 'products', 'cream', 'creams', 'serum', 'serums', 'toner', 'cleanser',
  'moisturizer', 'moisturiser', 'sunscreen', 'essence', 'face', 'facial', 'apply', 'applying', 'layer', 'barrier',
])
const topicWords = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !STOP.has(w))
  )

/**
 * Pure attribution for a subscriber check-in, exported for tests. Base-rate
 * chat is NOT engagement: a subscriber who chats every week anyway would grade
 * every check-in "engaged". Order of strength: acted on the card, sent the
 * prefilled ask, or wrote a message sharing ≥2 topic words with the check-in.
 */
export function attributeSubscriberEngagement(input: {
  actedInWindow: boolean
  suggestedAsk: string | null
  checkinMessage: string | null
  userMessagesInWindow: string[]
}): { engaged: boolean; attribution: 'acted' | 'ask_sent' | 'topic_reply' | null; chattedUnattributed: boolean } {
  if (input.actedInWindow) return { engaged: true, attribution: 'acted', chattedUnattributed: false }
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const askHead = input.suggestedAsk ? safeSlice(norm(input.suggestedAsk), 30) : ''
  if (askHead.length >= 12 && input.userMessagesInWindow.some((m) => norm(m).startsWith(askHead))) {
    return { engaged: true, attribution: 'ask_sent', chattedUnattributed: false }
  }
  const topic = topicWords(input.checkinMessage ?? '')
  const shared = (m: string) => [...topicWords(m)].filter((w) => topic.has(w)).length
  if (input.userMessagesInWindow.some((m) => shared(m) >= 2)) {
    return { engaged: true, attribution: 'topic_reply', chattedUnattributed: false }
  }
  return { engaged: false, attribution: null, chattedUnattributed: input.userMessagesInWindow.length > 0 }
}

/** Share of the 8 prior 7-day windows in which the user wrote at all. Exported for tests. */
export function baselineWeeklyChatRate(messageTimes: string[], sentAt: string): number {
  const end = new Date(sentAt).getTime()
  const weeks = new Set<number>()
  for (const t of messageTimes) {
    const age = end - new Date(t).getTime()
    if (age > 0 && age <= 56 * DAY_MS) weeks.add(Math.min(7, Math.floor(age / (7 * DAY_MS))))
  }
  return weeks.size / 8
}

/**
 * Pure classification of one matured send. Order matters and is deliberate:
 * an undelivered email graded "no_response" would teach Yuri her words failed
 * when nobody read them; an unsubscribe outranks a click because a person who
 * came back once and then opted out is telling you the outreach cost more than
 * it gave. Conversion outranks everything — it is the One Metric.
 */
export function classifyGrade(e: GradeEvidence): Grade {
  if (e.converted) return 'converted'
  if (
    e.delivery_status === 'bounced' ||
    e.delivery_status === 'complained' ||
    e.delivery_status === 'send_failed' ||
    e.delivery_status === 'not_reached'
  ) {
    return e.delivery_status === 'complained' ? 'unsubscribed' : 'undelivered'
  }
  if (e.unsubscribed) return 'unsubscribed'
  if (e.engaged) return 'engaged'
  return 'no_response'
}

interface MaturedRow {
  id: string
  audience: Audience
  user_id: string | null
  nurture_lead_id: string | null
  widget_visitor_id: string | null
  nudge_id: string | null
  sent_at: string
  delivery_status: string | null
  attribution_tag: string | null
  context_facts: Record<string, unknown> | null
  message: string | null
  suggested_ask: string | null
}

async function evidenceFor(db: SupabaseClient, r: MaturedRow): Promise<GradeEvidence> {
  const sentAt = r.sent_at
  const windowEnd = new Date(new Date(sentAt).getTime() + GRADE_WINDOW_DAYS[r.audience] * DAY_MS).toISOString()
  const ev: GradeEvidence = { delivery_status: r.delivery_status, converted: false, unsubscribed: false, engaged: false }

  if (r.audience === 'lead') {
    const [lead, sessions, visitorMsgs] = await Promise.all([
      r.nurture_lead_id
        ? db.from('ss_nurture_leads').select('email, user_id, suppressed_reason, updated_at').eq('id', r.nurture_lead_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      r.attribution_tag
        ? db.from('ss_widget_sessions').select('id').eq('source', r.attribution_tag).gte('started_at', sentAt).lte('started_at', windowEnd).limit(1)
        : Promise.resolve({ data: [], error: null }),
      r.widget_visitor_id
        ? db.from('ss_widget_messages').select('id').eq('visitor_id', r.widget_visitor_id).eq('role', 'user').gte('created_at', sentAt).lte('created_at', windowEnd).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ])
    for (const q of [lead, sessions, visitorMsgs]) {
      if (q.error) throw new Error(`lead evidence query failed: ${q.error.message}`)
    }
    const l = lead.data as { email: string; user_id: string | null; suppressed_reason: string | null; updated_at: string } | null
    ev.unsubscribed = !!l && l.suppressed_reason === 'unsubscribed' && l.updated_at >= sentAt
    ev.engaged = (sessions.data?.length ?? 0) > 0 || (visitorMsgs.data?.length ?? 0) > 0

    if (l?.email) {
      // Converted: any widget row for this address stamped converted after the send,
      // or the registered account gaining a subscription after the send.
      const { data: conv, error: convErr } = await db
        .from('ss_widget_visitors')
        .select('id')
        .ilike('captured_email', l.email.replace(/[%_\\]/g, '\\$&'))
        .gte('converted_at', sentAt)
        .limit(1)
      if (convErr) throw new Error(`conversion query failed: ${convErr.message}`)
      ev.converted = (conv?.length ?? 0) > 0
    }
    if (!ev.converted && l?.user_id) {
      const { data: sub, error: subErr } = await db
        .from('ss_subscriptions').select('id').eq('user_id', l.user_id).gte('created_at', sentAt).limit(1)
      if (subErr) throw new Error(`subscription query failed: ${subErr.message}`)
      ev.converted = (sub?.length ?? 0) > 0
      if (!ev.engaged) {
        const { data: msgs, error: mErr } = await db
          .from('ss_yuri_messages')
          .select('id, ss_yuri_conversations!inner(user_id)')
          .eq('ss_yuri_conversations.user_id', l.user_id)
          .eq('role', 'user')
          .gte('created_at', sentAt)
          .lte('created_at', windowEnd)
          .limit(1)
        if (mErr) throw new Error(`registered-lead message query failed: ${mErr.message}`)
        ev.engaged = (msgs?.length ?? 0) > 0
      }
    }
    return ev
  }

  // Subscriber: an ATTRIBUTABLE response inside the window, judged against the
  // user's own baseline (both recorded in grade_evidence).
  if (!r.user_id) return ev
  const baselineStart = new Date(new Date(sentAt).getTime() - 56 * DAY_MS).toISOString()
  const [msgs, prior, nudge, profile] = await Promise.all([
    db
      .from('ss_yuri_messages')
      .select('content, created_at, ss_yuri_conversations!inner(user_id)')
      .eq('ss_yuri_conversations.user_id', r.user_id)
      .eq('role', 'user')
      .gte('created_at', sentAt)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: true })
      .limit(100),
    db
      .from('ss_yuri_messages')
      .select('created_at, ss_yuri_conversations!inner(user_id)')
      .eq('ss_yuri_conversations.user_id', r.user_id)
      .eq('role', 'user')
      .gte('created_at', baselineStart)
      .lt('created_at', sentAt)
      .limit(1000),
    r.nudge_id
      ? db.from('ss_user_nudges').select('acted_at, surfaced_at, email_status').eq('id', r.nudge_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('ss_user_profiles').select('nudge_email_opt_out, updated_at').eq('user_id', r.user_id).maybeSingle(),
  ])
  for (const q of [msgs, prior, nudge, profile]) {
    if (q.error) throw new Error(`subscriber evidence query failed: ${q.error.message}`)
  }
  const n = nudge.data as { acted_at: string | null; surfaced_at: string | null; email_status: string | null } | null
  const attributed = attributeSubscriberEngagement({
    actedInWindow: !!n?.acted_at && n.acted_at >= sentAt && n.acted_at <= windowEnd,
    suggestedAsk: r.suggested_ask,
    checkinMessage: r.message,
    userMessagesInWindow: ((msgs.data ?? []) as Array<{ content: string }>).map((m) => m.content),
  })
  ev.engaged = attributed.engaged
  ev.attribution = attributed.attribution
  ev.chatted_unattributed = attributed.chattedUnattributed
  ev.baseline_week_chat_rate = baselineWeeklyChatRate(
    ((prior.data ?? []) as Array<{ created_at: string }>).map((m) => m.created_at),
    sentAt
  )
  // The nudge row carries the webhook's delivery outcome for subscriber emails.
  if (n?.email_status) ev.delivery_status = n.email_status
  // Reached nobody: the email did not go out (or bounced) AND the dashboard card
  // was never seen inside the window. Grading that "no_response" would teach
  // Yuri her words failed when nobody read them.
  const emailReached = n?.email_status === 'sent' || n?.email_status === 'delivered'
  const cardSeen = (!!n?.surfaced_at && n.surfaced_at <= windowEnd) || (!!n?.acted_at && n.acted_at <= windowEnd)
  if (!emailReached && !cardSeen && !ev.engaged) ev.delivery_status = 'not_reached'
  // "Turned off check-in emails": the opt-out flipped from off (at send) to on,
  // with the profile last updated inside the window. A later opt-out is not
  // attributed to this message.
  const optedOutAtSend = r.context_facts?.nudge_email_opt_out_at_send === true
  const prof = profile.data as { nudge_email_opt_out: boolean | null; updated_at: string | null } | null
  ev.unsubscribed =
    !optedOutAtSend &&
    prof?.nudge_email_opt_out === true &&
    !!prof.updated_at &&
    prof.updated_at >= sentAt &&
    prof.updated_at <= windowEnd
  return ev
}

/**
 * Grade every send whose window has closed, then record 30-day retention for
 * subscriber sends. Per-row failure isolation; failures are counted, not hidden.
 */
export async function gradeMatured(db: SupabaseClient): Promise<{ graded: number; retentionChecked: number; errors: number }> {
  let graded = 0
  let retentionChecked = 0
  let errors = 0

  for (const audience of ['lead', 'subscriber'] as Audience[]) {
    const cutoff = new Date(Date.now() - GRADE_WINDOW_DAYS[audience] * DAY_MS).toISOString()
    const { data, error } = await db
      .from('ss_proactive_judgments')
      .select('id, audience, user_id, nurture_lead_id, widget_visitor_id, nudge_id, sent_at, delivery_status, attribution_tag, context_facts, message, suggested_ask')
      .eq('audience', audience)
      .eq('decision', 'speak')
      .is('grade', null)
      .not('sent_at', 'is', null)
      .lte('sent_at', cutoff)
      .limit(200)
    if (error) {
      console.error('[proactive] matured query failed:', error.message)
      errors++
      continue
    }
    for (const r of (data ?? []) as MaturedRow[]) {
      try {
        const ev = await evidenceFor(db, r)
        const { error: upErr } = await db
          .from('ss_proactive_judgments')
          .update({ grade: classifyGrade(ev), grade_evidence: ev, graded_at: new Date().toISOString() })
          .eq('id', r.id)
        if (upErr) throw new Error(upErr.message)
        graded++
      } catch (err) {
        errors++
        console.error(`[proactive] grading failed for ${r.id}:`, err)
      }
    }
  }

  const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString()
  const { data: due, error: dueErr } = await db
    .from('ss_proactive_judgments')
    .select('id, user_id, sent_at')
    .eq('audience', 'subscriber')
    .eq('decision', 'speak')
    .is('retained_30d', null)
    .not('sent_at', 'is', null)
    .lte('sent_at', retentionCutoff)
    .limit(200)
  if (dueErr) {
    errors++
    console.error('[proactive] retention query failed:', dueErr.message)
  } else {
    for (const r of due ?? []) {
      const { data: subs, error: sErr } = await db
        .from('ss_subscriptions')
        .select('status, canceled_at')
        .eq('user_id', r.user_id as string)
      if (sErr) {
        errors++
        continue
      }
      const checkpoint = new Date(new Date(r.sent_at as string).getTime() + RETENTION_DAYS * DAY_MS).toISOString()
      // No Stripe row = a comped account; retention is not a meaningful read there.
      const retained =
        (subs ?? []).length === 0
          ? null
          : (subs ?? []).some((s) => s.status === 'active' || !s.canceled_at || (s.canceled_at as string) > checkpoint)
      const { error: rErr } = await db
        .from('ss_proactive_judgments')
        .update({ retained_30d: retained, retention_checked_at: new Date().toISOString() })
        .eq('id', r.id as string)
      if (rErr) errors++
      else retentionChecked++
    }
  }

  return { graded, retentionChecked, errors }
}

// ---------------------------------------------------------------------------
// Feedback — the graded record, as facts for Yuri's next judgment
// ---------------------------------------------------------------------------

interface GradedRow {
  signal: string | null
  reasoning: string | null
  message: string | null
  grade: Grade
  created_at: string
  context_facts: { guard?: string[] } | null
}

/**
 * The calibration block. Totals for the audience plus the most recent graded
 * sends verbatim, so Yuri can see WHAT she said and what happened, and reason
 * about it herself. When nothing is graded yet it says so plainly, which is the
 * honest state for the first two weeks.
 */
export async function calibrationFacts(db: SupabaseClient, audience: Audience): Promise<string> {
  const { data, error } = await db
    .from('ss_proactive_judgments')
    .select('signal, reasoning, message, grade, created_at, context_facts')
    .eq('audience', audience)
    .in('decision', ['speak', 'blocked'])
    .not('grade', 'is', null)
    // The owner's own dogfood reactions never calibrate what strangers want.
    .or('context_facts->>dogfood.is.null,context_facts->>dogfood.neq.true')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    if (error.code === 'PGRST205') {
      // Ledger table not created yet (migration unapplied): there is genuinely no record.
      return `YOUR GRADED TRACK RECORD: nothing graded yet. This is the first time you are making this kind of decision.`
    }
    // Say so rather than presenting an empty record as "no history".
    return `YOUR GRADED TRACK RECORD: unavailable this run (query failed). Do not assume it is empty.`
  }
  const rows = (data ?? []) as GradedRow[]
  if (rows.length === 0) {
    return `YOUR GRADED TRACK RECORD (${audience === 'lead' ? 'reaching out to past visitors' : 'checking in with subscribers'}): nothing graded yet. You are early; there is no evidence yet about what lands.`
  }
  const totals: Record<string, number> = {}
  for (const r of rows) totals[r.grade] = (totals[r.grade] ?? 0) + 1
  const totalLine = Object.entries(totals)
    .map(([g, n]) => `${g} ${n}`)
    .join(', ')
  const recent = rows.slice(0, 12).map((r) => {
    const excerpt = safeSlice((r.message ?? '').replace(/\s+/g, ' '), 220)
    const why = r.grade === 'blocked' && r.context_facts?.guard?.length ? `\n  refused because: ${r.context_facts.guard.join('; ')}` : ''
    return `- ${r.created_at.slice(0, 10)} | ${r.signal ?? 'unlabeled'} | outcome: ${r.grade}\n  you wrote: "${excerpt}${(r.message ?? '').length > 220 ? '…' : ''}"${why}`
  })
  return `YOUR GRADED TRACK RECORD (${rows.length} messages you chose to send; outcome measured from what people actually did afterwards, not from what they said, or the reason a draft was refused):
Totals: ${totalLine}.
${
    audience === 'lead'
      ? `"engaged" = they came back to talk to you within ${GRADE_WINDOW_DAYS[audience]} days.`
      : `"engaged" = within ${GRADE_WINDOW_DAYS[audience]} days they responded to THIS note (opened it into a chat, sent your opener, or wrote back about what you raised); chatting about something else does not count.`
  } "no_response" = nothing attributable happened. ${
    audience === 'lead'
      ? '"unsubscribed" = they unsubscribed from Seoul Sister email.'
      : '"unsubscribed" = they turned off check-in emails (they still see check-ins in the app).'
  } "undelivered" = it never reached them, so it says nothing about your words. "blocked" = a second reader refused your draft before it was sent (it assumed something they never said, made a promise, contradicted a decision, or changed their routine); the reason is shown.
Most recent:
${recent.join('\n')}`
}
