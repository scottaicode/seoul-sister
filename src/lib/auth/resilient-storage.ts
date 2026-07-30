/**
 * Session storage that survives Safari clearing localStorage.
 *
 * WHY (July 29 2026)
 *
 * Bailey still had to sign in every launch after the cold-launch fix, while
 * Scott's iPhone on the SAME build and the SAME origin stayed signed in. The
 * database settled what was happening: she had exactly ONE session row, created
 * minutes earlier and never refreshed — down from the five-per-day the earlier
 * bug produced. So the session was being created and stored correctly, and her
 * browser simply could not find it again on relaunch. Nothing in this codebase
 * clears it (verified), and the shipped bundle contains the fix (verified).
 *
 * That leaves the browser evicting the storage. iOS does this in several
 * situations that are entirely outside our control and differ per device, which
 * is exactly why one iPhone works and another does not:
 *   - Safari's 7-day cap on script-writable storage for sites without
 *     "user interaction" as Apple defines it
 *   - Prevent Cross-Site Tracking / Advanced Tracking Protection heuristics
 *   - Private Relay and Lockdown Mode variations
 *   - aggressive storage reclamation under low disk
 *
 * We cannot switch those off from a web page. What we CAN do is stop keeping the
 * session in only one place. This adapter writes every value to localStorage AND
 * mirrors it into a cookie, then reads back from whichever still exists. A cookie
 * with an explicit Max-Age is not "script-writable storage" in the sense Safari
 * evicts on that 7-day timer, so the two have genuinely different lifetimes —
 * losing both at once is far less likely than losing either.
 *
 * This is deliberately NOT a move to @supabase/ssr. Every API route here reads an
 * `Authorization: Bearer` header from `supabase.auth.getSession()`, so cookie
 * transport would mean rewriting the auth read in ~150 files for no gain. The
 * cookie here is a durability mirror, not the transport.
 *
 * SECURITY NOTE: the cookie cannot be HttpOnly, because the whole point is that
 * client-side JS reads it back — same exposure as the localStorage copy it
 * mirrors, so this does not weaken anything. It is scoped `SameSite=Lax` (blocks
 * cross-site sends), `Secure`, and path-limited. Access tokens are short-lived
 * and rotate; the refresh token is the sensitive part and is no more exposed here
 * than it already was in localStorage.
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 400 // ~400 days, the Chrome cookie ceiling

function cookieName(key: string): string {
  // Cookie names cannot contain the characters supabase uses freely in keys.
  return `ss-auth-${encodeURIComponent(key)}`
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length))
      } catch {
        return null
      }
    }
  }
  return null
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
}

/**
 * A supabase-js compatible storage adapter. Every operation is wrapped: in
 * private browsing localStorage access THROWS rather than returning null, and an
 * uncaught throw here would break sign-in entirely rather than degrading.
 */
export const resilientAuthStorage = {
  getItem: (key: string): string | null => {
    let fromLocal: string | null = null
    try {
      fromLocal = window.localStorage.getItem(key)
    } catch {
      // localStorage unavailable (private mode / blocked). Fall through.
    }
    if (fromLocal) return fromLocal

    // localStorage lost it — recover from the cookie mirror. This is the case
    // that keeps Bailey signed in.
    const fromCookie = readCookie(cookieName(key))
    if (fromCookie) {
      // Re-seed localStorage so the fast path works for the rest of the session.
      try {
        window.localStorage.setItem(key, fromCookie)
      } catch {
        // Fine — the cookie remains the source of truth.
      }
      return fromCookie
    }
    return null
  },

  setItem: (key: string, value: string): void => {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Ignore; the cookie write below still persists the session.
    }
    writeCookie(cookieName(key), value)
  },

  removeItem: (key: string): void => {
    // A real sign-out must clear BOTH, or the cookie would silently resurrect a
    // session the user explicitly ended.
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Ignore.
    }
    deleteCookie(cookieName(key))
  },
}
