/**
 * Account erasure: everything "Delete my account" has to do, in order, with
 * every step checked (Nov 11 2026).
 *
 * WHAT WAS WRONG. The route deleted a list of tables, ignored every error, then
 * called `auth.admin.deleteUser` and ignored that result too, and answered
 * `{ success: true }`. Measured on throwaway accounts in production, the login
 * could NOT be deleted while the person had any of:
 *   - an AI usage row (`ss_ai_usage.user_id`, a foreign key with no ON DELETE):
 *     the route never touched that table, and anyone who has talked to Yuri has
 *     one;
 *   - a landing-chat visitor marked as converted to them
 *     (`ss_widget_visitors.converted_user_id`, same kind of key);
 *   - a conversation with messages or a custom shelf product, if the earlier
 *     deletes had failed (the route deleted `ss_yuri_messages` by a `user_id`
 *     column that table does not have).
 * So a member would be told the account was deleted, their profile and routine
 * would be gone, and the login would still exist. No real account had hit it:
 * production held 59 logins and 59 profiles when it was found.
 *
 * It also left behind data about the person that no foreign key reaches: the
 * preview chat they had before signing up (linked by `registered_user_id` or by
 * the email they typed into it), and their row in the nurture email list.
 *
 * ORDER. Everything that can block the login's deletion goes first, each step
 * checked. Then the login is deleted, which cascades to every table keyed to it.
 * Then the result is VERIFIED: the login must really be gone. Any failure
 * throws, so the caller tells the person it did not finish; every step is safe
 * to run again.
 *
 * KEPT ON PURPOSE: the free-trial ledger row (`ss_trial_starts`: a canonical
 * email, dates and a network hash, no content). It is what stops one inbox
 * taking the free week again and again by deleting and re-registering. Its
 * `user_id` and Stripe subscription id are cleared. AI usage rows are kept for
 * cost accounting with their `user_id` cleared.
 *
 * FOUND BY THE SECOND-MODEL REVIEW (same day), all fixed here: our stored
 * Stripe event payloads (name, address, email in 65 of 79 rows) survived with
 * no link back; the Stripe customer was never deleted; an older or paused
 * subscription could be left billing; an address containing `*` would have
 * matched other people's rows; and a failure part-way left the person
 * receiving the weekly note and re-enrolled in the lead emails.
 *
 * No Next.js or Stripe imports: the route supplies them, and tests run this
 * file as it is.
 */

/** The slice of the Supabase client this module uses. */
export interface EraseDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
  auth: {
    admin: {
      deleteUser(id: string): Promise<{ error: { message: string } | null }>
      getUserById(id: string): Promise<{ data: { user: { id: string } | null } | null; error: { message: string; status?: number } | null }>
    }
  }
}

export interface EraseDeps {
  /** Cancels a Stripe subscription now. Must throw if Stripe could not be reached. */
  cancelSubscription: (stripeSubscriptionId: string) => Promise<void>
  /**
   * Deletes the person's Stripe customer (name, address, saved card), which
   * also cancels every subscription that customer still has there. Must throw
   * if Stripe could not be reached; a customer already gone is not an error.
   */
  deleteStripeCustomer: (stripeCustomerId: string) => Promise<void>
  /**
   * Asks Stripe for every customer that has ever held a subscription for this
   * account. Our own table keeps one row per person and each checkout makes a
   * new Stripe customer, so an earlier customer is in no row of ours. Must
   * throw if Stripe could not be reached.
   */
  findStripeCustomers: (userId: string) => Promise<string[]>
  /** Removes the person's stored photos; returns how many. A failure inside is logged there and does not stop the erasure. */
  purgePhotos: (userId: string) => Promise<number>
}

export interface EraseResult {
  photosRemoved: number
  /** The steps that ran, in order, for the log. */
  steps: string[]
}

/** Thrown when a step fails. `step` names it; nothing after it has run. */
export class EraseError extends Error {
  constructor(public step: string, detail: string) {
    super(`account erasure stopped at "${step}": ${detail}`)
    this.name = 'EraseError'
  }
}

type Result = { error: { message: string } | null }

