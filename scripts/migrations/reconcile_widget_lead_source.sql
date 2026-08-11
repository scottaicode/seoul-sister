-- v11.25.0 — reconcile ss_subscriptions.lead_source against widget attribution.
--
-- THE CONTRADICTION THIS FIXES
--
-- The admin dashboard showed two panels disagreeing about the same person on the
-- same screen: the One Metric counted the first paying subscriber as a widget
-- conversion (her ss_widget_visitors rows carry converted_at + converted_user_id),
-- while lead_source_breakdown filed her under "organic_or_unknown" because
-- ss_subscriptions.lead_source was NULL.
--
-- Why it happened: the Stripe webhook writes lead_source from the return value of
-- attributeConversion(), which returns 'widget' only when it STAMPS a row. It
-- filters on `.is('converted_at', null)`, so on any path where the visitor rows
-- were already stamped (a retried webhook, a re-sent event, an out-of-order
-- subscription.created), the update matches nothing, returns null, and the
-- subscription is filed as organic — even though the attribution plainly exists.
--
-- This backfills from the attribution that is already recorded. It does NOT
-- invent attribution: a subscription only becomes 'widget' when a widget visitor
-- row explicitly names that user in converted_user_id.
--
-- Idempotent: guarded on lead_source IS NULL, so re-running is a no-op. Safe to
-- run repeatedly (the discipline from scripts/fix-fabricated-routine-matches.ts).

-- Blast radius first — inspect before writing.
-- Expected on Aug 11 2026: exactly 1 row (user fe464145…, the first paying sub).
SELECT
  s.user_id,
  s.status,
  s.lead_source                                   AS current_lead_source,
  count(v.id)                                     AS attributed_visitor_rows,
  min(v.converted_at)                             AS attributed_at
FROM ss_subscriptions s
JOIN ss_widget_visitors v ON v.converted_user_id = s.user_id
WHERE s.lead_source IS NULL
GROUP BY s.user_id, s.status, s.lead_source;

-- The write.
UPDATE ss_subscriptions s
SET lead_source = 'widget'
WHERE s.lead_source IS NULL
  AND EXISTS (
    SELECT 1
    FROM ss_widget_visitors v
    WHERE v.converted_user_id = s.user_id
      AND v.converted_at IS NOT NULL
  );

-- Verify: no active subscription should be attributed in one table and orphaned
-- in the other. Expect zero rows.
SELECT s.user_id, s.lead_source
FROM ss_subscriptions s
WHERE s.lead_source IS NULL
  AND EXISTS (SELECT 1 FROM ss_widget_visitors v WHERE v.converted_user_id = s.user_id);
