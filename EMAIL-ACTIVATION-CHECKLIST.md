# Email + Conversion Activation Checklist

**Status:** ⏸️ DEFERRED — code shipped (v10.13.2, June 10 2026), email-send intentionally OFF until traffic starts.
**Activate when:** the Yuri HeyGen/ElevenLabs avatar is ready and you're about to drive real traffic (est. ~1–2 weeks out from June 10 2026, so target window ~June 17–24 2026).
**Owner:** Scott (all steps below are account/billing/DNS actions only you can do).

---

## What's already live vs. what's waiting

The v10.13.2 code is **shipped and safe**. It degrades gracefully:

| Capability | Works now (no setup)? | Needs activation? |
|---|---|---|
| Widget captures lead emails | ✅ yes (since v10.12.0) | — |
| Stripe → widget **attribution** (`converted_at`, `lead_source`) | ⚠️ after Step 1 (migration) | Step 1 only |
| **Conversion dashboard** (⭐ The One Metric at `/admin/widget`) | ⚠️ after Step 1 (migration) | Step 1 only |
| Yuri **sends** the follow-up email | ❌ no | Steps 2–4 |

So: **Step 1 alone lights up all the measurement.** Steps 2–4 are only needed to actually *send* Yuri's follow-up emails. You can do Step 1 today and Steps 2–4 the week traffic starts.

---

## STEP 1 — Apply the attribution migration (do this anytime; lights up measurement)

The Supabase MCP is read-only in the dev environment, so this is applied by hand.

1. Open **Supabase Studio → SQL Editor** for the Seoul Sister project (ref `gzqjvbhmndnovhlgumdk`).
2. Paste and run the contents of:
   `supabase/migrations/20260609000001_subscription_lead_source.sql`
   (adds nullable `lead_source` to `ss_subscriptions` + a partial index — additive, no risk).
3. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='ss_subscriptions' AND column_name='lead_source';` returns one row.

✅ After this, every new paid subscription is attributed to its source, and the `/admin/widget` "⭐ The One Metric" panel shows real visitor→paid numbers.
_(The `converted_at` / `converted_user_id` columns the webhook writes ALREADY exist live — confirmed June 9 2026 — so no migration is needed for those.)_

---

## STEP 2 — Add + verify `seoulsister.com` in Resend (REQUIRES the $20/mo upgrade)

**Why the upgrade:** the shared `vibetrendai` Resend account is on the free plan, which includes **1 domain** — already used by `leadsthatlearn.com` (LGAAS). Adding `seoulsister.com` as a 2nd domain requires **Resend Pro ($20/mo, 10 domains)**.

> **Decision point:** two clean options —
> - **(A, simplest) Upgrade the shared account to Pro ($20/mo).** One account, both apps, 10 domains. Recommended for simplicity.
> - **(B, fully decoupled, $0) Create a SEPARATE Resend account for Seoul Sister** on its own free tier (its 1 included domain = `seoulsister.com`). Keeps the two businesses independent at no cost; downside is a second login to manage.
> Either works. If you pick B, the API key in Step 3 comes from the new account.

Once on a plan that allows the domain:
1. **Resend → Domains → Add domain →** `seoulsister.com`.
2. Resend shows DNS records (SPF/TXT, DKIM CNAME/TXT, possibly MX).
3. Add those records where `seoulsister.com`'s DNS lives. **Per CLAUDE.md the domain is configured in Vercel via Namecheap** — confirm which holds the editable DNS zone (whichever the nameservers point to). _If unsure, paste the records to Claude and say whether NS points to Vercel or Namecheap; Claude will say exactly where each goes._
4. Wait for Resend to show `seoulsister.com` = **Verified** (minutes–couple hours after DNS propagates).

---

## STEP 3 — Create the Seoul Sister sending key

Once `seoulsister.com` shows **Verified**:
1. **Resend → API keys → Create API key.**
2. **Name:** `seoul-sister-prod`
3. **Permission:** `Sending access` (least-privilege — not Full access).
4. **Domain:** select **`seoulsister.com`** specifically (NOT "All domains"). This physically prevents the SS key from sending as LGAAS and vice versa — clean blast-radius separation.
5. Copy the key (`re_...`) — shown once.

---

## STEP 4 — Set the env vars in Vercel (this is what flips email ON)

In the **Seoul Sister** Vercel project → Settings → Environment Variables (Production):
1. `RESEND_API_KEY` = the `re_...` key from Step 3.
2. `EMAIL_FROM` = `Yuri at Seoul Sister <yuri@seoulsister.com>` (the from-address MUST be on the verified domain).
3. Redeploy (or it applies on next deploy).

✅ The moment these land, `sendEmail()` stops no-op-ing and Yuri's AI-generated follow-up emails start sending. **No code change needed** — the code already checks for these at runtime.

---

## How to confirm it's working (after Step 4)

1. Go to seoulsister.com, open the Yuri widget, have a short chat, and type an email address into the chat.
2. Check that inbox — a Yuri-voiced follow-up should arrive (grounded in what you just discussed).
3. Check **Resend → Emails** — the send should show "Delivered" under the `seoul-sister-prod` key.
4. If nothing sends: check Vercel logs for `[email] RESEND_API_KEY unset` (env not picked up) or a `resend_4xx` error (domain not verified / from-address mismatch).

---

## ⏰ Reminder / nudge

A reminder to run this checklist has been set for **~1-2 weeks out** (when the avatar work wraps and traffic begins). When it fires — or whenever you start the avatar push — open this file and work Steps 1→4.

If you're reading this and the avatar is ready but you haven't activated: **do Step 1 now** (free, lights up measurement instantly), then 2–4 when you're ready to spend the $20 and send.

_Last updated: June 10 2026 (v10.13.2)._