export async function eraseAccount(
  db: EraseDb,
  user: { id: string; email?: string | null },
  deps: EraseDeps
): Promise<EraseResult> {
  const userId = user.id
  const email = (user.email ?? '').trim().toLowerCase() || null
  const steps: string[] = []
  const must = async (step: string, run: () => PromiseLike<Result>) => {
    const { error } = await run()
    if (error) throw new EraseError(step, error.message)
    steps.push(step)
  }
  const rows = async <T>(step: string, run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> => {
    const { data, error } = await run()
    if (error) throw new EraseError(step, error.message)
    return data ?? []
  }

  // 1. Stripe first. If it cannot be reached nothing has been removed yet, so
  //    the person can try again rather than be billed with no account.
  //    Our table holds one row per person, so it can miss an older
  //    subscription, and it records "paused" and "unpaid" as canceled when
  //    Stripe has not cancelled them. Deleting the customer in Stripe cancels
  //    whatever is left there, and removes the name, address and card Stripe
  //    holds for them.
  const subs = await rows<{ id: string; stripe_subscription_id: string | null; stripe_customer_id: string | null; status: string | null }>(
    'read subscriptions',
    () => db.from('ss_subscriptions').select('id, stripe_subscription_id, stripe_customer_id, status').eq('user_id', userId)
  )
  // Earlier customers of theirs: named inside the events we stored, and asked
  // of Stripe itself. (Measured Nov 11 2026: one live member had a second
  // customer with 31 stored events and no row in our table.)
  const eventCustomers = await rows<{ customer: string | null }>('find billing events', () =>
    db.from('ss_subscription_events').select('customer:event_data->>customer').eq('event_data->metadata->>user_id', userId)
  )
  let stripeCustomers: string[]
  try {
    stripeCustomers = await deps.findStripeCustomers(userId)
  } catch (err) {
    throw new EraseError('find billing', err instanceof Error ? err.message : String(err))
  }
  const customerIds = [
    ...new Set(
      [...subs.map((s) => s.stripe_customer_id), ...eventCustomers.map((e) => e.customer), ...stripeCustomers].filter(
        (c): c is string => typeof c === 'string' && c.length > 0
      )
    ),
  ]
  for (const s of subs) {
    if (s.stripe_subscription_id && s.status !== 'canceled') {
      try {
        await deps.cancelSubscription(s.stripe_subscription_id)
      } catch (err) {
        throw new EraseError('cancel subscription', err instanceof Error ? err.message : String(err))
      }
    }
  }
  for (const customerId of customerIds) {
    try {
      await deps.deleteStripeCustomer(customerId)
    } catch (err) {
      throw new EraseError('close billing', err instanceof Error ? err.message : String(err))
    }
  }
  steps.push('subscriptions cancelled')

  // 1b. Stop our own emails before anything else. If a later step fails the
  //     login still exists for a while, and the weekly note and the lead
  //     emails would otherwise keep going to someone who asked to be deleted.
  await must('weekly notes stopped', () => db.from('ss_user_profiles').update({ nudge_email_opt_out: true }).eq('user_id', userId))
  await must('lead emails stopped (by account)', () =>
    db.from('ss_nurture_leads').update({ suppressed: true, suppressed_reason: 'account_deleted' }).eq('user_id', userId)
  )
  if (email) {
    await must('lead emails stopped (by email)', () =>
      matchAddress(db.from('ss_nurture_leads').update({ suppressed: true, suppressed_reason: 'account_deleted' }), 'email', email)
    )
  }

  // 2. Photos, while the rows that point at them still exist.
  const photosRemoved = await deps.purgePhotos(userId)
  steps.push('photos')

  // 3. The preview chat they had before signing up. No foreign key links it:
  //    it is tied to them by the account it was carried into, the account it
  //    converted to, or the email they typed into it.
  const visitorFilters = [`registered_user_id.eq.${userId}`, `converted_user_id.eq.${userId}`]
  const linked = await rows<{ id: string; visitor_id: string }>('find preview chats', () =>
    db.from('ss_widget_visitors').select('id, visitor_id').or(visitorFilters.join(','))
  )
  const byEmail = email
    ? await rows<{ id: string; visitor_id: string }>('find preview chats by email', () =>
        matchAddress(db.from('ss_widget_visitors').select('id, visitor_id'), 'captured_email', email)
      )
    : []
  const visitorKeys = [...new Set([...linked, ...byEmail].map((v) => v.visitor_id).filter(Boolean))]
  const visitorIds = [...new Set([...linked, ...byEmail].map((v) => v.id).filter(Boolean))]
  if (visitorKeys.length) {
    await must('preview chat intent signals', () => db.from('ss_widget_intent_signals').delete().in('visitor_id', visitorKeys))
    await must('preview chat sessions and messages', () => db.from('ss_widget_sessions').delete().in('visitor_id', visitorKeys))
    await must('preview chat attribution', () => db.from('ss_campaign_touches').delete().in('visitor_id', visitorKeys))
    await must('preview chat follow-up decisions', () => db.from('ss_proactive_judgments').delete().in('widget_visitor_id', visitorKeys))
    await must('preview chat visitors', () => db.from('ss_widget_visitors').delete().in('id', visitorIds))
  }

  // 4. Our copies of their Stripe billing events. The stored payloads can hold
  //    a name, address and email, and almost none are linked to the
  //    subscription row (78 of 79 had no link when this was written), so they
  //    are found by the Stripe customer and by the account id inside them.
  if (subs.length) {
    await must('billing events (by subscription)', () => db.from('ss_subscription_events').delete().in('subscription_id', subs.map((s) => s.id)))
  }
  if (customerIds.length) {
    await must('billing events (by customer)', () => db.from('ss_subscription_events').delete().in('event_data->>customer', customerIds))
  }
  await must('billing events (by account)', () => db.from('ss_subscription_events').delete().eq('event_data->metadata->>user_id', userId))

  // 5. Rows that would block the login's deletion.
  await must('AI usage rows de-identified', () => db.from('ss_ai_usage').update({ user_id: null }).eq('user_id', userId))
  // A trial still open is closed here: its subscription id is about to be
  // cleared, so the webhook that would have marked it could no longer find it.
  await must('trial ledger closed', () =>
    db.from('ss_trial_starts').update({ lapsed_at: new Date().toISOString() }).eq('user_id', userId).is('lapsed_at', null).is('paid_at', null)
  )
  await must('trial ledger de-linked', () =>
    db.from('ss_trial_starts').update({ user_id: null, stripe_subscription_id: null }).eq('user_id', userId)
  )
  // Kept de-identified by their keys otherwise; a typed product name or a
  // click trail is still theirs, so they go.
  await must('catalog requests', () => db.from('ss_catalog_requests').delete().eq('user_id', userId))
  await must('retailer clicks', () => db.from('ss_affiliate_clicks').delete().eq('user_id', userId))
  // Reviews and messages carry count triggers that run as the caller; the
  // login's own cascade runs as a role that may not write those counters. So
  // they are deleted here, by the service role, before the login goes.
  await must('review votes', () => db.from('ss_review_helpfulness').delete().eq('user_id', userId))
  await must('reviews', () => db.from('ss_reviews').delete().eq('user_id', userId))
  // Scores and breakdowns point at a treatment phase with a key that blocks the
  // phase's deletion (found by running this on a throwaway account), so they go first.
  await must('skin scores', () => db.from('ss_glass_skin_scores').delete().eq('user_id', userId))
  await must('skin breakdown history', () => db.from('ss_skin_breakdown_history').delete().eq('user_id', userId))
  await must('treatment phases', () => db.from('ss_treatment_phases').delete().eq('user_id', userId))
  const conversations = await rows<{ id: string }>('find conversations', () =>
    db.from('ss_yuri_conversations').select('id').eq('user_id', userId)
  )
  const conversationIds = conversations.map((c) => c.id)
  if (conversationIds.length) {
    await must('messages', () => db.from('ss_yuri_messages').delete().in('conversation_id', conversationIds))
    await must('conversations', () => db.from('ss_yuri_conversations').delete().in('id', conversationIds))
  }
  await must('shelf', () => db.from('ss_user_products').delete().eq('user_id', userId))
  // The lead-email rows go last: until here they sat suppressed, so a failure
  // above could not get the person enrolled afresh. The row by account goes
  // with the login; a row made from the preview chat has only the address.
  if (email) await must('lead email row (by email)', () => matchAddress(db.from('ss_nurture_leads').delete(), 'email', email))

  // 6. The login. Every other table keyed to it is removed by its cascade.
  // One argument on purpose: a second `true` would be a soft delete, which keeps the row.
  const { error: deleteError } = await db.auth.admin.deleteUser(userId)
  if (deleteError) throw new EraseError('delete login', deleteError.message)
  steps.push('login deleted')

  // 7. Verify, rather than trust the call above: the login must be gone and no
  //    profile may remain.
  let check: Awaited<ReturnType<EraseDb['auth']['admin']['getUserById']>>
  try {
    check = await db.auth.admin.getUserById(userId)
  } catch (err) {
    throw new EraseError('verify', `could not confirm the login is gone: ${err instanceof Error ? err.message : String(err)}`)
  }
  // Three different outcomes, three different things to tell the person.
  if (check.data?.user) throw new EraseError('login still exists', 'the login still exists after its deletion reported success')
  // "Not found" is the answer we want. Any other error means the question was
  // not answered, which is not the same as the login being gone.
  if (!check.error || !isNotFound(check.error)) {
    throw new EraseError('verify', `could not confirm the login is gone: ${check.error?.message ?? 'no user and no error returned'}`)
  }
  const profiles = await rows<{ user_id: string }>('verify profile', () =>
    db.from('ss_user_profiles').select('user_id').eq('user_id', userId)
  )
  if (profiles.length) throw new EraseError('verify profile', 'a profile row remains after deletion')
  steps.push('verified')

  return { photosRemoved, steps }
}

/** Steps at which nothing of the person's has been removed and nothing cancelled. */
const BEFORE_ANYTHING = new Set(['read subscriptions', 'find billing events', 'find billing'])
/** Steps in Stripe: nothing of ours removed yet, but a membership may already be cancelled. */
const IN_STRIPE = new Set(['cancel subscription', 'close billing'])
/** The login's deletion reported success but could not be confirmed either way. */
const LOGIN_UNCONFIRMED = new Set(['verify'])
/** The login is confirmed gone, so trying again cannot work: there is nothing left to sign in with. */
const AFTER_LOGIN = new Set(['verify profile'])

/**
 * What the person is told when the erasure stops. It says only what is true at
 * that step. Any step this does not know is treated as part-way.
 */
export function erasureFailedMessage(step: string, contactEmail: string): string {
  if (BEFORE_ANYTHING.has(step)) {
    return `We could not delete your account just now. None of your data has been removed and your membership has not changed. Please try again. If it happens again, write to ${contactEmail} and we will delete it for you.`
  }
  if (IN_STRIPE.has(step)) {
    return `We could not delete your account just now. Nothing in your Seoul Sister account has been removed, but your membership may already have been cancelled. Please try again. If it happens again, write to ${contactEmail} and we will delete it for you.`
  }
  if (LOGIN_UNCONFIRMED.has(step)) {
    return `We asked for your login to be deleted but could not confirm that it was. If you can still sign in, please try again. If you cannot, your login is gone: write to ${contactEmail} and we will check that everything else was removed.`
  }
  if (AFTER_LOGIN.has(step)) {
    return `Your login was deleted, but we could not confirm that everything else was removed. Trying again will not work because the login is gone. Please write to ${contactEmail} and we will finish it for you.`
  }
  return `We could not finish deleting your account. Your membership may already have been cancelled. Some of your data has been removed and some has not. Please try again. If it happens again, write to ${contactEmail} and we will finish it for you.`
}

/**
 * Match a stored address to this person's, whatever its letter case. PostgREST
 * reads `*` in a LIKE pattern as "anything" and offers no way to escape it, so
 * an address containing one is matched exactly instead: it must never widen to
 * someone else's rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchAddress(query: any, column: string, email: string) {
  return email.includes('*') ? query.eq(column, email) : query.ilike(column, escapeLike(email))
}

function isNotFound(error: { message: string; status?: number }): boolean {
  // Both, as the auth server answers for a login that does not exist (seen in
  // production: status 404, "User not found"). A 404 from somewhere else, or
  // some other "not found", has not answered the question.
  return error.status === 404 && /user not found/i.test(error.message)
}

/** Escape LIKE wildcards so an address is matched literally (case-insensitively). */
function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
