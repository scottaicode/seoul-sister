-- Security hardening (July 1 2026 security review)
--
-- P0: Three SECURITY DEFINER functions were executable by PUBLIC + anon +
-- authenticated via PostgREST /rest/v1/rpc:
--   - auto_promote_verified_products: anyone could trigger catalog-wide
--     verified-flag promotion
--   - ss_check_rate_limit: anyone could burn/pollute rate-limit counters
--     for arbitrary keys (DoS other visitors)
--   - handle_new_user: signup trigger, no business being anon-callable
-- Server code only ever calls these with the service role (verified:
-- src/lib/pipeline/auto-promote-verified.ts and src/lib/utils/rate-limiter.ts
-- both use getServiceClient()).

REVOKE EXECUTE ON FUNCTION public.auto_promote_verified_products() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ss_check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- handle_new_user fires as a trigger on auth.users inserts (signup path, run
-- by supabase_auth_admin). Grant explicitly so the PUBLIC revoke cannot break
-- registration.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Keep the service role able to call the app-facing RPCs (explicit).
GRANT EXECUTE ON FUNCTION public.auto_promote_verified_products() TO service_role;
GRANT EXECUTE ON FUNCTION public.ss_check_rate_limit(text, integer, integer) TO service_role;

-- Advisor lint 0011: pin mutable search_path on trigger function.
ALTER FUNCTION public.ss_review_queue_set_updated_at() SET search_path = public;

-- P2 (advisor lint 0025): the broad SELECT policy on the public
-- product-images bucket allowed anyone to enumerate every file. Public-bucket
-- object URLs do not require a SELECT policy; only listing did.
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
