/**
 * GA4 event helper — deterministic analytics infrastructure.
 *
 * Thin typed wrapper over the global `gtag` configured in layout.tsx
 * (Measurement ID G-L3VXSLT781). Safe to call anywhere on the client:
 * if gtag hasn't loaded (ad-blocker, SSR, race before the afterInteractive
 * script), the call is a no-op rather than a crash.
 *
 * This is NOT a judgment surface — it records facts about what happened in
 * the funnel so visitor→paid conversion becomes readable instead of a single
 * inscrutable zero. Keep it dumb on purpose.
 */

type GtagParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: GtagParams) => void
  }
}

export function trackEvent(eventName: string, params?: GtagParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  try {
    window.gtag('event', eventName, params)
  } catch {
    // Analytics must never break a user flow.
  }
}

/** Funnel events for the paywall (/subscribe). The "paid" end is recorded
 *  server-side by the Stripe webhook, so these three plus the webhook give the
 *  full view → checkout-intent → reached-Stripe → paid drop-off curve. */
export const PaywallEvent = {
  view: 'paywall_view',
  checkoutClick: 'paywall_checkout_click',
  checkoutRedirect: 'paywall_checkout_redirect',
} as const

/** Landing-page Yuri demo events. The hero widget shows one of two demo angles
 *  (owner vs beginner) at random per load. These two events let GA4 grade which
 *  demo earns engagement: `demo_shown` fires once on display with the variant,
 *  `demo_first_message` fires when the visitor actually sends their first
 *  message. The display→first-message rate per `demo_variant` is the objective
 *  teacher for which angle resonates — turning the random rotation into a real,
 *  measured experiment (Learning Loop principle). */
export const DemoEvent = {
  shown: 'yuri_demo_shown',
  firstMessage: 'yuri_demo_first_message',
  // Visitor arrived at the hero widget from a feeder page (blog/product/
  // ingredient "Ask Yuri" CTA) with a prefilled question via ?ask=. `source`
  // tags which feeder sent them, so we can measure the funnel each page drives.
  prefillArrived: 'yuri_prefill_arrived',
} as const

/** Landing widget send outcomes. Before this, a visitor who tried to send but
 *  hit a failure (server error, or the shared-IP abuse-429 that hid the input)
 *  wrote NO row to ss_widget_sessions and looked identical to someone who simply
 *  chose to leave — so "did my fixes work?" was unanswerable. `sendFailed` fires
 *  whenever a send attempt does NOT produce a Yuri response, tagged by `reason`:
 *    - 'rate_limited'  → per-IP/day abuse limit (transient; input stays open)
 *    - 'limit_reached' → the real per-visitor preview cap (paywall shown)
 *    - 'error'         → genuine failure (network/5xx/parse) with no content
 *  Pairing this against `yuri_demo_first_message` finally separates ABANDONMENT
 *  from FAILURE in GA4 — the measurement the v11.8.0 friction fixes need to be
 *  proven or killed. Metadata only, no message content (keeps GA4 PII-free). */
export const WidgetEvent = {
  sendFailed: 'yuri_send_failed',
} as const

/** Contextual Yuri nudge on Products/Ingredients/Blog detail pages (Phase 4). The
 *  nudge is a feeder to the landing widget: `shown` fires when an engaged
 *  visitor (scroll/dwell triggered) sees it, `click` when they take it. Combined
 *  with `yuri_prefill_arrived` (source=product/ingredient/blog), this gives the full
 *  feeder funnel: shown → click → arrived → first message. `kind` = which page. */
export const NudgeEvent = {
  shown: 'yuri_nudge_shown',
  click: 'yuri_nudge_click',
} as const

/** Free-surface search demand. Fires when a public search returns (debounced),
 *  so GA4 can measure that strangers are actively searching the free content —
 *  the top-of-funnel demand signal the DB can't see (anonymous page reads write
 *  no rows). Metadata only: `query_length` + `result_count`, never the raw query
 *  string, to keep GA4 free of PII. A high search volume with low widget
 *  first-message rate = the flywheel is leaking between free content and Yuri. */
export const SearchEvent = {
  ingredient: 'ingredient_search',
} as const

/** Blog → Yuri feeder. Blog posts already route "Ask Yuri" CTAs to the landing
 *  widget with `&from=blog` (the arrival is caught by `yuri_prefill_arrived`
 *  source=blog), but the blog-SIDE click was invisible. `ctaClick` closes that:
 *  it fires when a reader takes a blog CTA, tagged by `placement` (which CTA)
 *  and `authed` (logged-in readers go to /yuri instead of the widget). Pairing
 *  click→arrival measures how much of your GEO/blog traffic actually reaches
 *  Yuri — the flywheel the free content exists to drive. */
export const BlogEvent = {
  ctaClick: 'blog_yuri_cta_click',
} as const
