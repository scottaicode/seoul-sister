# Lead-Email Observability — system of record

**Shipped:** July 15 2026 (v11.5.0). **Owner surface:** the Yuri landing-page
widget lead-capture flow. **Status:** code live; ONE manual Resend step (below)
needed to activate delivery/bounce events.

## Why this exists

The widget captures a visitor's email when they ask Yuri to send a recap, and
Yuri writes + sends that recap in her own voice. Until this change, the database
recorded only that the email was **captured** (`captured_email`,
`email_captured_at`) — never whether the recap **sent**, and never learned if it
**bounced**. Answering *"did my best lead of the day actually get their email?"*
required either `ss_ai_usage` archaeology (looking for the `content_generation`
breadcrumb that fires ~9s after capture) or a Resend dashboard login. A bounce to
a hot lead was **silently invisible**.

The July 15 2026 audit hit exactly this: a genuine high-intent stranger
(`meyer.greg.pro`) handed over his email after a 49-minute conversation, and
there was no way to confirm from our own data that his recap went out.

## What it records

Four columns on `ss_widget_visitors` (migration
`scripts/migrations/add_widget_recap_email_tracking.sql`):

| Column | Meaning |
|---|---|
| `recap_status` | Lifecycle status (see below) |
| `recap_sent_at` | When the recap was handed to Resend |
| `recap_provider_id` | Resend message id — ties a later webhook event to this visitor |
| `recap_status_updated_at` | Last status change (send or webhook) |

### `recap_status` lifecycle

```
                 Yuri judges (lead-email.ts)
                          │
      ┌───────────────────┼────────────────────┐
   should_send=false   not visitor's        should_send=true
      │                 own address              │
 'suppressed'      'not_their_address'      sendEmail()
                                                 │
                                    ┌────────────┴───────────┐
                                 accepted                 rejected/threw
                                 'sent'                   'send_failed'
                                    │
                       Resend delivery webhook
                       (needs manual setup ↓)
                    ┌───────────┼────────────┐
               'delivered'  'bounced'   'complained'
```

- **`suppressed`** — Yuri decided a follow-up wasn't warranted (thin/off-topic).
  Deliberate non-send, capture kept.
- **`not_their_address`** — Yuri judged the address belongs to someone else (a
  retailer, a quoted order confirmation). Capture slot reopened so their real
  email can land later.
- **`sent`** — Resend accepted the message for delivery. This is the strongest
  status you get **without** the webhook configured.
- **`send_failed`** — Resend rejected it, or generation/transport threw. Capture
  kept; a future retry mechanism could re-drive these.
- **`delivered` / `bounced` / `complained`** — from the Resend delivery webhook
  (manual setup below). `bounced`/`complained` are the ones that matter: a lead
  who never received their recap.

`recap_status` is **transport/observability only** — it records the *result* of
Yuri's judgments (consent + address ownership), never a judgment itself. Those
stay with the model in `src/lib/email/lead-email.ts`.

## The pieces

| File | Role |
|---|---|
| `scripts/migrations/add_widget_recap_email_tracking.sql` | Columns + indexes + backfill of the two known July-15 captures |
| `src/lib/email/send.ts` | `sendEmail()` now returns Resend's `providerId` |
| `src/lib/widget/visitor.ts` | `recordRecapStatus()` (send-time) + `updateRecapStatusByProviderId()` (webhook) + `RecapStatus` type |
| `src/app/api/widget/chat/route.ts` | Records a status on every send branch (send / not_their_address / suppressed / failed) |
| `src/app/api/webhooks/resend/route.ts` | Verifies Svix signature, maps delivery events → status by provider id |

## MANUAL SETUP (Scott-only — not automatable)

Two env vars gate two independent capabilities. Everything degrades gracefully
if they're unset.

