# Pricing relaunch plan — Oct 30 2026 (v2, after Fable review)

**v2 (after adversarial review).** The draft below (v1) was refuted on six blocking points: trial users
locked out (webhook wrote plan=null on trialing; AppShell gates on plan), trial status never stored,
annual allowance counted per billing YEAR, allowances only break-even at the logged cost (~$0.21/msg plus
~$1.35/subscriber/mo proactive AI, post-fix cost unmeasured), Essentials cannibalizing Pro (almost no one
exceeds 40 msgs/mo), and missing auto-renewal consent/acknowledgment (CA AB 2863). Also: LGAAS holds stale
Seoul Sister facts (a "$299.88/yr" plan that never existed, "20 free messages").

**Phase A (shipped Oct 30, no price change):** landing email gate 8 -> 6 with first showing recorded
(`ss_widget_visitors.email_gate_shown_at`); trialing = active everywhere (webhook plan write, confirm
route, hasActiveSubscription, usage period); `stripe_price_id` + `trial_end` stored; LGAAS stale facts
corrected; measure post-fix Yuri cost per message on real usage.

**Phase B (after ~1-2 weeks of measured cost):** ONE paid plan sized from measured cost; 7-day card
trial with Checkout consent + custom renewal text + acknowledgment email; Yuri told the user's
allowance as a fact; every "unlimited" claim replaced in one release; legacy subscriber keeps
"unlimited"; unknown price id fails loudly; usage counted per calendar month; annual held until cost
is proven; then the founding-member email.

---

## v1 draft (superseded)

Owner decision (Scott, Oct 29): focus on revenue; replace the single "unlimited" $24.99/mo plan with
priced allowances, a free trial, and earlier lead capture. Claude decides details.

## Why (measured)
- Since Mar 11: 164 landing chats -> 67 emails -> 57 free accounts -> 2 ever paid -> 1 active (Oct 29).
- Landing depth: >=2 msgs 106, >=3 77, >=4 60, >=5 44, >=8 18, >=12 9. Email gate at 8 reaches 18.
- In-app Yuri cost: ~$0.24/msg historically (pre-Oct-7); v11.46.0 cache fix shipped Oct 29, modeled
  ~$0.08-0.12, NOT yet measured. Heaviest user-month $22.73 (~108 msgs). Landing ~$0.09/msg.
- Paid plan is marketed "unlimited" with a hidden 1,500 msg/mo backstop (worst case ~$375 cost on $24.99).
- Market: paid skincare apps with traction charge ~EUR 10-20/YEAR (Yuka); hard paywall converts ~5x
  freemium (RevenueCat 2026, via research agent, unverified by me).

## Changes
1. **Landing email gate 8 -> 4** (EMAIL_GATE_AFTER_MESSAGES). Lifetime preview stays 12. Reaches ~60
   visitors instead of 18 over the same period. Yuri already sees her preview counts as facts.
2. **Plans** (new `src/lib/pricing.ts` shape, one definition, everything reads it):
   | Plan | Price | Yuri msgs / month | Label scans / month |
   |---|---|---|---|
   | Essentials | $9.99/mo or $79/yr | 40 | 30 |
   | Pro | $24.99/mo | 100 | 150 |
   | Legacy Pro (existing subscriber only) | $24.99/mo (existing price) | 1,500 (as sold: "unlimited") | 300 |
   Worst case at the historical $0.24/msg: Essentials $9.60 (~break-even), Pro $24 (~break-even).
   At the modeled post-fix $0.10: Essentials $4, Pro $10. Allowances get raised once real cost is measured.
3. **7-day free trial, card required**, on Essentials and Pro checkout (`subscription_data.trial_period_days`),
   one trial per customer (skip if the Stripe customer or user already had a subscription).
   **Fix:** `hasActiveSubscription` treats `trialing` as active (today only `active` passes, so a trial
   user would be locked out). Webhook already maps `trialing`.
4. **Allowance enforcement**: `getUsageStatus` / `incrementYuriMessageCount` read the user's plan
   allowance instead of the single USAGE_CAPS constant. At the limit, the chat returns a clear message:
   used N of N this month, resets on <date>, upgrade to Pro (Essentials) — no silent failure.
5. **Every "unlimited" promise replaced** with the real allowance, in the same commit:
   PricingCards, stripe.ts feature list, ProductIntelligenceSection, widget route upgrade messages
   (3 places), HomeClient, register page, profile page, products page, TryYuriSection, nurture/lead
   emails, lead-reengage, Yuri onboarding/advisor prompt facts about plans, and `/api/lgaas/pricing`
   (LGAAS AriaStar/blog generators read this). Grandfathered subscriber keeps what they were sold.
6. **Auto-renew disclosure** at checkout (trial converts to paid on day 8 unless cancelled; how to cancel)
   — required by state auto-renewal laws for free trials.
7. **Stripe objects**: create product "Seoul Sister Essentials" with prices $9.99/mo and $79/yr, and a
   new $24.99/mo Pro price (so legacy is distinguishable by price id). Env vars on Vercel:
   STRIPE_PRICE_ESSENTIALS_MONTHLY, STRIPE_PRICE_ESSENTIALS_ANNUAL, STRIPE_PRICE_PRO_MONTHLY_V2.
   Existing STRIPE_PRICE_PRO_MONTHLY = legacy.

## Not in this release
Message top-up packs; skin-condition segment; affiliate program sign-ups (Scott, separate);
founding-member email (next step, after launch verified).

## Success bar (pre-registered, judged ~Dec 1 2026)
- >= 10 paying (incl. trialing->paid) subscribers, OR >= 5 if traffic stays ~30 chats/mo.
- Average AI cost per paying user < 40% of their revenue.
- Seoul Sister revenue > its monthly running cost.
Miss -> diagnose price vs product vs traffic before any new build.
