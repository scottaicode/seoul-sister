-- Phase 1 (July 29 2026) — let Yuri see the ingredients of products we do not
-- carry, so her safety checks stop silently passing.
--
-- THE DEFECT
-- ss_ingredient_conflicts holds a HIGH-severity "Retinol + Glycolic Acid" rule
-- ("significantly increases risk of irritation, redness, peeling, and a
-- compromised skin barrier"). A paying subscriber is running exactly that
-- combination on a post-Accutane barrier and told Yuri so during onboarding.
--
-- The rule cannot fire for her. Both products are custom entries with
-- product_id = NULL, and checkRoutineConflicts joins ss_product_ingredients by
-- product_id, so they contribute zero ingredients and it returns
-- { safe: true, conflicts: [] }. For her, "safe: true" is silence, not a check.
--
-- WHY A COLUMN AND NOT A CATALOG ROW
-- This is deliberately PER-USER data, never a public catalog row. Nothing here
-- is indexed, cited, or served to a crawler, so it dilutes no AI-citation
-- position. The audit confirmed no existing column fits: `notes` is free prose
-- rendered to Yuri as a trailing sentence and joined to nothing.

ALTER TABLE ss_user_products
  ADD COLUMN IF NOT EXISTS ingredients_inci text[],
  ADD COLUMN IF NOT EXISTS ingredients_source text,
  ADD COLUMN IF NOT EXISTS ingredients_captured_at timestamptz;

COMMENT ON COLUMN ss_user_products.ingredients_inci IS
  'INCI list for a product NOT in the catalog, so conflict/allergy checks work on the user''s real shelf. Per-user only: never public, never indexed. NULL when unknown.';

COMMENT ON COLUMN ss_user_products.ingredients_source IS
  'Provenance of ingredients_inci: ''label_scan'' (user photographed the label, highest confidence) or ''web_lookup'' (retrieved for a named product). Provenance matters because a web lookup can return a sibling product-line variant with different actives.';

-- Provenance must be honest and closed. Same discipline as fitzpatrick_source:
-- a value whose origin we cannot name is a value Yuri should not treat as fact.
ALTER TABLE ss_user_products
  DROP CONSTRAINT IF EXISTS ss_user_products_ingredients_source_check;
ALTER TABLE ss_user_products
  ADD CONSTRAINT ss_user_products_ingredients_source_check
  CHECK (ingredients_source IS NULL OR ingredients_source IN ('label_scan', 'web_lookup'));

-- Never a list without a stated source, and never a source without a list.
ALTER TABLE ss_user_products
  DROP CONSTRAINT IF EXISTS ss_user_products_ingredients_paired_check;
ALTER TABLE ss_user_products
  ADD CONSTRAINT ss_user_products_ingredients_paired_check
  CHECK (
    (ingredients_inci IS NULL AND ingredients_source IS NULL)
    OR (ingredients_inci IS NOT NULL AND ingredients_source IS NOT NULL)
  );

-- Verification:
--   SELECT custom_brand, custom_name, ingredients_source,
--          array_length(ingredients_inci, 1) AS n
--   FROM ss_user_products
--   WHERE product_id IS NULL
--   ORDER BY updated_at DESC;
