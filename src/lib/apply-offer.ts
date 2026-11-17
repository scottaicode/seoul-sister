import type { SupabaseClient } from '@supabase/supabase-js'
import type { OfferState } from '@/lib/offers-server'
import { normalizeOfferCode, offerAppliedLine, offerEndedLine, codeShapeLine, codeCheckFailedLine, codeNeedsHelpLine, codeAlreadyOnLine, codeNotInFreeWeekLine, codeNotAppliedNowLine, codeAfterCancelLine } from '@/lib/offers'

/**
 * Adds a creator code to a member's running free week (Nov 16 2026).
 *
 * The discount is on the first PAID month, so a code is in time any day
 * before the free week ends. Rules, each with its own sentence:
 *  - the account must be in a free week that has not ended;
 *  - one code per membership (a second is refused, never swapped);
 *  - Stripe decides whether the code is real and still open, and only codes
 *    marked as creator offers are applied here (resolveOffer);
 *  - Stripe is asked FIRST what is already on the subscription, because it,
 *    not our row, is the record of what a card will be charged;
 *  - a member who has cancelled is refused: the code would take one of the
 *    creator's places for a month that will never be paid;
 *  - our row is claimed before Stripe is asked to apply, so two tabs cannot
 *    put on two codes; the claim is released if Stripe refuses.
 * Everything that talks to Stripe is passed in, so this is executed in tests.
 */
export type ApplyOfferResult = { ok: true; code: string; percentOff: number; line: string } | { ok: false; status: number; line: string }

type LiveFreeWeek = { status: string; cancelling: boolean; discount: { code: string | null; percentOff: number | null } | null }

