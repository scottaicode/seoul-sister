/**
 * Builds ss-product-link-replacements.json: links that name a product but open
 * the general products page, pointed at the product's own page. The map below
 * was read by hand against the catalog on Nov 18 2026. Writes no database rows.
 *
 *   npx tsx scripts/build-product-link-replacements.ts
 */
import './load-env'
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getServiceClient } from '../src/lib/supabase'

const md5 = (s: string) => createHash('md5').update(s).digest('hex')
const GENERIC = '](https://www.seoulsister.com/products)'
/** link text -> product id. Text with no catalog row is left out on purpose. */
const MAP: Record<string, string> = {
  'Klairs Supple Preparation Unscented Toner': 'f60cfa78-383b-4a94-b117-b7b3799987eb',
  'Supple Preparation Unscented Toner': 'f60cfa78-383b-4a94-b117-b7b3799987eb',
  'Bioderma Sensibio H2O': '1ad9fa3f-76e2-4f24-9569-b91dab00b22e',
  'Sensibio H2O': '1ad9fa3f-76e2-4f24-9569-b91dab00b22e',
  'Illiyoon Ceramide Ato Foam Cleanser': '38c35323-f9ae-4897-8b46-5000db9bfa02',
  'SoonJung pH 5.5 Relief Toner': '342f9f81-5567-4b27-8c1d-f1108abdbc05',
  'Madeca Cream Time Reverse': 'ecabf893-ff7e-47db-84c8-4b5d799d196e',
  'Bakuchiol Plumping Serum': 'aee7f495-8e67-4592-bdda-b3c66093621c',
  'Pine Calming Cica Ampoule': '4256b1cd-49d8-48f7-95be-dc76a25f75a8',
}

async function main() {
  const db = getServiceClient()
  const { data: ids, error: idErr } = await db.from('ss_products').select('id').in('id', [...new Set(Object.values(MAP))])
  if (idErr) throw new Error(idErr.message)
  if (ids?.length !== new Set(Object.values(MAP)).size) throw new Error('a mapped product id is not in the catalog')
  const { data: posts, error } = await db.from('ss_content_posts').select('slug, body').not('published_at', 'is', null).order('slug')
  if (error) throw new Error(error.message)
  const replacements: Array<{ slug: string; field: string; finding: string; old: string; new: string }> = []
  const fingerprints: Record<string, { content: { md5_before: string; md5_after: string } }> = {}
  const left: string[] = []
  for (const post of posts ?? []) {
    const before = post.body as string
    let body = before
    for (const m of before.matchAll(/\[([^\]]+)\]\(https:\/\/www\.seoulsister\.com\/products\)/g)) {
      const text = m[1]
      const id = MAP[text]
      if (!id) { if (!/database|price|product pages/i.test(text)) left.push(`${post.slug}: ${text}`); continue }
      const link = `[${text}${GENERIC}`
      // Take just enough of the text before the link to make this occurrence unique in the body as it stands.
      const at = body.indexOf(link)
      let lead = 0
      while (body.split(body.slice(at - lead, at + link.length)).length - 1 !== 1) { lead += 10; if (lead > 400) throw new Error(`${post.slug}: cannot make "${text}" unique`) }
      const old = body.slice(at - lead, at + link.length)
      const neu = old.slice(0, lead) + `[${text}](https://www.seoulsister.com/products/${id})`
      replacements.push({ slug: post.slug as string, field: 'content', finding: 'a link naming a product opened the general products page', old, new: neu })
      body = body.replace(old, () => neu)
    }
    if (body !== before) fingerprints[post.slug as string] = { content: { md5_before: md5(before), md5_after: md5(body) } }
  }
  writeFileSync('ss-product-link-replacements.json', JSON.stringify({
    made_at: '2026-11-18', made_by: 'a Seoul Sister session',
    note: 'Only the link target changes; no visible word does. Each old occurs exactly once at the point it is applied. Apply IN ORDER to the body (LGAAS: content). Products were matched to link text by hand against the catalog on Nov 18 2026. Not changed: links whose text says "product database" or "price comparison" (the products page is the right target), and the one below with no catalog row.',
    left_alone: left, replacements, fingerprints,
  }, null, 2) + '\n')
  console.log(`${replacements.length} links in ${Object.keys(fingerprints).length} posts; left alone: ${left.join(' | ') || 'none'}`)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
