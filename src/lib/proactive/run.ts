/**
 * Yuri Wakes Up First — one run: grade what matured, judge subscribers, judge
 * leads. Shared by the cron route (live) and the dry-run path (route POST
 * {dry_run:true} and scripts/dry-run-yuri-wakes-up.ts).
 *
 * DRY RUN writes NOTHING and sends NOTHING: no judgment rows, no nudge rows, no
 * run row, no email. It returns the exact subject/body each recipient would get.
 *
 * LIVE requires YURI_WAKES_UP_MODE=live. Anything else and the route logs a
 * run row that says "off" and does no work, so a disabled job is visible in
 * data and never mistaken for "ran and found nothing".
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeDecisionMemory, type DecisionMemory, type UserContext } from '@/lib/yuri/memory'
import { sendEmail } from '@/lib/email/send'
import { sendNudgeEmail, buildNudgeEmailHtml, type NudgeEmailStatus } from '@/lib/email/nudge-email'
import { getLocalClock } from '@/lib/yuri/clock'
import {
  recordJudgment,
  recordDelivery,
  gradeMatured,
  LEAD_CAMPAIGN,
  CHECKIN_CAMPAIGN,
} from './ledger'
import {
  leadGate,
  loadLeadContext,
  hasSomethingToGroundIn,
  judgeLead,
  buildLeadEmail,
  attributionTag,
  ownerApprovedAfterLastEmail,
  postalAddress,
  excludedEmails,
  leadGuardEvidence,
  type LeadRow,
} from './lead-reengage'
import { checkinGate, judgeSubscriber, dogfoodUserIds, type SubscriberRow } from './subscriber-checkin'
import type { ProactiveDecision } from './judge'
import { checkProactiveDraft, type GuardEvidence } from './content-guard'
import { safeSlice } from '@/lib/utils/text-slice'
import { PAID_PLAN_KEYS } from '@/lib/pricing'

/**
 * Every 'speak' passes the closed-world content guard before it can be
 * recorded or sent. A refused draft becomes decision 'blocked', keeping the
 * draft and the reasons so the refusal is a graded fact Yuri can learn from.
 */
export async function guardDecision(
  decision: ProactiveDecision,
  evidence: GuardEvidence,
  userId?: string
): Promise<{ decision: ProactiveDecision; guardReasons: string[] | null }> {
  if (decision.decision !== 'speak' || !decision.message) return { decision, guardReasons: null }
  const g = await checkProactiveDraft({ message: decision.message, subject: decision.subject, evidence, userId })
  if (g.pass) return { decision, guardReasons: [] }
  return { decision: { ...decision, decision: 'blocked' }, guardReasons: g.reasons }
}

export interface RunOptions {
  dryRun: boolean
  /**
   * Which phases this invocation runs. The cron fires hourly so every
   * timezone's 9am-8pm window is reachable for subscribers; grading and the
   * lead phase (leads have no timezone) run once a day. Default: all.
   */
  phases?: { grade: boolean; subscribers: boolean; leads: boolean }
  leadLimit: number
  /** Restrict to these users / nurture lead ids (dry-run review of named recipients). */
  onlyUserIds?: string[]
  onlyLeadIds?: string[]
  /** DRY RUN ONLY: render as if the owner had approved writing after the last-email promise. */
  assumeOwnerApproval?: boolean
  /** DRY RUN ONLY: ignore the local-daytime gate so a review can run any hour. */
  bypassDaytime?: boolean
  /**
   * DRY RUN ONLY: settled memory not yet written (memory-settle dry run), keyed
   * by conversation id. Substituted in-process so the render shows what Yuri
   * would say once the backfill is applied. Never used on a live run.
   */
  memoryOverrides?: Map<string, MemoryOverride>
}

export interface MemoryOverride {
  summary: { summaryBody: string; openerText: string | null } | null
  decisionMemory: DecisionMemory | null
}

