/**
 * Nurture sequence engine — the "Honest Three" (see nurture-copy.ts).
 *
 * enrollLeads():   idempotently pulls every lead the funnel has ever captured
 *                  into ss_nurture_leads — registered-but-never-paid users
 *                  (via the auth admin API; emails live in auth.users) and
 *                  widget visitors who shared an email with Yuri.
 * processDueSends(): sends the next step to every due, unsuppressed lead,
 *                  with a conversion check right before each send (a lead who
 *                  subscribed mid-sequence exits silently — never pitch a
 *                  paying customer).
 *
 * Behavioral exits: converted → suppressed('converted');
 * unsubscribe link → suppressed('unsubscribed') via /api/email/unsubscribe.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, wrapEmailHtml, postalAddress } from './send'
import { buildNurtureEmail, STEP_DELAYS_DAYS, type NurtureCohort } from './nurture-copy'
import { createResumeToken, widgetEmailLink } from '@/lib/widget/resume-token'
import { normalizeOfferCode } from '@/lib/offers'
import { PAID_PLAN_KEYS } from '@/lib/pricing'
import { MAX_FREE_MESSAGES } from '@/lib/widget/visitor'

const BATCH_LIMIT = 20

interface NurtureLead {
  id: string
  email: string
  user_id: string | null
  cohort: NurtureCohort
  /** ss_widget_visitors.id (uuid), NOT the browser's text visitor_id. */
  visitor_id: string | null
  sequence_step: number
  last_sent_at: string | null
  enrolled_at: string
  unsubscribe_token: string
}

