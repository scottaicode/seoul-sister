/**
 * Correct catalog brands that the Feb 19 2026 Olive Young scrape got wrong.
 *
 * Found Nov 13 2026: a member was recommended "Anua Retinal Skin Booster
 * Serum" and "Beplain Phytoncide Mild Cleansing Foam". The products are real,
 * but they are Meditherapy's and KLAVUU's. The scraper saved the true brand as
 * the front of the product title ("KLAVUU Phytoncide Mild Cleansing Foam
 * 150mL") beside a wrong `brand_en` ("beplain"); processing stripped the real
 * brand off the name and kept the wrong one.
 *
 * WHAT THIS FIXES, and only this: a product whose stored brand
 *   (a) does not appear anywhere in the scraped title, AND
 *   (b) is one of the brands the bug attached to many other brands' products
 *       (the cluster below, measured), AND
 *   (c) whose stored name sits inside the scraped title with text in front of
 *       it, which is then the true brand.
 * Everything else that looks odd is REPORTED, not changed: a classifier that
 * needs hand-tuning is the signal to stop, not to keep adjusting.
 *
 * Dry run by default; `--apply` writes. A backup is written first, every
 * update is guarded on the row still holding the wrong brand, and a second
 * run changes nothing.
 *
 *   node --env-file=.env.local scripts/fix-wrong-brand-feb19-scrape.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Brands the bug attached to at least 8 products of other brands (measured
// Nov 13 2026). A stored brand outside this list is left alone.
const ABSORBING = new Set(['anua', 'beplain', 'aestura', 'careplus', 'banilaco', 'centellian24', 'medicube', 'ilso', 'ariul', 'boho'])

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function editDistance(a, b) {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

async function readAll(table, columns, build) {
  const out = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns, { count: 'exact' }).order('id').range(from, from + PAGE - 1)
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

const staging = await readAll('ss_product_staging', 'id, source_id, raw_data, processed_product_id', (q) =>
  q.eq('source', 'olive_young').not('processed_product_id', 'is', null)
)
const products = await readAll('ss_products', 'id, brand_en, name_en')
const byId = new Map(products.map((p) => [p.id, p]))

// How a brand is spelled on products this script does NOT consider wrong.
const candidateIds = new Set()
const rows = []
for (const s of staging) {
  const p = byId.get(s.processed_product_id)
  const rawName = s.raw_data?.name_en
  if (!p || typeof rawName !== 'string' || !p.brand_en || !p.name_en) continue
  if (norm(rawName).includes(norm(p.brand_en))) continue
  candidateIds.add(p.id)
  rows.push({ p, rawName, sourceId: s.source_id })
}
const spelling = new Map()
for (const p of products) {
  if (candidateIds.has(p.id) || !p.brand_en) continue
  const k = norm(p.brand_en)
  if (k && !spelling.has(k)) spelling.set(k, p.brand_en)
}
const existing = new Set(products.map((p) => `${norm(p.brand_en)}|${(p.name_en ?? '').toLowerCase()}`))

const fix = []
const skipped = { not_in_cluster: [], name_at_start: [], name_not_in_title: [], unusable_prefix: [], near_same_brand: [], would_duplicate: [] }
const seen = new Set()
for (const { p, rawName, sourceId } of rows) {
  if (seen.has(p.id)) continue
  seen.add(p.id)
  const item = { id: p.id, stored_brand: p.brand_en, name: p.name_en, scraped_title: rawName, source_id: sourceId }
  if (!ABSORBING.has(norm(p.brand_en))) { skipped.not_in_cluster.push(item); continue }
  const pos = rawName.toLowerCase().indexOf(p.name_en.toLowerCase())
  if (pos === 0) { skipped.name_at_start.push(item); continue }
  if (pos < 0) { skipped.name_not_in_title.push(item); continue }
  // "OGANACELL New Peptide ..." -> OGANACELL; "NANO RECIPE." -> NANO RECIPE.
  const prefix = rawName.slice(0, pos).replace(/[\s\-·:|]+$/u, '').replace(/\s+new$/i, '').replace(/\.$/, '').trim()
  // "The Phi Hyaluronic ..." leaves only "The": not a brand anyone can check.
  if (prefix.length < 2 || prefix.length > 30 || /[[\]#()]/.test(prefix) || !/[A-Za-z]/.test(prefix) || /^(the|new|a|an|my)$/i.test(prefix)) {
    skipped.unusable_prefix.push({ ...item, prefix }); continue
  }
  // A misspelling of the same brand is not a different brand.
  if (editDistance(norm(prefix), norm(p.brand_en)) <= 2) { skipped.near_same_brand.push({ ...item, prefix }); continue }
  const brand = spelling.get(norm(prefix)) ?? prefix
  if (existing.has(`${norm(brand)}|${p.name_en.toLowerCase()}`)) { skipped.would_duplicate.push({ ...item, true_brand: brand }); continue }
  fix.push({ ...item, true_brand: brand })
}
// One spelling per brand among the fixes: the scrape wrote "BOTANITY" and
// "Botanity" for the same brand. The most common spelling wins.
{
  const votes = new Map()
  for (const f of fix) {
    const k = norm(f.true_brand)
    if (!votes.has(k)) votes.set(k, new Map())
    votes.get(k).set(f.true_brand, (votes.get(k).get(f.true_brand) ?? 0) + 1)
  }
  for (const f of fix) {
    const options = [...votes.get(norm(f.true_brand)).entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    f.true_brand = spelling.get(norm(f.true_brand)) ?? options[0][0]
  }
}

console.log(`staging rows read: ${staging.length}; products read: ${products.length}`)
console.log(`stored brand absent from the scraped title: ${seen.size}`)
console.log(`WILL FIX: ${fix.length}`)
for (const [k, v] of Object.entries(skipped)) console.log(`  left alone, ${k}: ${v.length}`)
const byOld = {}
for (const f of fix) byOld[f.stored_brand] = (byOld[f.stored_brand] ?? 0) + 1
console.log('by wrong brand:', JSON.stringify(byOld))
console.log('distinct true brands:', new Set(fix.map((f) => norm(f.true_brand))).size)
console.log('\nsample of fixes:')
for (const f of fix.filter((_, i) => i % Math.max(1, Math.floor(fix.length / 25)) === 0).slice(0, 25)) {
  console.log(`  ${f.stored_brand} -> ${f.true_brand} | ${f.name}`)
}
for (const id of ['47a30169-2dad-4940-a36c-021871d9d050', '5a34940f-5982-4545-a170-a9c2e1adb741']) {
  const f = fix.find((x) => x.id === id)
  console.log(`known case ${id.slice(0, 8)}: ${f ? `${f.stored_brand} -> ${f.true_brand} | ${f.name}` : 'NOT IN FIX LIST'}`)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportPath = new URL(`./wrong-brand-feb19-${APPLY ? 'applied' : 'dryrun'}-${stamp}.json`, import.meta.url).pathname
writeFileSync(reportPath, JSON.stringify({ taken_at: new Date().toISOString(), applied: APPLY, fix, skipped }, null, 2))
console.log(`\nfull list written: ${reportPath}`)

if (!APPLY) {
  console.log('Dry run. Nothing written. Re-run with --apply to write.')
  process.exit(0)
}

let written = 0
const failed = []
for (const f of fix) {
  const { data, error } = await db
    .from('ss_products')
    .update({ brand_en: f.true_brand })
    .eq('id', f.id)
    .eq('brand_en', f.stored_brand)
    .select('id')
  if (error) failed.push(`${f.id}: ${error.message}`)
  else if (!data || data.length !== 1) failed.push(`${f.id}: brand changed since it was read, not written`)
  else written++
}
console.log(`written: ${written} of ${fix.length}`)
for (const m of failed) console.log(' - ' + m)

const ids = fix.map((f) => f.id)
let wrongLeft = 0
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db.from('ss_products').select('id, brand_en').in('id', ids.slice(i, i + 200))
  if (error) { console.error('verification read failed:', error.message); process.exit(1) }
  const want = new Map(fix.map((f) => [f.id, f.true_brand]))
  wrongLeft += data.filter((r) => r.brand_en !== want.get(r.id)).length
}
console.log(`verified from the database: rows not holding the intended brand ${wrongLeft}`)
process.exit(failed.length || wrongLeft ? 1 : 0)