/** Substitute settled memory into a loaded context (dry run). */
async function applyMemoryOverrides(
  db: SupabaseClient,
  userId: string,
  ctx: UserContext,
  overrides: Map<string, MemoryOverride>
): Promise<void> {
  for (const c of ctx.recentConversations) {
    const o = overrides.get(c.conversationId)
    if (o?.summary) {
      c.aiSummary = o.summary.summaryBody
      c.nextSessionOpener = o.summary.openerText
    }
  }
  // Rebuild decision memory the way the loader does (3 most recent conversations,
  // oldest first, merged), with settled memory substituted.
  const { data, error } = await db
    .from('ss_yuri_conversations')
    .select('id, decision_memory')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)
  if (error) throw new Error(`override dm load: ${error.message}`)
  let merged: DecisionMemory | null = null
  for (const conv of [...(data ?? [])].reverse()) {
    const dm = overrides.get(conv.id as string)?.decisionMemory ?? (conv.decision_memory as DecisionMemory | null)
    if (dm && Object.keys(dm).length) merged = mergeDecisionMemory(merged, dm)
  }
  ctx.decisionMemory = merged
}

export interface DryRunRender {
  audience: 'lead' | 'subscriber'
  recipientRef: string
  decision: ProactiveDecision['decision']
  signal: string | null
  reasoning: string | null
  confidence: number | null
  subject: string | null
  html: string | null
  suggestedAsk: string | null
  /** Draft text when the guard blocked it (null otherwise). */
  blockedDraft?: string | null
  guardReasons?: string[] | null
}

/**
 * DRY RUN ONLY: before the migration is applied the ledger table does not
 * exist. A review run may treat that as "no prior judgments" (true: none can
 * exist). A LIVE run never does; there it stays an error.
 */
function ledgerMissing(err: { message?: string; code?: string } | null, dryRun: boolean): boolean {
  return dryRun && !!err && (err.code === 'PGRST205' || /ss_proactive_judgments/.test(err.message ?? ''))
}

/**
 * The check-in's "pick this up" link. Never throws: encodeURIComponent throws
 * on a lone surrogate, so the ask is made well-formed first. Exported for tests.
 */
export function checkinDeepLink(ask: string | null): string {
  const text = (ask ?? 'Picking up your check-in').replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '�'
  )
  return `/yuri?ask=${encodeURIComponent(text)}`
}

const count = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1
}

async function resolveUserEmail(db: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await db.auth.admin.getUserById(userId)
    if (error) {
      console.error(`[proactive] email lookup failed for ${userId}:`, error.message)
      return null
    }
    return data?.user?.email ?? null
  } catch (err) {
    console.error(`[proactive] email lookup threw for ${userId}:`, err)
    return null
  }
}

