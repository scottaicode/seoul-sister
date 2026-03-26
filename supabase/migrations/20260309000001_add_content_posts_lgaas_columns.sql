-- Add columns required by LGAAS blog ingest webhook
-- The ingest endpoint (api/admin/content/ingest) writes these fields
-- but they were never added to the ss_content_posts table.

ALTER TABLE ss_content_posts
  ADD COLUMN IF NOT EXISTS lgaas_post_id UUID,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS excerpt TEXT,
  ADD COLUMN IF NOT EXISTS primary_keyword TEXT,
  ADD COLUMN IF NOT EXISTS secondary_keywords TEXT[],
  ADD COLUMN IF NOT EXISTS faq_schema JSONB,
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS read_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS author TEXT,
  ADD COLUMN IF NOT EXISTS word_count INTEGER;

-- Partial unique index: only one row per lgaas_post_id (allows NULLs for non-LGAAS posts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_posts_lgaas_post_id
  ON ss_content_posts (lgaas_post_id)
  WHERE lgaas_post_id IS NOT NULL;
