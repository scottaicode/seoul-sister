/**
 * Lists every star rating or review count quoted in a published blog post and
 * checks it against the catalog. Read-only. A figure is "held" when a catalog
 * product named in the same sentence carries that count (within 3%) and, when
 * a star rating is quoted, that rating.
 *
 *   npx tsx scripts/audit-blog-review-figures.ts [out.json]
 */
import './load-env'
import { writeFileSync } from 'node:fs'
import { getServiceClient } from '../src/lib/supabase'

type Product = { id: string; brand_en: string; name_en: string; rating_avg: number | null; review_count: number | null }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

async function all<T>(table: string, cols: string, filter?: (q: any) => any): Promise<T[]> {
  const db = getServiceClient()
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).order('id').range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  const posts = await all<{ id: string; slug: string; body: string }>('ss_content_posts', 'id, slug, body', (q) => q.not('published_at', 'is', null))
  const products = await all<Product>('ss_products', 'id, brand_en, name_en, rating_avg, review_count')
  console.log(`posts ${posts.length}, catalog products ${products.length}`)
  const FIG = /(?:(\d\.\d)\s*(?:stars?|★)[^.\n]{0,40}?)?(?:roughly|about|around|over|nearly|more than|~)?\s*([\d,]{2,})\+?\s*reviews|(\d\.\d)\s*(?:stars?|★|out of 5)/gi
  const rows: Array<Record<string, unknown>> = []
  for (const post of posts) {
    for (const m of post.body.matchAll(FIG)) {
      const at = m.index ?? 0
      // The sentence or list item the figure sits in.
      const start = Math.max(post.body.lastIndexOf('\n', at), post.body.lastIndexOf('. ', at - 1)) + 1
      const endDot = post.body.indexOf('. ', at + m[0].length)
      const endNl = post.body.indexOf('\n', at + m[0].length)
      const end = Math.min(...[endDot >= 0 ? endDot + 1 : Infinity, endNl >= 0 ? endNl : Infinity, post.body.length])
      const sentence = post.body.slice(start, end).trim()
      const stars = m[1] ?? m[3] ?? null
      const count = m[2] ? Number(m[2].replace(/,/g, '')) : null
      const s = norm(sentence)
      const named = products.filter((p) => p.brand_en && s.includes(norm(p.brand_en)) && norm(p.name_en).split(' ').filter((w) => w.length > 3).filter((w) => s.includes(w)).length >= Math.min(2, norm(p.name_en).split(' ').filter((w) => w.length > 3).length))
      const held = named.filter((p) => (count === null || (p.review_count != null && p.review_count > 0 && Math.abs(p.review_count - count) / count <= 0.03)) && (stars === null || (p.rating_avg != null && Number(p.rating_avg).toFixed(1) === stars)))
      rows.push({ slug: post.slug, figure: m[0].trim(), stars, count, held: held.length > 0, held_by: held.slice(0, 2).map((p) => `${p.brand_en} ${p.name_en} (${p.rating_avg ?? '-'} / ${p.review_count ?? 0})`), named: named.slice(0, 4).map((p) => `${p.brand_en} ${p.name_en} (${p.rating_avg ?? '-'} / ${p.review_count ?? 0})`), sentence })
    }
  }
  const bySlug = new Map<string, { n: number; held: number }>()
  for (const r of rows) { const e = bySlug.get(r.slug as string) ?? { n: 0, held: 0 }; e.n++; if (r.held) e.held++; bySlug.set(r.slug as string, e) }
  console.log(`figures found: ${rows.length} in ${bySlug.size} posts; held by the catalog: ${rows.filter((r) => r.held).length}`)
  for (const [slug, e] of [...bySlug].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(e.n).padStart(3)} figures, ${String(e.held).padStart(2)} held  ${slug}`)
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows, null, 1))
}
main().catch((e) => { console.error(e); process.exit(1) })