export async function runYuriWakesUp(db: SupabaseClient, opts: RunOptions) {
  const now = Date.now()
  const renders: DryRunRender[] = []
  const errors: string[] = []

  // ---- 1. Teacher ---------------------------------------------------------
  const phases = opts.phases ?? { grade: true, subscribers: true, leads: true }
  const grading = opts.dryRun
    ? { graded: 0, retentionChecked: 0, errors: 0, skipped: 'dry_run' }
    : phases.grade
      ? await gradeMatured(db)
      : { graded: 0, retentionChecked: 0, errors: 0, skipped: 'not_this_hour' }

  // ---- 2. Subscribers -----------------------------------------------------
  const sub = { scanned: 0, skipped: {} as Record<string, number>, speak: 0, silent: 0, failed: 0, blocked: 0, emailOutcomes: {} as Record<string, number> }

  let profQuery = db
    .from('ss_user_profiles')
    .select('user_id, timezone, latitude, longitude, is_demo, is_admin, excluded_from_metrics, nudge_email_opt_out, nudge_unsubscribe_token')
    .eq('onboarding_completed', true)
    .in('plan', [...PAID_PLAN_KEYS])
  if (opts.onlyUserIds?.length) profQuery = profQuery.in('user_id', opts.onlyUserIds)
  const { data: profiles, error: profErr } = phases.subscribers
    ? await profQuery
    : { data: [] as Array<Record<string, unknown>>, error: null }
  if (!phases.subscribers) count(sub.skipped, 'phase_not_this_hour')
  if (profErr) {
    errors.push(`profile load: ${profErr.message}`)
  } else {
    const ids = (profiles ?? []).map((p) => p.user_id as string)
    // A canceled Stripe row no longer excludes anyone: canceling clears the
    // plan (webhook), so a paid plan on a canceled account was set on purpose
    // (a comp) and that member gets check-ins like any other (Oct 31 2026).
    const [subsRes, nudgesRes, judgedRes] = await Promise.all([
      db.from('ss_subscriptions').select('user_id, status').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      db.from('ss_user_nudges').select('user_id, created_at').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      db
        .from('ss_proactive_judgments')
        .select('user_id, created_at')
        .eq('campaign', CHECKIN_CAMPAIGN)
        .gte('created_at', new Date(now - 48 * 3600 * 1000).toISOString()),
    ])
    // A failed load here would read as "no prior nudges / never canceled" and
    // hand out fresh contact — make it an error and skip the phase instead.
    const loadErr = subsRes.error || nudgesRes.error || (ledgerMissing(judgedRes.error, opts.dryRun) ? null : judgedRes.error)
    if (loadErr) {
      errors.push(`subscriber gate load: ${loadErr.message}`)
    } else {
      const dogfood = dogfoodUserIds()
      for (const p of (profiles ?? []) as Array<SubscriberRow & { is_admin: boolean | null; excluded_from_metrics: boolean | null }>) {
        sub.scanned++
        const isDogfood = dogfood.has(p.user_id)
        const rows = (subsRes.data ?? []).filter((r) => r.user_id === p.user_id)
        // Comped = no live Stripe subscription (never had one, or canceled and
        // then given the plan). Recorded on every judgment so results for
        // comped and paying members are never averaged together.
        const comped = !rows.some((r) => r.status === 'active' || r.status === 'trialing')
        const nudgeCreatedAts = (nudgesRes.data ?? []).filter((r) => r.user_id === p.user_id).map((r) => r.created_at as string)
        const lastJudgedAt =
          (judgedRes.data ?? [])
            .filter((r) => r.user_id === p.user_id)
            .map((r) => r.created_at as string)
            .sort()
            .pop() ?? null
        const skip = checkinGate(p, {
          internal: (p.is_admin === true || p.excluded_from_metrics === true) && !isDogfood,
          nudgeCreatedAts,
          lastJudgedAt: opts.dryRun ? null : lastJudgedAt,
          now,
          bypassDaytime: opts.dryRun && opts.bypassDaytime,
        })
        if (skip) {
          count(sub.skipped, skip)
          continue
        }

        try {
          const judged = await judgeSubscriber(
            db,
            p,
            now,
            opts.dryRun && opts.memoryOverrides
              ? (ctx) => applyMemoryOverrides(db, p.user_id, ctx, opts.memoryOverrides!)
              : undefined
          )
          const { decision, guardReasons } = await guardDecision(judged.decision, judged.evidence, p.user_id)
          sub[decision.decision]++

          const windowCount = nudgeCreatedAts.filter((c) => new Date(c).getTime() >= now - 30 * 86400000).length

          if (opts.dryRun) {
            const deepLink = checkinDeepLink(decision.suggestedAsk)
            renders.push({
              audience: 'subscriber',
              recipientRef: `user ${p.user_id.slice(0, 8)}`,
              decision: decision.decision,
              signal: decision.signal,
              reasoning: decision.reasoning,
              confidence: decision.confidence,
              subject: decision.subject,
              html:
                decision.decision === 'speak' && decision.message
                  ? buildNudgeEmailHtml({
                      nudgeId: 'dry-run',
                      message: decision.message,
                      deepLink,
                      nudgeType: 'yuri_checkin',
                      nudgeSequence: windowCount + 1,
                      unsubscribeToken: p.nudge_unsubscribe_token,
                      subject: decision.subject,
                    })
                  : null,
              suggestedAsk: decision.suggestedAsk,
              blockedDraft: decision.decision === 'blocked' ? decision.message : null,
              guardReasons,
            })
            continue
          }

          const judgmentId = await recordJudgment(db, {
            audience: 'subscriber',
            campaign: CHECKIN_CAMPAIGN,
            user_id: p.user_id,
            decision,
            context_facts: {
              nudge_email_opt_out_at_send: p.nudge_email_opt_out === true,
              ...(isDogfood ? { dogfood: true } : {}),
              comped,
              ...(guardReasons ? { guard: guardReasons } : {}),
              local_date: getLocalClock(p.timezone, new Date(now)).isoDate,
            },
            delivery_status: decision.decision === 'speak' ? 'pending' : null,
          })
          if (decision.decision !== 'speak' || !judgmentId || !decision.message) continue

          // Built only AFTER the judgment row exists: anything that can throw
          // must come after the record, so "silence is a row" (and "speak is a
          // row") holds even when a later step fails.
          const deepLink = checkinDeepLink(decision.suggestedAsk)
          const { data: nudge, error: nErr } = await db
            .from('ss_user_nudges')
            .insert({
              user_id: p.user_id,
              nudge_type: 'yuri_checkin',
              trigger_reason: `yuri_checkin_${judgmentId.slice(0, 8)}`,
              message: decision.message,
              deep_link: deepLink,
              nudge_sequence: windowCount + 1,
              status: 'pending',
            })
            .select('id')
            .single()
          if (nErr || !nudge) {
            errors.push(`nudge insert ${p.user_id.slice(0, 8)}: ${nErr?.message}`)
            await recordDelivery(db, judgmentId, { delivery_status: 'nudge_insert_failed' })
            continue
          }

          const status: NudgeEmailStatus = await sendNudgeEmail(
            await resolveUserEmail(db, p.user_id),
            p.nudge_email_opt_out === true,
            {
              nudgeId: nudge.id,
              message: decision.message,
              deepLink,
              nudgeType: 'yuri_checkin',
              nudgeSequence: windowCount + 1,
              unsubscribeToken: p.nudge_unsubscribe_token,
              subject: decision.subject,
            }
          )
          count(sub.emailOutcomes, status)
          // The dashboard card delivers it regardless of the email outcome, so the
          // grading clock starts now either way; the email status rides along.
          await recordDelivery(db, judgmentId, { delivery_status: status, sent_at: new Date().toISOString(), nudge_id: nudge.id })
        } catch (err) {
          sub.failed++
          const message = err instanceof Error ? err.message : String(err)
          errors.push(`subscriber ${p.user_id.slice(0, 8)}: ${message}`)
          // A judgment that threw before it was recorded still leaves a row
          // (decision 'failed'), so a crashed day is never indistinguishable
          // from a day that never ran. Best effort; its own failure is logged.
          if (!opts.dryRun) {
            await recordJudgment(db, {
              audience: 'subscriber',
              campaign: CHECKIN_CAMPAIGN,
              user_id: p.user_id,
              decision: {
                decision: 'failed',
                signal: null,
                reasoning: safeSlice(message, 300),
                confidence: null,
                subject: null,
                message: null,
                suggestedAsk: null,
                model: 'n/a',
              },
              context_facts: { local_date: getLocalClock(p.timezone, new Date(now)).isoDate, error_stage: 'pre_record' },
            }).catch((e) => errors.push(`failed-row write: ${e instanceof Error ? e.message : String(e)}`))
          }
        }
      }
    }
  }

  // ---- 3. Leads -----------------------------------------------------------
  const lead = {
    phase: 'ran' as string,
    considered: 0,
    skipped: {} as Record<string, number>,
    speak: 0,
    silent: 0,
    failed: 0,
    blocked: 0,
    sent: 0,
    sendOutcomes: {} as Record<string, number>,
  }
  const address = postalAddress()
  const ownerApproved = ownerApprovedAfterLastEmail() || (opts.dryRun && opts.assumeOwnerApproval === true)

  if (!phases.leads) {
    lead.phase = 'not_this_hour'
  } else if (!address && !opts.dryRun) {
    // CAN-SPAM requires a valid postal address in commercial email. Block the
    // whole phase loudly rather than send non-compliant mail or burn judgments.
    lead.phase = 'blocked_no_postal_address'
  } else if (!process.env.RESEND_API_KEY && !opts.dryRun) {
    // Without a provider every send would no-op AFTER the lead's one-ever
    // judgment was recorded, consuming it with nothing delivered. Block instead.
    lead.phase = 'blocked_no_email_provider'
  } else {
    let leadQuery = db
      .from('ss_nurture_leads')
      .select('id, email, user_id, visitor_id, cohort, sequence_step, last_sent_at, enrolled_at, suppressed, unsubscribe_token')
      .order('enrolled_at', { ascending: true })
    if (opts.onlyLeadIds?.length) leadQuery = leadQuery.in('id', opts.onlyLeadIds)
    const [leadsRes, subsRes, judgedRes, internalRes, convertedRes, usersRes] = await Promise.all([
      leadQuery,
      // ANY status: a former payer is excluded exactly like a current one.
      db.from('ss_subscriptions').select('user_id'),
      db.from('ss_proactive_judgments').select('nurture_lead_id').eq('campaign', LEAD_CAMPAIGN).in('decision', ['speak', 'silent', 'blocked']),
      // Founder/test/demo accounts are not leads, even when the Honest Three
      // enrolled them (the founder's canceled test account was).
      // Comped accounts (plan pro*, no Stripe row) count as internal here too.
      db.from('ss_user_profiles').select('user_id').or('is_admin.eq.true,is_demo.eq.true,excluded_from_metrics.eq.true,plan.like.pro%'),
      db.from('ss_widget_visitors').select('captured_email').not('converted_at', 'is', null),
      // A widget lead's address may belong to an account made later; resolve it
      // so the payer/internal checks see the person, not just the lead row.
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    const loadErr =
      leadsRes.error ||
      subsRes.error ||
      (ledgerMissing(judgedRes.error, opts.dryRun) ? null : judgedRes.error) ||
      internalRes.error ||
      convertedRes.error ||
      usersRes.error
    if (loadErr) {
      lead.phase = 'load_failed'
      errors.push(`lead load: ${loadErr.message}`)
    } else {
      const everPaid = new Set((subsRes.data ?? []).map((r) => r.user_id as string))
      const convertedEmails = new Set(
        (convertedRes.data ?? []).map((r) => String(r.captured_email ?? '').toLowerCase()).filter(Boolean)
      )
      const userByEmail = new Map<string, string>()
      for (const u of usersRes.data?.users ?? []) if (u.email) userByEmail.set(u.email.toLowerCase(), u.id)
      const judged = new Set((judgedRes.data ?? []).map((r) => r.nurture_lead_id as string))
      const internalUsers = new Set((internalRes.data ?? []).map((r) => r.user_id as string))
      const excluded = excludedEmails()
      let judgedThisRun = 0
      const personId = (l: LeadRow) => l.user_id ?? userByEmail.get(l.email.toLowerCase()) ?? null

      for (const l of (leadsRes.data ?? []) as LeadRow[]) {
        lead.considered++
        const skip = leadGate(l, {
          now,
          ownerApproved,
          hasEverPaid:
            (!!personId(l) && everPaid.has(personId(l)!)) || convertedEmails.has(l.email.toLowerCase()),
          internal: (!!personId(l) && internalUsers.has(personId(l)!)) || excluded.has(l.email.toLowerCase()),
          alreadyJudged: judged.has(l.id),
        })
        if (skip) {
          count(lead.skipped, skip)
          continue
        }
        if (judgedThisRun >= opts.leadLimit) {
          count(lead.skipped, 'batch_limit')
          continue
        }

        try {
          const ctx = await loadLeadContext(db, l)
          if (!hasSomethingToGroundIn(ctx)) {
            count(lead.skipped, 'nothing_to_ground_in')
            continue
          }
          judgedThisRun++
          const { decision, guardReasons } = await guardDecision(await judgeLead(db, ctx), leadGuardEvidence(ctx))
          lead[decision.decision]++

          if (opts.dryRun) {
            const email = decision.decision === 'speak' ? buildLeadEmail(decision, l, 'reengage_DRYRUN', address) : null
            renders.push({
              audience: 'lead',
              recipientRef: `lead ${l.id.slice(0, 8)} (${l.cohort}, ${ctx.turns.filter((t) => t.role === 'user').length} msgs from them)`,
              decision: decision.decision,
              signal: decision.signal,
              reasoning: decision.reasoning,
              confidence: decision.confidence,
              subject: decision.subject,
              html: email?.html ?? null,
              suggestedAsk: decision.suggestedAsk,
              blockedDraft: decision.decision === 'blocked' ? decision.message : null,
              guardReasons,
            })
            continue
          }

          const judgmentId = await recordJudgment(db, {
            audience: 'lead',
            campaign: LEAD_CAMPAIGN,
            user_id: l.user_id,
            nurture_lead_id: l.id,
            widget_visitor_id: ctx.widgetVisitorKey,
            decision,
            context_facts: {
              cohort: l.cohort,
              free_messages_used: ctx.freeMessagesUsed,
              last_email_promise_sent_at: l.last_sent_at,
              owner_approved_after_last_email: ownerApproved,
              ...(guardReasons ? { guard: guardReasons } : {}),
            },
            delivery_status: decision.decision === 'speak' ? 'sending' : null,
          })
          if (judgmentId === null) {
            count(lead.skipped, 'already_judged_race')
            continue
          }
          if (decision.decision !== 'speak') continue

          // Last-moment suppression re-check: an unsubscribe can land mid-run.
          const { data: fresh, error: freshErr } = await db
            .from('ss_nurture_leads')
            .select('suppressed')
            .eq('id', l.id)
            .single()
          if (freshErr || fresh?.suppressed) {
            await recordDelivery(
              db,
              judgmentId,
              freshErr ? { delivery_status: 'recheck_failed', decision: 'failed' } : { delivery_status: 'suppressed' }
            )
            continue
          }

          const tag = attributionTag(judgmentId)
          const email = buildLeadEmail(decision, l, tag, address)
          const result = await sendEmail(l.email, email.subject, email.html, { unsubscribeUrl: email.unsubscribeUrl })
          const status = result.sent ? 'sent' : result.reason === 'no_provider' ? 'no_provider' : 'send_failed'
          count(lead.sendOutcomes, status)
          if (result.sent) lead.sent++
          await recordDelivery(db, judgmentId, {
            delivery_status: status,
            provider_id: result.providerId ?? null,
            sent_at: result.sent ? new Date().toISOString() : null,
            attribution_tag: tag,
            // A send that never left must not consume the lead's one judgment:
            // 'failed' drops out of the lead-once index so a later run retries.
            ...(result.sent ? {} : { decision: 'failed' as const }),
          })
        } catch (err) {
          lead.failed++
          const message = err instanceof Error ? err.message : String(err)
          errors.push(`lead ${l.id.slice(0, 8)}: ${message}`)
          // Same rule as subscribers: a crash leaves a 'failed' row (not counted
          // by the lead-once index, so the lead is retried on a later run).
          if (!opts.dryRun) {
            await recordJudgment(db, {
              audience: 'lead',
              campaign: LEAD_CAMPAIGN,
              user_id: l.user_id,
              nurture_lead_id: l.id,
              decision: {
                decision: 'failed',
                signal: null,
                reasoning: safeSlice(message, 300),
                confidence: null,
                subject: null,
                message: null,
                suggestedAsk: null,
                model: 'n/a',
              },
              context_facts: { error_stage: 'pre_record' },
            }).catch((e) => errors.push(`failed-row write: ${e instanceof Error ? e.message : String(e)}`))
          }
        }
      }
    }
  }

  return {
    dryRun: opts.dryRun,
    grading,
    subscribers: sub,
    leads: { ...lead, ownerApprovedAfterLastEmail: ownerApproved, postalAddressConfigured: !!address },
    errors,
    renders,
  }
}
