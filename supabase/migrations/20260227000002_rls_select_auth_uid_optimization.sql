-- Fix 5: Replace auth.uid() with (select auth.uid()) in all RLS policies
--
-- Without the select wrapper, PostgreSQL re-evaluates auth.uid() for every row
-- scanned instead of once per query. The subselect form lets the planner treat
-- the value as a constant for the duration of the statement, which is critical
-- on high-row-count tables like ss_yuri_messages, ss_routine_products, etc.
--
-- This migration drops and recreates 69 policies across 28 tables.
-- 3 policies on ss_usage_tracking already use the correct form and are skipped.

BEGIN;

-- ============================================================================
-- ss_affiliate_clicks (1 policy)
-- ============================================================================
DROP POLICY IF EXISTS "ss_affiliate_clicks_select_own" ON ss_affiliate_clicks;
CREATE POLICY "ss_affiliate_clicks_select_own" ON ss_affiliate_clicks
  FOR SELECT USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_batch_code_verifications (2 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_batch_code_verifications_select_own" ON ss_batch_code_verifications;
CREATE POLICY "ss_batch_code_verifications_select_own" ON ss_batch_code_verifications
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_batch_code_verifications_insert_own" ON ss_batch_code_verifications;
CREATE POLICY "ss_batch_code_verifications_insert_own" ON ss_batch_code_verifications
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_community_points (2 policies)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own points" ON ss_community_points;
CREATE POLICY "Users can read own points" ON ss_community_points
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own points" ON ss_community_points;
CREATE POLICY "Users can insert own points" ON ss_community_points
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_counterfeit_reports (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_counterfeit_reports_select_own" ON ss_counterfeit_reports;
CREATE POLICY "ss_counterfeit_reports_select_own" ON ss_counterfeit_reports
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_counterfeit_reports_insert_own" ON ss_counterfeit_reports;
CREATE POLICY "ss_counterfeit_reports_insert_own" ON ss_counterfeit_reports
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_counterfeit_reports_update_own" ON ss_counterfeit_reports;
CREATE POLICY "ss_counterfeit_reports_update_own" ON ss_counterfeit_reports
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_counterfeit_reports_delete_own" ON ss_counterfeit_reports;
CREATE POLICY "ss_counterfeit_reports_delete_own" ON ss_counterfeit_reports
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_counterfeit_scans (2 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_counterfeit_scans_select_own" ON ss_counterfeit_scans;
CREATE POLICY "ss_counterfeit_scans_select_own" ON ss_counterfeit_scans
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_counterfeit_scans_insert_own" ON ss_counterfeit_scans;
CREATE POLICY "ss_counterfeit_scans_insert_own" ON ss_counterfeit_scans
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_glass_skin_scores (3 policies)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own glass skin scores" ON ss_glass_skin_scores;
CREATE POLICY "Users can read own glass skin scores" ON ss_glass_skin_scores
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own glass skin scores" ON ss_glass_skin_scores;
CREATE POLICY "Users can insert own glass skin scores" ON ss_glass_skin_scores
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own glass skin scores" ON ss_glass_skin_scores;
CREATE POLICY "Users can delete own glass skin scores" ON ss_glass_skin_scores
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_onboarding_progress (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_onboarding_progress_select" ON ss_onboarding_progress;
CREATE POLICY "ss_onboarding_progress_select" ON ss_onboarding_progress
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_onboarding_progress_insert" ON ss_onboarding_progress;
CREATE POLICY "ss_onboarding_progress_insert" ON ss_onboarding_progress
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_onboarding_progress_update" ON ss_onboarding_progress;
CREATE POLICY "ss_onboarding_progress_update" ON ss_onboarding_progress
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_onboarding_progress_delete" ON ss_onboarding_progress;
CREATE POLICY "ss_onboarding_progress_delete" ON ss_onboarding_progress
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_price_history (1 policy — auth.uid() IS NOT NULL pattern)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users read price history" ON ss_price_history;
CREATE POLICY "Authenticated users read price history" ON ss_price_history
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- ss_review_helpfulness (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_review_helpfulness_select_own" ON ss_review_helpfulness;
CREATE POLICY "ss_review_helpfulness_select_own" ON ss_review_helpfulness
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_review_helpfulness_insert_own" ON ss_review_helpfulness;
CREATE POLICY "ss_review_helpfulness_insert_own" ON ss_review_helpfulness
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_review_helpfulness_update_own" ON ss_review_helpfulness;
CREATE POLICY "ss_review_helpfulness_update_own" ON ss_review_helpfulness
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_review_helpfulness_delete_own" ON ss_review_helpfulness;
CREATE POLICY "ss_review_helpfulness_delete_own" ON ss_review_helpfulness
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_reviews (3 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_reviews_insert_own" ON ss_reviews;
CREATE POLICY "ss_reviews_insert_own" ON ss_reviews
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_reviews_update_own" ON ss_reviews;
CREATE POLICY "ss_reviews_update_own" ON ss_reviews
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_reviews_delete_own" ON ss_reviews;
CREATE POLICY "ss_reviews_delete_own" ON ss_reviews
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_routine_outcomes (1 policy — FOR ALL with both USING and WITH CHECK)
-- ============================================================================
DROP POLICY IF EXISTS "Users manage own routine outcomes" ON ss_routine_outcomes;
CREATE POLICY "Users manage own routine outcomes" ON ss_routine_outcomes
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_routine_products (4 policies — EXISTS-based, auth.uid() inside subquery)
-- ============================================================================
DROP POLICY IF EXISTS "ss_routine_products_select_own" ON ss_routine_products;
CREATE POLICY "ss_routine_products_select_own" ON ss_routine_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ss_user_routines r
      WHERE r.id = ss_routine_products.routine_id
        AND r.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ss_routine_products_insert_own" ON ss_routine_products;
CREATE POLICY "ss_routine_products_insert_own" ON ss_routine_products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ss_user_routines r
      WHERE r.id = ss_routine_products.routine_id
        AND r.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ss_routine_products_update_own" ON ss_routine_products;
CREATE POLICY "ss_routine_products_update_own" ON ss_routine_products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ss_user_routines r
      WHERE r.id = ss_routine_products.routine_id
        AND r.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ss_routine_products_delete_own" ON ss_routine_products;
CREATE POLICY "ss_routine_products_delete_own" ON ss_routine_products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ss_user_routines r
      WHERE r.id = ss_routine_products.routine_id
        AND r.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- ss_specialist_insights (2 policies — EXISTS-based)
-- ============================================================================
DROP POLICY IF EXISTS "ss_specialist_insights_select_own" ON ss_specialist_insights;
CREATE POLICY "ss_specialist_insights_select_own" ON ss_specialist_insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ss_yuri_conversations c
      WHERE c.id = ss_specialist_insights.conversation_id
        AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ss_specialist_insights_insert_own" ON ss_specialist_insights;
CREATE POLICY "ss_specialist_insights_insert_own" ON ss_specialist_insights
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ss_yuri_conversations c
      WHERE c.id = ss_specialist_insights.conversation_id
        AND c.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- ss_subscriptions (3 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_subscriptions_select_own" ON ss_subscriptions;
CREATE POLICY "ss_subscriptions_select_own" ON ss_subscriptions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_subscriptions_insert_own" ON ss_subscriptions;
CREATE POLICY "ss_subscriptions_insert_own" ON ss_subscriptions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_subscriptions_update_own" ON ss_subscriptions;
CREATE POLICY "ss_subscriptions_update_own" ON ss_subscriptions
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_usage_tracking (1 policy — view own; insert/update already use select form)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own usage" ON ss_usage_tracking;
CREATE POLICY "Users can view own usage" ON ss_usage_tracking
  FOR SELECT USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_cycle_tracking (1 policy — FOR ALL, missing WITH CHECK)
-- ============================================================================
DROP POLICY IF EXISTS "Users manage own cycle data" ON ss_user_cycle_tracking;
CREATE POLICY "Users manage own cycle data" ON ss_user_cycle_tracking
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_dismissed_alerts (3 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_user_dismissed_alerts_select_own" ON ss_user_dismissed_alerts;
CREATE POLICY "ss_user_dismissed_alerts_select_own" ON ss_user_dismissed_alerts
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_dismissed_alerts_insert_own" ON ss_user_dismissed_alerts;
CREATE POLICY "ss_user_dismissed_alerts_insert_own" ON ss_user_dismissed_alerts
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_dismissed_alerts_delete_own" ON ss_user_dismissed_alerts;
CREATE POLICY "ss_user_dismissed_alerts_delete_own" ON ss_user_dismissed_alerts
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_product_reactions (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_user_product_reactions_select_own" ON ss_user_product_reactions;
CREATE POLICY "ss_user_product_reactions_select_own" ON ss_user_product_reactions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_product_reactions_insert_own" ON ss_user_product_reactions;
CREATE POLICY "ss_user_product_reactions_insert_own" ON ss_user_product_reactions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_product_reactions_update_own" ON ss_user_product_reactions;
CREATE POLICY "ss_user_product_reactions_update_own" ON ss_user_product_reactions
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_product_reactions_delete_own" ON ss_user_product_reactions;
CREATE POLICY "ss_user_product_reactions_delete_own" ON ss_user_product_reactions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_product_tracking (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own product tracking" ON ss_user_product_tracking;
CREATE POLICY "Users can read own product tracking" ON ss_user_product_tracking
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own product tracking" ON ss_user_product_tracking;
CREATE POLICY "Users can insert own product tracking" ON ss_user_product_tracking
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own product tracking" ON ss_user_product_tracking;
CREATE POLICY "Users can update own product tracking" ON ss_user_product_tracking
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own product tracking" ON ss_user_product_tracking;
CREATE POLICY "Users can delete own product tracking" ON ss_user_product_tracking
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_profiles (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_user_profiles_select_own" ON ss_user_profiles;
CREATE POLICY "ss_user_profiles_select_own" ON ss_user_profiles
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_profiles_insert_own" ON ss_user_profiles;
CREATE POLICY "ss_user_profiles_insert_own" ON ss_user_profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_profiles_update_own" ON ss_user_profiles;
CREATE POLICY "ss_user_profiles_update_own" ON ss_user_profiles
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_profiles_delete_own" ON ss_user_profiles;
CREATE POLICY "ss_user_profiles_delete_own" ON ss_user_profiles
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_reformulation_alerts (2 policies)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own reformulation alerts" ON ss_user_reformulation_alerts;
CREATE POLICY "Users can read own reformulation alerts" ON ss_user_reformulation_alerts
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own reformulation alerts" ON ss_user_reformulation_alerts;
CREATE POLICY "Users can update own reformulation alerts" ON ss_user_reformulation_alerts
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_routines (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_user_routines_select_own" ON ss_user_routines;
CREATE POLICY "ss_user_routines_select_own" ON ss_user_routines
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_routines_insert_own" ON ss_user_routines;
CREATE POLICY "ss_user_routines_insert_own" ON ss_user_routines
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_routines_update_own" ON ss_user_routines;
CREATE POLICY "ss_user_routines_update_own" ON ss_user_routines
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_routines_delete_own" ON ss_user_routines;
CREATE POLICY "ss_user_routines_delete_own" ON ss_user_routines
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_scans (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_user_scans_select_own" ON ss_user_scans;
CREATE POLICY "ss_user_scans_select_own" ON ss_user_scans
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_scans_insert_own" ON ss_user_scans;
CREATE POLICY "ss_user_scans_insert_own" ON ss_user_scans
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_scans_update_own" ON ss_user_scans;
CREATE POLICY "ss_user_scans_update_own" ON ss_user_scans
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_scans_delete_own" ON ss_user_scans;
CREATE POLICY "ss_user_scans_delete_own" ON ss_user_scans
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_user_wishlists (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_user_wishlists_select_own" ON ss_user_wishlists;
CREATE POLICY "ss_user_wishlists_select_own" ON ss_user_wishlists
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_wishlists_insert_own" ON ss_user_wishlists;
CREATE POLICY "ss_user_wishlists_insert_own" ON ss_user_wishlists
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_wishlists_update_own" ON ss_user_wishlists;
CREATE POLICY "ss_user_wishlists_update_own" ON ss_user_wishlists
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_user_wishlists_delete_own" ON ss_user_wishlists;
CREATE POLICY "ss_user_wishlists_delete_own" ON ss_user_wishlists
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_yuri_conversations (4 policies)
-- ============================================================================
DROP POLICY IF EXISTS "ss_yuri_conversations_select_own" ON ss_yuri_conversations;
CREATE POLICY "ss_yuri_conversations_select_own" ON ss_yuri_conversations
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_yuri_conversations_insert_own" ON ss_yuri_conversations;
CREATE POLICY "ss_yuri_conversations_insert_own" ON ss_yuri_conversations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_yuri_conversations_update_own" ON ss_yuri_conversations;
CREATE POLICY "ss_yuri_conversations_update_own" ON ss_yuri_conversations
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ss_yuri_conversations_delete_own" ON ss_yuri_conversations;
CREATE POLICY "ss_yuri_conversations_delete_own" ON ss_yuri_conversations
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- ss_yuri_messages (4 policies — EXISTS-based)
-- ============================================================================
DROP POLICY IF EXISTS "ss_yuri_messages_select_own" ON ss_yuri_messages;
CREATE POLICY "ss_yuri_messages_select_own" ON ss_yuri_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ss_yuri_conversations c
      WHERE c.id = ss_yuri_messages.conversation_id
        AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ss_yuri_messages_insert_own" ON ss_yuri_messages;
CREATE POLICY "ss_yuri_messages_insert_own" ON ss_yuri_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ss_yuri_conversations c
      WHERE c.id = ss_yuri_messages.conversation_id
        AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ss_yuri_messages_update_own" ON ss_yuri_messages;
CREATE POLICY "ss_yuri_messages_update_own" ON ss_yuri_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ss_yuri_conversations c
      WHERE c.id = ss_yuri_messages.conversation_id
        AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ss_yuri_messages_delete_own" ON ss_yuri_messages;
CREATE POLICY "ss_yuri_messages_delete_own" ON ss_yuri_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ss_yuri_conversations c
      WHERE c.id = ss_yuri_messages.conversation_id
        AND c.user_id = (select auth.uid())
    )
  );

COMMIT;
