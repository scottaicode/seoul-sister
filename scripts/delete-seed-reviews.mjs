/**
 * Removes the launch seed reviews and everything derived from them.
 *
 * Measured Nov 15 2026: every row in ss_reviews (20, one per product) was
 * written in February 2026 under the owner's and one insider's account from a
 * template (scripts/seed-community-reviews.ts and
 * scripts/seed/seed-images-reviews-trending.sql). They are not member
 * reviews. The rating trigger set those 20 products' stars from them, and 18
 * ss_product_effectiveness rows (sample size 1, same skin type as the seeded
 * review, no member reaction behind them) were computed from them.
 *
 * Picked by SHAPE, and it stops if the shape is not what was measured:
 *   - a review is a seed if it was created before 2026-03-01;
 *   - the script refuses to run if any review is newer than that (a real
 *     member review may exist by then; look before deleting);
 *   - a product's rating is cleared only if it has no retailer scrape behind it;
 *   - an effectiveness row goes only if it sits on a seeded-review product,
 *     has sample size 1, and no member reaction exists for that product.
 *
 * Owner approved Nov 15 2026. Dry run by default; `--apply` writes. A backup
 * of every row touched is written either way.
 *
 *   node --env-file=.env.local scripts/delete-seed-reviews.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const SEED_BEFORE = '2026-03-01T00:00:00Z'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const must = ({ data, error, count }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return { data, count }
}

const { data: reviews, count: reviewTotal } = must(
  await db.from('ss_reviews').select('*', { count: 'exact' }).order('created_at').range(0, 999),
  'read reviews'
)
if (reviews.length !== reviewTotal) throw new Error(`partial read of reviews: ${reviews.length} of ${reviewTotal}`)
const newer = reviews.filter((r) => new Date(r.created_at) >= new Date(SEED_BEFORE))
if (newer.length) throw new Error(`${newer.length} review(s) are newer than ${SEED_BEFORE}; they may be real. Nothing changed.`)
const authors = new Set(reviews.map((r) => r.user_id))
if (authors.size > 2) throw new Error(`${authors.size} different authors; measured shape was 2. Nothing changed.`)

const productIds = [...new Set(reviews.map((r) => r.product_id))]
const { data: products } = must(
  await db.from('ss_products').select('id, brand_en, name_en, rating_avg, review_count').in('id', productIds),
  'read products'
)
const { data: staged } = must(
  await db.from('ss_product_staging').select('processed_product_id').in('processed_product_id', productIds),
  'read staging'
)
const hasRetailerRating = new Set(staged.map((s) => s.processed_product_id))
const { data: reactions } = must(
  await db.from('ss_user_product_reactions').select('product_id').in('product_id', productIds),
  'read reactions'
)
const hasReaction = new Set(reactions.map((r) => r.product_id))
const { data: effAll } = must(
  await db.from('ss_product_effectiveness').select('*').in('product_id', productIds),
  'read effectiveness'
)
const effectiveness = effAll.filter((e) => e.sample_size === 1 && !hasReaction.has(e.product_id))
const clearRating = products.filter((p) => !hasRetailerRating.has(p.id))

console.log(`seed reviews to delete: ${reviews.length} (authors: ${authors.size}, newest ${reviews.at(-1)?.created_at})`)
console.log(`products whose rating came only from them, to clear: ${clearRating.length} of ${products.length}`)
console.log(`effectiveness rows derived from them, to delete: ${effectiveness.length} of ${effAll.length} on those products`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const path = new URL(`./delete-seed-reviews-${APPLY ? 'applied' : 'dryrun'}-${stamp}.json`, import.meta.url).pathname
writeFileSync(path, JSON.stringify({ taken_at: new Date().toISOString(), applied: APPLY, reviews, products, effectiveness }, null, 1))
console.log(`backup written: ${path}`)
if (!APPLY) { console.log('Dry run. Nothing changed.'); process.exit(0) }

const del = async (table, ids, what) => {
  if (!ids.length) return 0
  const { data } = must(await db.from(table).delete().in('id', ids).select('id'), what)
  return data.length
}
console.log(`effectiveness rows deleted: ${await del('ss_product_effectiveness', effectiveness.map((e) => e.id), 'delete effectiveness')}`)
console.log(`reviews deleted: ${await del('ss_reviews', reviews.map((r) => r.id), 'delete reviews')}`)
// The count trigger has already subtracted each deleted review; the rating
// trigger deliberately leaves the last rating in place, so clear it here.
const { data: cleared } = must(
  await db.from('ss_products').update({ rating_avg: null, review_count: 0 }).in('id', clearRating.map((p) => p.id)).select('id'),
  'clear ratings'
)
console.log(`product ratings cleared: ${cleared.length}`)

const { count: left } = must(await db.from('ss_reviews').select('id', { count: 'exact', head: true }), 'verify reviews')
const { data: still } = must(
  await db.from('ss_products').select('id').in('id', clearRating.map((p) => p.id)).or('rating_avg.not.is.null,review_count.gt.0'),
  'verify products'
)
console.log(`verify: reviews left ${left}; cleared products still carrying a figure ${still.length}`)
if (left !== 0 || still.length) process.exit(1)
