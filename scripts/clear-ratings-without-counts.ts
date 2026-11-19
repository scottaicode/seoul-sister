/**
 * Sweeps the rows the importer already wrote as "a rating, 0 reviews".
 * (The writer is fixed in src/lib/pipeline/stored-rating.ts; this cleans what it left.)
 *
 *   - where the import record holds a review count: restore the count, keep the rating
 *   - everywhere else: clear the rating (the figure stays in ss_product_staging.raw_data)
 *
 * Dry run by default; prints what it would change. --apply writes a snapshot first,
 * and each update only lands if the row still holds the values that were read.
 *
 *   npx tsx scripts/clear-ratings-without-counts.ts [--apply]
 */
import './load-env'
import { writeFileSync } from 'node:fs'
import { getServiceClient } from '../src/lib/supabase'

type Row = { id: string; brand_en: string; name_en: string; rating_avg: number; review_count: number }

async function main() {
  const apply = process.argv.includes('--apply')
  const db = getServiceClient()
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('ss_products').select('id, brand_en, name_en, rating_avg, review_count').not('rating_avg', 'is', null).eq('review_count', 0).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  const { count, error: cErr } = await db.from('ss_products').select('id', { count: 'exact', head: true }).not('rating_avg', 'is', null).eq('review_count', 0)
  if (cErr) throw new Error(cErr.message)
  if (count !== rows.length) throw new Error(`read ${rows.length} rows but the table holds ${count}: a partial read, stopping`)

  const staged = new Map<string, number>()
  for (let i = 0; i < rows.length; i += 100) {
    const ids = rows.slice(i, i + 100).map((r) => r.id)
    const { data, error } = await db.from('ss_product_staging').select('processed_product_id, raw_data').in('processed_product_id', ids)
    if (error) throw new Error(error.message)
    for (const s of data ?? []) {
      const n = Number((s.raw_data as { review_count?: unknown } | null)?.review_count)
      if (Number.isFinite(n) && n > 0) staged.set(s.processed_product_id as string, Math.max(staged.get(s.processed_product_id as string) ?? 0, Math.round(n)))
    }
  }
  const restore = rows.filter((r) => staged.has(r.id))
  const clear = rows.filter((r) => !staged.has(r.id))
  console.log(`${rows.length} rows hold a rating with 0 reviews`)
  console.log(`  restore the count from the import record: ${restore.length}`)
  for (const r of restore) console.log(`    ${r.brand_en} | ${r.name_en}: ${r.rating_avg}, 0 -> ${staged.get(r.id)} reviews`)
  console.log(`  clear the rating: ${clear.length}`)
  for (const r of clear.slice(0, 8)) console.log(`    ${r.brand_en} | ${r.name_en}: ${r.rating_avg} -> none`)
  if (!apply) return console.log('Dry run. Nothing changed.')

  const snapshot = `scripts/backup-ratings-without-counts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(snapshot, JSON.stringify(rows, null, 1))
  console.log(`snapshot: ${snapshot}`)
  let done = 0
  let failed = 0
  for (const r of rows) {
    const change = staged.has(r.id) ? { review_count: staged.get(r.id) } : { rating_avg: null }
    const { data, error } = await db.from('ss_products').update(change).eq('id', r.id).eq('review_count', 0).eq('rating_avg', r.rating_avg).select('id')
    if (error || data?.length !== 1) { failed++; console.log(`FAILED ${r.id}: ${error?.message ?? 'row had changed'}`) } else done++
  }
  const { count: left } = await db.from('ss_products').select('id', { count: 'exact', head: true }).not('rating_avg', 'is', null).eq('review_count', 0)
  console.log(`updated ${done}, failed ${failed}, rows still holding a rating with 0 reviews: ${left}`)
  if (failed || left) process.exit(1)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
