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
