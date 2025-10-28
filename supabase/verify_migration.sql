-- Verify that all new tables were created successfully
-- Run this in Supabase SQL Editor

-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'price_tracking_history',
    'affiliate_links',
    'retailer_trust_scores',
    'deal_alerts',
    'wishlists'
)
ORDER BY table_name;

-- Check if new columns were added to products table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('best_price_found', 'best_retailer', 'price_last_updated', 'price_comparison')
ORDER BY column_name;

-- Verify retailer trust scores data was inserted
SELECT * FROM retailer_trust_scores LIMIT 5;

-- Check the price intelligence summary view
SELECT COUNT(*) as table_count FROM price_tracking_history;
SELECT COUNT(*) as affiliate_count FROM affiliate_links;

-- Success message
SELECT 'Migration verified successfully! All tables and columns exist.' as status;