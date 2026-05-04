-- ============================================================
-- Fix Bailey Donmartin's Phase 2 AM and PM routines
-- User ID: 551569d3-aed0-4feb-a340-47bfb146a835
--
-- Origin: May 5, 2026 diagnostic surfaced that Bailey's active
-- Phase 2 routines did not match what Yuri promised in the May 4
-- transcript. Yuri described a 9-step Phase 2 AM with Goodal Vita C
-- in slot 4 and a PM with COSRX BHA Blackhead Power Liquid in slot
-- 4 (Mon/Wed/Fri). The actual ss_routine_products rows showed
-- Torriden DIVE-IN HA Serum and COSRX Snail 96 Mucin Essence in
-- those slots — the routine save bug fixed in v10.3.2.
--
-- This script does two things:
--   1. Applies the v10.3.3 schema migration (drops NOT NULL on
--      ss_routine_products.product_id) so device/action steps can
--      live in routines without pointing at a wrong product.
--   2. Restores Bailey's Phase 2 AM and PM routines to match the
--      May 4 transcript, with custom steps (cool water rinse, ice
--      roller, LED masks, shower) saved as null product_id rows.
--
-- See CHANGELOG.md v10.3.2 / v10.3.3 entries for full context.
--
-- Routine IDs:
--   Phase 2 AM: fa5925fa-580c-4a62-87b2-c4e20f19e6a9
--   Phase 2 PM: fc969697-4b8d-4620-a721-9c39f71b53d0
--
-- Run this in Supabase Studio SQL Editor (Dashboard > SQL Editor).
-- Single transaction. The verification SELECT at the bottom is
-- commented out — run it after COMMIT to confirm the result.
-- ============================================================

BEGIN;

-- ---- Schema migration (v10.3.3) ----
ALTER TABLE ss_routine_products ALTER COLUMN product_id DROP NOT NULL;

-- ---- Phase 2 AM Routine ----
DELETE FROM ss_routine_products WHERE routine_id = 'fa5925fa-580c-4a62-87b2-c4e20f19e6a9';

INSERT INTO ss_routine_products (routine_id, product_id, step_order, frequency, notes) VALUES
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', NULL,                                   1, 'daily', 'Cool water rinse — no cleanser AM, barrier still healing'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', NULL,                                   2, 'daily', 'Ice roller / cold spoon — 2 min on cheeks for vascular flush'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', '3beba1aa-b03c-4d4e-a37d-2abb1cc8050a', 3, 'daily', 'Acwell Licorice Toner — pat on damp skin, no cotton pad'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', '8cf06b70-f4f9-4912-bcc6-be2843e8864c', 4, 'daily', 'NEW Phase 2. Goodal Vita C — after toner, before other serums. Wait 5-10 min before next step'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', NULL,                                   5, 'daily', 'Anua Heartleaf 70% Rice Ceramide Serum — thinner, goes first (custom entry, not in product DB)'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', 'f2452824-63df-4885-93de-b4752dfa7a1f', 6, 'daily', 'Medicube PDRN Pink Peptide Serum — thicker, goes second'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', NULL,                                   7, 'daily', 'Medicube PDRN Pink Peptide Eye Cream — ring finger tap (custom entry, not in product DB)'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', 'aeb68155-76a8-47aa-8255-967475237633', 8, 'daily', 'Illiyoon Ceramide Ato Concentrate Cream'),
  ('fa5925fa-580c-4a62-87b2-c4e20f19e6a9', 'f2ba1ae1-8ed2-4ea7-b658-fd191f144008', 9, 'daily', 'Beauty of Joseon Relief Sun SPF50+ PA++++ — non-negotiable');

-- ---- Phase 2 PM Routine ----
-- BHA step uses frequency='mon_wed_fri'. LED rotation noted on the device row.
DELETE FROM ss_routine_products WHERE routine_id = 'fc969697-4b8d-4620-a721-9c39f71b53d0';

INSERT INTO ss_routine_products (routine_id, product_id, step_order, frequency, notes) VALUES
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', NULL,                                   1, 'daily',       'Shower / cleanse'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', NULL,                                   2, 'daily',       'LED mask — Blue (Mon/Wed/Fri) for P. acnes / Red (Tue/Thu/Sat/Sun) for barrier + collagen. 10 min on bare clean skin'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', '3beba1aa-b03c-4d4e-a37d-2abb1cc8050a', 3, 'daily',       'Acwell Licorice Toner — pat on, wait until fully absorbed'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', 'dd11bde0-86b5-40e6-9782-0540dcc0f914', 4, 'mon_wed_fri', 'NEW Phase 2. COSRX BHA Blackhead Power Liquid — Mon/Wed/Fri only. Jawline + T-zone only, NOT full face. Apply on dry skin. Wait 10-15 min before next step'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', NULL,                                   5, 'daily',       'Anua Heartleaf 70% Rice Ceramide Serum — thinner, goes first (custom entry, not in product DB)'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', 'f2452824-63df-4885-93de-b4752dfa7a1f', 6, 'daily',       'Medicube PDRN Pink Peptide Serum — thicker, goes second'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', NULL,                                   7, 'daily',       'Medicube PDRN Pink Peptide Eye Cream — ring finger tap (custom entry, not in product DB)'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', 'aeb68155-76a8-47aa-8255-967475237633', 8, 'daily',       'Illiyoon Ceramide Ato Concentrate Cream'),
  ('fc969697-4b8d-4620-a721-9c39f71b53d0', '2c7c736f-0429-4971-a85e-f00519eb01f1', 9, 'as_needed',   'COSRX Acne Pimple Master Patch — on surfacing bumps');

COMMIT;

-- ============================================================
-- VERIFICATION (run after COMMIT — should show clean Phase 2 routines)
-- ============================================================
-- SELECT r.name, rp.step_order, rp.frequency, rp.notes,
--        coalesce(p.brand_en || ' ' || p.name_en, '(custom)') AS product
-- FROM ss_user_routines r
-- LEFT JOIN ss_routine_products rp ON rp.routine_id = r.id
-- LEFT JOIN ss_products p ON p.id = rp.product_id
-- WHERE r.user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
--   AND r.is_active = true
-- ORDER BY r.routine_type, rp.step_order;
