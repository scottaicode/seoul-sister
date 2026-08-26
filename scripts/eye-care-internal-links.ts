/**
 * Eye-care internal links + price-rule compliance — SEO Guardian bet
 * `eye-care-internal-link-authority-test` (report 2026-08-23, review 2026-09-13).
 *
 * ONE post is edited: the Korean eye-patches guide. It already recommends three
 * eye creams by name in prose and links to NONE of them, and quotes three prices
 * that no longer exist in the catalog.
 *
 * WHY ONLY ONE POST (the bet asked for two):
 * The bet also asked for a link from "the highest-traffic sebaceous-filaments
 * post ... where eye-area care is mentioned". Measured: BOTH sebaceous posts
 * contain the substring "eye" ZERO times. There is no eye-area context to link
 * from, and inserting one would be an irrelevant link on an unrelated page.
 * Reported, not forced.
 *
 * WHAT CHANGES (one paragraph):
 *   - "an eye cream" -> descriptive link to /best/eye-care, anchor
 *     "best Korean eye creams" (the anchor the bet specifies).
 *   - each of the three named creams -> link to its own product page.
 *   - three prose prices REMOVED per the Aug 25 standing rule
 *     (LGAAS-WORK-ORDER-NEVER-QUOTE-PRICES.md). All three products have NO
 *     price row in the catalog, so the figures are unverifiable, not merely
 *     stale. Ratings + review counts VERIFIED CORRECT against ss_products and
 *     kept: 4.5/5,800 · 4.5/4,800 · 4.5/3,200.
 *
 * Product ids verified is_verified=true and HTTP 200 on 2026-08-26.
 * NOTE: Mary&May ships a separate "... Eye Cream Set" SKU ($22.01). This links
 * the single unit, not the set.
 *
 * SAFETY: dry run by default; snapshot before write; idempotent (skips if the
 * marker is already gone or the eye-care link already present).
 *
 *   npx tsx scripts/eye-care-internal-links.ts           # dry run
 *   npx tsx scripts/eye-care-internal-links.ts --apply   # write
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SLUG = 'do-korean-eye-patches-actually-work-a-realistic-guide-to-whats-worth-your-money';
const APPLY = process.argv.includes('--apply');

const FIND =
  'If you want a longer-lasting version of the same actives, an eye cream is usually the better value per use, and those we can ground: the **Mizon Snail Repair Eye Cream** (about $12 at Olive Young, 4.5 stars, roughly 5,800 reviews), the **Beauty of Joseon Ginseng Eye Cream** (about $11, 4.5 stars, roughly 4,800 reviews), or the **Mary&May Tranexamic Acid + Glutathione Eye Cream** (about $12.50, 4.5 stars, roughly 3,200 reviews) if pigmentation is your specific concern.';

const REPLACE =
  'If you want a longer-lasting version of the same actives, an eye cream is usually the better value per use, and those we can ground. Our roundup of the [best Korean eye creams](https://www.seoulsister.com/best/eye-care) ranks the full category, and three are worth naming here: the [Mizon Snail Repair Eye Cream](https://www.seoulsister.com/products/de179315-d7d1-404e-bd59-ff73e28d2e35) (4.5 stars, roughly 5,800 reviews), the [Beauty of Joseon Ginseng Eye Cream](https://www.seoulsister.com/products/1b2fe74a-d3a7-4e0a-86f9-7bb0e25f6b81) (4.5 stars, roughly 4,800 reviews), or the [Mary&May Tranexamic Acid + Glutathione Eye Cream](https://www.seoulsister.com/products/81a4de39-f480-4bbf-bb5e-5e2ddada3b06) (4.5 stars, roughly 3,200 reviews) if pigmentation is your specific concern.';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key);

  const { data: post, error } = await db
    .from('ss_content_posts')
    .select('id, slug, body, updated_at')
    .eq('slug', SLUG)
    .single();

  if (error) throw new Error(`fetch failed: ${error.message}`);
  if (!post) throw new Error('post not found');

  if (post.body.includes('/best/eye-care')) {
    console.log('SKIP: /best/eye-care link already present. Nothing to do.');
    return;
  }
  const hits = post.body.split(FIND).length - 1;
  if (hits !== 1) {
    throw new Error(`expected exactly 1 match for the marker, found ${hits}. Aborting without writing.`);
  }

  const nextBody = post.body.replace(FIND, REPLACE);
  if (nextBody === post.body) throw new Error('replacement produced no change. Aborting.');

  console.log(`post ${post.id}  body ${post.body.length} -> ${nextBody.length} chars`);
  console.log(`prose prices removed: ${(FIND.match(/\$\d/g) || []).length}`);
  console.log(`links added: 4 (1 category + 3 product)`);

  if (!APPLY) {
    console.log('\nDRY RUN. Re-run with --apply to write.');
    return;
  }

  const snap = `scripts/snapshots/eye-care-links-before-${post.id}-${Date.now()}.json`;
  writeFileSync(snap, JSON.stringify(post, null, 2));
  console.log(`snapshot: ${snap}`);

  const { error: upErr } = await db
    .from('ss_content_posts')
    .update({ body: nextBody, updated_at: new Date().toISOString() })
    .eq('id', post.id)
    .eq('body', post.body); // guard: no-op if the row changed under us

  if (upErr) throw new Error(`update failed: ${upErr.message}`);
  console.log('WROTE.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
