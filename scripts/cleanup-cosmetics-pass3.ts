import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Subcategories that are cosmetics (not skincare) — DELETE these
const DELETE_PATTERNS = [
  '%eyeshadow%',
  '%eyebrow%',
  '%eyeliner%',
];

const DELETE_EXACT = [
  'brow bleach',
  'brow finisher',
  'brow cara',
  'brow powder',
  'brow texturizer',
  'brow shaper',
  'brow perm',
  'lip gloss',
  'lip tint',
  'aegyo-sal highlighter',
  'setting spray',
  'blur powder',
  'powder pencil',
];

// Subcategories that LOOK like they'd match but are actually skincare — KEEP
const KEEP_SUBCATEGORIES = new Set([
  'eyelash serum', 'lash serum', 'lash brow serum',
  'lash treatment', 'lash kit', 'lash perm kit',
  'eyelash lift kit', 'eyelash perm kit',
  'lash adhesive', 'lash ampoule', 'eyelash tool',
  'splash mask',
  'makeup remover', 'eye makeup remover',
  'makeup sun cream', 'makeup base sunscreen',
  'primer moisturizer', 'hydrating primer',
  'powder cleanser', 'enzyme powder', 'powder sunscreen',
  'probiotic powder', 'powder wash', 'drying powder',
  'calming powder', 'vitamin c powder',
  'powder treatment', 'powder spot treatment',
]);

async function cleanup() {
  // Build OR query for ILIKE patterns + exact matches
  const orParts = [
    ...DELETE_PATTERNS.map(p => `subcategory.ilike.${p}`),
    ...DELETE_EXACT.map(p => `subcategory.eq.${p}`),
  ].join(',');

  console.log('Querying products matching cosmetic patterns...');
  const { data: allMatches, error: fetchErr } = await supabase
    .from('ss_products')
    .select('id, subcategory, name_en, brand_en')
    .or(orParts);

  if (fetchErr) { console.error('Fetch error:', fetchErr); process.exit(1); }

  // Filter out the ones we want to keep
  const toDelete = allMatches!.filter(p => !KEEP_SUBCATEGORIES.has(p.subcategory));
  const toKeep = allMatches!.filter(p => KEEP_SUBCATEGORIES.has(p.subcategory));

  console.log(`Total matched by patterns: ${allMatches!.length}`);
  console.log(`Keeping (skincare): ${toKeep.length}`);
  console.log(`Deleting (cosmetics): ${toDelete.length}`);
  console.log('');

  // Show all deletions grouped by subcategory
  const grouped: Record<string, string[]> = {};
  toDelete.forEach(p => {
    if (!grouped[p.subcategory]) grouped[p.subcategory] = [];
    grouped[p.subcategory].push(`${p.brand_en} | ${p.name_en}`);
  });
  Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).forEach(([sub, products]) => {
    console.log(`  ${sub} (${products.length}):`);
    products.slice(0, 2).forEach(p => console.log(`    - ${p}`));
    if (products.length > 2) console.log(`    ... and ${products.length - 2} more`);
  });

  const ids = toDelete.map(p => p.id);
  if (ids.length === 0) { console.log('\nNothing to delete!'); return; }

  console.log(`\nDeleting ${ids.length} products with cascade...`);

  // Cascade delete in chunks of 50
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const label = `Chunk ${Math.floor(i / 50) + 1}/${Math.ceil(ids.length / 50)}`;

    const { error: e1 } = await supabase.from('ss_trending_products').delete().in('product_id', chunk);
    if (e1) console.error(label, 'trending:', e1.message);

    const { error: e2 } = await supabase.from('ss_product_staging')
      .update({ processed_product_id: null, status: 'duplicate', error_message: 'Cleaned: not skincare (pass 3)' })
      .in('processed_product_id', chunk);
    if (e2) console.error(label, 'staging:', e2.message);

    const { error: e3 } = await supabase.from('ss_product_ingredients').delete().in('product_id', chunk);
    if (e3) console.error(label, 'ingredients:', e3.message);

    const { error: e4 } = await supabase.from('ss_products').delete().in('id', chunk);
    if (e4) console.error(label, 'products:', e4.message);

    console.log(`${label} done — ${chunk.length} deleted`);
  }

  // Final verification
  const { count: total } = await supabase.from('ss_products').select('*', { count: 'exact', head: true });
  console.log(`\nTotal products remaining: ${total}`);
}

cleanup().catch(console.error);
