-- v10.8.20 — Reset ss_ingredient_effectiveness to the Phase 11.4 research-backed baseline.
--
-- Investigation on May 28 2026 found that the daily update-effectiveness cron
-- had double-counted the same reviews every day since the Feb 23 2026 seed.
-- The 211 rows in the table had drifted to 143 at exactly score=1.000 with
-- positive_reports == sample_size (the structural signature of fake-aggregated
-- data). With only 20 reviews + 1 reaction in production, no honest
-- aggregation could have produced n=279 for Hyaluronic Acid.
--
-- This migration:
--   1. Deletes all 211 current rows.
--   2. Re-inserts the original 47 Phase 11.4 seed rows (research-backed,
--      sample_size 50-100, scores 0.62-0.88 — sane distribution).
--
-- The v10.8.20 cron rewrite uses Math.max() on top of these baseline values,
-- so the row counts can only GROW as real reviews accumulate — they can no
-- longer drift upward from the same reviews being counted repeatedly.

BEGIN;

DELETE FROM ss_ingredient_effectiveness;

INSERT INTO ss_ingredient_effectiveness
  (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'oily', 'acne', 0.82, 60, 49, 5, 6),
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'oily', 'pores', 0.78, 55, 43, 6, 6),
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'combination', 'hyperpigmentation', 0.80, 50, 40, 4, 6),
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'sensitive', 'redness', 0.72, 50, 36, 7, 7),
  ('ec1d5db9-1202-4ed7-bba9-b364a195d362', 'dry', 'dehydration', 0.88, 70, 62, 3, 5),
  ('ec1d5db9-1202-4ed7-bba9-b364a195d362', 'combination', 'dehydration', 0.84, 55, 46, 4, 5),
  ('ec1d5db9-1202-4ed7-bba9-b364a195d362', 'normal', 'dehydration', 0.85, 50, 43, 3, 4),
  ('3df9a0dd-38fd-4f93-9bd0-8953ae4be2c7', 'sensitive', 'redness', 0.85, 55, 47, 3, 5),
  ('3df9a0dd-38fd-4f93-9bd0-8953ae4be2c7', 'sensitive', 'irritation', 0.83, 50, 42, 4, 4),
  ('3df9a0dd-38fd-4f93-9bd0-8953ae4be2c7', 'oily', 'acne', 0.74, 50, 37, 6, 7),
  ('9590e514-547c-448c-89c0-a830f393abe6', 'oily', 'acne', 0.86, 65, 56, 4, 5),
  ('9590e514-547c-448c-89c0-a830f393abe6', 'oily', 'blackheads', 0.88, 55, 48, 3, 4),
  ('9590e514-547c-448c-89c0-a830f393abe6', 'combination', 'acne', 0.82, 50, 41, 4, 5),
  ('9590e514-547c-448c-89c0-a830f393abe6', 'sensitive', 'acne', 0.65, 50, 33, 10, 7),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'oily', 'acne', 0.80, 55, 44, 6, 5),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'normal', 'anti-aging', 0.87, 60, 52, 4, 4),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'combination', 'anti-aging', 0.84, 50, 42, 4, 4),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'dry', 'anti-aging', 0.78, 50, 39, 6, 5),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'sensitive', 'anti-aging', 0.62, 50, 31, 12, 7),
  ('507cae46-24da-420c-98d0-fea7e331c447', 'normal', 'hyperpigmentation', 0.84, 55, 46, 4, 5),
  ('507cae46-24da-420c-98d0-fea7e331c447', 'oily', 'hyperpigmentation', 0.80, 50, 40, 5, 5),
  ('507cae46-24da-420c-98d0-fea7e331c447', 'combination', 'dullness', 0.82, 50, 41, 4, 5),
  ('507cae46-24da-420c-98d0-fea7e331c447', 'sensitive', 'hyperpigmentation', 0.68, 50, 34, 9, 7),
  ('0f592610-9e19-4abc-ade1-48b5e651872d', 'dry', 'dehydration', 0.90, 60, 54, 2, 4),
  ('0f592610-9e19-4abc-ade1-48b5e651872d', 'sensitive', 'irritation', 0.86, 55, 47, 3, 5),
  ('0f592610-9e19-4abc-ade1-48b5e651872d', 'combination', 'dehydration', 0.82, 50, 41, 4, 5),
  ('aedfe2aa-ef84-4611-bbd1-416db9704856', 'dry', 'dehydration', 0.84, 55, 46, 4, 5),
  ('aedfe2aa-ef84-4611-bbd1-416db9704856', 'combination', 'dullness', 0.78, 50, 39, 5, 6),
  ('aedfe2aa-ef84-4611-bbd1-416db9704856', 'normal', 'anti-aging', 0.76, 50, 38, 5, 7),
  ('2423c8d1-6122-4a3d-aa91-cc1a74e2247d', 'combination', 'hyperpigmentation', 0.83, 50, 42, 4, 4),
  ('2423c8d1-6122-4a3d-aa91-cc1a74e2247d', 'oily', 'hyperpigmentation', 0.81, 50, 41, 4, 5),
  ('2423c8d1-6122-4a3d-aa91-cc1a74e2247d', 'sensitive', 'hyperpigmentation', 0.79, 50, 40, 5, 5),
  ('cf62f919-b39b-439b-bc0e-f8ad5f4deeab', 'normal', 'hyperpigmentation', 0.79, 50, 40, 5, 5),
  ('cf62f919-b39b-439b-bc0e-f8ad5f4deeab', 'sensitive', 'hyperpigmentation', 0.77, 50, 39, 5, 6),
  ('7ee6a1c2-bd71-4387-a6ca-aa408f9466d7', 'sensitive', 'redness', 0.84, 55, 46, 4, 5),
  ('7ee6a1c2-bd71-4387-a6ca-aa408f9466d7', 'oily', 'acne', 0.72, 50, 36, 7, 7),
  ('dc8062ed-b1c7-4467-b8c3-4d9d4ca805e2', 'dry', 'dehydration', 0.86, 55, 47, 3, 5),
  ('dc8062ed-b1c7-4467-b8c3-4d9d4ca805e2', 'normal', 'dehydration', 0.82, 50, 41, 4, 5),
  ('af93f7aa-8e87-40be-aff2-353c6195fdb3', 'sensitive', 'irritation', 0.84, 55, 46, 4, 5),
  ('af93f7aa-8e87-40be-aff2-353c6195fdb3', 'dry', 'dehydration', 0.82, 50, 41, 4, 5),
  ('a0cef4a3-21f9-4406-ba60-fe6a28f992de', 'oily', 'acne', 0.76, 55, 42, 6, 7),
  ('a0cef4a3-21f9-4406-ba60-fe6a28f992de', 'sensitive', 'acne', 0.58, 50, 29, 13, 8),
  ('e6877859-bfed-46d3-b89d-09109e55a4ce', 'oily', 'acne', 0.77, 50, 39, 5, 6),
  ('e6877859-bfed-46d3-b89d-09109e55a4ce', 'sensitive', 'redness', 0.75, 50, 38, 6, 6),
  ('c09f2908-513d-4da8-b9e1-5edaac3c4eb0', 'oily', 'acne', 0.80, 50, 40, 5, 5),
  ('c09f2908-513d-4da8-b9e1-5edaac3c4eb0', 'sensitive', 'redness', 0.78, 50, 39, 5, 6),
  ('c09f2908-513d-4da8-b9e1-5edaac3c4eb0', 'combination', 'hyperpigmentation', 0.76, 50, 38, 6, 6)
;

COMMIT;

-- Post-conditions (should each evaluate to a count near these values):
--   SELECT COUNT(*) FROM ss_ingredient_effectiveness;  -- 47
--   SELECT COUNT(*) FILTER (WHERE effectiveness_score = 1.0) FROM ss_ingredient_effectiveness;  -- 0
--   SELECT MAX(sample_size) FROM ss_ingredient_effectiveness;  -- ≤ 100
