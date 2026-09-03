-- ss_widget_sessions.landing_path — WHICH page, not just which KIND of page.
--
-- Sep 3 2026.
--
-- WHY
-- `source` is page-TYPE granular ('blog', 'product', 'ingredient_cta', ...), so
-- it can say a conversation came from "a blog post" and never WHICH one. That
-- gap sits under the site's largest measured asymmetry:
--
--   the blog earns ~674 Google clicks / 28 days
--   and produces ~4 widget conversations / month
--   while blog visitors are the BEST traffic we have
--   (6.4 avg messages vs 3.7 from the landing page; 37.5% give an email)
--
-- Without the specific path, "which post converts" is unanswerable and every
-- content bet the SEO Guardian makes is graded on clicks it cannot connect to a
-- conversation.
--
-- WHAT IT IS
-- The site-relative path of the page the visitor arrived FROM, captured on the
-- client from the SAME-ORIGIN referrer and written only when the session row is
-- created — i.e. on a real first message. No feeder CTA had to change.
--
-- PATH ONLY, deliberately. Never a querystring: a feeder link carries
-- `?ask=<whatever the visitor typed>`, and an external referrer's query can
-- carry a search term. Those are the visitor's words, not a page identifier.
-- The API rejects anything that is not a clean site-relative path rather than
-- truncating it, so a junk value never enters the data.
--
-- CRAWLERS CANNOT INFLATE THE DENOMINATOR
-- The honest denominator for this project is
-- `ss_widget_visitors WHERE total_messages > 0`. landing_path is written by
-- createSession(), which runs only on a visitor's first real message — the same
-- gate `source` already passes through. A crawler that renders the page and
-- never types produces no session row, and therefore no landing_path. This
-- column adds a FIELD to sessions that already exist; it does not create any.
--
-- NULL means no same-origin referrer, which is normal and correct for a direct
-- landing, a stripped referrer, or an external arrival. NULL here is an honest
-- "not applicable", not a silent failure — `source` still records the channel.
--
-- BACKFILL: PARTIAL, OPT-IN, and separated from the schema change on purpose.
-- Historical rows are only partly recoverable. The feeder CTA writes the post's
-- `primary_keyword` verbatim into the visitor's first message, which survives in
-- ss_widget_messages, so most old `source='blog'` sessions can be matched back
-- to a slug. MEASURED on all 8 of them:
--   6 match exactly one post           -> recoverable
--   1 matches NOTHING                  ("What actually works for glass skin?")
--   1 matches TWO posts ambiguously    (a sunscreen keyword shared by two)
-- An adversarial review claimed 7 of 8; measuring found 6. The ambiguous row is
-- exactly why this is not run automatically: guessing between two posts would
-- put a fabricated page identity into the column that content bets get graded
-- against.
--
-- The UPDATE below is COMMENTED OUT. Run it only if you want the 6, and know
-- that afterwards NULL will mean two different things — "no referrer" and "we
-- could not reconstruct it" — which is the ambiguity this repo keeps paying
-- for. Forward-only data is cleaner; the choice is yours, not the migration's.
--
-- update ss_widget_sessions s
-- set landing_path = '/blog/' || (
--   select p.slug from ss_content_posts p
--   where p.primary_keyword is not null
--     and (select m.content from ss_widget_messages m
--          where m.session_id = s.id and m.role = 'user'
--          order by m.created_at limit 1) ilike '%' || p.primary_keyword || '%'
--   -- exactly one match, or leave it alone
--   having count(*) = 1
-- )
-- where s.source = 'blog' and s.landing_path is null;

-- The application degrades gracefully if this migration has not been applied:
-- createSession() retries without the column rather than failing a conversation.

alter table ss_widget_sessions add column if not exists landing_path text;

comment on column ss_widget_sessions.landing_path is
  'Site-relative path of the page the visitor arrived FROM, from the same-origin referrer on first message. PATH ONLY (no querystring — a feeder ?ask= carries the visitor''s own words). NULL = no same-origin referrer (direct landing / stripped referrer), which is normal. `source` says which KIND of page; this says WHICH page. Forward-only: historical rows are only partially reconstructable and were deliberately not backfilled.';

create index if not exists idx_ss_widget_sessions_landing_path
  on ss_widget_sessions (landing_path)
  where landing_path is not null;
