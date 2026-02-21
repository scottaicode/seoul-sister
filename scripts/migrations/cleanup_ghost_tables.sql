-- ============================================================
-- Migration: Drop ghost tables, fix auth trigger, fix profiles
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- STEP 1: Drop triggers on ghost tables
-- (Must happen before dropping the tables they reference)
DROP TRIGGER IF EXISTS trigger_update_retailer_reputation ON authenticity_reports;
DROP TRIGGER IF EXISTS trigger_update_purchase_outcomes ON user_purchase_decisions;
DROP TRIGGER IF EXISTS handle_updated_at ON profiles;
DROP TRIGGER IF EXISTS handle_updated_at ON products;
DROP TRIGGER IF EXISTS handle_updated_at ON orders;
DROP TRIGGER IF EXISTS handle_updated_at ON ai_customer_insights;
DROP TRIGGER IF EXISTS handle_updated_at ON scraped_products;
DROP TRIGGER IF EXISTS update_product_best_price ON price_tracking_history;

-- STEP 2: Drop the ghost view
DROP VIEW IF EXISTS price_intelligence_summary CASCADE;

-- STEP 3: Drop all 76 ghost tables (CASCADE handles any remaining FKs between them)
DROP TABLE IF EXISTS affiliate_links CASCADE;
DROP TABLE IF EXISTS ai_conversation_threads CASCADE;
DROP TABLE IF EXISTS ai_customer_insights CASCADE;
DROP TABLE IF EXISTS ai_generated_leads CASCADE;
DROP TABLE IF EXISTS authenticity_reports CASCADE;
DROP TABLE IF EXISTS beauty_intelligence_reports CASCADE;
DROP TABLE IF EXISTS community_discussions CASCADE;
DROP TABLE IF EXISTS community_verifications CASCADE;
DROP TABLE IF EXISTS content_transcriptions CASCADE;
DROP TABLE IF EXISTS conversation_context CASCADE;
DROP TABLE IF EXISTS daily_deals CASCADE;
DROP TABLE IF EXISTS deal_alerts CASCADE;
DROP TABLE IF EXISTS influencer_content CASCADE;
DROP TABLE IF EXISTS influencer_impact CASCADE;
DROP TABLE IF EXISTS ingredient_mentions CASCADE;
DROP TABLE IF EXISTS ingredient_popularity CASCADE;
DROP TABLE IF EXISTS intelligence_report_sections CASCADE;
DROP TABLE IF EXISTS intelligence_reports CASCADE;
DROP TABLE IF EXISTS korean_cultural_responses CASCADE;
DROP TABLE IF EXISTS korean_influencers CASCADE;
DROP TABLE IF EXISTS korean_suppliers CASCADE;
DROP TABLE IF EXISTS lead_hunter_analytics CASCADE;
DROP TABLE IF EXISTS market_analysis CASCADE;
DROP TABLE IF EXISTS ml_insights CASCADE;
DROP TABLE IF EXISTS ml_training_data CASCADE;
DROP TABLE IF EXISTS monitoring_jobs CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS photo_skin_analyses CASCADE;
DROP TABLE IF EXISTS premium_subscriptions CASCADE;
DROP TABLE IF EXISTS price_anomaly_patterns CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS price_movements CASCADE;
DROP TABLE IF EXISTS price_retailers CASCADE;
DROP TABLE IF EXISTS price_tracking_history CASCADE;
DROP TABLE IF EXISTS processed_content CASCADE;
DROP TABLE IF EXISTS product_interests CASCADE;
DROP TABLE IF EXISTS product_launches CASCADE;
DROP TABLE IF EXISTS product_mentions CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS reddit_conversation_opportunities CASCADE;
DROP TABLE IF EXISTS reddit_kbeauty_insights CASCADE;
DROP TABLE IF EXISTS reddit_kbeauty_keywords CASCADE;
DROP TABLE IF EXISTS reddit_kbeauty_posts CASCADE;
DROP TABLE IF EXISTS reddit_kbeauty_product_mentions CASCADE;
DROP TABLE IF EXISTS reddit_kbeauty_questions CASCADE;
DROP TABLE IF EXISTS reddit_kbeauty_trends CASCADE;
DROP TABLE IF EXISTS report_categories CASCADE;
DROP TABLE IF EXISTS report_category_links CASCADE;
DROP TABLE IF EXISTS report_ingredients CASCADE;
DROP TABLE IF EXISTS report_sections CASCADE;
DROP TABLE IF EXISTS report_trending_products CASCADE;
DROP TABLE IF EXISTS report_user_interactions CASCADE;
DROP TABLE IF EXISTS retailer_performance CASCADE;
DROP TABLE IF EXISTS retailer_reputation_scores CASCADE;
DROP TABLE IF EXISTS retailer_trust_scores CASCADE;
DROP TABLE IF EXISTS review_votes CASCADE;
DROP TABLE IF EXISTS routine_steps CASCADE;
DROP TABLE IF EXISTS scraped_products CASCADE;
DROP TABLE IF EXISTS scraping_configs CASCADE;
DROP TABLE IF EXISTS seasonal_trends CASCADE;
DROP TABLE IF EXISTS skin_analysis_results CASCADE;
DROP TABLE IF EXISTS skincare_routines CASCADE;
DROP TABLE IF EXISTS social_beauty_trends CASCADE;
DROP TABLE IF EXISTS trend_analysis CASCADE;
DROP TABLE IF EXISTS trending_ingredients CASCADE;
DROP TABLE IF EXISTS user_product_interactions CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS user_purchase_decisions CASCADE;
DROP TABLE IF EXISTS user_skin_profiles CASCADE;
DROP TABLE IF EXISTS user_watchlists CASCADE;
DROP TABLE IF EXISTS whatsapp_conversations CASCADE;
DROP TABLE IF EXISTS whatsapp_outbound_queue CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;

