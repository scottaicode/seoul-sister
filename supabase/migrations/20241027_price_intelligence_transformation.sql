-- Seoul Sister: Strategic Transformation to Price Intelligence Platform
-- Migration from wholesale model to AI beauty intelligence aggregator

-- Step 1: Add new columns to products table for price intelligence
ALTER TABLE products
ADD COLUMN IF NOT EXISTS best_price_found DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS best_retailer TEXT,
ADD COLUMN IF NOT EXISTS price_last_updated TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS price_comparison JSONB;

-- Step 2: Migrate existing seoul_price data to best_price_found
UPDATE products
SET best_price_found = seoul_price,
    best_retailer = 'Seoul Sister Wholesale'
WHERE best_price_found IS NULL;

-- Step 3: Create retailer trust scores table
CREATE TABLE IF NOT EXISTS retailer_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_name TEXT UNIQUE NOT NULL,
  authenticity_score INTEGER CHECK (authenticity_score >= 0 AND authenticity_score <= 100),
  shipping_score INTEGER CHECK (shipping_score >= 0 AND shipping_score <= 100),
  customer_service_score INTEGER CHECK (customer_service_score >= 0 AND customer_service_score <= 100),
  overall_trust_rating DECIMAL(3, 1) CHECK (overall_trust_rating >= 0 AND overall_trust_rating <= 100),
  total_reviews INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create price tracking history table
CREATE TABLE IF NOT EXISTS price_tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  availability BOOLEAN DEFAULT true,
  shipping_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  promotion_info TEXT,
  tracked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for price tracking history
CREATE INDEX IF NOT EXISTS idx_price_tracking_product ON price_tracking_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_tracking_retailer ON price_tracking_history(retailer);
CREATE INDEX IF NOT EXISTS idx_price_tracking_date ON price_tracking_history(tracked_at DESC);

-- Step 5: Create affiliate links table
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  direct_url TEXT NOT NULL,
  commission_rate DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, retailer)
);

-- Step 6: Create deal alerts table
CREATE TABLE IF NOT EXISTS deal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  target_price DECIMAL(10, 2),
  alert_when_available BOOLEAN DEFAULT false,
  alert_on_any_discount BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Step 7: Create user wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  priority INTEGER DEFAULT 0,
  UNIQUE(user_id, product_id)
);

-- Step 8: Insert initial retailer trust scores
INSERT INTO retailer_trust_scores (retailer_name, authenticity_score, shipping_score, customer_service_score, overall_trust_rating)
VALUES
  ('YesStyle', 98, 92, 90, 95.0),
  ('Olive Young Global', 97, 90, 92, 93.0),
  ('Sephora', 95, 88, 92, 90.0),
  ('iHerb K-Beauty', 92, 85, 88, 88.0),
  ('Amazon (Verified Sellers)', 88, 90, 80, 85.0),
  ('Ulta', 94, 85, 88, 87.0),
  ('Stylevana', 90, 82, 85, 85.0),
  ('Jolse', 88, 80, 82, 83.0),
  ('BeautyNetKorea', 85, 78, 80, 80.0),
  ('Sokoglam', 92, 85, 90, 88.0)
ON CONFLICT (retailer_name) DO NOTHING;

-- Step 9: Update orders table to remove wholesale references
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS retailer TEXT,
ADD COLUMN IF NOT EXISTS affiliate_commission DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);

-- Step 10: Create price intelligence analytics view
CREATE OR REPLACE VIEW price_intelligence_summary AS
SELECT
  p.id,
  p.name_english,
  p.brand,
  p.best_price_found,
  p.best_retailer,
  p.us_price as msrp,
  ROUND(((p.us_price - p.best_price_found) / p.us_price * 100)::numeric, 2) as savings_percentage,
  p.price_last_updated,
  COUNT(DISTINCT pth.retailer) as retailers_tracked,
  MIN(pth.price) as lowest_price_30d,
  MAX(pth.price) as highest_price_30d,
  AVG(pth.price) as average_price_30d
FROM products p
LEFT JOIN price_tracking_history pth ON p.id = pth.product_id
  AND pth.tracked_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name_english, p.brand, p.best_price_found, p.best_retailer, p.us_price, p.price_last_updated;

-- Step 11: Create function to update best price
CREATE OR REPLACE FUNCTION update_best_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product's best price if this is lower
  UPDATE products
  SET
    best_price_found = NEW.price,
    best_retailer = NEW.retailer,
    price_last_updated = NOW()
  WHERE id = NEW.product_id
    AND (best_price_found IS NULL OR NEW.price < best_price_found);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create trigger for automatic best price updates
CREATE TRIGGER update_product_best_price
AFTER INSERT ON price_tracking_history
FOR EACH ROW
EXECUTE FUNCTION update_best_price();

-- Step 13: Create RLS policies for new tables
ALTER TABLE retailer_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Public read access for retailer scores and price history
CREATE POLICY "Public read access" ON retailer_trust_scores FOR SELECT USING (true);
CREATE POLICY "Public read access" ON price_tracking_history FOR SELECT USING (true);
CREATE POLICY "Public read access" ON affiliate_links FOR SELECT USING (true);

-- User-specific access for personal features
CREATE POLICY "Users manage own alerts" ON deal_alerts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own wishlists" ON wishlists
  FOR ALL USING (auth.uid() = user_id);

-- Step 14: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_best_price ON products(best_price_found);
CREATE INDEX IF NOT EXISTS idx_products_best_retailer ON products(best_retailer);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_active ON affiliate_links(product_id, is_active);

-- Step 15: Drop deprecated wholesale tables (commented out for safety - run manually after verification)
-- DROP TABLE IF EXISTS korean_suppliers CASCADE;
-- ALTER TABLE products DROP COLUMN IF EXISTS seoul_price CASCADE;
-- ALTER TABLE orders DROP COLUMN IF EXISTS seoul_price CASCADE;

COMMENT ON TABLE retailer_trust_scores IS 'Trust ratings for various K-beauty retailers based on authenticity, shipping, and service';
COMMENT ON TABLE price_tracking_history IS 'Historical price data from various retailers for price intelligence';
COMMENT ON TABLE affiliate_links IS 'Affiliate partnerships for monetization through intelligent recommendations';
COMMENT ON TABLE deal_alerts IS 'User-configured price drop notifications';
COMMENT ON TABLE wishlists IS 'User product wishlists with price tracking';