/**
 * Widget Session Tracking (localStorage-based)
 *
 * Tracks anonymous widget message usage with a 30-day rolling window.
 * After MAX_FREE_MESSAGES, visitors must subscribe for unlimited access.
 * Counter resets after 30 days, giving returning visitors a second chance.
 *
 * Why localStorage over cookies:
 * - Persists across browser sessions (cookies can be session-scoped)
 * - Not sent with every HTTP request (no bandwidth overhead)
 * - Survives cookie-clearing (most users clear cookies, not localStorage)
 * - 30-day reset is more natural than cookie expiry hacks
 *
 * Server-side enforcement: /api/widget/chat enforces the real cap as a
 * LIFETIME count per visitor_id (ss_widget_visitors.total_messages), plus a
 * per-IP 30-day backstop (device-switch quota resets) and a separate
 * 25/IP/day abuse limit. The client-side counter here is purely for UX
 * (showing remaining messages) — the server does NOT trust the client.
 */

const STORAGE_KEY = 'yuri_widget_session'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// Keep in sync with MAX_FREE_MESSAGES in src/lib/widget/visitor.ts (server truth).
export const MAX_FREE_MESSAGES = 12

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
  try { localStorage.setItem(PREVIEWED_AT_KEY, new Date().toISOString()) } catch { /* storage unavailable */ }
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
 * The visitor UUID if this browser already has one, else null. Never creates
 * one: onboarding uses it only to carry an existing preview conversation over
 * (src/lib/yuri/widget-carryover.ts), so a fresh id would point at nothing.
 */
export function getExistingVisitorId(): string | null {
  if (!isClient()) return null
  try {
    const stored = localStorage.getItem(VISITOR_ID_KEY)
    if (stored) return stored
  } catch { /* localStorage unavailable */ }
  return getCookie(VISITOR_COOKIE_NAME) || null
}

const CARRYOVER_CHOICE_KEY = 'yuri_carryover_choices'
const PREVIEWED_AT_KEY = 'yuri_previewed_at'

/** Last time this browser sent a preview message. Never reset (the message counter is, after 30 days). */
export function previewedAt(): string | null {
  if (!isClient()) return null
  try { return localStorage.getItem(PREVIEWED_AT_KEY) } catch { return null }
}

/** True when this browser has a free-preview conversation. */
export function hasPreviewConversation(): boolean {
  return Boolean(getExistingVisitorId()) && (getMessageCount() > 0 || Boolean(previewedAt()))
}

function readChoices(): Record<string, 'yes' | 'no'> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CARRYOVER_CHOICE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}

/**
 * This ACCOUNT's answer to "continue from your earlier chat on this device?".
 * Keyed by user id: a browser can be shared, and a single per-browser answer
 * let a second account inherit the first person's "yes" and receive their skin
 * conversation without being asked (review, Oct 17 2026).
 */
export function getCarryoverChoice(userId: string): 'yes' | 'no' | null {
  if (!isClient() || !userId) return null
  const v = readChoices()[userId]
  return v === 'yes' || v === 'no' ? v : null
}

export function setCarryoverChoice(userId: string, choice: 'yes' | 'no'): void {
  if (!isClient() || !userId) return
  try {
    localStorage.setItem(CARRYOVER_CHOICE_KEY, JSON.stringify({ ...readChoices(), [userId]: choice }))
  } catch { /* storage unavailable: they are asked again next time */ }
}

/** The visitor id to send to onboarding: only after THIS account said yes. */
export function consentedVisitorId(userId: string): string | undefined {
  return getCarryoverChoice(userId) === 'yes' ? getExistingVisitorId() ?? undefined : undefined
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
 * Forget the current session ID ("Start over").
 */
export function clearWidgetSessionId(): void {
  if (!isClient()) return
  try {
    sessionStorage.removeItem(SESSION_ID_KEY)
  } catch { /* sessionStorage unavailable */ }
}

/**
 * Set the session ID after first message response. A new id means the fresh
 * start (if any) has happened, so the marker is cleared.
 */
export function setWidgetSessionId(id: string): void {
  if (!isClient()) return
  try {
    sessionStorage.setItem(SESSION_ID_KEY, id)
    sessionStorage.removeItem(FRESH_KEY)
  } catch { /* sessionStorage unavailable */ }
}

/**
 * "Start over" marker. Survives a reload (an in-memory flag did not, so a reload
 * before the next message re-restored the conversation the visitor had just
 * discarded). While set: no restore, and the next message asks for a fresh
 * conversation. Cleared when a new session id is stored.
 */
const FRESH_KEY = 'yuri_widget_fresh'
export function markWidgetFresh(): void {
  if (!isClient()) return
  try { sessionStorage.setItem(FRESH_KEY, '1') } catch { /* unavailable */ }
}
export function isWidgetFresh(): boolean {
  if (!isClient()) return false
  try { return sessionStorage.getItem(FRESH_KEY) === '1' } catch { return false }
}
