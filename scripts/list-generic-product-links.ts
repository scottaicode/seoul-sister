/**
 * Lists every link in a published post that names a product but points at the
 * general products page, with the catalog rows its text could mean. Read-only.
 *
 * A link is "certain" when exactly one catalog product has its whole name in the
 * link text (or the text in its name) AND its brand appears in the link text or
 * just before it. Variants of one product (sets, sizes) are not certain: the
 * shortest-named one is offered as a suggestion only.
 *
 *   npx tsx scripts/list-generic-product-links.ts [out.json]
 */
import './load-env'
import { writeFileSync } from 'node:fs'
import { getServiceClient } from '../src/lib/supabase'

type Product = { id: string; brand_en: string; name_en: string; review_count: number | null }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

async function main() {
  const db = getServiceClient()
  const products: Product[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('ss_products').select('id, brand_en, name_en, review_count').order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    products.push(...((data ?? []) as Product[]))
    if (!data || data.length < 1000) break
  }
  const { data: posts, error } = await db.from('ss_content_posts').select('slug, body').not('published_at', 'is', null)
  if (error) throw new Error(error.message)
  const out: Array<Record<string, unknown>> = []
  const re = /\[([^\]]+)\]\(https:\/\/www\.seoulsister\.com\/products\)/g
  for (const post of posts ?? []) {
    const body = post.body as string
    for (const m of body.matchAll(re)) {
      const text = m[1]
      const before = body.slice(Math.max(0, (m.index ?? 0) - 80), m.index ?? 0)
      const t = norm(text)
      const ctx = norm(before + ' ' + text)
      const hits = products.filter((p) => {
        const name = norm(p.name_en)
        const brand = norm(p.brand_en)
        if (name.length < 6 || !brand) return false
        const nameHit = t.includes(name) || (t.replace(brand, '').trim().length >= 8 && name.includes(t.replace(brand, '').trim()))
        return nameHit && ctx.includes(brand)
      })
      const exact = hits.filter((p) => t.includes(norm(p.name_en)))
      const pool = exact.length ? exact : hits
      const longest = Math.max(0, ...pool.map((p) => norm(p.name_en).length))
      const best = pool.filter((p) => norm(p.name_en).length === longest)
      out.push({
        slug: post.slug,
        text,
        before: before.slice(-50),
        certain: exact.length > 0 && best.length === 1,
        pick: best.length === 1 ? best[0] : null,
        candidates: hits.slice(0, 6).map((p) => `${p.brand_en} | ${p.name_en} | ${p.review_count} | ${p.id}`),
      })
    }
  }
  const certain = out.filter((o) => o.certain).length
  console.log(`${out.length} generic product links in ${new Set(out.map((o) => o.slug)).size} posts; certain match: ${certain}`)
  for (const o of out) console.log(`${o.certain ? 'OK ' : '?? '} ${String(o.text).slice(0, 60).padEnd(60)} -> ${o.pick ? `${(o.pick as Product).brand_en} | ${(o.pick as Product).name_en}` : `(${(o.candidates as string[]).length} candidates)`}`)
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
}
main().catch((e) => { console.error(e.message); process.exit(1) })
