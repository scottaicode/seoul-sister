-- Grant Bailey admin access so she can view /admin/traffic.
--
-- Aug 10 2026. Scott asked for a traffic + Yuri-conversation dashboard that
-- only he and Bailey can see, so she can judge whether her TikTok videos are
-- producing real conversations without asking for a manual check each time.
--
-- /admin/* already gates on ss_user_profiles.is_admin (see
-- src/app/(app)/admin/widget/page.tsx and the /api/admin/* routes), so this is
-- the whole change — no new role system, no new column.
--
-- Scoped to the single known user_id rather than matching on email, so a future
-- account that happens to reuse the address cannot inherit admin. The
-- IS DISTINCT FROM guard makes re-running a no-op.
--
--   vibetrendai@gmail.com     cdb2a7e8-b182-4da8-864f-4417fa6416be  (already admin)
--   baileydonmartin@gmail.com 551569d3-aed0-4feb-a340-47bfb146a835  (granted here)

UPDATE ss_user_profiles
SET is_admin = true
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND is_admin IS DISTINCT FROM true;

-- Verify: expect exactly the two rows above, and no one else.
SELECT u.email, p.is_admin
FROM ss_user_profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.is_admin IS TRUE
ORDER BY u.email;