function excludedEmails(): Set<string> {
  return new Set(
    (process.env.NURTURE_EXCLUDE_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * Who is a member right now, by account id AND by email address (Nov 12 2026).
 *
 * A member is anyone with an active, trialing or past-due subscription, or
 * whose profile is on a paid plan (comped and grandfathered accounts have no
 * subscription). Past-due counts: someone whose card just failed is a member
 * being retried by Stripe, not a stranger to pitch.
 *
 * By email as well as by id, because a chat lead is enrolled from the address
 * they typed and has no account id. Checking ids only, a visitor who chatted,
 * gave an email and started the free week was sent "you can talk to me free"
 * the next morning (the owner's own walkthrough, Nov 12), and would have been
 * sent the membership pitch a week into being a member.
 *
 * Returns null when any of the three reads fails. "Could not check" is never
 * "nobody is a member": the caller sends nothing on null.
 */
export interface Members {
  ids: Set<string>
  emails: Set<string>
  /** Every account, for enrolling the ones with no membership. */
  accounts: Array<{ id: string; email: string }>
}

const ACCOUNTS_PER_PAGE = 1000
const MAX_ACCOUNT_PAGES = 50

export async function loadMembers(db: SupabaseClient): Promise<Members | null> {
  const ids = new Set<string>()
  const { data: subs, error: subErr } = await db.from('ss_subscriptions').select('user_id').in('status', ['active', 'trialing', 'past_due'])
  if (subErr) {
    console.error('[nurture] subscription read failed:', subErr.message)
    return null
  }
  for (const r of subs ?? []) if (r.user_id) ids.add(r.user_id as string)

  const { data: planned, error: planErr } = await db.from('ss_user_profiles').select('user_id').in('plan', [...PAID_PLAN_KEYS])
  if (planErr) {
    console.error('[nurture] plan read failed:', planErr.message)
    return null
  }
  for (const r of planned ?? []) if (r.user_id) ids.add(r.user_id as string)

  const accounts: Members['accounts'] = []
  for (let page = 1; ; page++) {
    if (page > MAX_ACCOUNT_PAGES) {
      console.error(`[nurture] more than ${ACCOUNTS_PER_PAGE * MAX_ACCOUNT_PAGES} accounts: the account list was not read to the end`)
      return null
    }
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: ACCOUNTS_PER_PAGE })
    if (error) {
      console.error('[nurture] listUsers failed:', error.message)
      return null
    }
    // Stop on an EMPTY page, never on a short one: the server may hand back
    // fewer rows than asked for, and a short page read as the last page would
    // leave every later member looking like a lead.
    if (data.users.length === 0) break
    for (const u of data.users) if (u.email) accounts.push({ id: u.id, email: u.email.trim().toLowerCase() })
  }

  const emails = new Set(accounts.filter((a) => ids.has(a.id)).map((a) => a.email))
  return { ids, emails, accounts }
}

export async function enrollLeads(db: SupabaseClient, members: Members): Promise<{ enrolled: number; errors: number }> {
  const excluded = excludedEmails()

  const rows: Array<{
    email: string
    user_id: string | null
    visitor_id: string | null
    cohort: NurtureCohort
  }> = []

  // Cohort A: registered accounts with no membership.
  for (const u of members.accounts) {
    if (excluded.has(u.email) || members.ids.has(u.id)) continue
    rows.push({ email: u.email, user_id: u.id, visitor_id: null, cohort: 'registered' })
  }

  // Cohort B: widget visitors who shared an email with Yuri.
  let errors = 0
  const { data: visitors, error: visitorErr } = await db
    .from('ss_widget_visitors')
    .select('id, captured_email, registered_user_id, converted_user_id')
    .not('captured_email', 'is', null)
  if (visitorErr) {
    // Counted, so a run that could not read the chat leads is not recorded as clean.
    console.error('[nurture] lead read failed:', visitorErr.message)
    errors++
  }
  for (const v of visitors ?? []) {
    const email = (v.captured_email as string).trim().toLowerCase()
    // A member's address is never a lead, whichever browser they chatted in.
    // Nor is a chat already tied to a member's account, when they signed up
    // with a different address from the one they typed to Yuri.
    const linked = [v.registered_user_id, v.converted_user_id].some((id) => typeof id === 'string' && members.ids.has(id))
    if (!email || excluded.has(email) || members.emails.has(email) || linked) continue
    // Registered cohort wins if the same email exists in both (dedup below keeps first).
    if (!rows.some((r) => r.email === email)) {
      rows.push({ email, user_id: null, visitor_id: v.id as string, cohort: 'widget' })
    }
  }

  if (rows.length === 0) return { enrolled: 0, errors }

  const { data: inserted, error } = await db
    .from('ss_nurture_leads')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('[nurture] enrollment upsert failed:', error.message)
    return { enrolled: 0, errors: errors + 1 }
  }
  return { enrolled: inserted?.length ?? 0, errors }
}

/**
 * The creator code a widget lead arrived with (ss_widget_visitors.offer_code),
 * or null. A failed lookup is logged and sends the email without the code: the
 * lead can still type it on the Stripe page.
 */
export async function leadOfferCode(db: SupabaseClient, visitorRowId: string | null): Promise<string | null> {
  if (!visitorRowId) return null
  const { data, error } = await db.from('ss_widget_visitors').select('offer_code').eq('id', visitorRowId).maybeSingle()
  if (error) {
    console.error('[nurture] offer code lookup failed:', error.message)
    return null
  }
  return normalizeOfferCode((data?.offer_code as string | null | undefined) ?? null)
}

/**
 * Encrypted link reopening a widget lead's most recent open conversation, plus
 * the lead's remaining free preview messages, or null (no visitor, no
 * conversation, the visitor chose "Start over", a failed query, or no usable
 * WIDGET_RESUME_SECRET). Null means email 1 uses its neutral subject and the
 * plain homepage button, so it never promises a conversation the link can't
 * reopen.
 */
export async function widgetResumeUrl(
  db: SupabaseClient,
  visitorRowId: string | null,
  offerCode: string | null = null
): Promise<{ url: string; remaining: number } | null> {
  if (!visitorRowId) return null
  const { data: visitor, error: vErr } = await db
    .from('ss_widget_visitors')
    .select('visitor_id, total_messages')
    .eq('id', visitorRowId)
    .maybeSingle()
  if (vErr) {
    console.error('[nurture] resume visitor lookup failed:', vErr.message)
    return null
  }
  if (!visitor?.visitor_id) return null
  const { data: sessions, error: sErr } = await db
    .from('ss_widget_sessions')
    .select('id')
    .eq('visitor_id', visitor.visitor_id as string)
    .gt('message_count', 0)
    .not('ended_naturally', 'is', true)
    .order('last_message_at', { ascending: false })
    .limit(1)
  if (sErr) {
    console.error('[nurture] resume session lookup failed:', sErr.message)
    return null
  }
  const sessionId = sessions?.[0]?.id as string | undefined
  if (!sessionId) return null
  const token = createResumeToken(visitor.visitor_id as string, sessionId)
  if (!token) return null
  const used = typeof visitor.total_messages === 'number' ? visitor.total_messages : 0
  return { url: widgetEmailLink('nurture_1', token, offerCode), remaining: Math.max(0, MAX_FREE_MESSAGES - used) }
}

function isDue(lead: NurtureLead, now: Date): boolean {
  if (lead.sequence_step >= 3) return false
  const nextStep = lead.sequence_step + 1
  const delayDays = STEP_DELAYS_DAYS[nextStep - 1]
  const anchor = lead.last_sent_at ?? lead.enrolled_at
  const dueAt = new Date(anchor).getTime() + delayDays * 24 * 60 * 60 * 1000
  return now.getTime() >= dueAt
}

export async function processDueSends(
  db: SupabaseClient
): Promise<{ enrolled: number; sent: number; converted: number; errors: number; skipped_reason?: 'no_postal_address' | 'members_unreadable' }> {
  // Who is a member is read once, before anyone is enrolled or emailed. If it
  // cannot be read, nothing is sent: a failed read must not turn every member
  // into a lead.
  const members = await loadMembers(db)
  if (!members) return { enrolled: 0, sent: 0, converted: 0, errors: 1, skipped_reason: 'members_unreadable' }
  const { enrolled, errors: enrollErrors } = await enrollLeads(db, members)
  // These emails sell the plan, so they are marketing mail and must carry the
  // sender's postal address (CAN-SPAM). No address configured -> send nothing
  // and say why; sends resume on their own once EMAIL_POSTAL_ADDRESS is set.
  if (!postalAddress()) {
    console.warn('[nurture] skipped: EMAIL_POSTAL_ADDRESS not set (marketing email needs a postal address)')
    return { enrolled, sent: 0, converted: 0, errors: enrollErrors, skipped_reason: 'no_postal_address' }
  }
  const now = new Date()

  const { data: leads, error } = await db
    .from('ss_nurture_leads')
    .select('id, email, user_id, cohort, visitor_id, sequence_step, last_sent_at, enrolled_at, unsubscribe_token')
    .eq('suppressed', false)
    .lt('sequence_step', 3)
    .order('enrolled_at', { ascending: true })
  if (error) {
    console.error('[nurture] due-lead query failed:', error.message)
    return { enrolled, sent: 0, converted: 0, errors: enrollErrors + 1 }
  }

  let sent = 0
  let converted = 0
  let errors = enrollErrors

  for (const lead of (leads ?? []) as NurtureLead[]) {
    if (sent >= BATCH_LIMIT) break
    if (!isDue(lead, now)) continue

    // Exit: the lead is a member now, by account or by address. Never pitch a member.
    if ((lead.user_id && members.ids.has(lead.user_id)) || members.emails.has(lead.email.trim().toLowerCase())) {
      const { error: exitErr } = await db
        .from('ss_nurture_leads')
        .update({ suppressed: true, suppressed_reason: 'converted', updated_at: now.toISOString() })
        .eq('id', lead.id)
      if (exitErr) console.error('[nurture] could not mark a lead converted:', exitErr.message)
      converted++
      continue
    }

    const step = (lead.sequence_step + 1) as 1 | 2 | 3
    // The creator code this lead arrived with, so the email's links carry it.
    const offerCode = lead.cohort === 'widget' ? await leadOfferCode(db, lead.visitor_id) : null
    const resume =
      step === 1 && lead.cohort === 'widget' ? await widgetResumeUrl(db, lead.visitor_id, offerCode) : null
    const { subject, bodyHtml, footerHtml, unsubscribeUrl } = buildNurtureEmail(
      step,
      lead.cohort,
      lead.unsubscribe_token,
      { resumeUrl: resume?.url ?? null, resumeRemaining: resume?.remaining ?? null, offerCode }
    )
    const result = await sendEmail(lead.email, subject, wrapEmailHtml(bodyHtml, footerHtml), {
      unsubscribeUrl,
    })

    if (result.sent) {
      await db
        .from('ss_nurture_leads')
        .update({
          sequence_step: step,
          last_sent_at: now.toISOString(),
          updated_at: now.toISOString(),
          // The current email 3 makes no "last email" promise. This is the ONLY
          // place the column becomes false; it is true by default, so a lead
          // sent email 3 by older code stays marked as told.
          ...(step === 3 ? { told_last_email: false } : {}),
        })
        .eq('id', lead.id)
      sent++
    } else {
      console.error(`[nurture] send failed (step ${step}) for lead ${lead.id}: ${result.reason ?? 'unknown'}`)
      errors++
    }
  }

  return { enrolled, sent, converted, errors }
}
