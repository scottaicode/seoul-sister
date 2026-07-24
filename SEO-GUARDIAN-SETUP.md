# SEO Guardian — Setup Checklist (Scott-only steps)

The weekly SEO Guardian cron (`/api/cron/seo-guardian`, Sundays 10:00 UTC) is deployed but
runs in `not_configured` mode until Google Search Console API credentials exist. These steps
take ~10 minutes and only Scott can do them (account access).

## 1. Create the service account (Google Cloud)

1. Go to https://console.cloud.google.com/ — any project is fine (create one, e.g. `seoul-sister-seo`, if none exists).
2. **Enable the API**: APIs & Services → Enable APIs → search "Google Search Console API" (`searchconsole.googleapis.com`) → Enable. (Skipping this is the #2 cause of 403s.)
3. IAM & Admin → Service Accounts → **Create service account**. Name: `seo-guardian`. No Cloud IAM roles needed — Search Console has its own permission system.
4. Open the new service account → Keys → **Add key → JSON**. Download the key file.

## 2. Grant it Search Console access

1. Open https://search.google.com/search-console → property `seoulsister.com` → Settings → **Users and permissions** → Add user.
2. Paste the service account's email (the `client_email` from the JSON, looks like `seo-guardian@<project>.iam.gserviceaccount.com`).
3. Permission: **Full**. (This is the #1 cause of 403s if skipped — Cloud IAM does nothing here.)

## 3. Set the Vercel env vars

From the downloaded JSON key file:

| Env var | Value |
|---|---|
| `GSC_CLIENT_EMAIL` | the `client_email` field |
| `GSC_PRIVATE_KEY` | the `private_key` field, pasted as-is (the code restores the `\n` newlines) |
| `GSC_SITE_URL` | optional — defaults to `sc-domain:seoulsister.com` |

Add to Production in Vercel → Settings → Environment Variables, then redeploy (or wait for the next push).

## 4. Verify

Trigger a manual run (or wait for Sunday):

```
curl -X POST https://www.seoulsister.com/api/cron/seo-guardian -H "x-cron-secret: $CRON_SECRET"
```

Expected: `{"success":true,"status":"completed","report_id":"...","bets":N}` and the report
email lands at `GUARDIAN_ALERT_EMAIL`. A `status:"not_configured"` response means step 3 didn't
take; a 403 in the logs means step 2 (property permission) or step 1.2 (API not enabled).

## What runs weekly once configured

Pull 28-day GSC query+page data (ends today−3d; GSC lags) → deterministic aggregates +
striking-distance facts → Opus 4.8 strategist writes the report + 2–5 dated bets (each with
falsifiable expected outcome) → stored in `ss_seo_reports` → emailed. Bets get graded against
later GSC data by the Phase 3 grader (not yet built); graded history feeds back into the
strategist's context so it self-calibrates. Content bets are executed via LGAAS — see
`LGAAS-WORK-ORDER-SEO-GUARDIAN.md`.
