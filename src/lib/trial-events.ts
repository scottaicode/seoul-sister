import type { SupabaseClient } from '@supabase/supabase-js'
import { markFirstPayment } from '@/lib/trial'

/**
 * What happens when Stripe says an invoice was paid (Nov 10 2026).
 *
 * This is THE place a trial becomes a paying customer. The first version
 * stamped the conversion when the subscription's status went from trialing to
 * active. Review pointed out that Stripe marks a subscription active when the
 * trial-end invoice is created, before the card is charged, so a declined card
 * would have been counted as a conversion and announced to the owner as a
 * paying customer. An invoice that was actually paid, with an amount above
 * zero, is the only signal that money moved.
 *
 * Dependencies are injected so the test executes this for real against fakes
 * and asserts how many times each side effect ran.
 */
export interface FirstPaymentDeps {
  /** Stamps ss_widget_visitors.converted_* and returns the lead source. */
  attributeConversion: (email: string | null, userId: string) => Promise<'widget' | null>
  /** Tells the owner a customer paid. Best-effort. */
  notifyPaid: (info: { email: string | null; leadSource: string | null; userId: string }) => Promise<void>
  /** The account's email, from auth. */
  emailForUser: (userId: string) => Promise<string | null>
}

export type InvoicePaidOutcome =
  | 'nothing_paid'
  | 'not_first_payment'
  | 'no_subscription_row'
  | 'converted'

export async function onInvoicePaid(
  db: SupabaseClient,
  deps: FirstPaymentDeps,
  invoice: { subscriptionId: string; amountPaid: number },
  nowIso: string
): Promise<InvoicePaidOutcome> {
  // A free trial's $0 invoice also fires "payment succeeded". It is not a payment.
  if (!(invoice.amountPaid > 0)) return 'nothing_paid'

  // Read the subscription row BEFORE marking the ledger. markFirstPayment is
  // the once-only switch; if a later step threw after it, the webhook retry
  // would find the trial already marked and the conversion would be lost.
  const { data: sub, error } = await db
    .from('ss_subscriptions')
    .select('user_id, lead_source')
    .eq('stripe_subscription_id', invoice.subscriptionId)
    .limit(1)
  if (error) throw new Error(`subscription lookup for first payment failed: ${error.message}`)
  const row = (sub ?? [])[0] as { user_id?: string; lead_source?: string | null } | undefined

  const marked = await markFirstPayment(db, invoice.subscriptionId, invoice.amountPaid, nowIso)
  if (marked !== 'first_payment_after_trial') return 'not_first_payment'

  if (!row?.user_id) {
    // paid_at is set, so this trial is counted as paid in the ledger; only the
    // visitor attribution could not be done. Loud, not silent.
    console.error(`[trial] first payment for ${invoice.subscriptionId} has no subscription row; conversion not attributed`)
    return 'no_subscription_row'
  }

  const email = await deps.emailForUser(row.user_id)
  const leadSource = await deps.attributeConversion(email, row.user_id)
  if (leadSource && !row.lead_source) {
    const { error: leadErr } = await db
      .from('ss_subscriptions')
      .update({ lead_source: leadSource })
      .eq('stripe_subscription_id', invoice.subscriptionId)
    if (leadErr) console.error('[trial] lead_source write failed:', leadErr.message)
  }
  try {
    await deps.notifyPaid({ email, leadSource: leadSource ?? row.lead_source ?? null, userId: row.user_id })
  } catch (err) {
    console.error('[trial] paid notification threw:', err)
  }
  return 'converted'
}
