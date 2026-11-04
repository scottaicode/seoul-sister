# Go-live: postal address + price-change email

Status Oct 31 2026: everything built and dry-run tested. Waiting on Anytime Mailbox
"Application Completed" (Form 1583 notarized Oct 31, session 88AAF1).

## When Scott says "go live" (Claude does these)

1. Confirm the mailbox shows **Application Completed**.
2. Set `EMAIL_POSTAL_ADDRESS` on Vercel (Production) and in `.env.local`:
   `5960 South Land Park Dr #926, Sacramento, CA 95822` (no personal name: footer renders "Seoul Sister · <address>"; Scott does not want his name shown)
3. Redeploy production (env changes only apply to new deployments), then confirm the
   deployment is Ready.
4. Test send to Scott only:
   `npx tsx scripts/send-price-change-email.ts --test-to vibetrendai@gmail.com`
   Scott checks both versions: copy, links, the address line and the unsubscribe link.
5. On Scott's OK: `npx tsx scripts/send-price-change-email.ts --send`
   (39 recipients as of Oct 31: 31 free accounts, 8 homepage-chat emails).
6. Verify: `reports/price-change-sent-log.jsonl` has one line per recipient, the
   `ss_pipeline_runs` row `run_type='price_change_email'` exists, and no bounce spike in Resend.
7. Nurture emails resume on their own at the next Tue-Thu 16:00 UTC run. The send stamps
   each lead's `last_sent_at`, so nurture waits its normal gap after the announcement.

## Who is excluded (automatic)
Unsubscribed/suppressed leads, anyone with any past subscription (no trial for them),
admin/demo/internal accounts, Scott's own and test addresses, leads with a personal offer (via PRICE_CHANGE_SKIP_EMAILS in .env.local),
and anyone already in the sent log (re-running never double-sends).

## Grade it (after 7 days)
Clicks on /login?from=price_change and /register?from=price_change, replies, new trials
(`ss_subscriptions.status='trialing'`), unsubscribes. Not opens.