export async function applyCodeToFreeWeek(
  db: SupabaseClient,
  userId: string,
  raw: unknown,
  deps: {
    resolve: (raw: string) => Promise<OfferState>
    /** What Stripe holds for the subscription right now. */
    readFreeWeek: (subscriptionId: string) => Promise<LiveFreeWeek>
    applyToFreeWeek: (subscriptionId: string, promotionCodeId: string) => Promise<'applied' | 'not_in_free_week' | 'has_discount'>
    now?: number
  }
): Promise<ApplyOfferResult> {
  const code = normalizeOfferCode(typeof raw === 'string' ? raw : null)
  if (!code) return { ok: false, status: 400, line: codeShapeLine() }

  const { data: sub, error } = await db
    .from('ss_subscriptions')
    .select('status, trial_end, stripe_subscription_id, offer_code, offer_percent_off')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[offer-code] subscription read failed:', error.message)
    return { ok: false, status: 503, line: codeCheckFailedLine() }
  }
  const row = sub as { status?: string; trial_end?: string | null; stripe_subscription_id?: string | null; offer_code?: string | null; offer_percent_off?: number | string | null } | null
  const endMs = row?.trial_end ? new Date(row.trial_end).getTime() : null
  if (!row?.stripe_subscription_id || row.status !== 'trialing' || (endMs !== null && endMs <= (deps.now ?? Date.now()))) {
    return { ok: false, status: 409, line: codeNotInFreeWeekLine() }
  }
  const subscriptionId = row.stripe_subscription_id
  const stamp = (c: string, pct: number | null) => writeOffer(db, userId, subscriptionId, c, pct)

  // Stripe first. It is the record of what the card will be charged, and our
  // row can be behind it: a reply that never arrived, a write that failed.
  let live: LiveFreeWeek
  try {
    live = await deps.readFreeWeek(subscriptionId)
  } catch (err) {
    console.error('[offer-code] could not read the subscription from Stripe:', err instanceof Error ? err.message : String(err))
    return { ok: false, status: 503, line: codeCheckFailedLine() }
  }
  if (live.status !== 'trialing') return { ok: false, status: 409, line: codeNotInFreeWeekLine() }
  if (live.discount) {
    // A code is already on in Stripe. Bring our rows up to it, and answer for
    // what IS on: "applied" if it is the one they typed, else that one is on.
    if (live.discount.code && !(Number(row.offer_percent_off ?? 0) > 0)) await stamp(live.discount.code, live.discount.percentOff)
    if (live.discount.code === code && live.discount.percentOff) return { ok: true, code, percentOff: live.discount.percentOff, line: offerAppliedLine(code, live.discount.percentOff) }
    return { ok: false, status: 409, line: codeAlreadyOnLine(live.discount.code ?? row.offer_code ?? null) }
  }
  if (Number(row.offer_percent_off ?? 0) > 0 || row.offer_code) return { ok: false, status: 409, line: codeAlreadyOnLine(row.offer_code ?? null) }
  // Cancelled: it stops at the end of the free week. A code would take one of
  // the creator's places for a month that will never be paid.
  if (live.cancelling) return { ok: false, status: 409, line: codeAfterCancelLine() }

  let offer: OfferState
  try {
    offer = await deps.resolve(code)
  } catch (err) {
    console.error('[offer-code] code lookup failed:', err instanceof Error ? err.message : String(err))
    return { ok: false, status: 503, line: codeCheckFailedLine() }
  }
  if (offer.state === 'ended') return { ok: false, status: 409, line: offerEndedLine(offer.code) }
  if (offer.state !== 'active') return { ok: false, status: 404, line: codeNeedsHelpLine(code) }

  // One code per membership, and two tabs must not put on two: the row is
  // claimed first, and only the request that claimed it goes to Stripe.
  const { data: claimed, error: claimErr } = await db
    .from('ss_subscriptions')
    .update({ offer_code: offer.code })
    .eq('user_id', userId)
    .eq('stripe_subscription_id', subscriptionId)
    .is('offer_code', null)
    .select('id')
  if (claimErr) {
    console.error('[offer-code] could not claim the membership for the code:', claimErr.message)
    return { ok: false, status: 503, line: codeCheckFailedLine() }
  }
  if (!claimed || claimed.length === 0) return { ok: false, status: 409, line: codeAlreadyOnLine(null) }
  const release = async () => {
    const { error: e } = await db.from('ss_subscriptions').update({ offer_code: null }).eq('user_id', userId).eq('stripe_subscription_id', subscriptionId).eq('offer_code', offer.code)
    if (e) console.error('[offer-code] could not release the claim after a failed apply:', e.message)
  }

  let outcome: 'applied' | 'not_in_free_week' | 'has_discount'
  try {
    outcome = await deps.applyToFreeWeek(subscriptionId, offer.promotionCodeId)
  } catch (err) {
    // For example the last place went a moment ago. Nothing was applied.
    console.error(`[offer-code] Stripe refused ${offer.code}:`, err instanceof Error ? err.message : String(err))
    await release()
    return { ok: false, status: 409, line: codeNotAppliedNowLine(offer.code) }
  }
  if (outcome !== 'applied') {
    await release()
    return { ok: false, status: 409, line: outcome === 'not_in_free_week' ? codeNotInFreeWeekLine() : codeAlreadyOnLine(null) }
  }

  // Stripe has it: the first paid month WILL be discounted. Our rows are what
  // the notice and the emails read. A failed write is logged; the next ask
  // finds the discount in Stripe (above) and writes it then.
  await stamp(offer.code, offer.percentOff)
  return { ok: true, code: offer.code, percentOff: offer.percentOff, line: offerAppliedLine(offer.code, offer.percentOff) }
}

async function writeOffer(db: SupabaseClient, userId: string, subscriptionId: string, code: string, percentOff: number | null): Promise<void> {
  const values = { offer_code: code, offer_percent_off: percentOff }
  const { error: subErr } = await db.from('ss_subscriptions').update(values).eq('user_id', userId).eq('stripe_subscription_id', subscriptionId)
  if (subErr) console.error('[offer-code] the code is on in Stripe, but the subscription row was not updated:', subErr.message)
  const { error: ledgerErr } = await db.from('ss_trial_starts').update(values).eq('stripe_subscription_id', subscriptionId)
  if (ledgerErr) console.error('[offer-code] the code is on in Stripe, but the free-week ledger was not updated:', ledgerErr.message)
}
