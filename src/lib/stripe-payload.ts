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
