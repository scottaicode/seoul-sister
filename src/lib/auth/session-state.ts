/**
 * Cold-launch session-state reducers.
 *
 * Extracted from AuthContext so the decision "is this a logout, or a network
 * blip?" is testable on its own. The guard tests in
 * tests/cold-launch-session-recovery.test.mjs execute THESE functions — a
 * regression here fails a behavioural test, not just a source-text grep.
 *
 * WHY THIS EXISTS (July 29 2026)
 *
 * Bailey, on the freshly-installed home-screen app: "As soon as I closed
 * everything out and clicked the app it was back to main login page."
 *
 * Verified against the installed @supabase/auth-js 2.95.3: on a cold launch the
 * stored access token is normally past the 90s EXPIRY_MARGIN_MS, so
 * `__loadSession` refreshes it INLINE inside `getSession()`
 * (GoTrueClient.js:1235). When iOS restores a home-screen app the network is
 * usually not up yet, so that refresh throws AuthRetryableFetchError
 * (lib/fetch.js:106) and `getSession()` resolves `{ session: null, error }`
 * (GoTrueClient.js:1237).
 *
 * Critically, auth-js does NOT delete the stored session for a retryable error
 * (the `!isAuthRetryableFetchError` guards at :1994 and :1925) and recovers on
 * its own via the visibility handler and the 30s refresh tick. The credentials
 * are still on disk. Treating that as a logout is what bounced her to /login,
 * and why she accumulated five sessions in one day — each bounce made her sign
 * in again instead of reusing the good session.
 */

/** What the provider should do with an auth outcome. */
export type SessionOutcome =
  /** Not a logout. Leave `user` alone, stay loading, wait for auth-js to retry. */
  | { kind: 'wait' }
  /** Authoritative. Apply this user (or null for a real logout) and stop loading. */
  | { kind: 'resolve'; user: unknown | null }

/**
 * A retryable fetch error means the network was unavailable, NOT that the
 * session is invalid. auth-js keeps the stored session in this case.
 */
export function isTransientAuthError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: string }).name === 'AuthRetryableFetchError'
  )
}

/** Decide what a resolved `getSession()` call means. */
export function reduceGetSession(result: {
  session: { user?: unknown } | null
  error?: unknown
}): SessionOutcome {
  // No session BECAUSE the network failed → the credentials are still on disk.
  // Showing /login here is the defect.
  if (!result.session && isTransientAuthError(result.error)) {
    return { kind: 'wait' }
  }
  return { kind: 'resolve', user: result.session?.user ?? null }
}

/** Decide what an `onAuthStateChange` event means. */
export function reduceAuthEvent(
  event: string,
  session: { user?: unknown } | null
): SessionOutcome {
  // auth-js surfaces the failed cold-launch refresh as INITIAL_SESSION with a
  // null session (GoTrueClient.js:1639). Same reasoning as above: not a logout.
  // SIGNED_OUT remains the authoritative logged-out signal and falls through.
  if (event === 'INITIAL_SESSION' && !session) {
    return { kind: 'wait' }
  }
  return { kind: 'resolve', user: session?.user ?? null }
}
