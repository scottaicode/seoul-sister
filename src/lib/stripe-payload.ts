/**
 * Version-tolerant readers for Stripe webhook payloads.
 *
 * Webhook events are serialized at the ENDPOINT's API version, not the
 * version our client pins (2023-10-16). Our endpoint delivers the newer
 * shape, where:
 *   - Subscription.current_period_start/end moved onto each subscription ITEM
 *   - Invoice.subscription moved to Invoice.parent.subscription_details.subscription
 *
 * Reading the old top-level fields gave `new Date(NaN).toISOString()`, which
 * threw inside a catch that returned 200 — so every subscription.updated
 * event since launch was acknowledged and dropped (Oct 5 2026: a subscriber
 * renewed twice while our row still said her period ended Aug 21).
 *
 * These read both shapes and return null when neither is present, so callers
 * can fail loudly instead of writing garbage.
 */

type UnixSeconds = number

function asUnix(value: unknown): UnixSeconds | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function toIso(seconds: UnixSeconds): string {
  return new Date(seconds * 1000).toISOString()
}

export interface SubscriptionPeriod {
  start: string
  end: string
}

/** Billing period from either the legacy top-level fields or the first item. */
export function subscriptionPeriod(subscription: unknown): SubscriptionPeriod | null {
  if (!subscription || typeof subscription !== 'object') return null
  const sub = subscription as Record<string, unknown>

  let start = asUnix(sub.current_period_start)
  let end = asUnix(sub.current_period_end)

  if (start === null || end === null) {
    const items = sub.items as { data?: Array<Record<string, unknown>> } | undefined
    const first = items?.data?.[0]
    start = start ?? asUnix(first?.current_period_start)
    end = end ?? asUnix(first?.current_period_end)
  }

  if (start === null || end === null) return null
  return { start: toIso(start), end: toIso(end) }
}

/** Subscription id an invoice belongs to, from either payload shape. */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== 'object') return null
  const inv = invoice as Record<string, unknown>

  const legacy = inv.subscription
  if (typeof legacy === 'string') return legacy
  if (legacy && typeof legacy === 'object' && typeof (legacy as { id?: unknown }).id === 'string') {
    return (legacy as { id: string }).id
  }

  const parent = inv.parent as { subscription_details?: { subscription?: unknown } } | undefined
  const nested = parent?.subscription_details?.subscription
  if (typeof nested === 'string') return nested
  if (nested && typeof nested === 'object' && typeof (nested as { id?: unknown }).id === 'string') {
    return (nested as { id: string }).id
  }

  return null
}

/** Amount actually paid on an invoice, in the smallest currency unit. 0 when absent. */
export function invoiceAmountPaid(invoice: unknown): number {
  if (!invoice || typeof invoice !== 'object') return 0
  const paid = (invoice as Record<string, unknown>).amount_paid
  return typeof paid === 'number' && Number.isFinite(paid) && paid > 0 ? paid : 0
}

/**
 * The fields of a Stripe object we keep in our own event log, and nothing else
 * (Nov 11 2026). The log used to store the whole object: invoices and checkout
 * sessions carry the customer's name, email, address and phone, and 65 of 79
 * stored rows held an address. Nothing reads those fields from the log, and a
 * copy we never use is a copy that has to be found and erased when the person
 * deletes their account. A list of what is kept, not of what is dropped, so a
 * field Stripe adds next year is left out by default.
 */
const LOGGED_EVENT_FIELDS = [
  'id', 'object', 'status', 'mode', 'payment_status', 'billing_reason', 'currency', 'livemode',
  'amount', 'amount_due', 'amount_paid', 'amount_remaining', 'amount_total', 'total',
  'created', 'cancel_at', 'canceled_at', 'cancel_at_period_end', 'ended_at',
  'current_period_start', 'current_period_end', 'trial_start', 'trial_end',
] as const

export function eventObjectForLog(object: unknown): Record<string, unknown> {
  if (!object || typeof object !== 'object') return {}
  const source = object as Record<string, unknown>
  const kept: Record<string, unknown> = {}
  for (const key of LOGGED_EVENT_FIELDS) {
    const value = source[key]
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) kept[key] = value
  }
  // Ids only: either can arrive expanded into a whole object.
  for (const key of ['customer', 'subscription'] as const) {
    if (typeof source[key] === 'string') kept[key] = source[key]
  }
  // Our own flat keys (account id, code used, purpose). Stripe allows only strings here.
  const metadata = source.metadata
  if (metadata && typeof metadata === 'object') {
    // Not the network code: the trial ledger holds it once, and a copy on every
    // event would outlive an account whose events arrive after its deletion.
    kept.metadata = Object.fromEntries(
      Object.entries(metadata as Record<string, unknown>).filter(([k, v]) => typeof v === 'string' && k !== 'ip_hash')
    )
  }
  const comment = (source.cancellation_details as { comment?: unknown } | null | undefined)?.comment
  if (typeof comment === 'string') kept.cancellation_details = { comment }
  return kept
}
