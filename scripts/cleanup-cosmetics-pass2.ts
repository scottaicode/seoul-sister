import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Subcategories that contain "makeup", "mascara", etc. but are actually skincare
const KEEP_SUBCATEGORIES = [
  'makeup remover',
  'eye makeup remover',
  'makeup sun cream',
  'makeup base sunscreen',
  'primer moisturizer',
  'hydrating primer',
];

async function cleanup() {
  console.log('=== Cosmetics Cleanup Pass 2 ===\n');

  // Find all products matching cosmetic patterns via ILIKE
  const { data: allMatches, error: fetchErr } = await supabase
    .from('ss_products')
    .select('id, subcategory, name_en, brand_en')
    .or(
      'subcategory.ilike.%mascara%,' +
      'subcategory.ilike.%eyeliner%,' +
      'subcategory.ilike.%concealer%,' +
      'subcategory.ilike.%blush%,' +
      'subcategory.ilike.%lipstick%,' +
      'subcategory.ilike.%foundation%,' +
      'subcategory.ilike.%makeup%,' +
      'subcategory.eq.eye primer,' +
      'subcategory.eq.glitter primer,' +
      'subcategory.eq.lash primer,' +
      'subcategory.eq.pore primer,' +
      'subcategory.eq.makeup primer'
    );

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    process.exit(1);
  }

  // Separate keepers from deletions
  const toDelete = allMatches!.filter(
    (p) => !KEEP_SUBCATEGORIES.includes(p.subcategory)
  );
  const toKeep = allMatches!.filter((p) =>
    KEEP_SUBCATEGORIES.includes(p.subcategory)
  );

  console.log('Total matched:', allMatches!.length);
  console.log(
    'Keeping:',
    toKeep.length,
    '(' + [...new Set(toKeep.map((p) => p.subcategory))].join(', ') + ')'
  );
  console.log('Deleting:', toDelete.length);
  console.log('');

  if (toDelete.length === 0) {
    console.log('Nothing to delete — database is clean!');
    return;
  }

  // Show what we're deleting
  console.log('Products to delete:');
  const grouped = new Map<string, typeof toDelete>();
  for (const p of toDelete) {
    const list = grouped.get(p.subcategory) || [];
    list.push(p);
    grouped.set(p.subcategory, list);
  }
  for (const [subcat, products] of grouped) {
    console.log(`  ${subcat} (${products.length}):`);
    products.slice(0, 3).forEach((p) =>
      console.log(`    - ${p.brand_en} | ${p.name_en}`)
    );
    if (products.length > 3) console.log(`    ... and ${products.length - 3} more`);
  }
  console.log('');

  const ids = toDelete.map((p) => p.id);

  // Cascade delete in chunks of 50
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const label = `Chunk ${Math.floor(i / 50) + 1}/${Math.ceil(ids.length / 50)}`;

    // 1. Trending products
    const { error: e1 } = await supabase
      .from('ss_trending_products')
      .delete()
      .in('product_id', chunk);
    if (e1) console.error(label, 'trending:', e1.message);

    // 2. Unlink staging rows
    const { error: e2 } = await supabase
      .from('ss_product_staging')
      .update({
        processed_product_id: null,
        status: 'duplicate',
        error_message: 'Cleaned: not skincare (pass 2)',
      })
      .in('processed_product_id', chunk);
    if (e2) console.error(label, 'staging:', e2.message);

    // 3. Ingredient links
    const { error: e3 } = await supabase
      .from('ss_product_ingredients')
      .delete()
      .in('product_id', chunk);
    if (e3) console.error(label, 'ingredients:', e3.message);

    // 4. Products themselves
    const { error: e4 } = await supabase
      .from('ss_products')
      .delete()
      .in('id', chunk);
    if (e4) console.error(label, 'products:', e4.message);

    console.log(`${label} done — ${chunk.length} deleted`);
  }

  // Verify final count
  const { count: total } = await supabase
    .from('ss_products')
    .select('*', { count: 'exact', head: true });
  console.log('\nTotal products remaining:', total);

  // Verify no cosmetics left (except keepers)
  const { data: remaining } = await supabase
    .from('ss_products')
    .select('subcategory')
    .or(
      'subcategory.ilike.%mascara%,' +
      'subcategory.ilike.%eyeliner%,' +
      'subcategory.ilike.%concealer%,' +
      'subcategory.ilike.%blush%,' +
      'subcategory.ilike.%lipstick%,' +
      'subcategory.ilike.%foundation%,' +
      'subcategory.ilike.%makeup%,' +
      'subcategory.eq.eye primer,' +
      'subcategory.eq.glitter primer,' +
      'subcategory.eq.lash primer,' +
      'subcategory.eq.pore primer,' +
      'subcategory.eq.makeup primer'
    );

  const remainingSubcats = [...new Set(remaining!.map((r) => r.subcategory))];
  console.log(
    'Remaining matched subcategories (should be KEEP list only):',
    remainingSubcats
  );
}

cleanup().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
