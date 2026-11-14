/**
 * Where a Google sign-up came from (Nov 14 2026).
 *
 * An email-and-password sign-up records three things on the account as it is
 * created: the first-touch attribution, the landing-chat visitor id, and the
 * `signup_from` tag of the link that led to the sign-up page. A Google
 * sign-up recorded none of them. `signInWithOAuth` has no `data` option; the
 * old code passed one behind a type cast and it was dropped without an error.
 * The first stranger to start a free week after the landing chat closed
 * signed up with Google, and her account said nothing about how she arrived.
 *
 * The browser still holds all three when Google sends the person back, so the
 * callback page writes them then, once, with `supabase.auth.updateUser`.
 * Supabase merges provider claims into user metadata key by key on later
 * Google sign-ins (read in supabase/auth `UpdateUserMetaData`, Nov 14 2026),
 * so these keys stay.
 *
 * No imports, so the test runs this file as it is.
 */

/** A callback this soon after the account was created is the sign-up itself. */
export const OAUTH_NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000

export interface OAuthSignupSourceFound {
  attribution?: unknown
  widgetVisitorId?: string | null
  signupFrom?: string | null
}

/**
 * The metadata to add to a just-created Google account, or null when there is
 * nothing to add.
 *
 * - Null for an account older than the window: a member signing IN from a
 *   tagged link is not a sign-up, and must not be counted as one.
 * - A key already on the account is never replaced (first touch is kept).
 * - A value the browser does not have is left out, never written as empty:
 *   "unknown" must stay distinguishable from "arrived with no tag".
 */
export function oauthSignupMetadata(
  user: { created_at?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined,
  found: OAuthSignupSourceFound,
  now: number
): Record<string, unknown> | null {
  if (!user?.created_at) return null
  const createdAt = Date.parse(user.created_at)
  if (!Number.isFinite(createdAt)) return null
  const age = now - createdAt
  // A small allowance for a device clock that runs behind the server's.
  if (age > OAUTH_NEW_ACCOUNT_WINDOW_MS || age < -2 * 60 * 1000) return null

  const existing = user.user_metadata ?? {}
  const has = (key: string) => existing[key] !== undefined && existing[key] !== null && existing[key] !== ''
  const out: Record<string, unknown> = {}

  if (!has('attribution') && found.attribution && typeof found.attribution === 'object') {
    out.attribution = found.attribution
  }
  const visitorId = typeof found.widgetVisitorId === 'string' ? found.widgetVisitorId.trim() : ''
  if (!has('widget_visitor_id') && visitorId) out.widget_visitor_id = visitorId
  const from = typeof found.signupFrom === 'string' ? found.signupFrom.trim() : ''
  if (!has('signup_from') && /^[A-Za-z0-9_]{1,60}$/.test(from)) out.signup_from = from

  return Object.keys(out).length ? out : null
}
