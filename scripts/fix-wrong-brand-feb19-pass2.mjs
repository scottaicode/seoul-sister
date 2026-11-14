/**
 * Second pass on the Feb 19 2026 wrong-brand rows (see
 * fix-wrong-brand-feb19-scrape.mjs for the cause and the first pass).
 *
 * The first pass fixed rows whose stored name sat inside the scraped title
 * with the true brand in front of it. This pass handles the two shapes it
 * left alone, still only for the brands the bug attached to other brands'
 * products:
 *
 *  A. The stored name differs slightly from the title ("#Small" vs "Small",
 *     a dropped "Set"), so it was not found as a substring. The words are
 *     aligned instead; the title's words before the name are the brand.
 *  B. The true brand is still the first word(s) of the stored NAME
 *     ("Hyggee Repair Serum" filed under Anua). The brand is taken only when
 *     those leading words are a brand the catalog already knows; the name
 *     loses them.
 *
 * Anything else is reported, not changed. Dry run by default; `--apply` writes.
 *
 *   node --env-file=.env.local scripts/fix-wrong-brand-feb19-pass2.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ABSORBING = new Set(['anua', 'beplain', 'aestura', 'careplus', 'banilaco', 'centellian24', 'medicube', 'ilso', 'ariul', 'boho'])
const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const words = (s) => (s ?? '').split(/\s+/).filter(Boolean)

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

const staging = await readAll('ss_product_staging', 'id, source_id, raw_data, processed_product_id', (q) =>
  q.eq('source', 'olive_young').not('processed_product_id', 'is', null)
)
const products = await readAll('ss_products', 'id, brand_en, name_en')
const byId = new Map(products.map((p) => [p.id, p]))

const candidates = []
const seen = new Set()
for (const s of staging) {
  const p = byId.get(s.processed_product_id)
  const title = s.raw_data?.name_en
  if (!p || typeof title !== 'string' || !p.brand_en || !p.name_en || seen.has(p.id)) continue
  if (norm(title).includes(norm(p.brand_en)) || !ABSORBING.has(norm(p.brand_en))) continue
  seen.add(p.id)
  candidates.push({ p, title, sourceId: s.source_id })
}
const candidateIds = new Set(candidates.map((c) => c.p.id))

// Brands the catalog knows, spelled as on rows this pass does not touch.
// Counted, so a brand seen once on one odd row is not treated as known.
const known = new Map()
for (const p of products) {
  if (candidateIds.has(p.id) || !p.brand_en) continue
  const k = norm(p.brand_en)
  if (k.length < 3) continue
  const e = known.get(k) ?? { spelling: p.brand_en, n: 0 }
  e.n++
  known.set(k, e)
}
const existing = new Set(products.map((p) => `${norm(p.brand_en)}|${norm(p.name_en)}`))

const usableBrand = (b) => b.length >= 2 && b.length <= 30 && !/[[\]#()]/.test(b) && /[A-Za-z]/.test(b) && !/^(the|new|a|an|my)$/i.test(b)

const fix = []
const left = { no_alignment_no_known_brand: [], unusable: [], would_duplicate: [], name_would_be_empty: [] }
for (const { p, title, sourceId } of candidates) {
  const item = { id: p.id, stored_brand: p.brand_en, stored_name: p.name_en, scraped_title: title, source_id: sourceId }
  const tWords = words(title)
  const nWords = words(p.name_en)
  const t = tWords.map(norm)
  const n = nWords.map(norm).filter(Boolean)
  if (!n.length) { left.unusable.push(item); continue }

  // A: where do the name's first words start inside the title?
  let at = -1
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== n[0]) continue
    if (n.length > 1 && i + 1 < t.length && t[i + 1] !== n[1]) continue
    at = i
    break
  }
  if (at > 0) {
    const brandRaw = tWords.slice(0, at).join(' ').replace(/[\s\-·:|]+$/u, '').replace(/\s+new$/i, '').replace(/\.$/, '').trim()
    if (!usableBrand(brandRaw)) { left.unusable.push({ ...item, prefix: brandRaw }); continue }
    const brand = known.get(norm(brandRaw))?.spelling ?? brandRaw
    if (existing.has(`${norm(brand)}|${norm(p.name_en)}`)) { left.would_duplicate.push({ ...item, true_brand: brand }); continue }
    fix.push({ ...item, shape: 'A', true_brand: brand, new_name: p.name_en })
    continue
  }

  // B: the name itself starts with a brand the catalog knows (longest match).
  let hit = null
  for (let k = Math.min(4, nWords.length - 1); k >= 1; k--) {
    const lead = norm(nWords.slice(0, k).join(''))
    const e = known.get(lead)
    if (e && e.n >= 1 && !ABSORBING.has(lead)) { hit = { k, brand: e.spelling }; break }
  }
  // Or, failing that, the title's own first word when the name begins with it
  // and the title carries the same word as its first word (Olive Young titles
  // lead with the brand). Only a single, distinctive word is accepted.
  if (!hit && at === 0 && nWords.length >= 3 && /^[A-Za-z][A-Za-z0-9'&+.:-]{2,}$/.test(nWords[0])) {
    const sameLead = candidates.filter((c) => norm(words(c.p.name_en)[0]) === n[0]).length
    if (sameLead >= 2) hit = { k: 1, brand: tWords[0].replace(/\.$/, '') }
  }
  if (!hit) { left.no_alignment_no_known_brand.push(item); continue }
  const newName = nWords.slice(hit.k).join(' ').trim()
  if (newName.length < 3) { left.name_would_be_empty.push({ ...item, true_brand: hit.brand }); continue }
  if (!usableBrand(hit.brand)) { left.unusable.push({ ...item, prefix: hit.brand }); continue }
  if (existing.has(`${norm(hit.brand)}|${norm(newName)}`)) { left.would_duplicate.push({ ...item, true_brand: hit.brand, new_name: newName }); continue }
  fix.push({ ...item, shape: 'B', true_brand: hit.brand, new_name: newName })
}

// ---- Corrections read by eye from the dry run (Nov 13 2026) ----------------
// The rule split three multi-word brands after their first word, and took a
// retailer badge for a brand.
const MULTIWORD = [
  { lead: 'Black Monster ', brand: 'Black Monster' },
  { lead: 'Cell In Shot ', brand: 'Cell In Shot' },
]
for (const f of fix) {
  const m = MULTIWORD.find((x) => f.stored_name.startsWith(x.lead))
  if (m) { f.true_brand = m.brand; f.new_name = f.stored_name.slice(m.lead.length).trim(); f.shape = 'hand' }
  if (/[★☆]/.test(f.true_brand) && f.stored_name.startsWith('Acropass ')) {
    f.true_brand = 'Acropass'; f.new_name = f.stored_name.slice('Acropass '.length).trim(); f.shape = 'hand'
  }
}
// Rows the rule could not place, where the scraped title is unambiguous. Brand
// and name are both taken from the title (the stored name had been rewritten
// into a different, better-known product: "Atobarrier 365", "Clean It Zero").
const BY_HAND = {
  'Banila Co|Clean & Glow Green Barley LHA Deep Cleansing Oil Set': ['Veganifect', 'Clean & Glow Green Barley LHA Deep Cleansing Oil Set'],
  'Aestura|Aepiderm EGF Skin Barrier Hydrating Cream': ['Z+Piderm', 'EGF Skin Barrier Hydrating Cream'],
  'Anua|Vari:Hope AHA BHA PHA Refining Boost Serum': ['VARI:HOPE', 'AHA BHA PHA Refining Boost Serum'],
  'Anua|Heartleaf Ampoule Serum': ['The Harnay', 'Ampoule Serum Special Set'],
  'Aestura|Aestura Uno Skin Serum Duo Set': ['UNO', 'Skin Serum Duo Set'],
  'Beplain|Organacell Derx Calm Active Cleanser': ['OGANACELL', 'DERX Calm Active Cleanser'],
  'Aestura|Atobarrier 365 Water-Bag Barrier Cream': ['plodica', 'Water-bag Barrier Cream'],
  'Banila Co|Grain Cleansing Oil Special Set': ["LASSIE'EL", 'Grain Cleansing Oil Special Set'],
  'CAREPLUS|AC Magnesium Patch Small': ['Snow2plus', 'AC Magnesium Patch Small'],
  'Beplain|Menthology Super Cool Cleansing Foam': ['Menthology', 'Super Cool Cleansing Foam'],
  'Aestura|Dr.Iaso Complete Moisturizer EX': ['Dr.IASO', 'Complete Moisturizer EX'],
  'Aestura|NuTexture Comforting Cream': ['NuTexture', 'Comforting Cream'],
  'Banila Co|Clean It Zero Cleansing Balm White': ['SHHOM', 'White Vegan Cleansing Balm Double Pack'],
  'Anua|Vitamin C 15% Super Blast Ampoule': ['ZIGTAG', 'Vitamin C 15% Super Blast Ampoule'],
  'Anua|Orthotamin Vitamin C Ampoule': ['Mommycare', 'Orthotamin Vitamin C Ampoule'],
  'Banila Co|The phi Sunflower Cleansing Oil': ['The Phi', 'Sunflower Cleansing Oil'],
}
{
  const still = []
  for (const x of left.no_alignment_no_known_brand) {
    const hand = BY_HAND[`${x.stored_brand}|${x.stored_name}`]
    if (!hand) { still.push(x); continue }
    const [brand, name] = hand
    if (existing.has(`${norm(brand)}|${norm(name)}`)) { left.would_duplicate.push({ ...x, true_brand: brand, new_name: name }); continue }
    fix.push({ ...x, shape: 'hand', true_brand: brand, new_name: name })
  }
  left.no_alignment_no_known_brand = still
}
// Two fixes must never land on the same brand + name.
{
  const taken = new Set()
  for (let i = fix.length - 1; i >= 0; i--) {
    const k = `${norm(fix[i].true_brand)}|${norm(fix[i].new_name)}`
    if (taken.has(k)) { left.would_duplicate.push(fix[i]); fix.splice(i, 1) } else taken.add(k)
  }
}

console.log(`candidates still filed under a wrong brand: ${candidates.length}`)
console.log(`WILL FIX: ${fix.length} (shape A ${fix.filter((f) => f.shape === 'A').length}, shape B ${fix.filter((f) => f.shape === 'B').length})`)
for (const [k, v] of Object.entries(left)) console.log(`  left alone, ${k}: ${v.length}`)
console.log('\nALL FIXES:')
for (const f of fix) console.log(`  [${f.shape}] ${f.stored_brand} | ${f.stored_name}  =>  ${f.true_brand} | ${f.new_name}`)
console.log('\nLEFT ALONE (no brand could be established):')
for (const x of left.no_alignment_no_known_brand) console.log(`  ${x.stored_brand} | ${x.stored_name}  <=  ${x.scraped_title}`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportPath = new URL(`./wrong-brand-feb19-pass2-${APPLY ? 'applied' : 'dryrun'}-${stamp}.json`, import.meta.url).pathname
writeFileSync(reportPath, JSON.stringify({ taken_at: new Date().toISOString(), applied: APPLY, fix, left }, null, 2))
console.log(`\nfull list written: ${reportPath}`)
if (!APPLY) { console.log('Dry run. Nothing written.'); process.exit(0) }

let written = 0
const failed = []
for (const f of fix) {
  const { data, error } = await db
    .from('ss_products')
    .update({ brand_en: f.true_brand, name_en: f.new_name })
    .eq('id', f.id)
    .eq('brand_en', f.stored_brand)
    .eq('name_en', f.stored_name)
    .select('id')
  if (error) failed.push(`${f.id}: ${error.message}`)
  else if (!data || data.length !== 1) failed.push(`${f.id}: row changed since it was read, not written`)
  else written++
}
console.log(`written: ${written} of ${fix.length}`)
for (const m of failed) console.log(' - ' + m)
process.exit(failed.length ? 1 : 0)
