-- Fix 8: Wrap auth.role() in subselect on 5 service-role-only policies
--
-- auth.role() internally calls current_setting('request.jwt.claim.role', true)
-- which re-evaluates per row. Wrapping in (select ...) makes it an InitPlan
-- evaluated once per query — same optimisation as auth.uid().

BEGIN;

-- 1. ss_pipeline_runs
DROP POLICY IF EXISTS "Service role only on pipeline runs" ON ss_pipeline_runs;
CREATE POLICY "Service role only on pipeline runs" ON ss_pipeline_runs
  FOR ALL USING ((select auth.role()) = 'service_role');

-- 2. ss_product_staging
DROP POLICY IF EXISTS "Service role only on staging" ON ss_product_staging;
CREATE POLICY "Service role only on staging" ON ss_product_staging
  FOR ALL USING ((select auth.role()) = 'service_role');

-- 3. ss_rate_limits
DROP POLICY IF EXISTS "Service role only on rate limits" ON ss_rate_limits;
CREATE POLICY "Service role only on rate limits" ON ss_rate_limits
  FOR ALL USING ((select auth.role()) = 'service_role');

-- 4. ss_subscription_events
DROP POLICY IF EXISTS "Service role manages subscription events" ON ss_subscription_events;
CREATE POLICY "Service role manages subscription events" ON ss_subscription_events
  FOR ALL USING ((select auth.role()) = 'service_role');

-- 5. ss_widget_analytics
DROP POLICY IF EXISTS "Service role manages widget analytics" ON ss_widget_analytics;
CREATE POLICY "Service role manages widget analytics" ON ss_widget_analytics
  FOR ALL USING ((select auth.role()) = 'service_role');

COMMIT;

-- Fix 9: Drop duplicate index on ss_product_ingredients
--
-- idx_ss_product_ingredients_ingr and idx_product_ingredients_ingredient_id
-- are identical btree indexes on (ingredient_id). Keep the one with the
-- clearer naming convention.
DROP INDEX IF EXISTS idx_ss_product_ingredients_ingr;
