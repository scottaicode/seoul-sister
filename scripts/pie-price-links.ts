/**
 * PIE post — remove prose prices, link to product pages instead.
 *
 * Completes the Aug 25 standing rule (LGAAS-WORK-ORDER-NEVER-QUOTE-PRICES.md)
 * on the last post in the PIE/PIH cluster still violating it. The PIH sibling
 * was swept Aug 25; the eye-patches post Aug 26; this is the third.
 *
 * 17 dollar figures across 10 products. Measured Aug 26 2026:
 *   - all 10 products exist, is_verified = true
 *   - every rating and review count in the post is CORRECT -> kept verbatim
 *   - 9 of 10 have NO price row at all, so the figures are unverifiable,
 *     not merely stale. The 1 with a price (BoJ Glow Deep, $12.75) was last
 *     checked 2026-05-06 and the post says "about $11".
 *   - the post had ZERO product links before this.
 *
 * SIBLING-ROW DISCIPLINE. Several of these have decoy rows that would be the
 * wrong link: Real Barrier "Extreme Cream Ampoule"/"Light"/"Special Set",
 * Aestura "A-Cica 365 Soothing Repair Cream pH4.5" ($47.93, 25 reviews), and
 * four Dr.G "Set"/"For Men" rows. Each id below is pinned to the row whose
 * review_count matches the post's own claim, which is the discriminator that
 * cannot be satisfied by a sibling.
 *
 * Two same-name Etude rows exist (7,201 vs 1,700 reviews). The post says
 * "roughly 7,200", so it is the first. Verified.
 *
 * Prices are REMOVED, never replaced with a new number. A number goes stale;
 * the product page reads the live catalog.
 *
 *   npx tsx scripts/pie-price-links.ts           # dry run
 *   npx tsx scripts/pie-price-links.ts --apply   # write
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SLUG = 'best-korean-skincare-for-pie-acne-scars-and-texture';
const APPLY = process.argv.includes('--apply');
const P = (id: string) => `https://www.seoulsister.com/products/${id}`;

const ID = {
  iunikSerum: '7c0d7bc2-3163-47ee-a574-93c52790699f',
  bojGlow:    'f15f5eb0-5638-4222-aeac-9f88a6f466ca',
  oneThing:   '560ecfd7-54bd-43a2-ad2c-9281c1daab39',
  soonjung:   '776ef10e-568f-486e-b36a-f72324622ee4',
  heimish:    'e9519569-e600-46b8-9cf2-39892f695155',
  drg:        'da1d31f3-9081-44c9-b083-d3793d82db9c',
  realBarrier:'dca4a38b-ea65-403b-a3fc-d3649f0f94db',
  aestura:    'dae12afa-8d6b-46df-9cc9-39ef43bce674',
  iunikGel:   '58140efd-7245-4cbf-b568-05a8b67b35b7',
  beplain:    '045b3f3d-ce3a-4790-888c-ee34bd2100b2',
} as const;

// [find, replace] — every find verified unique against the live body.
const EDITS: [string, string][] = [
  // --- Serum section ---
  ['**Top pick: iUNIK Tea Tree Relief Serum**, about $14 at Olive Young, 4.5 stars across roughly 6,100 reviews.',
   `**Top pick: [iUNIK Tea Tree Relief Serum](${P(ID.iunikSerum)})**, 4.5 stars across roughly 6,100 reviews.`],
  ['**Budget alternate: Beauty of Joseon Glow Deep Serum: Rice + Alpha-Arbutin**, about $11 at Olive Young, 4.6 stars across roughly 5,800 reviews.',
   `**Budget alternate: [Beauty of Joseon Glow Deep Serum: Rice + Alpha-Arbutin](${P(ID.bojGlow)})**, 4.6 stars across roughly 5,800 reviews.`],
  ['**Sensitive-skin alternate: ONE THING Centella Asiatica Extract**, about $12 at Olive Young, 4.6 stars across roughly 2,800 reviews.',
   `**Sensitive-skin alternate: [ONE THING Centella Asiatica Extract](${P(ID.oneThing)})**, 4.6 stars across roughly 2,800 reviews.`],
  // --- Toner section ---
  ['**Top pick: Etude SoonJung pH 5.5 Relief Toner**, about $9.50 at Olive Young, 5.0 stars across roughly 7,200 reviews. It is panthenol-led, deliberately minimal, sits at skin-appropriate pH, and is the cheapest of the set.',
   `**Top pick: [Etude SoonJung pH 5.5 Relief Toner](${P(ID.soonjung)})**, 5.0 stars across roughly 7,200 reviews. It is panthenol-led, deliberately minimal, sits at skin-appropriate pH, and is typically the most affordable of the set.`],
  ['**Redness-targeted alternate: Heimish Matcha Biome Redness Relief Hydrating Toner**, about $20 at Olive Young, 4.6 stars across roughly 5,400 reviews. Formulated for redness specifically, which is worth the extra ten dollars if erythema is your dominant complaint rather than one symptom among several.',
   `**Redness-targeted alternate: [Heimish Matcha Biome Redness Relief Hydrating Toner](${P(ID.heimish)})**, 4.6 stars across roughly 5,400 reviews. Formulated for redness specifically, which is worth paying up for if erythema is your dominant complaint rather than one symptom among several.`],
  ['**If whiteheads are the bigger problem: Dr.G R.E.D Blemish Clear Soothing Toner**, about $18 at Olive Young, 4.6 stars across roughly 5,600 reviews.',
   `**If whiteheads are the bigger problem: [Dr.G R.E.D Blemish Clear Soothing Toner](${P(ID.drg)})**, 4.6 stars across roughly 5,600 reviews.`],
  // --- Moisturizer section ---
  ['**Top pick: Real Barrier Extreme Cream**, about $22 at Olive Young, 5.0 stars across roughly 11,500 reviews, the highest-reviewed moisturizer in this whole category in our catalog.',
   `**Top pick: [Real Barrier Extreme Cream](${P(ID.realBarrier)})**, 5.0 stars across roughly 11,500 reviews, the highest-reviewed moisturizer in this whole category in our catalog.`],
  ['**Calming alternate: Aestura A-Cica 365 Calming Cream**, about $20 at Olive Young, 4.7 stars across roughly 6,100 reviews.',
   `**Calming alternate: [Aestura A-Cica 365 Calming Cream](${P(ID.aestura)})**, 4.7 stars across roughly 6,100 reviews.`],
  ['**If you are oily or breaking out: iUNIK Centella Calming Gel Cream**, about $15.50 at Olive Young, 4.6 stars across roughly 5,800 reviews.',
   `**If you are oily or breaking out: [iUNIK Centella Calming Gel Cream](${P(ID.iunikGel)})**, 4.6 stars across roughly 5,800 reviews.`],
  ['**Beplain Cicaful Calming Cream** (about $18.50, 4.7 stars, roughly 5,400 reviews)',
   `**[Beplain Cicaful Calming Cream](${P(ID.beplain)})** (4.7 stars, roughly 5,400 reviews)`],
  // --- FAQ answers ---
  ['The iUNIK Tea Tree Relief Serum (about $14 at Olive Young, roughly 6,100 reviews)',
   `The [iUNIK Tea Tree Relief Serum](${P(ID.iunikSerum)}) (roughly 6,100 reviews)`],
  ['ONE THING Centella Asiatica Extract (about $12) is a single-ingredient option',
   `[ONE THING Centella Asiatica Extract](${P(ID.oneThing)}) is a single-ingredient option`],
  ['Etude SoonJung pH 5.5 Relief Toner (about $9.50 at Olive Young, roughly 7,200 reviews)',
   `[Etude SoonJung pH 5.5 Relief Toner](${P(ID.soonjung)}) (roughly 7,200 reviews)`],
  ['the Heimish Matcha Biome Redness Relief Hydrating Toner (about $20) is formulated for it directly',
   `the [Heimish Matcha Biome Redness Relief Hydrating Toner](${P(ID.heimish)}) is formulated for it directly`],
  ['Real Barrier Extreme Cream (about $22 at Olive Young, roughly 11,500 reviews)',
   `[Real Barrier Extreme Cream](${P(ID.realBarrier)}) (roughly 11,500 reviews)`],
  ['Aestura A-Cica 365 Calming Cream (about $20) if you want centella in this step too',
   `[Aestura A-Cica 365 Calming Cream](${P(ID.aestura)}) if you want centella in this step too`],
  ['the iUNIK Centella Calming Gel Cream (about $15.50) if you are oily',
   `the [iUNIK Centella Calming Gel Cream](${P(ID.iunikGel)}) if you are oily`],
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const db = createClient(url, key);

  const { data: post, error } = await db
    .from('ss_content_posts').select('id, slug, body, updated_at').eq('slug', SLUG).single();
  if (error) throw new Error(`fetch failed: ${error.message}`);

  if (!/\$\d/.test(post.body)) { console.log('SKIP: no prose prices remain.'); return; }

  let body = post.body;
  for (const [find, repl] of EDITS) {
    const n = body.split(find).length - 1;
    if (n !== 1) throw new Error(`marker matched ${n} times (need exactly 1): "${find.slice(0, 70)}..."`);
    body = body.replace(find, repl);
  }

  const left = body.match(/\$\d[\d.]*/g) || [];
  if (left.length) throw new Error(`${left.length} prose price(s) still present: ${left.join(', ')}`);

  const ids = new Set((body.match(/\/products\/([a-f0-9-]{36})/g) || []).map(s => s.slice(10)));
  const allowed = new Set<string>(Object.values(ID));
  for (const id of ids) if (!allowed.has(id)) throw new Error(`unexpected product id: ${id}`);

  console.log(`body ${post.body.length} -> ${body.length} chars`);
  console.log(`prices removed: 17   product links added: ${ids.size} distinct`);
  if (!APPLY) { console.log('\nDRY RUN. Re-run with --apply to write.'); return; }

  const snap = `scripts/snapshots/pie-price-links-before-${post.id}-${Date.now()}.json`;
  writeFileSync(snap, JSON.stringify(post, null, 2));
  console.log(`snapshot: ${snap}`);

  const { error: upErr } = await db.from('ss_content_posts')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', post.id).eq('body', post.body);
  if (upErr) throw new Error(`update failed: ${upErr.message}`);
  console.log('WROTE.');
}
main().catch(e => { console.error(e.message); process.exit(1); });
