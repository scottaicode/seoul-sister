-- Seoul Sister Supabase Fixes and Enhancements
-- Run this script in your Supabase SQL editor

-- ============================================
-- PART 1: STORAGE BUCKET SETUP FOR IMAGES
-- ============================================
-- This fixes the CSP issues with external images

-- Create a public storage bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,  -- Public bucket so images can be accessed without authentication
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Create RLS policies for the product-images bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- ============================================
-- PART 2: SCRAPED PRODUCTS TABLE
-- ============================================
-- For storing products from web scraping (separate from main products table)

-- Create scraped_products table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.scraped_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_site text NOT NULL, -- 'sephora', 'ulta', 'olive_young', etc.
  source_url text UNIQUE NOT NULL,
  name_korean text,
  name_english text NOT NULL,
  brand text NOT NULL,
  original_price decimal(10,2) NOT NULL,
  sale_price decimal(10,2),
  seoul_price decimal(10,2), -- Our estimated Seoul price
  estimated_savings decimal(10,2),
  savings_percentage decimal(5,2),
  category text,
  subcategory text,
  description text,
  ingredients text[],
  image_urls text[],
  local_image_url text, -- URL after we download and store in our bucket
  ratings decimal(3,2),
  review_count integer,
  in_stock boolean DEFAULT true,
  last_scraped timestamp with time zone DEFAULT timezone('utc'::text, now()),
  scrape_metadata jsonb, -- Store any additional data from scraping
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_scraped_products_brand ON public.scraped_products(brand);
CREATE INDEX IF NOT EXISTS idx_scraped_products_category ON public.scraped_products(category);
CREATE INDEX IF NOT EXISTS idx_scraped_products_savings ON public.scraped_products(savings_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_products_source ON public.scraped_products(source_site);
CREATE INDEX IF NOT EXISTS idx_scraped_products_last_scraped ON public.scraped_products(last_scraped DESC);

-- Enable RLS
ALTER TABLE public.scraped_products ENABLE ROW LEVEL SECURITY;

-- Anyone can view scraped products
CREATE POLICY "Anyone can view scraped products"
ON public.scraped_products FOR SELECT
USING (true);

-- Only authenticated users can insert scraped products
CREATE POLICY "Authenticated can insert scraped products"
ON public.scraped_products FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can update scraped products
CREATE POLICY "Authenticated can update scraped products"
ON public.scraped_products FOR UPDATE
USING (auth.role() = 'authenticated');

-- ============================================
-- PART 3: PERFORMANCE INDEXES FOR EXISTING TABLES
-- ============================================

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_savings ON public.products(savings_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_popularity ON public.products(popularity_score DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- ============================================
-- PART 4: UPDATE PRODUCTS TABLE IMAGE HANDLING
-- ============================================

-- Add column for local storage URL if it doesn't exist
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS local_image_url text;

-- Add column to track if image is external or local
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_source text DEFAULT 'external' CHECK (image_source IN ('external', 'local', 'supabase'));

-- ============================================
-- PART 5: FUNCTION TO MIGRATE EXTERNAL IMAGES
-- ============================================

-- Function to help track which images need to be migrated
CREATE OR REPLACE FUNCTION public.get_external_images()
RETURNS TABLE(
  product_id uuid,
  product_name text,
  current_image_url text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id as product_id,
    name_english as product_name,
    image_url as current_image_url
  FROM public.products
  WHERE image_url IS NOT NULL
    AND image_source = 'external'
    AND (image_url LIKE 'https://images.unsplash.com%'
         OR image_url LIKE 'http://%'
         OR image_url NOT LIKE '%supabase%');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 6: PRICE TRACKING TABLE
-- ============================================

-- Create price history table for tracking price changes
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  scraped_product_id uuid REFERENCES public.scraped_products(id) ON DELETE CASCADE,
  source_site text NOT NULL,
  old_price decimal(10,2),
  new_price decimal(10,2) NOT NULL,
  price_change decimal(10,2),
  change_percentage decimal(5,2),
  recorded_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT either_product_or_scraped CHECK (
    (product_id IS NOT NULL AND scraped_product_id IS NULL) OR
    (product_id IS NULL AND scraped_product_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped ON public.price_history(scraped_product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON public.price_history(recorded_at DESC);

-- ============================================
-- PART 7: TRIGGER FOR UPDATED_AT TIMESTAMPS
-- ============================================

-- Make sure updated_at triggers exist for new tables
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.scraped_products
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.price_history
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ============================================
-- PART 8: GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- PART 9: ADD SCRAPING CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.scraping_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name text UNIQUE NOT NULL,
  base_url text NOT NULL,
  selectors jsonb NOT NULL, -- CSS selectors for different elements
  headers jsonb, -- Custom headers if needed
  rate_limit integer DEFAULT 1000, -- milliseconds between requests
  is_active boolean DEFAULT true,
  last_run timestamp with time zone,
  next_run timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default scraping configurations
INSERT INTO public.scraping_configs (site_name, base_url, selectors, rate_limit) VALUES
('sephora', 'https://www.sephora.com',
 '{"product_name": ".css-1qe8tjm", "price": ".css-0", "brand": ".css-uzubhx", "image": ".css-1egyzfi img"}',
 2000),
('ulta', 'https://www.ulta.com',
 '{"product_name": ".ProductMainSection__productName", "price": ".ProductPricingPanel", "brand": ".ProductMainSection__brandName", "image": ".ProductImageCarousel img"}',
 2000)
ON CONFLICT (site_name) DO NOTHING;

-- ============================================
-- PART 10: FIX CSP FOR SUPABASE
-- ============================================

-- Note: CSP headers are typically configured in your Supabase Dashboard
-- under Settings > API > CORS/Headers, but here's what you need:

COMMENT ON DATABASE postgres IS 'Seoul Sister K-Beauty Database

IMPORTANT CSP CONFIGURATION:
To fix image loading issues, add these domains to your Supabase CORS allowed origins:
- https://images.unsplash.com
- https://seoulsister.com
- https://www.seoulsister.com

In your Next.js app, update next.config.js to include:
images: {
  domains: ["images.unsplash.com", "your-supabase-url.supabase.co"],
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/public/**",
    }
  ]
}';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify everything is set up correctly:
-- SELECT * FROM storage.buckets WHERE id = 'product-images';
-- SELECT count(*) FROM public.products WHERE image_source = 'external';
-- SELECT * FROM public.get_external_images() LIMIT 5;