-- STEP 4: Drop ghost functions that are no longer needed
-- (Keep update_updated_at_column — used by ss_* triggers)
-- (Keep handle_updated_at — used by storage.objects)
DROP FUNCTION IF EXISTS calculate_ingredient_trend() CASCADE;
DROP FUNCTION IF EXISTS generate_referral_code() CASCADE;
DROP FUNCTION IF EXISTS get_external_images() CASCADE;
DROP FUNCTION IF EXISTS get_user_saved_reports() CASCADE;
DROP FUNCTION IF EXISTS increment_report_view_count() CASCADE;
DROP FUNCTION IF EXISTS update_best_price() CASCADE;
DROP FUNCTION IF EXISTS update_kbeauty_trend_scores() CASCADE;
DROP FUNCTION IF EXISTS update_product_trending_scores() CASCADE;
DROP FUNCTION IF EXISTS update_purchase_outcomes() CASCADE;
DROP FUNCTION IF EXISTS update_retailer_reputation() CASCADE;

-- STEP 5: Rewrite handle_new_user to insert into ss_user_profiles
-- This trigger fires on every new auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.ss_user_profiles (user_id, plan, onboarding_completed)
  VALUES (NEW.id, 'free', false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- STEP 6: Fix search_path on all ss_* functions
CREATE OR REPLACE FUNCTION public.ss_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_update_helpful_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ss_reviews
    SET helpful_count = helpful_count + CASE WHEN NEW.is_helpful THEN 1 ELSE 0 END
    WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ss_reviews
    SET helpful_count = helpful_count - CASE WHEN OLD.is_helpful THEN 1 ELSE 0 END
    WHERE id = OLD.review_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.ss_reviews
    SET helpful_count = helpful_count
      + CASE WHEN NEW.is_helpful THEN 1 ELSE 0 END
      - CASE WHEN OLD.is_helpful THEN 1 ELSE 0 END
    WHERE id = NEW.review_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_update_review_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ss_products
    SET review_count = COALESCE(review_count, 0) + 1
    WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ss_products
    SET review_count = GREATEST(COALESCE(review_count, 0) - 1, 0)
    WHERE id = OLD.product_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_update_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.ss_products
  SET rating_avg = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM public.ss_reviews
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_update_message_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.ss_yuri_conversations
  SET message_count = COALESCE(message_count, 0) + 1,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_update_subscription_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_update_product_tracking_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ss_update_formulation_history_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ss_check_rate_limit and ss_cleanup_rate_limits need DROP first
-- because their return types may differ from existing versions
DROP FUNCTION IF EXISTS public.ss_check_rate_limit() CASCADE;
CREATE FUNCTION public.ss_check_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.ss_cleanup_rate_limits() CASCADE;
CREATE FUNCTION public.ss_cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.ss_rate_limits WHERE expires_at < NOW();
END;
$$;

-- STEP 7: Enable RLS on remaining unprotected ss_* tables
ALTER TABLE ss_product_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only on staging" ON ss_product_staging;
CREATE POLICY "Service role only on staging" ON ss_product_staging
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE ss_pipeline_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only on pipeline runs" ON ss_pipeline_runs;
CREATE POLICY "Service role only on pipeline runs" ON ss_pipeline_runs
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE ss_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only on rate limits" ON ss_rate_limits;
CREATE POLICY "Service role only on rate limits" ON ss_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- STEP 8: Create Bailey's ss_user_profiles record and set both accounts to pro
INSERT INTO ss_user_profiles (user_id, plan, onboarding_completed)
VALUES ('551569d3-aed0-4feb-a340-47bfb146a835', 'pro_monthly', false)
ON CONFLICT (user_id) DO UPDATE SET plan = 'pro_monthly';

UPDATE ss_user_profiles SET plan = 'pro_monthly'
WHERE user_id = 'cdb2a7e8-b182-4da8-864f-4417fa6416be';

-- STEP 9: Delete test@email.com account
DELETE FROM auth.users WHERE email = 'test@email.com';
