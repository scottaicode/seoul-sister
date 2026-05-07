-- Fix em-dashes (—) across all blog posts — they're an AI tell
-- Replaces ' — ' with ' - ' in body, meta_description, and excerpt
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

UPDATE ss_content_posts
SET body = REPLACE(body, ' — ', ' - '),
    meta_description = REPLACE(meta_description, ' — ', ' - '),
    excerpt = REPLACE(excerpt, ' — ', ' - '),
    updated_at = NOW()
WHERE body LIKE '%—%'
   OR meta_description LIKE '%—%'
   OR excerpt LIKE '%—%';
