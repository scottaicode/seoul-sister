# Stripe Price Change Runbook — $39.99 → $24.99

**Why this is a manual step:** Stripe Price objects are immutable — you can't edit the dollar amount of an existing Price. You create a NEW Price at $24.99 on the existing Product, then point the app's `STRIPE_PRICE_PRO_MONTHLY` env var at it. The code already reads the displayed price from `src/lib/pricing.ts` ($24.99), but the actual CHARGE comes from this Stripe Price ID. Until you do this, the site will SHOW $24.99 but CHARGE $39.99 — so do this before/with the deploy.

Estimated time: ~5 minutes.

---

## Step 1 — Create the new $24.99 Price

1. Go to the [Stripe Dashboard](https://dashboard.stripe.com/) → **Product catalog** (left sidebar).
2. Open the existing **Seoul Sister Pro** product (the one whose current Price is $39.99/mo).
3. In the **Pricing** section, click **+ Add another price**.
4. Set:
   - **Price**: `24.99`
   - **Billing period**: `Monthly` (recurring)
   - **Currency**: USD
5. Click **Add price**.
6. Click the new $24.99 price row → copy its **Price ID** (starts with `price_...`).

> Do NOT archive the old $39.99 price yet — your one existing subscriber is still on it. Leave it active; just stop referencing it for new checkouts.

---

## Step 2 — Point the app at the new Price ID

Update the env var **`STRIPE_PRICE_PRO_MONTHLY`** to the new `price_...` ID in BOTH places:

**A. Vercel (production):**
1. [Vercel Dashboard](https://vercel.com/) → the Seoul Sister project → **Settings** → **Environment Variables**.
2. Find `STRIPE_PRICE_PRO_MONTHLY` → **Edit** → paste the new `price_...` ID → **Save**.
3. **Redeploy** (Deployments tab → latest → ⋯ → Redeploy) so the new env var takes effect. *(Env var changes don't apply to existing deployments until a redeploy.)*

**B. Local (`.env.local`):**
- Update `STRIPE_PRICE_PRO_MONTHLY=price_...` so local dev matches. (I won't touch your `.env` files without asking — this line is yours to change.)

---

## Step 3 — Verify

1. On production, go to the pricing section / `/register` and confirm it shows **$24.99/mo**.
2. Start a checkout (don't have to complete it) and confirm the Stripe Checkout page shows **$24.99/month**.
3. If Checkout still shows $39.99 → the env var didn't update or the redeploy didn't happen. Re-check Step 2.

---

## Step 4 (optional) — The existing subscriber

You have ~1 real subscriber on the old $39.99 price. Options:
- **Leave them** — they keep $39.99 until they cancel/resubscribe. Simplest.
- **Migrate them to $24.99** — Stripe Dashboard → Customers → their subscription → **Update subscription** → swap the price to the new $24.99 one → choose proration behavior. (Goodwill move; trivial at 1 user.)

---

## If you ever change the price again

1. Edit `src/lib/pricing.ts` → `PRICING.monthly_usd` + the `monthly_display` / `monthly_display_long` strings (one place; all UI/prompts/emails derive from it).
2. Repeat Steps 1–3 above (new Stripe Price + env var).

That's the whole contract: **`pricing.ts` controls what's SHOWN; the Stripe Price ID controls what's CHARGED. Keep them in sync.**
