# Seoul Sister — Two-Tier Pricing Plan (Ready to Deploy)

**Status**: DESIGNED, CODED, TESTED, AND REVERTED — ready to activate when data supports it.
**Date**: March 10, 2026
**Decision**: Keep $39.99/mo single tier until we have subscriber engagement data to validate higher pricing.

## Why This Exists

In March 2026, we explored moving Seoul Sister from a single $39.99/mo plan to a two-tier premium model. The full implementation was built, TypeScript-checked, and tested — then reverted to single-tier because:

1. **Zero paying subscribers at any price point** — no data to validate a price increase
2. **B2C pricing research showed 98% of consumers won't pay >$25/mo** for a digital-only app
3. **No pure-digital consumer beauty app charges $80/mo** — even PROVEN ($60/mo) ships physical products
4. **Better to prove conversion at $39.99 first**, then raise prices with real usage data

## The Two-Tier Plan

| Feature | **Pro ($79.99/mo)** | **Elite ($149.99/mo)** |
|---------|---------------------|------------------------|
| Yuri AI advisor + all 6 specialists | 500 msgs/mo | 500 msgs/mo |
| Smart routine builder + conflicts | Unlimited | Unlimited |
| Ingredient encyclopedia | Full access | Full access |
| Community + trending | Full access | Full access |
| Weather + cycle alerts | Yes | Yes |
| Label scans | 15/mo | Unlimited |
| Glass Skin Score | 3/mo | Unlimited |
| Shelf scan analysis | 1/mo | Unlimited |
| Counterfeit checks | 5/mo | Unlimited |
| Priority Yuri responses | No | Yes |
| Monthly AI routine audit | No | Yes |
| Reformulation alerts | Standard | Instant + alternatives |

### Why These Specific Limits

- **15 label scans/mo** = enough to research a full haul. Exceeding it means power user behavior.
- **3 Glass Skin Scores/mo** = weekly-ish tracking. More than that is obsessive tracking (expensive Vision calls).
- **1 shelf scan/mo** = monthly check-in. Weekly scanning is Elite behavior.
- **5 counterfeit checks/mo** = covers a typical order. Beyond that = vetting inventory.

### Expected Distribution
- ~70% Pro, ~30% Elite
- Elite users are highest-engagement, lowest-churn
- The $149.99 anchor makes $79.99 feel reasonable (price anchoring psychology)

### Unit Economics

| Item | Pro ($79.99) | Elite ($149.99) |
|------|-------------|-----------------|
| Claude Opus 4.7 API | ~$1.40/mo | ~$2.80/mo |
| Claude Vision | ~$1.50/mo | ~$6.00/mo |
| Supabase | ~$0.50/mo | ~$0.75/mo |
| Vercel | ~$0.25/mo | ~$0.50/mo |
| Stripe (2.9% + $0.30) | ~$2.62/mo | ~$4.65/mo |
| **Total cost** | **~$8.87/mo** | **~$19.90/mo** |
| **Margin** | **~$71.12 (89%)** | **~$130.09 (87%)** |

### Alternative Pricing (Lower Entry Point)

If $79.99 proves too high for B2C, a softer version:

| | Pro | Elite |
|---|---|---|
| Price | $29.99/mo | $79.99/mo |
| Margin | ~$21/user (70%) | ~$71/user (89%) |
| Notes | In the viable B2C range ($10-30/mo) | $79.99 becomes the anchor |

## How to Activate

### Step 1: Update `src/lib/stripe.ts`

Replace the single `SUBSCRIPTION_TIERS` object with:

```typescript
export const SUBSCRIPTION_TIERS = {
  pro_monthly: {
    name: 'Seoul Sister Pro',
    price: 79.99, // or 29.99 for lower entry
    scans_per_month: 15,
    glass_skin_per_month: 3,
    shelf_scans_per_month: 1,
    counterfeit_checks_per_month: 5,
    yuri_messages_per_month: 500,
    features: [
      'Full Yuri AI advisor (Claude Opus)',
      '500 Yuri conversations/month',
      'All 6 specialist agents',
      '15 label scans/month',
      '3 Glass Skin Score analyses/month',
      '1 shelf scan analysis/month',
      '5 counterfeit checks/month',
      'Smart routine builder with conflict detection',
      'K-Beauty dupe finder & sunscreen finder',
      'Ingredient include/exclude search',
      'Expiration & weather-adaptive alerts',
      'Community reviews & trending',
      'Cross-session memory',
    ],
  },
  elite_monthly: {
    name: 'Seoul Sister Elite',
    price: 149.99, // or 79.99 for lower entry
    scans_per_month: -1, // unlimited
    glass_skin_per_month: -1,
    shelf_scans_per_month: -1,
    counterfeit_checks_per_month: -1,
    yuri_messages_per_month: 500,
    features: [
      'Everything in Pro, plus:',
      'Unlimited label scans (Vision AI)',
      'Unlimited Glass Skin Score analyses',
      'Unlimited shelf scan analyses',
      'Unlimited counterfeit checks',
      'Priority Yuri responses',
      'Monthly AI routine audit',
      'Instant reformulation alerts + alternatives',
      'Smart routine builder with conflict detection',
      'K-Beauty dupe finder & sunscreen finder',
      'Ingredient include/exclude search',
      'Expiration & weather-adaptive alerts',
      'Community reviews & trending',
      'Cross-session memory',
    ],
  },
} as const
```

