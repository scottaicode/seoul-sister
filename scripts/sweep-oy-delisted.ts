/**
 * Sweep Olive Young price rows for products that are no longer carried.
 *
 * WHY THIS EXISTS. Shipping the delisting guard does not clean the rows the bug
 * already wrote (CLAUDE.md: "a fix does NOT clean rows the bug already wrote").
 * On Aug 15 2026, two of the six products Yuri recommended to a real visitor at
 * purchase intent were already gone from Olive Young Global — including her #1
 * pick, the Dr.G RTX Peptishot, quoted confidently at $35.23.
 *
 * WHY THE NIGHTLY CRON IS NOT ENOUGH FOR THESE. The refresher's phase 1 only
 * fast-tracks products with `review_count >= 500`. Both Aug 15 rows sit far
 * below it (Dr.G 74, The Face Shop 2), so they would wait up to a full ~12-day
 * sweep before being corrected — while Yuri kept quoting a price for something
 * nobody can buy. Review count is a proxy for "what Yuri cites", and it is a
 * leaky one: she recommends on FIT, not popularity.
 *
 * WHAT IT DOES NOT DO. It never deletes a row, never nulls a price, and never
 * touches a row whose product still resolves. `in_stock: false` is a soft,
 * reversible flag — the refresher restores it to true on the next successful
 * read, because Olive Young relists.
 *
 * Usage:
 *   npx tsx scripts/sweep-oy-delisted.ts              # dry run (default)
 *   npx tsx scripts/sweep-oy-delisted.ts --apply      # write
 *   npx tsx scripts/sweep-oy-delisted.ts --limit 200  # bound the scan
 */

import { createClient } from '@supabase/supabase-js'
import { fetchOliveYoungPrice } from '../src/lib/pipeline/sources/olive-young-price-api'
import { parsePrdtNo } from '../src/lib/pipeline/olive-young-price-refresh'

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 400

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const db = createClient(url, key)

  const { data: retailer, error: rErr } = await db
    .from('ss_retailers').select('id').eq('name', 'Olive Young').single()
  if (rErr || !retailer) {
    console.error('Olive Young retailer row not found:', rErr?.message)
    process.exit(1)
  }

  // Only rows we currently advertise as buyable. A row already flagged false
  // needs no work, which makes re-running this a no-op.
  //
  // PAGINATED IN 1,000-ROW PAGES — do not replace this with a single `.limit()`.
  // PostgREST silently caps a query at 1,000 rows and reports NO error, so the
  // first version of this script asked for 5,000 and quietly processed ~1,000,
  // then printed a confident summary. It missed one of the two rows this script
  // was written to fix (The Face Shop cream, verified delisted on four separate
  // checks) while reporting success. That is the same silent cap that published
  // 2,018 dead sitemap URLs on Aug 4 2026 — documented in CLAUDE.md, and
  // reproduced here by the person who had just read it.
  const rows: Array<Record<string, unknown>> = []
  const PAGE = 1000
  for (let from = 0; from < LIMIT; from += PAGE) {
    const to = Math.min(from + PAGE, LIMIT) - 1
    const { data, error } = await db
      .from('ss_product_prices')
      .select('id, url, price_usd, in_stock, ss_products!inner(name_en, brand_en, review_count)')
      .eq('retailer_id', retailer.id)
      .eq('in_stock', true)
      .not('url', 'is', null)
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      console.error(`price scan failed at range ${from}-${to}:`, error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < to - from + 1) break // last page
  }

  // Loud coverage check. A scan that silently examined a fraction of the
  // catalog must not be able to look like a clean sweep.
  const { count: eligible } = await db
    .from('ss_product_prices')
    .select('id', { count: 'exact', head: true })
    .eq('retailer_id', retailer.id)
    .eq('in_stock', true)
    .not('url', 'is', null)
  if (eligible != null && rows.length < Math.min(eligible, LIMIT)) {
    console.error(
      `COVERAGE GAP: ${eligible} rows eligible, only ${rows.length} fetched. ` +
        `Do not treat this run as a full sweep.`
    )
  } else {
    console.log(`Coverage: ${rows.length} of ${eligible ?? '?'} eligible rows.`)
  }

  console.log(`Scanning ${rows?.length ?? 0} Olive Young rows (${APPLY ? 'APPLY' : 'DRY RUN'})\n`)

  let delisted = 0, live = 0, failed = 0, skipped = 0
  const dead: string[] = []

  for (const row of rows) {
    const prdtNo = parsePrdtNo(row.url as string | null)
    if (!prdtNo) { skipped++; continue }

    const outcome = await fetchOliveYoungPrice(prdtNo)

    // Only a CONFIRMED delisting writes. A fetch error says nothing about the
    // product — treating a timeout as "gone" would build the inverse silent
    // failure and could mark large numbers of live products dead in one run.
    if (outcome.kind === 'error') { failed++; continue }
    if (outcome.kind === 'ok') { live++; continue }

    delisted++
    const p = row.ss_products as unknown as { name_en: string; brand_en: string; review_count: number }
    dead.push(`${p.brand_en} ${p.name_en} ($${row.price_usd}, ${p.review_count} reviews)`)

    if (APPLY) {
      // Guarded on the row still being in_stock, so a concurrent run or a
      // re-run is a no-op rather than a double write.
      const { error: uErr } = await db
        .from('ss_product_prices')
        .update({ in_stock: false, last_checked: new Date().toISOString() })
        .eq('id', row.id)
        .eq('in_stock', true)
      if (uErr) console.error(`  update failed for ${row.id}: ${uErr.message}`)
    }
  }

  console.log(`\nlive=${live} delisted=${delisted} fetch_failed=${failed} no_prdtno=${skipped}`)
  if (dead.length) {
    console.log(`\nDelisted${APPLY ? ' (flagged in_stock=false)' : ' (dry run — not written)'}:`)
    for (const d of dead) console.log(`  - ${d}`)
  }
  if (!APPLY && delisted > 0) console.log('\nRe-run with --apply to write.')
}

main().catch((e) => { console.error(e); process.exit(1) })
