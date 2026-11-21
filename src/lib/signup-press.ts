/**
 * The first-party count of sign-up button presses (Nov 21 2026).
 *
 * A press is the earliest step in the path to membership that is mostly
 * people: crawlers load pages (Google Analytics counted 3,358 "sessions" in
 * nine days against 5 real accounts) but do not press buttons. Each press is
 * one row in ss_signup_presses: which button, a channel name for where the
 * visitor arrived from, and which page.
 *
 * Every field is CLOSED-WORLD: a button from a fixed list, a channel from a
 * fixed list, a path that is the home page or one blog post. Nothing a visitor
 * or a link's author can write freely is stored, so nothing here can identify a
 * person or carry their words. (A second-model review found that the first
 * version, which only cleaned the characters, would have kept a personalised
 * `utm_source` such as a name and mail domain.)
 *
 * WHAT IT COUNTS: presses of the six buttons below, in a browser running our
 * script. NOT counted: sign-up links elsewhere (product pages, the blog index),
 * a direct visit to the sign-up form, a link opened in a new tab, or a browser
 * that blocks the request. So an account with no press before it is normal. A
 * press count of zero over days when accounts were created from these buttons
 * (`signup_from` ending in one of their names) is what means it is broken.
 *
 * No imports: tests/signup-presses.test.mjs runs this file as it is.
 */

/** The sign-up buttons that record a press. Nothing else is accepted. */
export const SIGNUP_PRESS_BUTTONS = ['nav', 'menu', 'bar', 'final_cta', 'blog_cta', 'blog_inline'] as const

/**
 * Channel names an arrival is reduced to. Our own `?from=` tags, the social
 * and search sources we link from, and the AI assistants ai-referrer.ts names.
 */
export const SIGNUP_PRESS_ARRIVALS = [
  'landing', 'blog', 'product', 'ingredient', 'best', 'nav',
  'tiktok', 'instagram', 'reddit', 'youtube', 'pinterest', 'google',
  'recap', 'nurture', 'email',
  'chatgpt', 'copilot', 'bing', 'perplexity', 'claude', 'gemini', 'you', 'poe', 'duckduckgo',
] as const

/**
 * Where the visitor arrived from, as one of the names above, 'referrer' for
 * another site's link, 'other' for anything else, or null when unknown. The
 * raw value (a utm_source, a `from` tag, a referrer host) is never stored.
 */
export function pressArrival(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.toLowerCase().trim()
  if (!v) return null
  if (v.startsWith('ref_')) return 'referrer'
  // Our own tags carry a suffix (product_top, best_cta, nurture_3, tt_ss): the first word names the channel.
  const head = v.split(/[^a-z0-9]+/)[0]
  const known = (SIGNUP_PRESS_ARRIVALS as readonly string[]).find((name) => v === name || head === name)
  if (known) return known
  if (head === 'tt') return 'tiktok'
  if (head === 'ig') return 'instagram'
  return 'other'
}

/** The page the button was on: the home page or one blog post. null for anything else. */
export function pressPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const path = raw.split(/[?#]/)[0]
  if (path === '/') return '/'
  return /^\/blog\/[a-z0-9-]{1,180}$/.test(path) ? path : null
}

export interface SignupPress {
  button: string
  arrival: string | null
  page_path: string | null
}

/** What is stored for one press, or null when the button is not one of ours. */
export function signupPressRow(input: { button?: unknown; arrival?: unknown; path?: unknown }): SignupPress | null {
  const button = typeof input.button === 'string' ? input.button : ''
  if (!(SIGNUP_PRESS_BUTTONS as readonly string[]).includes(button)) return null
  return { button, arrival: pressArrival(input.arrival), page_path: pressPath(input.path) }
}

/** The largest body the endpoint reads. A real press is under 150 bytes. */
export const SIGNUP_PRESS_MAX_BYTES = 600

/**
 * Whether a request looks like it came from our own page. A browser says so
 * itself (Sec-Fetch-Site, Origin); neither header can be set by a script on
 * another site. A request carrying neither (an old browser) is let through:
 * refusing it would lose real presses, and the fixed lists above already limit
 * what such a request could write. This keeps other sites and casual scripts
 * out of the count; it does not make the count tamper-proof.
 */
export function pressRequestAllowed(h: { secFetchSite?: string | null; origin?: string | null; host?: string | null; contentLength?: string | null }): boolean {
  const length = Number(h.contentLength)
  if (h.contentLength != null && h.contentLength !== '' && (!Number.isFinite(length) || length > SIGNUP_PRESS_MAX_BYTES)) return false
  if (h.secFetchSite && h.secFetchSite !== 'same-origin') return false
  if (h.origin) {
    let originHost = ''
    try { originHost = new URL(h.origin).host } catch { return false }
    if (!h.host || originHost !== h.host) return false
  }
  return true
}

export const SIGNUP_PRESS_ENDPOINT = '/api/funnel/press'

/**
 * Record a press from the browser. Sent with sendBeacon so it survives the
 * navigation the press itself starts. Never throws and never delays the link.
 */
export function recordSignupPress(button: string, arrival: string | null | undefined): void {
  if (typeof window === 'undefined') return
  try {
    const row = signupPressRow({ button, arrival, path: window.location.pathname })
    if (!row) return
    const body = JSON.stringify({ button: row.button, arrival: row.arrival, path: row.page_path })
    const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(SIGNUP_PRESS_ENDPOINT, new Blob([body], { type: 'application/json' }))
    if (!sent) void fetch(SIGNUP_PRESS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined)
  } catch {
    // A count must never get in the way of the sign-up it counts.
  }
}