1. **Sending** (already done — your test + Greg's recap both sent):
   - `RESEND_API_KEY` — set in Vercel. Without it, `sendEmail()` no-ops and logs
     what it *would* have sent; status records as `send_failed`.
   - Optional: `EMAIL_FROM` (defaults to `Yuri at Seoul Sister
     <yuri@seoulsister.com>`) and `EMAIL_REPLY_TO` (currently unset — visitor
     replies fall back to the send-only `yuri@` address and are lost; set this
     to an inbox you check if you want lead replies to reach you).

2. **Delivery/bounce events** (NEW — do this to activate the webhook):
   1. resend.com → **Webhooks** → **Add endpoint**:
      `https://www.seoulsister.com/api/webhooks/resend`
      **Use the `www.` host** — the apex `seoulsister.com` 307-redirects to www,
      and webhook senders don't follow redirects, so the apex form silently
      drops every event. (Verified in prod: apex → 307, www → 400 unsigned /
      401 bad-signature.)
   2. Subscribe to: `email.delivered`, `email.bounced`, `email.complained`.
   3. Copy the endpoint's **Signing Secret** (starts with `whsec_`) and set
      `RESEND_WEBHOOK_SECRET` in **Vercel (Production)**.
   - Until the secret is set, the webhook route **fails closed** (401 on every
     request) — an unverified body must never mutate lead data. Sends still
     record `sent`; you just won't see `delivered`/`bounced`.

## Operational queries

**Did a specific lead get their email?**
```sql
SELECT captured_email, recap_status, recap_sent_at, recap_status_updated_at
FROM ss_widget_visitors
WHERE captured_email = 'someone@example.com';
```

**Recap health over the last 7 days:**
```sql
SELECT recap_status, count(*)
FROM ss_widget_visitors
WHERE email_captured_at > now() - interval '7 days'
GROUP BY recap_status
ORDER BY count(*) DESC;
```

**Leads that captured but have no recap outcome (should be ~zero once live):**
```sql
SELECT visitor_id, captured_email, email_captured_at
FROM ss_widget_visitors
WHERE captured_email IS NOT NULL AND recap_status IS NULL
ORDER BY email_captured_at DESC;
```

**Bounces/complaints — the leads who never got their email:**
```sql
SELECT captured_email, recap_status, recap_status_updated_at
FROM ss_widget_visitors
WHERE recap_status IN ('bounced', 'complained')
ORDER BY recap_status_updated_at DESC;
```

## Two sources of truth (still)

- **This DB** answers "did it send, did it deliver, did it bounce" for *lead
  recaps* — queryable, no login.
- **The Resend dashboard** (resend.com → Emails) remains the authoritative log
  for *all* Yuri mail, with full per-message event timelines. Yuri's mail is
  **never** in the Namecheap Private Email "Sent" folder — she sends via Resend,
  not that mailbox. An empty Private Email Sent folder is expected, not a bug.

## Guardian alerting

The always-on Guardian watcher (`/api/cron/guardian-watch`, 3×/day, zero AI
tokens) runs a `lead_recap_delivery_7d` health signal (`src/lib/guardian/
healthcheck.ts`, signal #8). For captures in the last 7 days it counts:
- `bounced` / `complained` / `send_failed` → the lead didn't get their email →
  **`warn`** (bumps the watcher's overall verdict, triggering its `console.warn`
  alert in Vercel logs + a durable verdict in `ss_pipeline_runs.metadata`).
- captured-but-`recap_status IS NULL` → the recording path may have silently
  failed (the v10.3.4 class) → surfaced in the signal detail.

**Caveat — where the alert lands today:** the Guardian's alert surface is Vercel
logs + the DB verdict, NOT a push/email to your phone. Active push/email
notification is `DEFERRED FEATURE 1` in `GUARDIAN-CHARTER.md`. So a bounced lead
is now *visible and queryable* (and shows in any `/guardian-run`), but you won't
be actively pinged until that alerting layer ships. Until then, the bounce query
below is the manual check.

## Learning-loop note

Persisted delivery/bounce outcomes are a harder signal than a captured address
(a real outcome beats a soft one — the owner's learning-loop principle). A future
improvement could feed lead bounce-rate back into behavior (e.g. suppress a
malformed-looking address before send). Not built now — flagged as the natural
next teacher for this loop.
