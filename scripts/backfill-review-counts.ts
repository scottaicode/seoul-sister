/**
 * Restore review_count (and rating_avg) that a Feb 20-21 2026 import dropped.
 *
 * FOUND Sept 5 2026, from a real widget conversation. A cold visitor asked where
 * to start with K-beauty; Yuri recommended a sunscreen with `review_count: 0`.
 * The product has 8 real reviews in ss_product_staging. She was reasoning
 * correctly over a column that had been silently emptied six months earlier.
 *
 * THE MECHANISM (src/lib/pipeline/batch-processor.ts:234):
 *     review_count: data.review_count != null ? Math.round(data.review_count) : 0
 * A missing count is written as `0` — a positive assertion of "no reviews" —
 * rather than NULL. `rating_avg` on the line above has no such coercion, which is
 * exactly why ratings mostly survived and counts did not. This is the repo's
 * documented "absent must read as absent" class (see inci_complete vouching for
 * an EMPTY list). The 0-vs-NULL coercion is NOT fixed here; this script is the
 * sweep for rows the bug already wrote. Fixing the writer is separate work.
 *
 * WHY IT MATTERS: 552 of 623 verified sunscreens are genuinely reviewed and only
 * 54 say so; 82 have 500+ reviews reading as none. Beauty of Joseon Relief Sun
 * (8,341) and SKIN1004 Water-Fit (10,161) both read as 0, so no ranking or
 * honesty rule anywhere can tell a 10,000-review flagship from a brand-new SKU.
 *
 * A CLAIM I GOT WRONG, recorded so it is not repeated: I first reported that
 * "unreviewed rows outrank reviewed ones" from a 4.65-vs-4.49 rating split. An
 * adversarial review refuted it and was right — that compared 571 SCRAPED rows
 * against 52 SEED rows, and 47 of the 49 seed counts are round hundreds
 * (5,200 / 11,200), i.e. estimates, while scraped counts are exact. Different
 * populations. The rating side is fine; only the count column is wrong.
 *
 * I ALSO MISDIAGNOSED THE INCIDENT. The visitor's sunscreen came back wrong
 * because of term scoring, not rating: "no white cast" tokenizes to include
 * "no", `SEARCH_STOP_WORDS` does not contain it, `termMatches` is a bare
 * substring test, and a brand hit scores 3 against a name hit's 1 — so COSNORI
 * ("cos-NO-ri") scored 3 and beat every real match. Reproduced in SQL: it wins
 * outright, and Haruharu (5,200 reviews) and Innisfree (5,600) sat in the same
 * window at score 2. This backfill does NOT fix that; it is filed separately.
 * Restoring the counts is still a precondition — before it, nothing downstream
 * can distinguish 2 reviews from 10,161.
 *
 * BLAST RADIUS, measured not assumed:
 *   - 1,967 products lost review_count, 196 lost rating_avg.
 *   - Every loss falls on Feb 20-21 2026. Feb 19 was clean (3,024 rows, 0 lost)
 *     and every date since is clean. A dormant historical bug, not a live leak.
 *   - No affected product was ever re-staged, so there is exactly one staging
 *     row per product and no "which snapshot wins" ambiguity.
 *
 * WHY STAGING IS TRUSTED: on the 2,719 products whose count DID copy, staging
 * matches ss_products EXACTLY 2,719/2,719, zero disagreements in either
 * direction. For rating the control is 4,874 match / 45 mismatch (99.1%), so
 * rating is restored ONLY where the live value is NULL — never overwritten.
 *
 * WHY PRICE IS EXCLUDED: the same bug dropped 480 price_usd values, and it is
 * tempting to sweep them in the same pass. Measured: all 480 already carry a
 * live row in ss_product_prices, and the Feb staging price averages $6.27 HIGHER
 * than the current one. Writing them would inject six-month-old overquotes into
 * the column the v11.28.0 price work just repaired. Price is left alone.
 *
 * STALENESS, stated honestly: these are February figures, ~6.5 months old, and
 * no newer source carries a review count (ss_trending_products has none). Review
 * counts only grow, so a restored value UNDERSTATES reality. Under-crediting a
 * proven product is the safe direction; the alternative is the status quo, where
 * an 8,341-review product claims to have none.
 *
 * SAFETY: every update is guarded on the row still holding the bad value
 * (review_count = 0 / rating_avg IS NULL), so re-running is a no-op and a row
 * that has since been fixed by any other path is never clobbered.
 *
 * Dry run:  npx tsx scripts/backfill-review-counts.ts
 * Apply:    npx tsx scripts/backfill-review-counts.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

/** PostgREST silently caps at 1,000 rows and reports no error. This repo has
 *  been bitten twice (2,018 dead sitemap URLs Aug 4; a delisting sweep that
 *  reported success over a fifth of the catalog Aug 15). Page explicitly and
 *  verify the total against an exact count. */
