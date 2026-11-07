/**
 * Where a signed-out member was going, carried through sign-in (Nov 7 2026).
 *
 * The check-in email's button opens /yuri?ask=<their question>&from=nudge_email.
 * A member who was signed out was sent to a bare /login and, after signing in,
 * to /dashboard: the question they clicked through for was gone. AppShell now
 * sends them to /login?next=<path+query>, and both sign-in paths (password and
 * Google) finish on that path when the account is onboarded and paid.
 *
 * Only same-site relative paths are accepted, so ?next= can never become an
 * open redirect to another origin.
 */

export const RETURN_TO_STORAGE_KEY = 'ss_return_to'

/** A same-site path, or null. Pure. */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const p = raw.trim()
  // Relative to this site only: no scheme, no protocol-relative //host, no
  // backslash tricks browsers normalise into //host.
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('\\')) return null
  if (/[\u0000-\u001f]/.test(p)) return null
  // Never loop back into the auth pages.
  if (/^\/(login|register|forgot-password|auth\/)/.test(p)) return null
  return p
}

/** /login, carrying the current path and query as ?next= when it is safe. Pure. */
export function loginUrlFor(pathname: string | null, search: string): string {
  const next = safeReturnTo(`${pathname ?? ''}${search ?? ''}`)
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login'
}

/**
 * The destination after sign-in: the onboarding/subscribe rules always win
 * (an unpaid or un-onboarded member must not be sent past them); only the
 * plain "/dashboard" landing is replaced by where they were going. Pure.
 */
export function afterSignIn(defaultDestination: string, next: string | null | undefined): string {
  const safe = safeReturnTo(next)
  return defaultDestination === '/dashboard' && safe ? safe : defaultDestination
}
