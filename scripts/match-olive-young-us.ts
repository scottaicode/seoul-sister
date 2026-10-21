/**
 * Match catalog products to Olive Young US listings and record their US price.
 *
 * WHY. Olive Young Global stopped shipping to the US on May 29 2026, so most
 * products had no price a US shopper could pay (Oct 21 2026, v11.43.0). This
 * gives the products Yuri is most likely to discuss a real, approximate US price
 * from Olive Young's own US store. The monthly cron keeps matched rows fresh via
 * the store's product feed; DISCOVERY needs this script because the store's
 * search is server-rendered (a browser is required, and it runs from a home IP).
 *
 * CANDIDATES (~650): products in subscribers' libraries and routines, popular
 * products with no price at all (1,000+ reviews), and the most-reviewed
 * products whose only price is Olive Young Global.
 *
 * STRICT. A product is written only when EXACTLY ONE listing is a clean 'match'
 * (brand, every word, identity numbers, pack, count, size, no added words) and
 * no other listing is plausible, OR when a person approved the pair from a prior
 * report (--approve). Everything else is 'needs_review' or 'unmatched' in the
 * report. A confident wrong price is worse than no price.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/match-olive-young-us.ts            # dry run
 *   npx tsx --env-file=.env.local scripts/match-olive-young-us.ts --apply    # write rows
 *   ... --limit 50                                                          # bound the run
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { launchBrowser } from '../src/lib/pipeline/browser'
import {
  fetchOyUsProduct,
  verifyOyUsMatch,
  oyUsSearchQuery,
  OY_US_PRODUCT_URL,
  type OyUsProduct,
} from '../src/lib/pipeline/olive-young-us'

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity
const SEARCH_DELAY_MS = 2500
// --approve <file.json>: [{ "product_id": "...", "oy_us_id": "UA..." }] — pairs a
// person checked by hand from a previous report's needs_review entries.
// --from-report <file.json>: skip searching; re-verify the listings that report
// saw (a rule change re-checks every product in seconds, not an hour) and
// re-read each chosen listing's live price before writing.
const reportArg = process.argv.indexOf('--from-report')
const FROM_REPORT: Map<string, OyUsProduct[]> | null = reportArg > -1
  ? new Map((JSON.parse(readFileSync(process.argv[reportArg + 1], 'utf8')) as Array<{ product_id: string; seen?: OyUsProduct[] }>)
      .map((r) => [r.product_id, r.seen ?? []]))
  : null
const approveArg = process.argv.indexOf('--approve')
const APPROVED = new Map<string, string>(
  approveArg > -1
    ? (JSON.parse(readFileSync(process.argv[approveArg + 1], 'utf8')) as Array<{ product_id: string; oy_us_id: string }>)
        .map((a) => [a.product_id, a.oy_us_id])
    : []
)

interface Candidate { id: string; brand_en: string; name_en: string; volume_display: string | null; why: string }

async function loadCandidates(db: SupabaseClient): Promise<Candidate[]> {
  const cols = 'id, brand_en, name_en, volume_display, review_count'
  const out = new Map<string, Candidate>()
  const add = (rows: Array<Record<string, unknown>> | null, why: string) => {
    for (const r of rows || []) {
      const id = r.id as string
      if (!out.has(id) && r.brand_en && r.name_en) {
        out.set(id, { id, brand_en: r.brand_en as string, name_en: r.name_en as string, volume_display: (r.volume_display as string) ?? null, why })
      }
    }
  }
  const must = <T>(res: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`)
    return res.data as T
  }

  const owned = must(await db.from('ss_user_products').select('product_id').not('product_id', 'is', null), 'owned')
  const routine = must(await db.from('ss_routine_products').select('product_id').not('product_id', 'is', null), 'routine')
  const ownedIds = [...new Set([...(owned as Array<{ product_id: string }>), ...(routine as Array<{ product_id: string }>)].map((r) => r.product_id))]
  if (ownedIds.length) add(must(await db.from('ss_products').select(cols).in('id', ownedIds), 'owned products'), 'subscriber-owned')

  // Every product that already has a price row, paginated (PostgREST caps at 1,000 silently).
  const priced = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from('ss_product_prices').select('product_id').range(from, from + 999), 'priced page') as Array<{ product_id: string }>
    page.forEach((r) => priced.add(r.product_id))
    if (page.length < 1000) break
  }
  const heroes = must(
    await db.from('ss_products').select(cols).gte('review_count', 1000).order('review_count', { ascending: false }).range(0, 999),
    'heroes'
  ) as Array<Record<string, unknown>>
  add(heroes.filter((p) => !priced.has(p.id as string)), 'popular, no price')

  const { data: oyGlobal, error: rErr } = await db.from('ss_retailers').select('id').eq('website', 'https://global.oliveyoung.com').single()
  if (rErr || !oyGlobal) throw new Error(`Olive Young Global retailer: ${rErr?.message}`)
  const globalRows = must(
    await db.from('ss_product_prices').select('product_id').eq('retailer_id', oyGlobal.id).range(0, 4999),
    'global rows'
  ) as Array<{ product_id: string }>
  const globalIds = new Set(globalRows.map((r) => r.product_id))
  const topGlobal = heroes.filter((p) => globalIds.has(p.id as string)).slice(0, 150)
  add(topGlobal, 'top global-only')

  return [...out.values()]
}

async function searchCandidates(page: import('playwright-core').Page, q: string): Promise<string[]> {
  await page.goto(`https://us.oliveyoung.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const hrefs = await page.$$eval('a[href*="/products/UA"]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
  return [...new Set(hrefs.map((h) => h.match(/\/products\/(UA\d+)/)?.[1]).filter((x): x is string => !!x))].slice(0, 8)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  const db = createClient(url, key)

  const { data: oyUs, error: usErr } = await db.from('ss_retailers').select('id').eq('website', 'https://us.oliveyoung.com').single()
  if (usErr || !oyUs) throw new Error(`Olive Young US retailer row not found: ${usErr?.message}`)

  const candidates = (await loadCandidates(db)).slice(0, LIMIT)
  console.log(`${candidates.length} candidates; ${APPLY ? 'APPLY' : 'dry run'}`)

  const browser = FROM_REPORT ? null : await launchBrowser()
  const page = browser
    ? await browser.newPage({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' })
    : null
  if (page) {
    await page.goto('https://us.oliveyoung.com/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
  }

  const feedCache = new Map<string, OyUsProduct | null>()
  const report: Array<Record<string, unknown>> = []
  let matched = 0, written = 0, searchErrors = 0

  for (const [i, c] of candidates.entries()) {
    const q = oyUsSearchQuery(c.brand_en, c.name_en)
    let ids: string[] = []
    if (FROM_REPORT) {
      for (const p of FROM_REPORT.get(c.id) ?? []) feedCache.set(p.id, p)
      ids = (FROM_REPORT.get(c.id) ?? []).map((p) => p.id)
    } else try {
      ids = await searchCandidates(page!, q)
    } catch (e) {
      searchErrors++
      report.push({ product_id: c.id, brand: c.brand_en, name: c.name_en, query: q, result: 'search_error', detail: String(e) })
      continue
    }
    const matches: OyUsProduct[] = []
    const reviews: Array<{ id: string; name: string; price: number | null; note: string }> = []
    const rejects: string[] = []
    const seen: OyUsProduct[] = []
    for (const id of ids) {
      if (!feedCache.has(id)) {
        try { feedCache.set(id, await fetchOyUsProduct(id)) } catch (e) { rejects.push(`${id}: feed error ${String(e)}`); continue }
      }
      const p = feedCache.get(id)
      if (!p) { rejects.push(`${id}: gone`); continue }
      seen.push(p)
      const v = verifyOyUsMatch({ brand: c.brand_en, name: c.name_en, volume: c.volume_display }, p)
      if (v.verdict === 'match') matches.push(p)
      else if (v.verdict === 'review') reviews.push({ id: p.id, name: p.name, price: p.price, note: v.note })
      else if (p.brand && p.brand.toLowerCase().replace(/\W/g, '') === c.brand_en.toLowerCase().replace(/\W/g, '')) rejects.push(`${p.name} -> ${v.reason}`)
    }
    // Exactly one clean match and nothing else plausible. Anything else is a person's call.
    const approved = APPROVED.get(c.id)
    const chosen =
      matches.length === 1 && reviews.length === 0 ? matches[0]
      : approved ? seen.find((p) => p.id === approved) ?? null
      : null
    const result = chosen ? (approved ? 'approved' : 'matched')
      : matches.length + reviews.length > 0 ? 'needs_review' : 'unmatched'
    report.push({
      product_id: c.id, why: c.why, brand: c.brand_en, name: c.name_en, volume: c.volume_display, query: q, result,
      match: chosen ? { id: chosen.id, name: chosen.name, price: chosen.price, in_stock: chosen.inStock } : null,
      candidates: [...matches.map((m) => ({ id: m.id, name: m.name, price: m.price, note: 'exact' })), ...reviews],
      rejects: rejects.slice(0, 4),
      seen,
    })
    if (chosen) {
      matched++
      // Fresh read of the chosen listing right before writing, and re-verify it:
      // a saved report can be hours old.
      const fresh = APPLY ? await fetchOyUsProduct(chosen.id) : chosen
      if (!fresh) { report[report.length - 1].result = 'gone_before_write'; continue }
      if (!approved && verifyOyUsMatch({ brand: c.brand_en, name: c.name_en, volume: c.volume_display }, fresh).verdict !== 'match') {
        report[report.length - 1].result = 'changed_before_write'
        continue
      }
      const m = fresh
      if (APPLY) {
        // Re-run safe: never a second Olive Young US row for the same product.
        const { data: existing, error: exErr } = await db.from('ss_product_prices').select('id')
          .eq('product_id', c.id).eq('retailer_id', oyUs.id).maybeSingle()
        if (exErr) throw new Error(`existing-row check failed for ${c.id}: ${exErr.message}`)
        if (!existing) {
          const { error } = await db.from('ss_product_prices').insert({
            product_id: c.id, retailer_id: oyUs.id, price_usd: m.price, url: `${OY_US_PRODUCT_URL}${m.id}`,
            in_stock: m.inStock, last_checked: new Date().toISOString(),
          })
          if (error) throw new Error(`insert failed for ${c.id}: ${error.message}`)
          written++
        }
      }
    }
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${candidates.length}  matched ${matched}  written ${written}  search errors ${searchErrors}`)
    if (page) await page.waitForTimeout(SEARCH_DELAY_MS)
  }
  if (browser) await browser.close()

  const file = `scripts/match-olive-young-us-${APPLY ? 'apply' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(file, JSON.stringify(report, null, 2))
  const by = (r: string) => report.filter((x) => x.result === r).length
  console.log(`done: ${candidates.length} candidates | matched ${by('matched')} | approved ${by('approved')} | needs review ${by('needs_review')} | unmatched ${by('unmatched')} | search errors ${by('search_error')} | written ${written}`)
  console.log(`report: ${file}`)
  // A run where every search failed must not look like "nothing matched".
  if (searchErrors > candidates.length / 2) {
    console.error('More than half of searches failed — treat this run as FAILED, not as "no matches".')
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
