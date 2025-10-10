-- Fix product images with unique, working URLs

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&h=600&fit=crop',
  description = 'Premium anti-aging serum with ginseng and traditional Korean herbs'
WHERE name_english = 'First Care Activating Serum';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=600&h=600&fit=crop',
  description = 'Brightening serum with rice bran and ginseng root water'
WHERE name_english = 'Glow Deep Serum';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=600&fit=crop',
  description = 'Hydrating essence with 96% snail mucin for repair and hydration'
WHERE name_english = 'Snail 96 Mucin Essence';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop',
  description = 'Overnight hydrating mask for deep moisture replenishment'
WHERE name_english = 'Water Sleeping Mask';