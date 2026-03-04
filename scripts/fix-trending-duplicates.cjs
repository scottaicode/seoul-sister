/**
 * Fix duplicate unmatched trending product rows in ss_trending_products.
 *
 * Unmatched products (product_id IS NULL) had no unique constraint,
 * so each cron run inserted new rows instead of updating existing ones.
 * This script keeps only the newest row per source_product_name and deletes the rest.
 */

const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  // 1. Get all unmatched olive_young trending rows
  const { data: rows, error } = await supabase
    .from('ss_trending_products')
    .select('id, source_product_name, created_at')
    .eq('source', 'olive_young')
    .is('product_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch rows:', error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} unmatched olive_young trending rows`);

  // 2. Keep only the newest per source_product_name
  const keepIds = new Set();
  const seen = new Set();

  for (const r of rows) {
    if (!seen.has(r.source_product_name)) {
      seen.add(r.source_product_name);
      keepIds.add(r.id);
    }
  }

  const deleteIds = rows
    .filter(r => !keepIds.has(r.id))
    .map(r => r.id);

  console.log(`Keeping ${keepIds.size} unique rows, deleting ${deleteIds.length} duplicates`);

  if (deleteIds.length === 0) {
    console.log('No duplicates to delete.');
    return;
  }

  // 3. Delete duplicates
  const { error: delError, count } = await supabase
    .from('ss_trending_products')
    .delete({ count: 'exact' })
    .in('id', deleteIds);

  if (delError) {
    console.error('Delete failed:', delError.message);
    process.exit(1);
  }

  console.log(`Deleted ${count} duplicate unmatched trending rows`);

  // 4. Verify
  const { count: remaining } = await supabase
    .from('ss_trending_products')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'olive_young')
    .is('product_id', null);

  console.log(`Remaining unmatched olive_young rows: ${remaining} (should be ${keepIds.size})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
