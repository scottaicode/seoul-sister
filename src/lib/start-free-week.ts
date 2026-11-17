import { freeWeekNotStartedLine } from '@/lib/offers'

/**
 * Starts the free week for someone who has just created an account (client
 * side, Nov 16 2026). It asks the same two endpoints the membership page
 * uses, so the rules live in one place (src/lib/trial.ts and the checkout
 * route): one free week per inbox, a few per network, no card.
 *
 * "Started" is said only when a free week is known to be running: the route
 * said so, or it said "already a member" AND the account's own trial facts
 * show a free week (the same reply is given for a paid or half-made
 * subscription, which is not one). Anything else leaves the person where they
 * were before this existed, an account with the membership page as the way
 * in, and comes back with a sentence saying why, because the sign-up page had
 * just told them the week would start.
 */
/** `retry` is true when the reason may be gone on another try (a failure), false when it will not (already used, the network limit, a code). */
export type StartOutcome = { started: true } | { started: false; note: string; retry: boolean }

type Fetch = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
type Facts = { eligible?: unknown; no_card?: unknown; direct?: unknown; had_trial?: unknown; network_cap?: unknown; trial?: unknown }

export async function startFreeWeekAfterSignup(
  token: string,
  offerCode: string | null,
  doFetch: Fetch = (url, init) => fetch(url, init),
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<StartOutcome> {
  const auth = { Authorization: `Bearer ${token}` }
  const readFacts = async (): Promise<Facts | null> => {
    const res = await doFetch('/api/me/trial', { headers: auth })
    return res.ok ? ((await res.json()) as Facts) : null
  }
  const facts = await readFacts()
  const failed: StartOutcome = { started: false, note: freeWeekNotStartedLine('other'), retry: true }
  if (!facts) return failed
  if (facts.trial) return { started: true }
  if (facts.had_trial === true) return { started: false, note: freeWeekNotStartedLine('had_week'), retry: false }
  if (facts.network_cap === true) return { started: false, note: freeWeekNotStartedLine('network'), retry: false }
  if (facts.eligible !== true || facts.no_card !== true || facts.direct !== true) return failed

  const press = () =>
    doFetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: 'monthly',
        expect_free_week: true,
        via: 'direct',
        // Agreed by creating the account under the sign-up page's Terms sentence.
        agreed_terms: true,
        terms_shown: 'signup',
        ...browserTimeZone(),
        ...(offerCode ? { offer_code: offerCode } : {}),
      }),
    })
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await press()
    const body = ((await res.json().catch(() => null)) ?? {}) as { started?: unknown; already_member?: unknown; started_not_recorded?: unknown; code_not_applied?: unknown; offer_ended?: unknown; offer_failed?: unknown; error?: unknown }
    if (res.ok && body.started === true) return { started: true }
    if (res.status === 409 && body.already_member === true) {
      // Another tab got there first, OR there is a subscription that is not a
      // free week. Only the account's own facts say which.
      // Looked at twice: another tab may have started it a moment ago, with
      // its records still being written.
      if ((await readFacts())?.trial) return { started: true }
      await wait(2000)
      return (await readFacts())?.trial ? { started: true } : failed
    }
    // Stripe has the free week but our records are not written: the same call finishes it.
    if (body.started_not_recorded === true && attempt === 0) {
      await wait(2000)
      continue
    }
    if (body.code_not_applied === true || body.offer_ended === true || body.offer_failed === true) {
      return { started: false, note: freeWeekNotStartedLine('code', typeof body.error === 'string' ? body.error : null), retry: false }
    }
    return failed
  }
  return failed
}

/**
 * One start per ACCOUNT per page load, however many times the effect that asks
 * for it runs (React runs effects twice in development, and a second mount
 * must get the first one's answer, not "nothing to do"). Keyed by account: a
 * tab where one person signs out and another signs up does not hand the
 * second person the first one's answer. An answer that may differ on another
 * try is not kept.
 */
const inflight = new Map<string, Promise<StartOutcome>>()
export function startFreeWeekOnce(
  userId: string,
  token: string,
  offerCode: string | null,
  run: (token: string, offerCode: string | null) => Promise<StartOutcome> = startFreeWeekAfterSignup
): Promise<StartOutcome> {
  const existing = inflight.get(userId)
  if (existing) return existing
  const started = run(token, offerCode)
    .catch((err): StartOutcome => {
      console.error('[free week] could not start after sign-up:', err)
      return { started: false, note: freeWeekNotStartedLine('other'), retry: true }
    })
    .then((outcome) => {
      if (!outcome.started && outcome.retry) inflight.delete(userId)
      return outcome
    })
  inflight.set(userId, started)
  return started
}

/** `{ timezone }` from the browser, or nothing when it cannot be read. Sent so the confirmation email gives the end time in the member's own time. */
export function browserTimeZone(): { timezone?: string } {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof timezone === 'string' && timezone ? { timezone } : {}
  } catch {
    return {}
  }
}
