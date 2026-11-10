import type { SupabaseClient } from '@supabase/supabase-js'
import { canonicalizeEmail } from '@/lib/utils/email-normalize'
import { PRICING } from '@/lib/pricing'

/**
 * The free trial's rules in one place (Nov 10 2026).
 *
 * The trial starts with NO card. Stripe cancels it on its last day unless the
 * member added one. PRICING.trial_requires_card is the setting; the env var
 * NO_CARD_TRIAL_ENABLED=false is an emergency stop that restores the
 * card-required checkout without a deploy (customer copy then lags until
 * pricing.ts is changed too).
 *
 * One trial per PERSON. "Person" is the canonical inbox (Gmail dots and +tags
 * collapse) recorded in ss_trial_starts, which has no foreign key to the
 * account, so deleting an account and registering again does not earn a second
 * free week. Subscription history on the account also rules a trial out. A
 * network (hashed address) can start only a few trials a month, counted from
 * trials that actually STARTED, never from button presses.
 *
 * A trial is NOT a paid conversion. Nothing here touches
 * ss_widget_visitors.converted_user_id. The conversion is the first invoice
 * that is actually paid (markFirstPayment).
 *
 * The paywall, the in-app notice and the checkout all read these same
 * functions, so a button can never promise a trial the checkout would refuse.
 */
export function noCardTrialEnabled(): boolean {
  return !PRICING.trial_requires_card && process.env.NO_CARD_TRIAL_ENABLED !== 'false'
}

/** Trials one network may start within TRIAL_NETWORK_WINDOW_DAYS. */
export const TRIAL_NETWORK_CAP = 3
export const TRIAL_NETWORK_WINDOW_DAYS = 30

