-- Fix 7: Drop 3 ghost functions from pre-rebuild app
--
-- These functions reference tables that were dropped in the ghost table cleanup
-- (v5.5.0): trending_ingredients, beauty_intelligence_reports, report_user_interactions.
-- They have mutable search_path (Supabase security advisor flag) and are unused
-- by any application code.

DROP FUNCTION IF EXISTS public.increment_report_view_count(uuid);
DROP FUNCTION IF EXISTS public.get_user_saved_reports(uuid);
DROP FUNCTION IF EXISTS public.calculate_ingredient_trend(text);
