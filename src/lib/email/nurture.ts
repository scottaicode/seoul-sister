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

async function activeSubscriberUserIds(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db
    .from('ss_subscriptions')
    .select('user_id')
    .in('status', ['active', 'trialing'])
  return new Set((data ?? []).map((r) => r.user_id as string))
}

export async function enrollLeads(db: SupabaseClient): Promise<{ enrolled: number }> {
  const excluded = excludedEmails()
  const subscribers = await activeSubscriberUserIds(db)

  const rows: Array<{
    email: string
    user_id: string | null
    visitor_id: string | null
    cohort: NurtureCohort
  }> = []

  // Cohort A: registered accounts with no active subscription.
  const { data: userList, error: listError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  })
  if (listError) {
    console.error('[nurture] listUsers failed:', listError.message)
  } else {
    for (const u of userList.users) {
      const email = u.email?.toLowerCase()
      if (!email || excluded.has(email) || subscribers.has(u.id)) continue
      rows.push({ email, user_id: u.id, visitor_id: null, cohort: 'registered' })
    }
  }

  // Cohort B: widget visitors who shared an email with Yuri.
  const { data: visitors } = await db
    .from('ss_widget_visitors')
    .select('id, captured_email')
    .not('captured_email', 'is', null)
  for (const v of visitors ?? []) {
    const email = (v.captured_email as string).toLowerCase()
    if (!email || excluded.has(email)) continue
    // Registered cohort wins if the same email exists in both (dedup below keeps first).
    if (!rows.some((r) => r.email === email)) {
      rows.push({ email, user_id: null, visitor_id: v.id as string, cohort: 'widget' })
    }
  }

  if (rows.length === 0) return { enrolled: 0 }

  const { data: inserted, error } = await db
    .from('ss_nurture_leads')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('[nurture] enrollment upsert failed:', error.message)
    return { enrolled: 0 }
  }
  return { enrolled: inserted?.length ?? 0 }
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
  visitorRowId: string | null
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
  return { url: widgetEmailLink('nurture_1', token), remaining: Math.max(0, MAX_FREE_MESSAGES - used) }
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
): Promise<{ enrolled: number; sent: number; converted: number; errors: number; skipped_reason?: 'no_postal_address' }> {
  const { enrolled } = await enrollLeads(db)
  // These emails sell the plan, so they are marketing mail and must carry the
  // sender's postal address (CAN-SPAM). No address configured -> send nothing
  // and say why; sends resume on their own once EMAIL_POSTAL_ADDRESS is set.
  if (!postalAddress()) {
    console.warn('[nurture] skipped: EMAIL_POSTAL_ADDRESS not set (marketing email needs a postal address)')
    return { enrolled, sent: 0, converted: 0, errors: 0, skipped_reason: 'no_postal_address' }
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
    return { enrolled, sent: 0, converted: 0, errors: 1 }
  }

  const subscribers = await activeSubscriberUserIds(db)
  let sent = 0
  let converted = 0
  let errors = 0

  for (const lead of (leads ?? []) as NurtureLead[]) {
    if (sent >= BATCH_LIMIT) break
    if (!isDue(lead, now)) continue

    // Exit: the lead converted since the last send. Never pitch a subscriber.
    if (lead.user_id && subscribers.has(lead.user_id)) {
      await db
        .from('ss_nurture_leads')
        .update({ suppressed: true, suppressed_reason: 'converted', updated_at: now.toISOString() })
        .eq('id', lead.id)
      converted++
      continue
    }

    const step = (lead.sequence_step + 1) as 1 | 2 | 3
    const resume =
      step === 1 && lead.cohort === 'widget' ? await widgetResumeUrl(db, lead.visitor_id) : null
    const { subject, bodyHtml, footerHtml, unsubscribeUrl } = buildNurtureEmail(
      step,
      lead.cohort,
      lead.unsubscribe_token,
      { resumeUrl: resume?.url ?? null, resumeRemaining: resume?.remaining ?? null }
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
