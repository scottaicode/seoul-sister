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
// Oct 30 2026 relaunch: one plan at $9.99/month with a monthly Yuri allowance
// and a 7-day free trial for first-time subscribers. Sized from MEASURED cost
// after the v11.46.0 cache fix (~$0.23 to open a conversation, ~$0.02-0.03 per
// follow-up). Charged price = STRIPE_PRICE_MONTHLY. The old $24.99 "unlimited"
// plan (plan key 'pro_monthly') is no longer sold; it remains for comped and
// grandfathered accounts. See PRICING-RELAUNCH-PLAN-2026-10-30.md.
export const PRICING = {
  /** Monthly price in USD (numeric, for math) */
  monthly_usd: 9.99,
  /** Display string with currency + cadence — use this in all copy */
  monthly_display: '$9.99/mo',
  /** Display string, long form */
  monthly_display_long: '$9.99/month',
  /** Product/plan display name */
  plan_name: 'Seoul Sister Pro',
  /** Free trial length for first-time subscribers (card required) */
  trial_days: 7,
  /** Yuri allowance, for copy: "80 messages with Yuri a month" */
  yuri_allowance_display: '80 messages with Yuri a month',
} as const

/** Monthly usage caps for the current plan (Oct 30 2026).
 *
 * A real monthly allowance, stated to subscribers and to Yuri. 80 Yuri messages
 * covers the heaviest real month on record (79, Aug 2026). Measured cost after
 * the cache fix: ~$0.23 to open a conversation, ~$0.02-0.03 per follow-up, so a
 * typical subscriber costs a few dollars and full use roughly breaks even. The
 * old June note claiming "$5-8/mo for a heavy user" was contradicted by the logs
 * ($22.73 in Bailey's busiest month before the fix).
 */
export const USAGE_CAPS = {
  yuri_messages_per_month: 80,
  scans_per_month: 30,
} as const

/** Comped and grandfathered accounts (plan key 'pro_monthly'): the old
 * "unlimited" plan's abuse backstops. Not sold any more. */
export const LEGACY_USAGE_CAPS = {
  yuri_messages_per_month: 1500,
  scans_per_month: 300,
} as const

/** Usage caps for a profile plan key. Anything other than the legacy key gets
 * the current plan's allowance. */
export function usageCapsForPlan(plan: string | null | undefined) {
  return plan === 'pro_monthly' ? LEGACY_USAGE_CAPS : USAGE_CAPS
}
