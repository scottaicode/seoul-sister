-- Pricing relaunch, Phase B (Oct 30 2026): the new $9.99/mo plan is stored as
-- plan='monthly'. 'pro_monthly' stays for the legacy $24.99 plan and comped
-- accounts. Without this the webhook's plan write fails for every new member.
ALTER TABLE ss_user_profiles DROP CONSTRAINT IF EXISTS ss_user_profiles_plan_check;
ALTER TABLE ss_user_profiles ADD CONSTRAINT ss_user_profiles_plan_check
  CHECK (plan IS NULL OR plan = ANY (ARRAY['free'::text, 'monthly'::text, 'pro_monthly'::text]));
