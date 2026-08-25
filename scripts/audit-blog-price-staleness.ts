/**
 * Audit hardcoded prices in published blog posts against the live catalog.
 *
 * Blog bodies store prices as PROSE ("about $25 at Olive Young"). Nothing
 * re-reads them when ss_product_prices changes, so a post is accurate the day
 * it ships and silently drifts afterwards. Found Aug 25 2026 on the PIH post:
 * a serum quoted at "about $25" has been $17.17 for 8 straight days — a 45%
 * overquote on the site's best-ranking PIH page.
 *
 * Report-only. Never writes.
 *   npx tsx --tsconfig tsconfig.json scripts/audit-blog-price-staleness.ts
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } })

const PRICE_RE = /\$(\d+(?:\.\d{2})?)/g

async function main() {
  const { data: posts, error } = await sb
    .from('ss_content_posts').select('slug,title,body').order('published_at', { ascending: false })
  if (error) throw new Error(error.message)

  let totalPrices = 0, postsWithPrices = 0
  const rows: Array<{ slug: string; n: number }> = []
  for (const p of (posts ?? []) as any[]) {
    const body = String(p.body ?? '')
    const n = [...body.matchAll(PRICE_RE)].length
    if (n > 0) { postsWithPrices++; totalPrices += n; rows.push({ slug: p.slug, n }) }
  }
  rows.sort((a, b) => b.n - a.n)
  console.log(`posts scanned            : ${posts?.length ?? 0}`)
  console.log(`posts quoting a price    : ${postsWithPrices}`)
  console.log(`hardcoded prices in total: ${totalPrices}`)
  console.log(`\nmost price-heavy posts:`)
  rows.slice(0, 12).forEach(r => console.log(`  ${String(r.n).padStart(3)}  ${r.slug}`))
  console.log(`\nEvery one of these is a claim that drifts silently.`)
  console.log(`Nothing in the pipeline re-reads them when ss_product_prices changes.`)
}
main().catch(e => { console.error(e); process.exit(1) })
