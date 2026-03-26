-- Backfill lgaas_post_id on existing ss_content_posts
-- The lgaas_post_id column was added but existing rows have NULL.
-- Without this, the ingest webhook tries INSERT (instead of UPDATE)
-- and fails on the UNIQUE slug constraint.
-- Run in Seoul Sister Supabase SQL Editor.

UPDATE ss_content_posts SET lgaas_post_id = 'dd8a2d69-279c-4ec2-83cb-ceac01d8eee6' WHERE slug = 'how-to-get-glass-skin-a-k-beauty-routine-that-works';
UPDATE ss_content_posts SET lgaas_post_id = '5eada99a-d267-4283-a17c-c63c565c3949' WHERE slug = 'why-does-your-makeup-look-worse-over-korean-skincare-and-how-to-actually-fix-it';
UPDATE ss_content_posts SET lgaas_post_id = 'a3035452-38e7-4158-bfb1-64e3982cf64e' WHERE slug = 'trending-k-beauty-products-2026-03';
UPDATE ss_content_posts SET lgaas_post_id = 'a8800652-f138-4e88-b0dd-44b6489b7cbb' WHERE slug = 'oily-skin-routine-guide';
UPDATE ss_content_posts SET lgaas_post_id = 'bbb7bd53-c668-4f92-91bc-b287b684ee64' WHERE slug = 'best-korean-cleansing-oils-for-every-skin-type-2026';
UPDATE ss_content_posts SET lgaas_post_id = 'cc930279-4b74-453d-8cdd-b3c486c40006' WHERE slug = 'where-to-buy-k-beauty-online-trusted-shops-in-2026';
UPDATE ss_content_posts SET lgaas_post_id = '020576a9-a50c-4b40-a432-adfa53e56dd1' WHERE slug LIKE 'how-to-build-a-korean-skincare-routine%';
UPDATE ss_content_posts SET lgaas_post_id = '3afa1844-64a0-46ae-b9a9-fc5bdf41040c' WHERE slug = 'how-to-fix-dehydrated-skin-with-a-korean-skincare-routine';
UPDATE ss_content_posts SET lgaas_post_id = 'c26ae054-da05-404d-8467-1032a58e399e' WHERE slug LIKE 'why-is-k-beauty-so-expensive%';
UPDATE ss_content_posts SET lgaas_post_id = 'c1914868-c3d3-49b0-8a39-7873cc4e1cdf' WHERE slug LIKE 'best-korean-skincare-for-dark-spots%';