### Step 2: Update Stripe

1. Create "Seoul Sister Elite" product in Stripe Dashboard
2. Set monthly price ($149.99 or $79.99)
3. Copy price ID to `STRIPE_PRICE_ELITE_MONTHLY` in Vercel env vars
4. Optionally update Pro price and `STRIPE_PRICE_PRO_MONTHLY`

### Step 3: Update These Files

| File | Change |
|------|--------|
| `src/lib/stripe.ts` | Add `elite_monthly` tier (code above) |
| `src/app/api/stripe/checkout/route.ts` | Change `z.enum(['pro_monthly'])` to `z.enum(['pro_monthly', 'elite_monthly'])` |
| `src/types/database.ts` | Change `SubscriptionPlan = 'pro_monthly'` to `'pro_monthly' \| 'elite_monthly'` |
| `src/components/pricing/PricingCards.tsx` | Two-card layout with Star/Crown icons (full code was built and tested) |
| `src/app/(auth)/subscribe/page.tsx` | Two-plan selection with URL param pre-selection |
| `src/app/api/subscription/route.ts` | Return correct tier for elite subscribers |
| `src/app/(app)/profile/page.tsx` | Display Elite vs Pro plan name |
| `src/lib/yuri/advisor.ts` | Update Yuri's knowledge of pricing |
| `src/app/api/widget/chat/route.ts` | Update widget system prompt + limit message |
| `src/components/widget/YuriBubble.tsx` | Update conversion CTA |
| `src/components/widget/TryYuriSection.tsx` | Update conversion CTA |
| `src/app/(auth)/register/page.tsx` | Update pricing note |
| `src/app/products/page.tsx` | Update CTA copy |
| `src/app/products/[id]/page.tsx` | Update CTA copy |

### Step 4: Enforce Usage Limits (Not Yet Built)

The tier definitions include limit fields (`scans_per_month`, `glass_skin_per_month`, etc.) but the **enforcement logic** (checking counts against limits in API routes) has NOT been built yet. When activating two tiers, you'll need to:

1. Track monthly usage counts per feature per user (new DB columns or a usage table)
2. Check against `SUBSCRIPTION_TIERS[plan].scans_per_month` etc. in the relevant API routes
3. Return appropriate error when limit reached ("Upgrade to Elite for unlimited scans")

### Step 5: Migrate Existing Subscribers

Any subscribers on the $39.99 plan will need to be handled:
- Option A: Grandfather them at $39.99 (Stripe keeps the old price)
- Option B: Migrate to new Pro price via Stripe subscription update
- Option C: Give them Elite as a thank-you for being early adopters

## When to Activate

Consider activating when you have:
- 10+ paying subscribers proving conversion at $39.99
- Usage data showing clear power-user vs casual-user segmentation
- Evidence that some users would pay more for unlimited Vision AI features
- Confidence that the organic search traffic → Yuri conversation → subscription funnel is working

## Competitive Context (March 2026)

Seoul Sister has **zero direct competitors** combining:
- AI conversational advisor (6 specialists)
- 5,800+ product database with real Korean pricing
- Ingredient conflict detection across routines
- Counterfeit detection via AI Vision
- Glass Skin Score photo analysis
- Reformulation tracking
- Weather + cycle adaptive routines

The closest competitors are fragmented: Picky (community, no AI), INCI Decoder (ingredients, no personalization), L'Oreal Beauty Genius (brand-locked), Skinly (cycle tracking, no K-beauty). No single product covers more than 2 of Seoul Sister's 7 unique features.

This competitive moat justifies premium pricing — but only after proving initial conversion.
