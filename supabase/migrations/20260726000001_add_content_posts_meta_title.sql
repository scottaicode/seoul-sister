-- Add meta_title to ss_content_posts.
--
-- WHY: the blog's <title> tag is built from `title` (the H1) and the layout
-- appends " | Seoul Sister" (15 chars). Article H1s are written for readers, so
-- they run long, and the rendered tag overruns the ~60-char budget search
-- engines display. Bing flagged this as "Title too long" on Jul 26 2026:
--
--   <title>How Do You Build a Korean Skincare Routine You'll Actually Stick
--          To? | Seoul Sister</title>                              -- 86 chars
--   <title>Why Is K-Beauty So Expensive in the US? The Real Price Markup,
--          Explained | Seoul Sister</title>                        -- 87 chars
--
-- Both truncate mid-phrase in results, losing the payoff AND the brand.
--
-- meta_title carries a SHORT search-display title while `title` stays the full
-- reader-facing H1. LGAAS already derives and stores one for every post
-- (lgaas_blog_posts.meta_title, backfilled Jul 26 2026) and now sends it on the
-- ingest webhook; this column is where it lands.
--
-- Nullable with no default: existing rows keep rendering from `title` exactly
-- as they do today, and the blog falls back with `meta_title || title`. Purely
-- additive — nothing changes until a delivery populates the column.

ALTER TABLE ss_content_posts
  ADD COLUMN IF NOT EXISTS meta_title TEXT;

COMMENT ON COLUMN ss_content_posts.meta_title IS
  'Short SEO display title (~45 chars) for the <title> tag; falls back to title when NULL. Populated by the LGAAS ingest webhook.';