/** A short non-reversible key for a network address. Not a security hash; a grouping key. */
export function networkKey(ip: string | null | undefined): string | null {
  const s = (ip ?? '').trim()
  if (!s || s === 'unknown') return null
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export type TrialIneligibleReason = 'subscription_history' | 'trial_used' | 'network_cap' | 'lookup_failed'
export type TrialEligibility = { eligible: true } | { eligible: false; reason: TrialIneligibleReason }

/**
 * Whether this account gets a free trial at checkout. A failed lookup is NOT
 * eligible and says so: the caller must stop rather than promise a trial it
 * cannot verify, or charge someone who was promised one.
 */
export async function checkTrialEligibility(
  db: SupabaseClient,
  user: { id: string; email?: string | null },
  opts: { ipHash?: string | null; now?: number } = {}
): Promise<TrialEligibility> {
  const { data: priorSub, error: subErr } = await db
    .from('ss_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
  if (subErr) {
    console.error('[trial] subscription history lookup failed:', subErr.message)
    return { eligible: false, reason: 'lookup_failed' }
  }
  if ((priorSub ?? []).length > 0) return { eligible: false, reason: 'subscription_history' }

  const email = (user.email ?? '').trim()
  if (email) {
    const { data: used, error: usedErr } = await db
      .from('ss_trial_starts')
      .select('id')
      .eq('email_canonical', canonicalizeEmail(email))
      .limit(1)
    if (usedErr) {
      console.error('[trial] trial ledger lookup failed:', usedErr.message)
      return { eligible: false, reason: 'lookup_failed' }
    }
    if ((used ?? []).length > 0) return { eligible: false, reason: 'trial_used' }
  }

  if (opts.ipHash) {
    const since = new Date((opts.now ?? Date.now()) - TRIAL_NETWORK_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: fromNetwork, error: netErr } = await db
      .from('ss_trial_starts')
      .select('id')
      .eq('ip_hash', opts.ipHash)
      .gte('started_at', since)
      .limit(TRIAL_NETWORK_CAP)
    if (netErr) {
      console.error('[trial] network cap lookup failed:', netErr.message)
      return { eligible: false, reason: 'lookup_failed' }
    }
    if ((fromNetwork ?? []).length >= TRIAL_NETWORK_CAP) return { eligible: false, reason: 'network_cap' }
  }
  return { eligible: true }
}

/**
 * Record that a trial started. Insert-once on the canonical inbox: a retried
 * webhook finds the row and writes nothing. Returns false on a real failure so
 * the caller can fail loudly.
 */
export async function recordTrialStart(
  db: SupabaseClient,
  t: { userId: string; email: string; subscriptionId: string; cardRequired: boolean; trialEnd: string | null; ipHash?: string | null }
): Promise<boolean> {
  const { error } = await db.from('ss_trial_starts').upsert(
    {
      email_canonical: canonicalizeEmail(t.email),
      user_id: t.userId,
      stripe_subscription_id: t.subscriptionId,
      card_required: t.cardRequired,
      trial_end: t.trialEnd,
      ip_hash: t.ipHash ?? null,
    },
    { onConflict: 'email_canonical', ignoreDuplicates: true }
  )
  if (error) {
    console.error('[trial] could not record trial start:', error.message)
    return false
  }
  return true
}

/**
 * A trial ended without becoming a paid subscription. Set once, and never on a
 * trial that has already paid.
 */
export async function markTrialLapsed(db: SupabaseClient, subscriptionId: string, nowIso: string): Promise<void> {
  const { error } = await db
    .from('ss_trial_starts')
    .update({ lapsed_at: nowIso })
    .eq('stripe_subscription_id', subscriptionId)
    .is('paid_at', null)
    .is('lapsed_at', null)
  if (error) console.error('[trial] could not mark trial lapsed:', error.message)
}

/**
 * An invoice for this subscription was PAID with real money.
 *
 * Returns 'first_payment_after_trial' exactly once per trial: the update only
 * matches a ledger row whose paid_at is still NULL, and the returned rows say
 * whether it matched. That one return value is the conversion (the One Metric
 * stamp and the "paying customer" alert hang off it), so a retried webhook, a
 * renewal next month, or a $0 trial invoice can never produce a second one.
 * A subscription that never had a trial returns 'not_a_trial'.
 *
 * Throws on a database error so the webhook retries: a swallowed failure here
 * would lose the conversion permanently.
 */
export async function markFirstPayment(
  db: SupabaseClient,
  subscriptionId: string,
  amountPaid: number,
  nowIso: string
): Promise<'first_payment_after_trial' | 'already_counted_or_not_a_trial' | 'nothing_paid'> {
  if (!(amountPaid > 0)) return 'nothing_paid'
  const { data, error } = await db
    .from('ss_trial_starts')
    .update({ paid_at: nowIso })
    .eq('stripe_subscription_id', subscriptionId)
    .is('paid_at', null)
    // A trial that already lapsed is not turned into a conversion by an old
    // invoice being settled later: that subscription has no access.
    .is('lapsed_at', null)
    .select('id')
  if (error) throw new Error(`trial ledger paid_at write failed: ${error.message}`)
  return Array.isArray(data) && data.length > 0 ? 'first_payment_after_trial' : 'already_counted_or_not_a_trial'
}

/**
 * Whether a subscription event should be ignored because it is about a
 * subscription that is no longer this account's current one.
 *
 * Stripe does not guarantee event order. After a trial lapses and the person
 * comes back and pays, a late or retried event for the OLD subscription
 * (status canceled) would otherwise overwrite the new paid row and clear the
 * plan, locking out a paying member.
 */
export function isStaleSubscriptionEvent(
  stored: { stripe_subscription_id: string | null; status: string | null; stripe_created_at?: string | null } | null,
  event: { subscriptionId: string; status: string; createdAt?: string | null }
): boolean {
  if (!stored || !stored.stripe_subscription_id) return false
  if (stored.stripe_subscription_id === event.subscriptionId) return false
  // Different subscription. When both creation times are known, the answer is
  // exact: an event about a subscription created BEFORE the one on file is
  // old news, whatever either status says. (Without this, a late "trialing"
  // event for an old subscription re-opened access on a cancelled account.)
  if (stored.stripe_created_at && event.createdAt) {
    return new Date(event.createdAt).getTime() < new Date(stored.stripe_created_at).getTime()
  }
  // Rows written before the creation time was stored: protect an open
  // subscription from a closed one.
  const storedOpen = stored.status === 'active' || stored.status === 'trialing' || stored.status === 'past_due'
  const eventOpen = event.status === 'active' || event.status === 'trialing'
  return storedOpen && !eventOpen
}

export interface LiveTrialStateLike {
  status: string
  hasPaymentMethod: boolean
  cancelAtPeriodEnd: boolean
}

export interface TrialFacts {
  /** This account would get the free trial at checkout. null = could not be determined. */
  eligible: boolean | null
  /** That trial starts with no card. */
  no_card: boolean
  /** This person already used their free trial. */
  had_trial: boolean
  /** Set when the account is on a trial right now. */
  trial: {
    ends_at: string | null
    /** null = Stripe could not be asked; the UI must then make no claim. */
    card_on_file: boolean | null
    /** The member cancelled: nothing will be charged. null = unknown. */
    cancelled: boolean | null
  } | null
}

/**
 * Everything the paywall and the in-app trial notice may say, from the same
 * rules the checkout applies. `liveState` asks Stripe (injected so this can be
 * executed in tests, including with Stripe failing).
 *
 * The trial block is returned even when eligibility cannot be determined: a
 * member on a trial must still see when it ends.
 */
export async function trialFacts(
  db: SupabaseClient,
  user: { id: string; email?: string | null },
  deps: { liveState: (subscriptionId: string) => Promise<LiveTrialStateLike>; ipHash?: string | null; now?: number }
): Promise<TrialFacts> {
  const now = deps.now ?? Date.now()
  let trial: TrialFacts['trial'] = null

  const { data: sub, error: subErr } = await db
    .from('ss_subscriptions')
    .select('status, trial_end, stripe_subscription_id')
    .eq('user_id', user.id)
    .limit(1)
  if (subErr) console.error('[trial] subscription read failed:', subErr.message)
  const row = (sub ?? [])[0] as { status?: string; trial_end?: string | null; stripe_subscription_id?: string | null } | undefined

  // On a trial only while our row says so AND the end date has not passed. A
  // trial whose end has passed is over even if the cancel webhook is late.
  const endMs = row?.trial_end ? new Date(row.trial_end).getTime() : null
  if (row?.status === 'trialing' && (endMs === null || endMs > now)) {
    let cardOnFile: boolean | null = null
    let cancelled: boolean | null = null
    if (row.stripe_subscription_id) {
      try {
        const live = await deps.liveState(row.stripe_subscription_id)
        cardOnFile = live.hasPaymentMethod
        cancelled = live.cancelAtPeriodEnd
      } catch (err) {
        console.error('[trial] Stripe state check failed:', err instanceof Error ? err.message : String(err))
      }
    }
    trial = { ends_at: row.trial_end ?? null, card_on_file: cardOnFile, cancelled }
  }

  const { data: ownTrial, error: ownErr } = await db
    .from('ss_trial_starts')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
  if (ownErr) console.error('[trial] own trial read failed:', ownErr.message)

  const eligibility = await checkTrialEligibility(db, user, { ipHash: deps.ipHash, now })
  const unknown = !eligibility.eligible && eligibility.reason === 'lookup_failed'
  return {
    eligible: unknown ? null : eligibility.eligible,
    no_card: noCardTrialEnabled(),
    // "Your free trial has ended" is only true for someone who HAD one: a
    // ledger row for this inbox or this account. A paying member who cancelled
    // has subscription history but never had a trial.
    had_trial:
      (!eligibility.eligible && eligibility.reason === 'trial_used') || (ownTrial ?? []).length > 0,
    trial,
  }
}
