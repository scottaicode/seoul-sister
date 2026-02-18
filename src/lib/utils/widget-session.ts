/**
 * Widget Session Tracking (localStorage-based)
 *
 * Tracks anonymous widget message usage with a 30-day rolling window.
 * After 5 messages, visitors must create an account for unlimited access.
 * Counter resets after 30 days, giving returning visitors a second chance.
 *
 * Why localStorage over cookies:
 * - Persists across browser sessions (cookies can be session-scoped)
 * - Not sent with every HTTP request (no bandwidth overhead)
 * - Survives cookie-clearing (most users clear cookies, not localStorage)
 * - 30-day reset is more natural than cookie expiry hacks
 *
 * Server-side enforcement: /api/widget/chat enforces the 5-message limit
 * per session (IP + User-Agent hash) via Supabase-backed rate limiter,
 * plus a separate 10/IP/day abuse prevention limit. The client-side
 * counter here is purely for UX (showing remaining messages) — the
 * server does NOT trust the client history array for counting.
 */

const STORAGE_KEY = 'yuri_widget_session'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const MAX_FREE_MESSAGES = 5

interface WidgetSession {
  count: number
  firstUsed: number // epoch ms
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function readSession(): WidgetSession {
  if (!isClient()) return { count: 0, firstUsed: Date.now() }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { count: 0, firstUsed: Date.now() }

    const session: WidgetSession = JSON.parse(raw)

    // Reset if 30 days have passed since first use
    if (Date.now() - session.firstUsed > THIRTY_DAYS_MS) {
      const fresh = { count: 0, firstUsed: Date.now() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
      return fresh
    }

    return session
  } catch {
    return { count: 0, firstUsed: Date.now() }
  }
}

function writeSession(session: WidgetSession): void {
  if (!isClient()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage full or disabled — fail silently
  }
}

export function getMessageCount(): number {
  return readSession().count
}

export function setMessageCount(count: number): void {
  const session = readSession()
  writeSession({ ...session, count })
}

export function incrementWidgetMessageCount(): number {
  const session = readSession()
  const updated = {
    count: session.count + 1,
    firstUsed: session.count === 0 ? Date.now() : session.firstUsed,
  }
  writeSession(updated)
  return updated.count
}

export function getRemainingWidgetMessages(): number {
  return Math.max(0, MAX_FREE_MESSAGES - getMessageCount())
}
