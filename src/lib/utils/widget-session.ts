/**
 * Widget Session Tracking (localStorage-based)
 *
 * Tracks anonymous widget message usage with a 30-day rolling window.
 * After 20 messages, visitors must subscribe for unlimited access.
 * Counter resets after 30 days, giving returning visitors a second chance.
 *
 * Why localStorage over cookies:
 * - Persists across browser sessions (cookies can be session-scoped)
 * - Not sent with every HTTP request (no bandwidth overhead)
 * - Survives cookie-clearing (most users clear cookies, not localStorage)
 * - 30-day reset is more natural than cookie expiry hacks
 *
 * Server-side enforcement: /api/widget/chat enforces the 20-message limit
 * per session (IP + User-Agent hash) via Supabase-backed rate limiter,
 * plus a separate 25/IP/day abuse prevention limit. The client-side
 * counter here is purely for UX (showing remaining messages) — the
 * server does NOT trust the client history array for counting.
 */

const STORAGE_KEY = 'yuri_widget_session'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const MAX_FREE_MESSAGES = 20

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

/**
 * Subscribe to cross-tab changes to the widget message counter.
 * When another tab increments the counter, this callback fires.
 * Returns an unsubscribe function.
 */
export function onMessageCountChange(callback: (count: number) => void): () => void {
  if (!isClient()) return () => {}

  function handler(e: StorageEvent) {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    try {
      const session: WidgetSession = JSON.parse(e.newValue)
      callback(session.count)
    } catch { /* ignore */ }
  }

  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

// ---------------------------------------------------------------------------
// Persistent Visitor Identity (Phase 14)
// ---------------------------------------------------------------------------

const VISITOR_ID_KEY = 'yuri_visitor_id'
const VISITOR_COOKIE_NAME = 'yuri_vid'
const SESSION_ID_KEY = 'yuri_widget_session_id'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 86400000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`
}

/**
 * Get or create a persistent visitor UUID.
 * Two-layer persistence: localStorage (primary) + cookie (backup).
 */
export function getOrCreateVisitorId(): string {
  if (!isClient()) return ''

  // Check localStorage first
  try {
    const stored = localStorage.getItem(VISITOR_ID_KEY)
    if (stored) {
      // Ensure cookie is in sync
      setCookie(VISITOR_COOKIE_NAME, stored, 365)
      return stored
    }
  } catch { /* localStorage unavailable */ }

  // Check cookie fallback
  const cookieVal = getCookie(VISITOR_COOKIE_NAME)
  if (cookieVal) {
    try { localStorage.setItem(VISITOR_ID_KEY, cookieVal) } catch { /* */ }
    return cookieVal
  }

  // Generate new UUID
  const newId = crypto.randomUUID()
  try { localStorage.setItem(VISITOR_ID_KEY, newId) } catch { /* */ }
  setCookie(VISITOR_COOKIE_NAME, newId, 365)
  return newId
}

/**
 * Get the current session ID (stored in sessionStorage — dies with tab).
 */
export function getWidgetSessionId(): string | null {
  if (!isClient()) return null
  try {
    return sessionStorage.getItem(SESSION_ID_KEY)
  } catch { return null }
}

/**
 * Set the session ID after first message response.
 */
export function setWidgetSessionId(id: string): void {
  if (!isClient()) return
  try {
    sessionStorage.setItem(SESSION_ID_KEY, id)
  } catch { /* sessionStorage unavailable */ }
}
