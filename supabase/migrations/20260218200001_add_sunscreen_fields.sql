-- Feature 8.7: Sunscreen Finder
-- Add sunscreen-specific fields to ss_products

ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS spf_rating INTEGER;
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS pa_rating TEXT CHECK (pa_rating IN ('PA+', 'PA++', 'PA+++', 'PA++++'));
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS sunscreen_type TEXT CHECK (sunscreen_type IN ('chemical', 'physical', 'hybrid'));
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS white_cast TEXT CHECK (white_cast IN ('none', 'minimal', 'moderate', 'heavy'));
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS finish TEXT CHECK (finish IN ('matte', 'dewy', 'natural', 'satin'));
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS under_makeup BOOLEAN;
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS water_resistant BOOLEAN;
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS suitable_for_activity TEXT CHECK (suitable_for_activity IN ('daily', 'outdoor', 'water_sports'));

-- Partial index for sunscreen queries
CREATE INDEX IF NOT EXISTS idx_ss_products_sunscreen ON ss_products(category, spf_rating, pa_rating) WHERE category = 'sunscreen';

-- Seed sunscreen-specific data for existing products
UPDATE ss_products SET
  spf_rating = 50, pa_rating = 'PA++++', sunscreen_type = 'chemical',
  white_cast = 'none', finish = 'dewy', under_makeup = true,
  water_resistant = false, suitable_for_activity = 'daily'
WHERE name_en = 'Relief Sun: Rice + Probiotics SPF50+ PA++++';

UPDATE ss_products SET
  spf_rating = 50, pa_rating = 'PA++++', sunscreen_type = 'chemical',
  white_cast = 'none', finish = 'natural', under_makeup = true,
  water_resistant = false, suitable_for_activity = 'daily'
WHERE name_en = 'Centella Green Level Unscented Sun SPF50+ PA++++';

UPDATE ss_products SET
  spf_rating = 50, pa_rating = 'PA++++', sunscreen_type = 'hybrid',
  white_cast = 'minimal', finish = 'dewy', under_makeup = true,
  water_resistant = false, suitable_for_activity = 'daily'
WHERE name_en = 'Birch Juice Moisturizing Sun Cream SPF50+ PA++++';

UPDATE ss_products SET
  spf_rating = 50, pa_rating = 'PA++++', sunscreen_type = 'chemical',
  white_cast = 'none', finish = 'natural', under_makeup = true,
  water_resistant = true, suitable_for_activity = 'outdoor'
WHERE name_en = 'Comfy Water Sun Block SPF50+ PA++++';

UPDATE ss_products SET
  spf_rating = 50, pa_rating = 'PA++++', sunscreen_type = 'chemical',
  white_cast = 'none', finish = 'dewy', under_makeup = true,
  water_resistant = false, suitable_for_activity = 'daily'
WHERE name_en = 'Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++';

UPDATE ss_products SET
  spf_rating = 50, pa_rating = 'PA++++', sunscreen_type = 'physical',
  white_cast = 'minimal', finish = 'matte', under_makeup = true,
  water_resistant = true, suitable_for_activity = 'outdoor'
WHERE name_en = 'Truecica Mineral 100 Calming Suncream SPF50+ PA++++';

UPDATE ss_products SET
  spf_rating = 42, pa_rating = 'PA+++', sunscreen_type = 'chemical',
  white_cast = 'none', finish = 'natural', under_makeup = true,
  water_resistant = false, suitable_for_activity = 'daily'
WHERE name_en = 'M Perfect Cover BB Cream SPF42 PA+++';

UPDATE ss_products SET
  spf_rating = 35, pa_rating = 'PA++', sunscreen_type = 'chemical',
  white_cast = 'none', finish = 'natural', under_makeup = true,
  water_resistant = false, suitable_for_activity = 'daily'
WHERE name_en = 'Daily UV Protection Cream SPF35 PA++';
