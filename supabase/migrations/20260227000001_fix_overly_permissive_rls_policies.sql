-- Fix 1: Drop overly permissive RLS policies
-- These policies use USING(true) / WITH CHECK(true) with roles={public},
-- granting unconditional access to all users. Service role operations
-- already bypass RLS via getServiceClient(), so these are unnecessary
-- and dangerous.
--
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. ss_affiliate_clicks: DROP the INSERT policy that allows anyone to insert
DROP POLICY IF EXISTS "ss_affiliate_clicks_insert_any" ON ss_affiliate_clicks;

-- 2. ss_price_history: DROP the INSERT policy that allows anyone to insert
DROP POLICY IF EXISTS "Service role inserts price history" ON ss_price_history;

-- 3. ss_product_formulation_history: DROP both INSERT and UPDATE policies
DROP POLICY IF EXISTS "Service role manages formulation history" ON ss_product_formulation_history;
DROP POLICY IF EXISTS "Service role updates formulation history" ON ss_product_formulation_history;

-- 4. ss_usage_tracking: DROP the ALL policy that grants full access to everyone
DROP POLICY IF EXISTS "Service role manages usage" ON ss_usage_tracking;

-- Add proper scoped policies for ss_usage_tracking so the app can
-- insert and update usage rows for the authenticated user only
CREATE POLICY "Users can insert own usage"
  ON ss_usage_tracking
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own usage"
  ON ss_usage_tracking
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 5. ss_user_reformulation_alerts: DROP the INSERT policy that allows anyone to insert
DROP POLICY IF EXISTS "Service role creates reformulation alerts" ON ss_user_reformulation_alerts;
