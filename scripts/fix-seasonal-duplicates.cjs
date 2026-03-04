/**
 * Fix duplicate seasonal patterns in ss_learning_patterns.
 *
 * The Phase 11.4 seed inserted 4 rows per climate zone (one per season).
 * The seasonal-adjustments cron expects exactly 1 row per climate zone
 * and uses .single() — which fails when multiple rows exist, causing
 * patterns_generated: 0.
 *
 * This script keeps only the newest row per climate zone and deletes the rest.
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
  // 1. Get all seasonal patterns grouped by climate
  const { data: patterns, error } = await supabase
    .from('ss_learning_patterns')
    .select('id, skin_type, pattern_description, updated_at')
    .eq('pattern_type', 'seasonal')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch patterns:', error.message);
    process.exit(1);
  }

  console.log(`Found ${patterns.length} seasonal pattern rows`);

  // 2. Group by skin_type, keep only the first (newest) per group
  const keepIds = new Set();
  const seenClimate = new Set();

  for (const p of patterns) {
    if (!seenClimate.has(p.skin_type)) {
      seenClimate.add(p.skin_type);
      keepIds.add(p.id);
      console.log(`  KEEP: ${p.skin_type} — ${p.id} (${p.pattern_description.substring(0, 60)}...)`);
    }
  }

  const deleteIds = patterns
    .filter(p => !keepIds.has(p.id))
    .map(p => p.id);

  console.log(`\nKeeping ${keepIds.size} rows, deleting ${deleteIds.length} duplicates`);

  if (deleteIds.length === 0) {
    console.log('No duplicates to delete.');
    return;
  }

  // 3. Delete duplicates
  const { error: delError, count } = await supabase
    .from('ss_learning_patterns')
    .delete({ count: 'exact' })
    .in('id', deleteIds);

  if (delError) {
    console.error('Delete failed:', delError.message);
    process.exit(1);
  }

  console.log(`Deleted ${count} duplicate seasonal pattern rows`);

  // 4. Verify
  const { count: remaining } = await supabase
    .from('ss_learning_patterns')
    .select('*', { count: 'exact', head: true })
    .eq('pattern_type', 'seasonal');

  console.log(`Remaining seasonal patterns: ${remaining} (should be 5, one per climate zone)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
