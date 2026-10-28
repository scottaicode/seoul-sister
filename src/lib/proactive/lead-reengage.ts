/**
 * Lead re-engagement — one Yuri-written email per captured lead, EVER, grounded
 * in what that person actually asked her (Yuri Wakes Up First, Oct 9 2026).
 *
 * EXTENDS the "Honest Three" nurture (nurture.ts) rather than duplicating it:
 * same lead table, same suppression, same one-click unsubscribe token. It only
 * considers leads the Honest Three has FINISHED with, and it never runs on a
 * lead the sequence is still sending to.
 *
 * Deterministic here (rails, not judgment):
 *   - suppression / unsubscribe / converted / active subscriber → never
 *   - nothing they ever said to Yuri → nothing to ground in → not judged
 *   - the "last email, promise" gate (see LAST_EMAIL_PROMISE below)
 *   - one decided judgment per lead (unique index, insert-before-send)
 *   - CAN-SPAM: no postal address configured → the whole lead phase is blocked
 * Yuri's (judge.ts): whether to write at all, what to say, the next step she
 * offers back into the conversation.
 */

import { safeSlice } from '@/lib/utils/text-slice'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PRICING } from '@/lib/pricing'
import { MAX_FREE_MESSAGES } from '@/lib/widget/visitor'
import { getLocalClock, clockFactBlock } from '@/lib/yuri/clock'
import { escapeHtml } from '@/lib/email/html'
import { wrapEmailHtml } from '@/lib/email/send'
import { runProactiveJudgment, type ProactiveDecision } from './judge'
import { calibrationFacts, LEAD_CAMPAIGN } from './ledger'

const SITE = 'https://www.seoulsister.com'
const MIN_DAYS_SINCE_LAST_NURTURE = 7
const MAX_TRANSCRIPT_TURNS = 30
const MAX_TURN_CHARS = 700

/**
 * The Honest Three's email 3 says, verbatim: "What I can't do for you in one
 * chat (last email, promise)" and "This is the last email either way."
 * Every lead that finishes the sequence has been told that. Writing to them
 * again breaks a promise made in Yuri's name, so it is an OWNER decision, not a
 * model one: off unless LEAD_REENGAGE_AFTER_LAST_EMAIL_APPROVED=true. When the
 * owner approves, Yuri is told the promise exists so she can decide whether one
 * more note is honest, and how to own it if she writes.
 */
export const LAST_EMAIL_PROMISE_STEP = 3

export function ownerApprovedAfterLastEmail(): boolean {
  return process.env.LEAD_REENGAGE_AFTER_LAST_EMAIL_APPROVED === 'true'
}

