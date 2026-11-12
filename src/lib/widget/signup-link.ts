/**
 * The sign-up page's half of the recap email's "Create your free account" link
 * (Nov 11 2026).
 *
 * The link carries the recap's resume token. On arrival the token is taken out
 * of the address bar at once (it is a 30-day credential: it must not reach
 * analytics, the history, or a screenshot), the server is asked which preview
 * conversation it names, and this browser is made that visitor. The setup chat
 * then asks its usual "was that you?" before using any of it, so nothing here
 * decides to share a conversation; it only makes the question possible.
 *
 * No imports, so the test runs this file as it is. The page passes the real
 * `adoptPreviewForSignup`.
 */

export interface SignupLinkEnv {
  location: { pathname: string; search: string; hash: string }
  history: { state: unknown; replaceState(state: unknown, unused: string, url: string): void }
  fetch: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>
  /** Returns whether this browser took the conversation (it declines when it already has one of its own). */
  adopt: (visitorId: string) => boolean
  /** Someone is already signed in here: the link is not for creating their account, so nothing is claimed. */
  signedIn: () => Promise<boolean>
}

const TOKEN = /^[A-Za-z0-9_-]{20,1000}$/
const VISITOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Removes `resume` from the URL and returns it (null if absent or not shaped
 * like a token). Synchronous: call it before anything can read the address.
 */
export function takeSignupResumeToken(env: Pick<SignupLinkEnv, 'location' | 'history'>): string | null {
  const params = new URLSearchParams(env.location.search)
  const token = params.get('resume')
  if (token === null) return null
  params.delete('resume')
  const qs = params.toString()
  env.history.replaceState(env.history.state, '', `${env.location.pathname}${qs ? `?${qs}` : ''}${env.location.hash}`)
  return TOKEN.test(token) ? token : null
}

/** True when this browser now holds the preview conversation. Never throws. */
export async function claimPreviewForSignup(
  token: string | null,
  env: Pick<SignupLinkEnv, 'fetch' | 'adopt' | 'signedIn'>
): Promise<boolean> {
  if (!token) return false
  try {
    if (await env.signedIn()) return false
    const res = await env.fetch(`/api/widget/transcript?for=account&resume=${encodeURIComponent(token)}`)
    if (!res.ok) return false
    const data = (await res.json()) as { visitor_id?: unknown } | null
    const visitorId = data?.visitor_id
    if (typeof visitorId !== 'string' || !VISITOR.test(visitorId)) return false
    return env.adopt(visitorId) === true
  } catch {
    // An expired link or a network failure: sign-up goes on without the chat.
    return false
  }
}

/**
 * Wait for the claim, but never long. Sign-up leaves this page (a route change,
 * or a full redirect to Google); leaving before the claim lands would greet
 * the person as a stranger again, and waiting forever on a slow network would
 * be worse. Resolves either way.
 */
export function settleWithin(claim: Promise<unknown> | null | undefined, ms: number): Promise<void> {
  if (!claim) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    claim.then(
      () => { clearTimeout(timer); resolve() },
      () => { clearTimeout(timer); resolve() }
    )
  })
}
