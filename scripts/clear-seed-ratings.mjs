/**
 * Removes ratings and review counts that were typed into the launch seed
 * migrations (20260216000002, 20260219000004 to ...011) and never came from a
 * retailer. Measured Nov 14 2026.
 *
 * Rows are picked by SHAPE, never by product name:
 *
 *  A. SEEDED: created 2026-02-17 or 2026-02-19 (UTC), has a rating, has no
 *     ss_product_staging row (so no retailer scrape ever supplied one) and no
 *     member review. rating_avg -> NULL, review_count -> 0.
 *  B. ONE MEMBER REVIEW OVER A SEEDED COUNT: same origin, but a member review
 *     exists, so the review trigger already replaced rating_avg with the
 *     member average while the seeded count stayed ("5.0 from 15,201
 *     reviews" on the strength of one review). review_count -> the number of
 *     member reviews. rating_avg is left alone.
 *  C. SEEDED COUNT WITH NO RATING: same origin, no member review, rating
 *     already NULL, but the seeded review count still attached ("15,200
 *     reviews" on an unrated product). review_count -> 0. Found on the second
 *     pass: shape A required a rating and so could not see these.
 *
 * Every write is guarded on the row still holding the values read, so running
 * it twice is a no-op. Dry run by default; `--apply` writes. A full backup of
 * every touched row is written either way.
 *
 *   node --env-file=.env.local scripts/clear-seed-ratings.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SEED_DAYS = new Set(['2026-02-17', '2026-02-19'])

async function readAll(table, columns, build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(columns, { count: 'exact' }).order('id').range(from, from + 999)
    if (build) q = build(q)
    const { data, error, count } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (out.length >= (count ?? 0) || data.length === 0) {
      if (out.length !== count) throw new Error(`${table}: partial read ${out.length} of ${count}`)
      return out
    }
  }
}

const products = await readAll('ss_products', 'id, brand_en, name_en, category, created_at, rating_avg, review_count', (q) =>
  q.or('rating_avg.not.is.null,review_count.gt.0')
)
const staged = new Set(
  (await readAll('ss_product_staging', 'id, processed_product_id', (q) => q.not('processed_product_id', 'is', null))).map(
    (s) => s.processed_product_id
  )
)
const memberReviews = new Map()
for (const r of await readAll('ss_reviews', 'id, product_id')) memberReviews.set(r.product_id, (memberReviews.get(r.product_id) ?? 0) + 1)

const seeded = []
const countOnly = []
const countNoRating = []
for (const p of products) {
  if (!SEED_DAYS.has(String(p.created_at).slice(0, 10)) || staged.has(p.id)) continue
  const n = memberReviews.get(p.id) ?? 0
  const row = { id: p.id, brand: p.brand_en, name: p.name_en, category: p.category, rating_avg: p.rating_avg, review_count: p.review_count }
  if (n === 0 && p.rating_avg === null) { if (p.review_count > 0) countNoRating.push(row) }
  else if (n === 0) seeded.push(row)
  else if (p.review_count !== n) countOnly.push({ ...row, member_reviews: n })
}

console.log(`products with a rating or a review count: ${products.length}`)
console.log(`C. seeded count on an unrated product, to clear: ${countNoRating.length}`)
for (const r of countNoRating) console.log(`   ${r.brand} | ${r.name}: ${r.review_count}`)
console.log(`A. seeded rating and count, to clear: ${seeded.length}`)
console.log(`   review counts that are a multiple of 100: ${seeded.filter((r) => r.review_count % 100 === 0).length}, of 10: ${seeded.filter((r) => r.review_count % 10 === 0).length}`)
console.log(`B. member rating over a seeded count, count to correct: ${countOnly.length}`)
for (const r of countOnly) console.log(`   ${r.brand} | ${r.name}: ${r.rating_avg} from ${r.review_count} -> from ${r.member_reviews}`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportPath = new URL(`./clear-seed-ratings-${APPLY ? 'applied' : 'dryrun'}-${stamp}.json`, import.meta.url).pathname
writeFileSync(reportPath, JSON.stringify({ taken_at: new Date().toISOString(), applied: APPLY, seeded, countOnly, countNoRating }, null, 2))
console.log(`\nbackup of every touched row written: ${reportPath}`)
if (!APPLY) { console.log('Dry run. Nothing written.'); process.exit(0) }

let written = 0
const failed = []
const skipped = []
async function guarded(row, patch) {
  let q = db.from('ss_products').update(patch).eq('id', row.id).eq('review_count', row.review_count)
  q = row.rating_avg === null ? q.is('rating_avg', null) : q.eq('rating_avg', row.rating_avg)
  const { data, error } = await q.select('id')
  if (error) failed.push({ id: row.id, error: error.message })
  else if (!data?.length) skipped.push(row.id)
  else written++
}
for (const r of seeded) await guarded(r, { rating_avg: null, review_count: 0 })
for (const r of countOnly) await guarded(r, { review_count: r.member_reviews })
for (const r of countNoRating) await guarded(r, { review_count: 0 })

console.log(`written: ${written}, skipped (row changed since read): ${skipped.length}, failed: ${failed.length}`)
for (const f of failed) console.log(`  FAILED ${f.id}: ${f.error}`)
if (failed.length) process.exit(1)