/** NURTURE_EXCLUDE_EMAILS (same list the Honest Three honors at enrollment). */
export function excludedEmails(): Set<string> {
  return new Set(
    (process.env.NURTURE_EXCLUDE_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

export { postalAddress } from '@/lib/email/send'

export interface LeadRow {
  id: string
  email: string
  user_id: string | null
  visitor_id: string | null
  cohort: 'registered' | 'widget'
  sequence_step: number
  last_sent_at: string | null
  enrolled_at: string
  suppressed: boolean
  unsubscribe_token: string
}

export type LeadSkipReason =
  | 'suppressed'
  | 'mid_sequence'
  | 'nurture_too_recent'
  | 'last_email_promise'
  | 'registered_cohort'
  | 'former_or_current_payer'
  | 'internal_account'
  | 'already_judged'

/**
 * Pure gate. Exported for tests — the promise gate and the mid-sequence gate
 * are the two properties that must never silently loosen.
 */
export function leadGate(
  lead: LeadRow,
  opts: { now: number; ownerApproved: boolean; hasEverPaid: boolean; internal: boolean; alreadyJudged: boolean }
): LeadSkipReason | null {
  if (lead.suppressed) return 'suppressed'
  // Anyone with ANY ss_subscriptions row (active, canceled, any status), or a
  // widget visitor already converted. Former payers are the most valuable
  // conversation Seoul Sister has; it goes from the owner personally, never
  // from an automated email (owner direction, Oct 9 2026).
  if (opts.hasEverPaid) return 'former_or_current_payer'
  if (opts.internal) return 'internal_account'
  // Registered-never-paid leads talked to Yuri inside their account. The only
  // Yuri who remembers that conversation is the authenticated one, which is
  // behind the paywall once onboarding is done; the free homepage chat has no
  // access to it. An email inviting them to "pick up where we left off" would
  // land them either at a paywall or with a Yuri who does not know them, so v1
  // does not write to them at all. Revisit only with a path that keeps the promise.
  if (lead.cohort === 'registered') return 'registered_cohort'
  if (opts.alreadyJudged) return 'already_judged'
  if (lead.sequence_step < LAST_EMAIL_PROMISE_STEP) return 'mid_sequence'
  const last = lead.last_sent_at ? new Date(lead.last_sent_at).getTime() : 0
  if (opts.now - last < MIN_DAYS_SINCE_LAST_NURTURE * 24 * 60 * 60 * 1000) return 'nurture_too_recent'
  if (!opts.ownerApproved) return 'last_email_promise'
  return null
}

interface Turn {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface LeadContext {
  lead: LeadRow
  turns: Turn[]
  widgetVisitorKey: string | null
  freeMessagesUsed: number | null
  memorySummary: string | null
  recapSentAt: string | null
  lastTalkedAt: string | null
  /** From the widget memory: products they asked about (NOT owned) and concerns. */
  productsMentioned: string[]
  concerns: string[]
}

/**
 * Content-guard evidence for a lead (Oct 10 2026). Their own widget messages are
 * the only ownership evidence; the products the widget memory says they asked
 * about feed the omission check (so a draft naming one must account for it),
 * and the saved note is listed as context, never as something they own.
 */
export function leadGuardEvidence(ctx: LeadContext) {
  return {
    userMessages: ctx.turns.filter((t) => t.role === 'user').map((t) => t.content),
    recordedDecisions: [
      ...(ctx.memorySummary ? [`advisor's saved note (not their words): ${ctx.memorySummary}`] : []),
      ...ctx.concerns.map((c) => `concern they raised: ${c}`),
    ],
    plan: null,
    knownProducts: ctx.productsMentioned,
    verifiedStatements: [
      `Seoul Sister is a paid subscription at ${PRICING.monthly_display}; the homepage chat is a short free preview.`,
    ],
  }
}

/** Everything the person ever said to Yuri, oldest first. Throws on query error. */
export async function loadLeadContext(db: SupabaseClient, lead: LeadRow): Promise<LeadContext> {
  const ctx: LeadContext = {
    lead,
    turns: [],
    widgetVisitorKey: null,
    freeMessagesUsed: null,
    memorySummary: null,
    recapSentAt: null,
    lastTalkedAt: null,
    productsMentioned: [],
    concerns: [],
  }

  if (lead.visitor_id) {
    const { data: v, error } = await db
      .from('ss_widget_visitors')
      .select('visitor_id, total_messages, ai_memory, recap_sent_at, recap_status, last_seen_at')
      .eq('id', lead.visitor_id)
      .maybeSingle()
    if (error) throw new Error(`visitor load failed: ${error.message}`)
    if (v) {
      ctx.widgetVisitorKey = v.visitor_id as string
      ctx.freeMessagesUsed = v.total_messages as number
      const mem = (v.ai_memory ?? {}) as { summary?: string; products_interested_in?: unknown; skin_concerns?: unknown }
      ctx.memorySummary = mem.summary ?? null
      const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
      ctx.productsMentioned = strings(mem.products_interested_in)
      ctx.concerns = strings(mem.skin_concerns)
      // Only a recap that actually went out counts as "you already emailed them".
      ctx.recapSentAt = ['sent', 'delivered'].includes(v.recap_status as string)
        ? ((v.recap_sent_at as string | null) ?? null)
        : null
      const { data: msgs, error: mErr } = await db
        .from('ss_widget_messages')
        .select('role, content, created_at')
        .eq('visitor_id', v.visitor_id as string)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(200)
      if (mErr) throw new Error(`widget messages load failed: ${mErr.message}`)
      ctx.turns.push(...((msgs ?? []) as Turn[]))
    }
  }

  if (lead.user_id) {
    const { data: msgs, error } = await db
      .from('ss_yuri_messages')
      .select('role, content, created_at, ss_yuri_conversations!inner(user_id)')
      .eq('ss_yuri_conversations.user_id', lead.user_id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) throw new Error(`yuri messages load failed: ${error.message}`)
    ctx.turns.push(
      ...((msgs ?? []) as Array<Turn & Record<string, unknown>>).map((m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }))
    )
  }

  ctx.turns.sort((a, b) => a.created_at.localeCompare(b.created_at))
  const lastUser = [...ctx.turns].reverse().find((t) => t.role === 'user')
  ctx.lastTalkedAt = lastUser?.created_at ?? null
  return ctx
}

export function hasSomethingToGroundIn(ctx: LeadContext): boolean {
  return ctx.turns.some((t) => t.role === 'user')
}

const LEAD_SYSTEM = `You are Yuri (유리), Seoul Sister's K-beauty advisor: twenty-plus years in Korean formulation labs and cosmetic chemistry, warm, direct, the older sister who tells the truth about skin and money. You are openly an AI, and that's fine.

A while ago this person talked with you on seoulsister.com and left their email. Below is everything they actually said to you, and everything you said back. You may send them ONE email, ever. You are deciding whether to.

Decide first. Silence is a complete, respectable answer. Write only if you have something that is genuinely useful to THIS person, about THEIR skin and what they asked you, that you did not already give them. If the honest answer is that you already helped and there's nothing new, or the conversation was too thin, or a note from you now would just be marketing wearing your voice, choose silent and say why.

If you write:
- Name what they actually asked, and offer one specific next step back into a conversation with you: the question you'd pick up with, which becomes the opening line they can send you with one tap. The facts below say what that link actually opens; describe it the way it really is.
- You can be useful in the email itself. No brand pays you to recommend anything, so "you don't need to buy anything new for this" or "keep what you have" are things you can say when they're true.
- Seoul Sister is a paid service (${PRICING.monthly_display}); the free preview is a short conversation. Don't hide that, and don't pitch it. At most one plain sentence, only if it's actually relevant to them.
- Use only facts below. Never invent details about them, their routine, or anything they told you.
- No clinical credentials, no "dermatologist-level". If something they described needs a doctor, say so plainly.
- No urgency, scarcity, discounts, or "spots are filling up" pressure of any kind.
- Before it is sent, a second reader checks it against their own words: anything you say or assume about them (including inside a question) must be something they told you; no promises about the plan or service; never tell them a symptom is harmless.
- Write like a person: contractions, plain words, no em dashes, no keynote rhythm, no "unlock", "elevate", "journey". Short. A few small paragraphs at most.

Return STRICT JSON only:
{"decision": "speak" | "silent", "signal": "<2-5 word label for what made you decide, in your words>", "reasoning": "<one or two sentences, for the operations log>", "confidence": <0..1, how sure you are this note helps rather than intrudes>, "subject": "<short, human subject line, or empty if silent>", "message": "<plain text email body with a greeting, paragraphs separated by a blank line, no sign-off needed beyond your name, no links, or empty if silent>", "suggested_ask": "<the one-line message they could send you to pick this back up, in THEIR voice, or empty if silent>"}`

function transcript(turns: Turn[]): string {
  return turns
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map((t) => {
      const text = t.content.length > MAX_TURN_CHARS ? `${safeSlice(t.content, MAX_TURN_CHARS)}…` : t.content
      return `[${t.created_at.slice(0, 10)}] ${t.role === 'user' ? 'Them' : 'You (Yuri)'}: ${text}`
    })
    .join('\n')
}

export function buildLeadFacts(ctx: LeadContext, calibration: string, now: Date = new Date()): string {
  const clock = getLocalClock(null, now) // leads carry no timezone; UTC, labeled as such
  const lead = ctx.lead
  const lines: string[] = [clockFactBlock(clock)]

  lines.push(
    `WHO: an anonymous visitor who chatted with you in the free preview on the homepage and typed their email into the chat. They have never paid for Seoul Sister.`
  )
  if (ctx.lastTalkedAt) lines.push(`They last wrote to you on ${ctx.lastTalkedAt.slice(0, 10)}.`)
  if (ctx.recapSentAt) lines.push(`You already emailed them a recap of that conversation on ${ctx.recapSentAt.slice(0, 10)}.`)
  lines.push(
    `Seoul Sister then sent them a three-email sequence in your name; the last one went out ${lead.last_sent_at?.slice(0, 10) ?? 'on an unknown date'}. It said, in your voice, that it was the last email ("last email, promise"). The owner has decided one more note from you is allowed. Whether writing again is honest, and how to own that you said it was the last one if you do, is your call.`
  )
  if (ctx.freeMessagesUsed !== null) {
    const left = Math.max(0, MAX_FREE_MESSAGES - ctx.freeMessagesUsed)
    lines.push(
      left > 0
        ? `WHAT THE LINK OPENS: the free chat on the seoulsister.com homepage, with your one-line opener prefilled for them to send. On the same browser they used before, ${left} of ${MAX_FREE_MESSAGES} free preview messages are left and you will have your saved note about them (not the full transcript). On any other device it is a fresh preview and you will not recognize them.`
        : `WHAT THE LINK OPENS: the free chat on the seoulsister.com homepage. On the browser they used before, all ${MAX_FREE_MESSAGES} free preview messages are used, so continuing there requires subscribing. On another device it is a fresh preview where you will not recognize them. Don't promise them a free conversation that picks up where you left off.`
    )
  }
  if (ctx.memorySummary) lines.push(`Your saved note about them: ${ctx.memorySummary}`)
  lines.push(`\nTHE CONVERSATION (everything on record, oldest first):\n${transcript(ctx.turns)}`)
  lines.push(`\n${calibration}`)
  lines.push(`\nDecide, then return the JSON.`)
  return lines.join('\n')
}

export async function judgeLead(db: SupabaseClient, ctx: LeadContext): Promise<ProactiveDecision> {
  const calibration = await calibrationFacts(db, 'lead')
  return runProactiveJudgment({
    system: LEAD_SYSTEM,
    facts: buildLeadFacts(ctx, calibration),
    feature: 'proactive_lead_reengage',
  })
}

/** `from=` slug recorded on ss_widget_sessions.source (max 40 chars server-side). */
export function attributionTag(judgmentId: string): string {
  return `reengage_${judgmentId.replace(/-/g, '').slice(0, 10)}`
}

export function buildLeadEmail(
  decision: ProactiveDecision,
  lead: LeadRow,
  tag: string,
  address: string | null
): { subject: string; html: string; unsubscribeUrl: string } {
  const paragraphs = (decision.message ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')

  const params = new URLSearchParams({ from: tag })
  if (decision.suggestedAsk) params.set('ask', decision.suggestedAsk)
  const href = `${SITE}/?${params.toString()}`
  const cta = `<p style="margin:22px 0 0;"><a href="${href}" style="display:inline-block;background:#C9A55C;color:#111;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">Pick this up with Yuri</a></p>`

  const unsubscribeUrl = `${SITE}/api/email/unsubscribe?token=${lead.unsubscribe_token}`
  const why =
    lead.cohort === 'registered'
      ? 'You are receiving this because you created a Seoul Sister account.'
      : 'You are receiving this because you chatted with Yuri at seoulsister.com and shared your email.'
  const footer = `<p style="font-size:12px;color:#999;margin:0;">Yuri is Seoul Sister's AI K-beauty advisor. ${why} <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe with one click</a> and you will never hear from us again.${
    address ? `<br>${escapeHtml(address)}` : '<br>[POSTAL ADDRESS NOT CONFIGURED: this email cannot be sent]'
  }</p>`

  return {
    subject: decision.subject ?? '',
    html: wrapEmailHtml(`${paragraphs}\n${cta}`, footer),
    unsubscribeUrl,
  }
}