const PAGE = 500

type StagingRow = {
  processed_product_id: string
  raw_data: Record<string, unknown> | null
}

async function fetchAllStaging(): Promise<StagingRow[]> {
  const rows: StagingRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('ss_product_staging')
      .select('processed_product_id, raw_data')
      .not('processed_product_id', 'is', null)
      .order('processed_product_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`staging fetch failed at ${from}: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as StagingRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

type ProductRow = {
  id: string
  name_en: string | null
  brand_en: string | null
  category: string | null
  review_count: number | null
  rating_avg: number | null
  volume_display: string | null
}

async function fetchAllProducts(): Promise<Map<string, ProductRow>> {
  const map = new Map<string, ProductRow>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('ss_products')
      .select('id, name_en, brand_en, category, review_count, rating_avg, volume_display')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`products fetch failed at ${from}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const p of data as ProductRow[]) map.set(p.id, p)
    if (data.length < PAGE) break
  }
  return map
}

/** Staging review_count must be a clean non-negative integer. A string, a float,
 *  or anything unparseable is SKIPPED rather than coerced — the whole defect
 *  being repaired is a coercion that turned "unknown" into a confident 0. */
function parseCount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : null
  if (typeof v === 'string' && /^[0-9]+$/.test(v)) return parseInt(v, 10)
  return null
}

function parseRating(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n) || n <= 0 || n > 5) return null
  return Math.round(n * 10) / 10
}

function parseVolume(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 && t.length <= 100 ? t : null
}

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (no writes) ===')

  const { count: exactStaging, error: cErr } = await db
    .from('ss_product_staging')
    .select('*', { count: 'exact', head: true })
    .not('processed_product_id', 'is', null)
  if (cErr) throw new Error(`count failed: ${cErr.message}`)

  const staging = await fetchAllStaging()
  console.log(`staging rows: fetched ${staging.length}, exact count ${exactStaging}`)
  if (exactStaging != null && staging.length !== exactStaging) {
    console.error(`ABORT: partial scan (${staging.length}/${exactStaging}). Refusing to write.`)
    process.exit(1)
  }

  const products = await fetchAllProducts()
  console.log(`products loaded: ${products.size}`)

  // A product with more than one staging row makes "which snapshot wins"
  // ambiguous, so those products are SKIPPED rather than guessed at.
  //
  // A first pass asserted this set was empty — a SQL check had counted distinct
  // products rather than rows per product, and the assertion caught what the
  // query missed. There are 6, all staged the same day (so no "newest wins"
  // rule is available), and they are genuinely two different Olive Young
  // listings collapsed onto one catalog row: Rovectin Dr. Mask Cica appears as
  // both 67 and 34 reviews, AIDA Propolis Biome Mask as both null and 547.
  // Picking either would be inventing a number. Six rows is not worth a
  // resolution heuristic; they are listed at the end for a human to settle.
  const seen = new Set<string>()
  const ambiguous = new Set<string>()
  for (const s of staging) {
    if (seen.has(s.processed_product_id)) ambiguous.add(s.processed_product_id)
    seen.add(s.processed_product_id)
  }

  const countFixes: Array<{ id: string; label: string; from: number | null; to: number }> = []
  const ratingFixes: Array<{ id: string; label: string; to: number }> = []
  const volumeFixes: Array<{ id: string; label: string; to: string }> = []
  let noStagingValue = 0
  let alreadyCorrect = 0

  for (const s of staging) {
    if (ambiguous.has(s.processed_product_id)) continue
    const p = products.get(s.processed_product_id)
    if (!p || !s.raw_data) continue
    const label = `${p.brand_en ?? '?'} ${p.name_en ?? '?'} [${p.category ?? '?'}]`

    const stagedCount = parseCount(s.raw_data.review_count)
    if (stagedCount === null) {
      noStagingValue++
    } else if (stagedCount > 0 && (p.review_count ?? 0) === 0) {
      countFixes.push({ id: p.id, label, from: p.review_count, to: stagedCount })
    } else {
      alreadyCorrect++
    }

    // Rating is restored ONLY into a NULL. The control is 99.1% rather than
    // 100%, so an existing live value always wins over a six-month-old one.
    const stagedRating = parseRating(s.raw_data.rating_avg)
    if (stagedRating !== null && p.rating_avg === null) {
      ratingFixes.push({ id: p.id, label, to: stagedRating })
    }

    // volume_display is the CLEANEST fingerprint of this bug: it is NULL on
    // 1,967 of 1,967 affected rows (100%) against 3 of 2,719 controls (0.1%).
    // An adversarial review caught that a script repairing only review_count
    // would fix one of several dropped columns and read as "the Feb bug is
    // closed". Restored only into a NULL, same as rating.
    const stagedVolume = parseVolume(s.raw_data.volume_display)
    if (stagedVolume !== null && p.volume_display === null) {
      volumeFixes.push({ id: p.id, label, to: stagedVolume })
    }
  }

  const totalReviews = countFixes.reduce((a, f) => a + f.to, 0)
  console.log(`\nreview_count to restore : ${countFixes.length} products (${totalReviews.toLocaleString()} reviews)`)
  console.log(`rating_avg to restore   : ${ratingFixes.length} products`)
  console.log(`volume_display restore  : ${volumeFixes.length} products`)
  console.log(`staging had no usable count: ${noStagingValue}`)
  console.log(`already correct / nothing to do: ${alreadyCorrect}`)
  console.log(`SKIPPED (ambiguous, >1 staging row): ${ambiguous.size} — listed below`)

  const byCat = new Map<string, { n: number; reviews: number }>()
  for (const f of countFixes) {
    const cat = f.label.match(/\[([^\]]+)\]$/)?.[1] ?? '?'
    const e = byCat.get(cat) ?? { n: 0, reviews: 0 }
    e.n++
    e.reviews += f.to
    byCat.set(cat, e)
  }
  console.log('\nby category:')
  for (const [cat, e] of [...byCat.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${cat.padEnd(16)} ${String(e.n).padStart(5)} products  ${e.reviews.toLocaleString().padStart(9)} reviews`)
  }

  console.log('\ntop 15 by restored review count:')
  for (const f of [...countFixes].sort((a, b) => b.to - a.to).slice(0, 15)) {
    console.log(`  ${String(f.to).padStart(6)}  ${f.label}`)
  }

  if (ambiguous.size > 0) {
    console.log('\nskipped as ambiguous (needs a human; two listings on one catalog row):')
    for (const id of ambiguous) {
      const p = products.get(id)
      const vals = staging
        .filter((s) => s.processed_product_id === id)
        .map((s) => String(s.raw_data?.review_count ?? 'null'))
        .join(' vs ')
      console.log(`  ${p?.brand_en ?? '?'} ${p?.name_en ?? '?'} — staged counts: ${vals}`)
    }
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write.')
    return
  }

  let ok = 0
  let failed = 0
  for (const f of countFixes) {
    // Guarded on the row STILL holding the bad value, so re-running is a no-op
    // and a row fixed by another path in the meantime is never clobbered.
    const { error } = await db
      .from('ss_products')
      .update({ review_count: f.to })
      .eq('id', f.id)
      .eq('review_count', 0)
    if (error) {
      failed++
      console.error(`  FAILED review_count ${f.id}: ${error.message}`)
    } else ok++
  }
  console.log(`\nreview_count updated: ${ok}, failed: ${failed}`)

  let rOk = 0
  let rFailed = 0
  for (const f of ratingFixes) {
    const { error } = await db
      .from('ss_products')
      .update({ rating_avg: f.to })
      .eq('id', f.id)
      .is('rating_avg', null)
    if (error) {
      rFailed++
      console.error(`  FAILED rating_avg ${f.id}: ${error.message}`)
    } else rOk++
  }
  console.log(`rating_avg updated: ${rOk}, failed: ${rFailed}`)

  let vOk = 0
  let vFailed = 0
  for (const f of volumeFixes) {
    const { error } = await db
      .from('ss_products')
      .update({ volume_display: f.to })
      .eq('id', f.id)
      .is('volume_display', null)
    if (error) {
      vFailed++
      console.error(`  FAILED volume_display ${f.id}: ${error.message}`)
    } else vOk++
  }
  console.log(`volume_display updated: ${vOk}, failed: ${vFailed}`)

  // A run whose writes all failed must not read as success. This is the price
  // refresher's failure letter-for-letter: status 'completed' over total failure.
  if (failed > 0 || rFailed > 0 || vFailed > 0) {
    console.error('\nFAILED: some writes did not land. Re-run to retry (updates are idempotent).')
    process.exit(1)
  }
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
