-- Learning notes are not public (Nov 14 2026).
--
-- ss_learning_patterns had a SELECT policy open to everyone (USING (true)), so
-- the site's public key, which ships in every browser, could read every row.
-- 310 of the 315 rows are notes an automated job writes from members'
-- conversations and reviews. They carry what members told Yuri about their
-- skin and health (for example a history of precancer removal, cycle phase).
-- Checked Nov 14 2026 with the public key, counts only: 315 rows readable.
--
-- Every reader in the app uses the service role, which bypasses RLS, so
-- nothing depends on the open policy. The five 'seasonal' rows are written by
-- a cron and are not about any person; they stay readable.
--
-- APPLY BY HAND in the Supabase SQL editor (the MCP connection is read-only).
-- Verify afterwards with the query at the bottom: it must return one policy,
-- limited to seasonal rows.

begin;

drop policy if exists ss_learning_patterns_public_select on public.ss_learning_patterns;

create policy ss_learning_patterns_public_select_seasonal
  on public.ss_learning_patterns
  for select
  using (pattern_type = 'seasonal');

commit;

-- select policyname, cmd, qual from pg_policies where tablename = 'ss_learning_patterns';
