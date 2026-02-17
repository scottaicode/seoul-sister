-- =============================================================================
-- Seoul Sister: DROP ALL ss_ Objects (Clean Slate)
-- Run this BEFORE the combined migration if tables already exist
-- =============================================================================

-- Using CASCADE to handle all foreign key dependencies automatically
-- This is safe because we're dropping ALL ss_ tables anyway

DROP TABLE IF EXISTS ss_review_helpfulness CASCADE;
DROP TABLE IF EXISTS ss_routine_products CASCADE;
DROP TABLE IF EXISTS ss_product_ingredients CASCADE;
DROP TABLE IF EXISTS ss_ingredient_conflicts CASCADE;
DROP TABLE IF EXISTS ss_product_prices CASCADE;
DROP TABLE IF EXISTS ss_trending_products CASCADE;
DROP TABLE IF EXISTS ss_ingredient_effectiveness CASCADE;
DROP TABLE IF EXISTS ss_product_effectiveness CASCADE;
DROP TABLE IF EXISTS ss_user_product_reactions CASCADE;
DROP TABLE IF EXISTS ss_user_wishlists CASCADE;
DROP TABLE IF EXISTS ss_user_dismissed_alerts CASCADE;
DROP TABLE IF EXISTS ss_counterfeit_scans CASCADE;
DROP TABLE IF EXISTS ss_specialist_insights CASCADE;
DROP TABLE IF EXISTS ss_yuri_messages CASCADE;
DROP TABLE IF EXISTS ss_routine_outcomes CASCADE;
DROP TABLE IF EXISTS ss_community_points CASCADE;
DROP TABLE IF EXISTS ss_batch_code_verifications CASCADE;
DROP TABLE IF EXISTS ss_price_history CASCADE;
DROP TABLE IF EXISTS ss_subscription_events CASCADE;
DROP TABLE IF EXISTS ss_affiliate_clicks CASCADE;
DROP TABLE IF EXISTS ss_counterfeit_reports CASCADE;
DROP TABLE IF EXISTS ss_counterfeit_markers CASCADE;
DROP TABLE IF EXISTS ss_reviews CASCADE;
DROP TABLE IF EXISTS ss_user_scans CASCADE;
DROP TABLE IF EXISTS ss_yuri_conversations CASCADE;
DROP TABLE IF EXISTS ss_learning_patterns CASCADE;
DROP TABLE IF EXISTS ss_onboarding_progress CASCADE;
DROP TABLE IF EXISTS ss_user_routines CASCADE;
DROP TABLE IF EXISTS ss_user_profiles CASCADE;
DROP TABLE IF EXISTS ss_safety_alerts CASCADE;
DROP TABLE IF EXISTS ss_content_posts CASCADE;
DROP TABLE IF EXISTS ss_subscriptions CASCADE;
DROP TABLE IF EXISTS ss_trend_signals CASCADE;
DROP TABLE IF EXISTS ss_retailers CASCADE;
DROP TABLE IF EXISTS ss_ingredients CASCADE;
DROP TABLE IF EXISTS ss_products CASCADE;
DROP TABLE IF EXISTS ss_widget_conversations CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS ss_set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS ss_update_helpful_count() CASCADE;
DROP FUNCTION IF EXISTS ss_update_review_count() CASCADE;
DROP FUNCTION IF EXISTS ss_update_product_rating() CASCADE;
DROP FUNCTION IF EXISTS ss_update_message_count() CASCADE;
DROP FUNCTION IF EXISTS ss_update_subscription_timestamp() CASCADE;

-- Verify clean slate
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'ss_%'
ORDER BY tablename;
