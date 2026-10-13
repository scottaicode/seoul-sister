-- Per-post "Ask Yuri" opener (Oct 12 2026)
--
-- Every blog CTA pre-filled the same visitor message: "I just read your guide on
-- {keyword}, can you help me figure out what's right for my skin?". Measured
-- Sep 14 - Oct 11 (GA4 landing sessions vs ss_widget_sessions.landing_path):
-- the acne-scar post 156 sessions -> 0 chats, "how to tell if K-beauty is fake"
-- 106 -> 0, the Japanese/Korean sunscreen post 20 -> 3. The generic opener
-- matches "which one is right for me?" posts and mismatches the rest.
--
-- yuri_opener: the reader's likely NEXT question, in their own voice. It is the
-- visitor's pre-filled first message and the CTA's visible text. It is never a
-- Yuri script; Yuri answers freely. NULL falls back to the old template, so
-- the code works before and after this migration.
--
-- Additive, nullable. Apply by hand (MCP is read-only).

ALTER TABLE ss_content_posts
  ADD COLUMN IF NOT EXISTS yuri_opener TEXT;

ALTER TABLE ss_content_posts
  DROP CONSTRAINT IF EXISTS ss_content_posts_yuri_opener_len;
ALTER TABLE ss_content_posts
  ADD CONSTRAINT ss_content_posts_yuri_opener_len
  CHECK (yuri_opener IS NULL OR char_length(btrim(yuri_opener)) BETWEEN 10 AND 240);
