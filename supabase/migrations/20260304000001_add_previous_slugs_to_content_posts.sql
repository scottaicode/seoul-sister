-- Add previous_slugs array to track old slugs for 301 redirects
-- When LGAAS updates a post's slug, the old slug is appended here
-- so existing URLs continue to work via redirect
ALTER TABLE ss_content_posts ADD COLUMN IF NOT EXISTS previous_slugs TEXT[] DEFAULT '{}';

-- GIN index for efficient @> containment queries on the array
CREATE INDEX IF NOT EXISTS idx_content_posts_previous_slugs ON ss_content_posts USING GIN (previous_slugs);
