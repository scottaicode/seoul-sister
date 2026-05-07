-- Fix "fk" language in skin barrier blog post
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

UPDATE ss_content_posts
SET body = REPLACE(
    body,
    'How do I optimize the fk out of my skin barrier?',
    'How do I actually fix my skin barrier?'
  ),
  updated_at = NOW()
WHERE id = '4120865f-d8ee-4755-baf7-b81180dda8c0';
