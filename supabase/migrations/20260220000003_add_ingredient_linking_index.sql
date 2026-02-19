-- Phase 9.3: Ingredient Auto-Linking Pipeline
-- Add index on ss_product_ingredients.ingredient_id for faster lookups during linking

CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient_id
  ON ss_product_ingredients(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_ingredients_name_inci_lower
  ON ss_ingredients(LOWER(name_inci));
