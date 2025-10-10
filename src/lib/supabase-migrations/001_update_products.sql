-- Migration: Update products table with curated Seoul Sister collection
-- Date: 2025-01-10

-- First, clear existing sample data
DELETE FROM public.products WHERE name_english IN ('Red Bean Water', 'Centella Asiatica Toner', 'Yun Jo Essence', 'Aqua Serum', 'Good Morning Gel Cleanser');

-- Insert Seoul Sister curated collection (matching the frontend display)
INSERT INTO public.products (
  name_korean,
  name_english,
  brand,
  seoul_price,
  us_price,
  savings_percentage,
  category,
  description,
  image_url,
  korean_site_url,
  us_site_url,
  skin_type,
  in_stock
) VALUES
(
  '퍼스트 케어 액티베이팅 세럼',
  'First Care Activating Serum',
  'Sulwhasoo',
  28.00,
  94.00,
  70,
  'Serum',
  'Legendary Korean anti-aging serum with 80+ years of herbal expertise. Contains the sacred JAUM balancing complex.',
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&h=600&fit=crop',
  'https://www.sulwhasoo.com/kr/ko/products/first-care-activating-serum.html',
  'https://www.sephora.com/product/sulwhasoo-first-care-activating-serum',
  'All skin types',
  true
),
(
  '글로우 딥 세럼',
  'Glow Deep Serum',
  'Beauty of Joseon',
  8.50,
  45.00,
  82,
  'Serum',
  'Rice bran + Alpha arbutin brightening serum. The K-beauty secret for glass skin that went viral on TikTok.',
  'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=600&h=600&fit=crop',
  'https://beautyofjoseon.com/products/glow-deep-serum',
  'https://www.ulta.com/p/glow-deep-serum-rice-alpha-arbutin',
  'All skin types, especially dull skin',
  true
),
(
  '달팽이 96 뮤신 에센스',
  'Snail 96 Mucin Essence',
  'COSRX',
  12.00,
  89.00,
  74,
  'Essence',
  '96% snail mucin for repair & hydration. The holy grail product that converted skeptics into believers.',
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
  'https://www.cosrx.com/products/snail-96-mucin-power-essence',
  'https://www.sephora.com/product/cosrx-snail-96-mucin-power-essence',
  'All skin types, especially damaged skin',
  true
),
(
  '워터 슬리핑 마스크',
  'Water Sleeping Mask',
  'Laneige',
  12.00,
  34.00,
  65,
  'Mask',
  'Overnight hydration miracle with Sleeping Micro Biome™ and enhanced Pro-biotics Complex.',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop',
  'https://www.laneige.com/kr/ko/product/skincare/water-sleeping-mask.html',
  'https://www.sephora.com/product/laneige-water-sleeping-mask',
  'All skin types, especially dry skin',
  true
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_savings ON public.products(savings_percentage DESC);