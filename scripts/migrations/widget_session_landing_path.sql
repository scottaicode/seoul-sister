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
-- BACKFILL: NOT ATTEMPTED, and here is the honest reason.
-- Historical sessions are only PARTIALLY recoverable. The `?ask=` prefill text
-- survives in the first user message and names the topic for some of them
-- ("I just read your guide on sebaceous filaments Korean skincare...",
-- "I'm looking at your Best Korean Sunscreens list..."), which maps to a real
-- post. But others carry no page identity at all ("What actually works for
-- glass skin?", "I just want to order it"). Backfilling the recoverable ones
-- would leave a column that is populated for some rows and NULL for others for
-- two different reasons — "no referrer" and "we couldn't reconstruct it" —
-- which is exactly the ambiguity this repo keeps paying for. Forward-only.
--
-- The application degrades gracefully if this migration has not been applied:
-- createSession() retries without the column rather than failing a conversation.

alter table ss_widget_sessions add column if not exists landing_path text;

comment on column ss_widget_sessions.landing_path is
  'Site-relative path of the page the visitor arrived FROM, from the same-origin referrer on first message. PATH ONLY (no querystring — a feeder ?ask= carries the visitor''s own words). NULL = no same-origin referrer (direct landing / stripped referrer), which is normal. `source` says which KIND of page; this says WHICH page. Forward-only: historical rows are only partially reconstructable and were deliberately not backfilled.';

create index if not exists idx_ss_widget_sessions_landing_path
  on ss_widget_sessions (landing_path)
  where landing_path is not null;
