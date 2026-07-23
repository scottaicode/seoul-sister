// ---------------------------------------------------------------------------
// Pricing — SINGLE SOURCE OF TRUTH (client-safe, no server imports)
// ---------------------------------------------------------------------------
// Every price string in the app (UI, system prompts, emails) must derive from
// here. Do NOT hardcode the dollar amount anywhere else — import PRICING and
// use PRICING.monthly_display. Changing the displayed price is a one-line edit.
//
// This module has NO server-only imports so it is safe to import from client
// ('use client') components as well as server code.
//
// NOTE: this is the DISPLAY price only. The actual charge comes from the Stripe
// Price object referenced by STRIPE_PRICE_PRO_MONTHLY (env var). When you change
// the number here you MUST also create a new Stripe Price at the same amount and
// update that env var — otherwise the displayed price and the charged price drift.
//
// REPRICING CHECKLIST — when you change the number, update these too:
//   1. Create a new Stripe Price at the same amount + set STRIPE_PRICE_PRO_MONTHLY.
//   2. LGAAS mirrors this automatically. It pulls GET /api/lgaas/pricing (which
//      reads THIS file) via a daily sync + a regen-time guard, so the LGAAS
//      business-profile price is NO LONGER a manual step — do NOT hand-edit it.
//      The ONE human step on the LGAAS side is its `price_history_note` prose
//      ("repriced from $X on <date>"), which is authored, not synced.
//   (History: a June 2026 repricing left a stale $39.99 in the hand-mirrored
//    LGAAS profile and it reached real users. The auto-sync exists so that can't
//    recur — see lgaas/lgaas-blueprint/129-*.md §129.1.)
export const PRICING = {
  /** Monthly price in USD (numeric, for math) */
  monthly_usd: 24.99,
  /** Display string with currency + cadence — use this in all copy */
  monthly_display: '$24.99/mo',
  /** Display string, long form */
  monthly_display_long: '$24.99/month',
  /** Product/plan display name */
  plan_name: 'Seoul Sister Pro',
} as const

/** Monthly usage caps for active subscribers.
 *
 * Set "feel-unlimited": high enough that no normal user ever hits them, so the
 * product reads as "your advisor is always there" rather than "you have a quota."
 * Cost data (June 2026) shows even a heavy daily user runs ~$5-8/mo in tokens, so
 * generous caps still hold ~70%+ margin at $24.99, and a typical bursty user
 * (Bailey: ~108 msgs in her busiest month, 0 scans) stays ~95% margin. These are
 * abuse backstops, not product limits — surfaced to the user as "unlimited."
 */
export const USAGE_CAPS = {
  yuri_messages_per_month: 1500,
  scans_per_month: 300,
} as const
